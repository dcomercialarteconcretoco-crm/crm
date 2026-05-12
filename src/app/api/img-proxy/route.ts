import { NextRequest, NextResponse } from 'next/server';

// Proxy de imágenes para el generador del PDF.
//
// Problema: las imágenes de los productos viven en arteconcreto.co
// (WooCommerce). Cuando el PDF se genera en el browser, hace `fetch(url)`
// directo a la URL del producto — y el servidor de Woo no incluye
// `Access-Control-Allow-Origin` para el dominio del CRM. CORS bloquea
// la respuesta y la imagen nunca llega al PDF (resultado: tabla con
// columna IMAGEN vacía, reportado 7-may-2026 "LAS IMAGENES SIGUEN SIN
// APARECER!!! INCRUSTALAS NO SE!!!!").
//
// Solución: el browser pega contra este endpoint, este endpoint corre
// en server (Vercel) y trae la imagen sin restricciones de origen. La
// devuelve con headers CORS abiertos al CRM y cacheada 1h.

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
        const r = await fetch(target, {
            // Algunos CDNs y WAFs bloquean User-Agents desconocidos.
            headers: { 'User-Agent': 'Mozilla/5.0 ArteConcretoCRM/1.0' },
            // Sin "cache: no-store" — queremos que Vercel haga su propio cache HTTP.
        });
        if (!r.ok) {
            return NextResponse.json({ error: `upstream ${r.status}` }, { status: r.status });
        }

        const ct = r.headers.get('content-type') || 'image/jpeg';
        // jspdf addImage admite JPEG, PNG, GIF (limitado). Si llega WEBP o AVIF,
        // el browser igual no lo va a poder agregar al PDF — devolvemos 415 para
        // que el cliente lo skipee en silencio en vez de mostrar un placeholder roto.
        if (!/^image\/(jpe?g|png|gif)/i.test(ct)) {
            return NextResponse.json({ error: `unsupported content-type ${ct}` }, { status: 415 });
        }

        const buf = await r.arrayBuffer();
        return new NextResponse(buf, {
            headers: {
                'Content-Type': ct,
                'Cache-Control': 'public, max-age=3600',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'proxy error' }, { status: 500 });
    }
}
