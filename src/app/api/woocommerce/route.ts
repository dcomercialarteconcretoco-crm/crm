import { NextRequest, NextResponse } from 'next/server';

function getCredentials(req: NextRequest) {
    const url = process.env.WOOCOMMERCE_URL || req.headers.get('x-woo-url') || '';
    const key = process.env.WOOCOMMERCE_KEY || req.headers.get('x-woo-key') || '';
    const secret = process.env.WOOCOMMERCE_SECRET || req.headers.get('x-woo-secret') || '';
    return { url, key, secret };
}

/**
 * WooCommerce REST expects EITHER Basic Auth OR query params, not both.
 * We use Basic Auth over HTTPS — the standard recommended method.
 */
function wooUrl(base: string, path: string, extra?: Record<string, string>) {
    const qs = extra ? `?${new URLSearchParams(extra).toString()}` : '';
    return `${base.replace(/\/$/, '')}${path}${qs}`;
}

function authHeader(key: string, secret: string) {
    return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
}

function describeError(err: unknown): string {
    if (!err) return 'unknown';
    const e = err as { message?: string; name?: string; cause?: { code?: string; message?: string; errno?: number } };
    const parts: string[] = [];
    if (e.name) parts.push(e.name);
    if (e.message) parts.push(e.message);
    if (e.cause?.code) parts.push(`code=${e.cause.code}`);
    if (e.cause?.errno) parts.push(`errno=${e.cause.errno}`);
    if (e.cause?.message && e.cause.message !== e.message) parts.push(e.cause.message);
    return parts.join(' · ') || String(err);
}

async function wooFetch(
    baseUrl: string,
    path: string,
    key: string,
    secret: string,
    init: RequestInit = {},
    extraQuery?: Record<string, string>
): Promise<Response> {
    // Up to 3 attempts with exponential backoff for transient network failures (ECONNRESET,
    // ETIMEDOUT, upstream cold-start). Abort each attempt at 25s so we fail loud instead of
    // hanging the serverless function.
    const MAX_ATTEMPTS = 3;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25_000);
        try {
            const res = await fetch(wooUrl(baseUrl, path, extraQuery), {
                ...init,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader(key, secret),
                    'User-Agent': 'CRM-ArteConcreto/1.1',
                    ...(init.headers || {}),
                },
                cache: 'no-store',
                signal: controller.signal,
            });
            clearTimeout(timeout);
            // Retry only on 502/503/504 (transient upstream). 4xx are real errors — bubble immediately.
            if (attempt < MAX_ATTEMPTS && [502, 503, 504].includes(res.status)) {
                console.warn(`WooCommerce upstream ${res.status} on attempt ${attempt}, retrying…`);
                lastError = new Error(`upstream ${res.status}`);
                await new Promise(r => setTimeout(r, 500 * attempt));
                continue;
            }
            return res;
        } catch (err) {
            clearTimeout(timeout);
            lastError = err;
            if (attempt < MAX_ATTEMPTS) {
                console.warn(`WooCommerce fetch attempt ${attempt} failed: ${describeError(err)}. Retrying…`);
                await new Promise(r => setTimeout(r, 500 * attempt));
                continue;
            }
            throw err;
        }
    }
    throw lastError;
}

export async function GET(req: NextRequest) {
    const { url, key, secret } = getCredentials(req);

    if (!url || !key || !secret) {
        return NextResponse.json(
            {
                error: 'Credenciales de WooCommerce no configuradas. Ve a Configuración → Integraciones API y completa la URL, Consumer Key y Consumer Secret de tu tienda.',
            },
            { status: 400 }
        );
    }

    try {
        // Paginate: WooCommerce returns X-WP-TotalPages header. Stop at 10 pages (1000 products) as safety.
        const MAX_PAGES = 10;
        const all: any[] = [];
        let totalPages = 1;

        for (let page = 1; page <= MAX_PAGES; page++) {
            const res = await wooFetch(url, '/wp-json/wc/v3/products', key, secret, { method: 'GET' }, {
                per_page: '100',
                status: 'publish',
                page: String(page),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`WooCommerce ${res.status}: ${errText.slice(0, 200)}`);
            }

            const batch = await res.json();
            if (!Array.isArray(batch)) {
                throw new Error('Respuesta inválida de WooCommerce (esperaba un array de productos)');
            }
            all.push(...batch);

            // Read the total pages header on the first request
            if (page === 1) {
                const header = res.headers.get('x-wp-totalpages');
                totalPages = header ? Math.min(parseInt(header, 10) || 1, MAX_PAGES) : 1;
            }
            if (page >= totalPages || batch.length === 0) break;
        }

        return NextResponse.json(all);
    } catch (error: any) {
        const isAbort = error?.name === 'AbortError';
        const msg = isAbort
            ? 'La petición a WooCommerce tardó demasiado (timeout). Revisa que tu tienda responda.'
            : error.message || 'Error sincronizando con WooCommerce';
        console.error('WooCommerce GET error:', error);
        return NextResponse.json({ error: msg }, { status: isAbort ? 504 : 500 });
    }
}

export async function POST(req: NextRequest) {
    const { url, key, secret } = getCredentials(req);
    if (!url || !key || !secret) {
        return NextResponse.json({ error: 'Credenciales de WooCommerce no configuradas.' }, { status: 400 });
    }

    try {
        const body = await req.json();
        const res = await wooFetch(url, '/wp-json/wc/v3/products', key, secret, {
            method: 'POST',
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`WooCommerce ${res.status}: ${errText.slice(0, 300)}`);
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('WooCommerce POST error:', error);
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
        const res = await wooFetch(url, `/wp-json/wc/v3/products/${id}`, key, secret, {
            method: 'PUT',
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`WooCommerce ${res.status}: ${errText.slice(0, 300)}`);
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('WooCommerce PUT error:', error);
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

        const res = await wooFetch(url, `/wp-json/wc/v3/products/${id}`, key, secret,
            { method: 'DELETE' },
            { force: 'true' }
        );

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`WooCommerce ${res.status}: ${errText.slice(0, 300)}`);
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('WooCommerce DELETE error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
