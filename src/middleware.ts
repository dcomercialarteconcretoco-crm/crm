import { NextRequest, NextResponse } from 'next/server';
import { parseSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth-session';

/**
 * API routes that don't require a session token.
 * Everything else under /api/ requires a valid crm_session cookie.
 */
const PUBLIC_API_PREFIXES = [
    '/api/auth/',                // Login, logout, me, forgot/reset-password
    '/api/public/',              // Public quote-request form (WordPress widget)
    '/api/biolinks/lead',        // Lead form on public /b/[slug] pages
    '/api/whatsapp/',            // WhatsApp webhook (has its own verify token)
    '/api/woocommerce',          // Product catalog — also used by /public/cotizar
    '/api/logo',                 // Logo proxy — public asset
    '/api/assistant',            // ConcreBOT public chat (Gemini proxy, no PII leaks)
    '/api/conversations',        // Widget chat storage — upserts clients with RR assign
    '/api/agenda/reminders',     // Vercel Cron — protegido internamente por x-vercel-cron header + CRON_SECRET
    '/api/daily-report/cron',    // Vercel Cron — protegido internamente por x-vercel-cron header + CRON_SECRET
];

/** POST /api/clients/<id>/attachments/upload — ver el comentario en middleware() */
const ATTACHMENT_UPLOAD_RE = /^\/api\/clients\/[^/]+\/attachments\/upload$/;

/** Mobile UA keywords — redirect to /m on these devices */
const MOBILE_UA_RE = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

/** Pages that should never trigger mobile redirect */
const NO_REDIRECT = ['/login', '/reset-password', '/public', '/b/', '/widget', '/m', '/api'];

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // ── Mobile auto-redirect ─────────────────────────────────────────────────
    // Redirect mobile browsers from the root CRM to /m (light mobile UI)
    if (
        !pathname.startsWith('/api/') &&
        !NO_REDIRECT.some(p => pathname.startsWith(p)) &&
        pathname === '/'                              // only from homepage for now
    ) {
        const ua = req.headers.get('user-agent') ?? '';
        if (MOBILE_UA_RE.test(ua)) {
            return NextResponse.redirect(new URL('/m', req.url));
        }
    }

    // Only guard API routes
    if (!pathname.startsWith('/api/')) return NextResponse.next();

    // Allow explicitly public APIs
    if (PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
        return NextResponse.next();
    }

    // Emisión de URLs prefirmadas de adjuntos — SOLO el POST. Lo llaman dos
    // clientes: el navegador del asesor (que sí trae cookie) y Vercel Blob
    // avisando que la subida terminó (que NO puede traerla). Si exigiéramos
    // sesión acá, ese callback moriría en 401 y la fila nunca se escribiría.
    // La ruta autentica por dentro: sesión fresca para emitir el token, firma
    // del webhook contra BLOB_WEBHOOK_PUBLIC_KEY para el callback.
    if (req.method === 'POST' && ATTACHMENT_UPLOAD_RE.test(pathname)) {
        return NextResponse.next();
    }

    // Validate session cookie
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const user = await parseSessionToken(token);

    if (!user) {
        return NextResponse.json(
            { error: 'No autorizado. Inicia sesión primero.' },
            { status: 401 }
        );
    }

    // Attach user info as header for routes that need it
    const res = NextResponse.next();
    res.headers.set('x-crm-user-id', user.id);
    res.headers.set('x-crm-user-role', user.role);
    return res;
}

export const config = {
    matcher: ['/', '/api/:path*'],
};
