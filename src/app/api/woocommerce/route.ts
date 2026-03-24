import { NextRequest, NextResponse } from 'next/server';

function getCredentials(req: NextRequest) {
    // Priority: env vars > request headers (passed from client settings)
    const url = process.env.WOOCOMMERCE_URL || req.headers.get('x-woo-url') || '';
    const key = process.env.WOOCOMMERCE_KEY || req.headers.get('x-woo-key') || '';
    const secret = process.env.WOOCOMMERCE_SECRET || req.headers.get('x-woo-secret') || '';
    return { url, key, secret };
}

/** Build a WooCommerce URL with auth as query params (avoids Authorization header being stripped by hosting) */
function wooUrl(base: string, path: string, key: string, secret: string, extra?: Record<string, string>) {
    const params = new URLSearchParams({ consumer_key: key, consumer_secret: secret, ...extra });
    return `${base.replace(/\/$/, '')}${path}?${params.toString()}`;
}

export async function GET(req: NextRequest) {
    const { url, key, secret } = getCredentials(req);

    if (!url || !key || !secret) {
        return NextResponse.json({
            error: 'Credenciales de WooCommerce no configuradas. Ve a Configuración → Integraciones API y completa la URL, Consumer Key y Consumer Secret de tu tienda.'
        }, { status: 400 });
    }

    try {
        const response = await fetch(
            wooUrl(url, '/wp-json/wc/v3/products', key, secret, { per_page: '100', status: 'publish' }),
            { method: 'GET', headers: { 'Content-Type': 'application/json' }, cache: 'no-store' }
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`WooCommerce respondió con error ${response.status}: ${errText.slice(0, 200)}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const { url, key, secret } = getCredentials(req);
    if (!url || !key || !secret) {
        return NextResponse.json({ error: 'Credenciales de WooCommerce no configuradas.' }, { status: 400 });
    }

    try {
        const body = await req.json();
        const response = await fetch(
            wooUrl(url, '/wp-json/wc/v3/products', key, secret),
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`WooCommerce API Error: ${errText}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const { url, key, secret } = getCredentials(req);
    if (!url || !key || !secret) {
        return NextResponse.json({ error: 'Credenciales de WooCommerce no configuradas.' }, { status: 400 });
    }

    try {
        const reqUrl = new URL(req.url);
        const id = reqUrl.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing product ID' }, { status: 400 });

        const body = await req.json();
        const response = await fetch(
            wooUrl(url, `/wp-json/wc/v3/products/${id}`, key, secret),
            { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`WooCommerce API Error: ${errText}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const { url, key, secret } = getCredentials(req);
    if (!url || !key || !secret) {
        return NextResponse.json({ error: 'Credenciales de WooCommerce no configuradas.' }, { status: 400 });
    }

    try {
        const reqUrl = new URL(req.url);
        const id = reqUrl.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing product ID' }, { status: 400 });

        const response = await fetch(
            wooUrl(url, `/wp-json/wc/v3/products/${id}`, key, secret, { force: 'true' }),
            { method: 'DELETE', headers: { 'Content-Type': 'application/json' } }
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`WooCommerce API Error: ${errText}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
