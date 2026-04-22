import { NextRequest, NextResponse } from 'next/server';

/**
 * WooCommerce sync diagnosis — admin calls this when "Sync Error" shows up.
 * Returns which env vars are set, what URL we're hitting, and the exact
 * upstream error (HTTP status + error name + cause code) so we can tell
 * misconfigured credentials apart from DNS/timeout/firewall issues.
 *
 * Never echoes the actual key or secret values — only whether they are
 * present and their last 4 characters for identification.
 */

function mask(value: string | undefined): string {
    if (!value) return '';
    if (value.length <= 6) return '****';
    return `****${value.slice(-4)}`;
}

export async function GET(req: NextRequest) {
    const urlEnv = process.env.WOOCOMMERCE_URL;
    const keyEnv = process.env.WOOCOMMERCE_KEY;
    const secretEnv = process.env.WOOCOMMERCE_SECRET;

    const urlHeader = req.headers.get('x-woo-url') || '';
    const keyHeader = req.headers.get('x-woo-key') || '';
    const secretHeader = req.headers.get('x-woo-secret') || '';

    const url = urlEnv || urlHeader;
    const key = keyEnv || keyHeader;
    const secret = secretEnv || secretHeader;

    const report: Record<string, unknown> = {
        env: {
            WOOCOMMERCE_URL: Boolean(urlEnv),
            WOOCOMMERCE_KEY: Boolean(keyEnv),
            WOOCOMMERCE_SECRET: Boolean(secretEnv),
        },
        headers: {
            'x-woo-url': Boolean(urlHeader),
            'x-woo-key': Boolean(keyHeader),
            'x-woo-secret': Boolean(secretHeader),
        },
        resolved: {
            urlPresent: Boolean(url),
            urlPreview: url ? url.replace(/\/$/, '') : null,
            keyPresent: Boolean(key),
            keyTail: mask(key),
            secretPresent: Boolean(secret),
            secretTail: mask(secret),
            source: {
                url: urlEnv ? 'env' : urlHeader ? 'header' : 'missing',
                key: keyEnv ? 'env' : keyHeader ? 'header' : 'missing',
                secret: secretEnv ? 'env' : secretHeader ? 'header' : 'missing',
            },
        },
    };

    if (!url || !key || !secret) {
        report.test = { attempted: false, reason: 'credenciales faltantes — configúralas en Vercel (env vars) o en Configuración → Integraciones.' };
        return NextResponse.json(report, { status: 400 });
    }

    // Single-request probe
    const probePath = `${url.replace(/\/$/, '')}/wp-json/wc/v3/products?per_page=1&status=publish`;
    const auth = 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    const startedAt = Date.now();
    try {
        const res = await fetch(probePath, {
            headers: {
                Authorization: auth,
                'User-Agent': 'CRM-ArteConcreto-Diagnose/1.0',
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
            signal: controller.signal,
        });
        const elapsedMs = Date.now() - startedAt;
        const bodyText = await res.text();
        let bodyPreview: unknown = bodyText.slice(0, 400);
        try { bodyPreview = JSON.parse(bodyText); } catch { /* keep as string */ }
        const totalProductsHeader = res.headers.get('x-wp-total');
        const totalPagesHeader = res.headers.get('x-wp-totalpages');

        report.test = {
            attempted: true,
            url: probePath,
            httpStatus: res.status,
            httpStatusText: res.statusText,
            ok: res.ok,
            elapsedMs,
            totalProducts: totalProductsHeader ? parseInt(totalProductsHeader, 10) : null,
            totalPages: totalPagesHeader ? parseInt(totalPagesHeader, 10) : null,
            bodyPreview,
        };

        if (res.ok && Array.isArray(bodyPreview)) {
            report.test = {
                ...(report.test as object),
                sample: (bodyPreview as any[])[0]
                    ? { id: (bodyPreview as any[])[0].id, name: (bodyPreview as any[])[0].name, price: (bodyPreview as any[])[0].price }
                    : null,
            };
        }
        return NextResponse.json(report, { status: res.ok ? 200 : 502 });
    } catch (error: any) {
        const elapsedMs = Date.now() - startedAt;
        report.test = {
            attempted: true,
            url: probePath,
            ok: false,
            elapsedMs,
            errorName: error?.name || 'Error',
            errorMessage: error?.message || String(error),
            causeCode: error?.cause?.code || null,
            causeErrno: error?.cause?.errno || null,
            causeMessage: error?.cause?.message || null,
            hint: error?.name === 'AbortError'
                ? 'Timeout de 20s — tu WooCommerce no respondió a tiempo. Puede estar caído, lento o bloqueando IPs de Vercel.'
                : error?.cause?.code === 'ENOTFOUND'
                ? 'DNS no resuelve — verifica WOOCOMMERCE_URL (debe incluir https:// y el dominio correcto).'
                : error?.cause?.code === 'ECONNREFUSED'
                ? 'Conexión rechazada — el servidor no acepta conexiones en ese puerto.'
                : 'Error de red genérico. Revisa que WooCommerce esté disponible públicamente.',
        };
        return NextResponse.json(report, { status: 504 });
    } finally {
        clearTimeout(timer);
    }
}
