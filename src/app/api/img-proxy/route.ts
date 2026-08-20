import { NextRequest, NextResponse } from 'next/server';

// Proxy de imágenes para el generador del PDF.
//
// Problema original: las imágenes de los productos viven en arteconcreto.co
// (WooCommerce). Cuando el PDF se genera en el browser, hace `fetch(url)`
// directo a la URL del producto — y el servidor de Woo no incluye
// `Access-Control-Allow-Origin` para el dominio del CRM. CORS bloquea
// la respuesta y la imagen nunca llega al PDF (resultado: tabla con
// columna IMAGEN vacía, reportado 7-may-2026 "LAS IMAGENES SIGUEN SIN
// APARECER!!! INCRUSTALAS NO SE!!!!").
//
// Round 2 (20-ago-2026, "algunas cotizaciones se están generando sin
// imagen"): arteconcreto.co quedó detrás de Cloudflare con bot management
// (cookie __cf_bm). Las requests salen de IPs de datacenter de Vercel y el
// User-Agent viejo ("ArteConcretoCRM/1.0") canta bot — Cloudflare las reta o
// bloquea de forma intermitente y el PDF sale sin las imágenes de catálogo
// (las personalizadas /api/quote-images no salen de Vercel y por eso sí se
// ven). Endurecimiento:
//   1. Headers de navegador real (UA Chrome + Accept de imagen + Referer del
//      propio sitio) — es el CRM del cliente pidiendo imágenes del sitio del
//      MISMO cliente; si Cloudflare sigue molestando, la solución de fondo es
//      una regla WAF en su panel que permita /wp-content/uploads/*.
//   2. Reintento con headers mínimos si el primer intento falla.
//   3. sharp re-encoda TODO a PNG ≤600px: convierte WEBP/AVIF (antes 415 y
//      celda vacía), normaliza PNGs entrelazados que jspdf no decodifica, y
//      baja PNGs de 1,6 MB a decenas de KB (PDF más liviano y rápido).
//   4. console.error con status upstream — queda en los logs de Vercel para
//      diagnosticar sin adivinar la próxima vez.

const BROWSER_HEADERS: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
};

async function fetchUpstream(target: string, referer: string): Promise<Response> {
    const first = await fetch(target, {
        headers: { ...BROWSER_HEADERS, Referer: referer },
        redirect: 'follow',
        // Sin "cache: no-store" — queremos que Vercel haga su propio cache HTTP.
    });
    if (first.ok) return first;
    // Segundo intento con la firma mínima — algunos WAF castigan una
    // combinación de headers y dejan pasar otra.
    return fetch(target, {
        headers: { 'User-Agent': BROWSER_HEADERS['User-Agent'], 'Accept': '*/*' },
        redirect: 'follow',
    });
}

export async function GET(req: NextRequest) {
    const target = req.nextUrl.searchParams.get('url');
    if (!target) {
        return NextResponse.json({ error: 'url query param required' }, { status: 400 });
    }

    // Validación mínima del URL — evita SSRF abriendo solo http(s).
    let parsed: URL;
    try {
        parsed = new URL(target);
    } catch {
        return NextResponse.json({ error: 'invalid url' }, { status: 400 });
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return NextResponse.json({ error: 'protocol not allowed' }, { status: 400 });
    }

    try {
        const r = await fetchUpstream(target, `${parsed.origin}/`);
        const ct = (r.headers.get('content-type') || '').toLowerCase();
        if (!r.ok || !ct.startsWith('image/')) {
            // Un 403/503 con HTML acá = challenge del WAF/Cloudflare del sitio.
            console.error(`[img-proxy] upstream falló: ${r.status} content-type=${ct || '?'} url=${target}`);
            return NextResponse.json(
                { error: `upstream ${r.status}${ct && !ct.startsWith('image/') ? ` (${ct})` : ''}` },
                { status: r.ok ? 415 : r.status }
            );
        }

        const buf = Buffer.from(await r.arrayBuffer());

        // Re-encodar SIEMPRE a PNG ≤600px con sharp: unifica formato (webp/avif
        // incluidos), elimina PNG entrelazado y recorta peso. Si sharp no puede
        // (SVG raro, buffer corrupto), caemos al passthrough de siempre para
        // los formatos que jspdf sí soporta.
        try {
            const sharp = (await import('sharp')).default;
            const png = await sharp(buf, { limitInputPixels: 50_000_000 })
                .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
                .flatten({ background: '#ffffff' })
                .png({ compressionLevel: 9 })
                .toBuffer();
            return new NextResponse(new Uint8Array(png), {
                headers: {
                    'Content-Type': 'image/png',
                    'Cache-Control': 'public, max-age=3600',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        } catch (sharpErr) {
            console.error('[img-proxy] sharp no pudo convertir, passthrough:', (sharpErr as Error)?.message, target);
            if (!/^image\/(jpe?g|png|gif)/i.test(ct)) {
                return NextResponse.json({ error: `unsupported content-type ${ct}` }, { status: 415 });
            }
            return new NextResponse(new Uint8Array(buf), {
                headers: {
                    'Content-Type': ct,
                    'Cache-Control': 'public, max-age=3600',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }
    } catch (err: any) {
        console.error('[img-proxy] error de red:', err?.message, target);
        return NextResponse.json({ error: err?.message || 'proxy error' }, { status: 500 });
    }
}
