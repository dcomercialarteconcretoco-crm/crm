import { NextRequest, NextResponse } from 'next/server';
import { parseSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth-session';

/**
 * API routes that don't require a session token.
 * Everything else under /api/ requires a valid crm_session cookie.
 */
const PUBLIC_API_PREFIXES = [
    '/api/auth/',           // Login, logout, me, forgot/reset-password
    '/api/public/',         // Public quote-request form (WordPress widget)
    '/api/biolinks/lead',   // Lead form on public /b/[slug] pages
    '/api/whatsapp/',       // WhatsApp webhook (has its own verify token)
    '/api/woocommerce',     // Product catalog — also used by /public/cotizar
    '/api/logo',            // Logo proxy — public asset
];

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Only guard API routes
    if (!pathname.startsWith('/api/')) return NextResponse.next();

    // Allow explicitly public APIs
    if (PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
        return NextResponse.next();
    }

    // Validate session cookie
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const user = parseSessionToken(token);

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
    matcher: '/api/:path*',
};
