import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';

/**
 * Enriches the global biolink featured_products array with images + URLs pulled
 * straight from WooCommerce. Matches each stored product by SKU (preferred) or
 * by normalized name. Leaves the rest of the settings untouched.
 *
 * Runs on-demand when the admin clicks "Autocompletar imágenes" in the settings UI.
 */
function normalize(s: string): string {
    return (s || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

async function fetchAllWooProducts(): Promise<any[]> {
    const url = process.env.WOOCOMMERCE_URL;
    const key = process.env.WOOCOMMERCE_KEY;
    const secret = process.env.WOOCOMMERCE_SECRET;
    if (!url || !key || !secret) return [];

    const auth = 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
    const all: any[] = [];
    for (let page = 1; page <= 10; page++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20_000);
        try {
            const res = await fetch(
                `${url.replace(/\/$/, '')}/wp-json/wc/v3/products?per_page=100&status=publish&page=${page}`,
                {
                    headers: {
                        Authorization: auth,
                        'User-Agent': 'CRM-ArteConcreto/1.1',
                        'Content-Type': 'application/json',
                    },
                    cache: 'no-store',
                    signal: controller.signal,
                }
            );
            if (!res.ok) break;
            const batch = await res.json();
            if (!Array.isArray(batch) || batch.length === 0) break;
            all.push(...batch);
            const totalPagesHeader = res.headers.get('x-wp-totalpages');
            const totalPages = totalPagesHeader ? parseInt(totalPagesHeader, 10) || 1 : 1;
            if (page >= totalPages) break;
        } catch {
            break;
        } finally {
            clearTimeout(timer);
        }
    }
    return all;
}

function formatCOP(value: number): string {
    if (!value || !isFinite(value)) return '';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

export async function POST(_req: NextRequest) {
    if (!hasDatabase()) {
        return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
    }
    await ensureCrmSchema();
    const pool = getPool();

    const { rows } = await pool.query(`SELECT featured_products FROM crm_biolink_settings WHERE id = 'global' LIMIT 1`);
    const featured = Array.isArray(rows[0]?.featured_products) ? rows[0].featured_products : [];
    if (featured.length === 0) {
        return NextResponse.json({ ok: true, updated: 0, message: 'No hay productos destacados configurados' });
    }

    const wooProducts = await fetchAllWooProducts();
    if (wooProducts.length === 0) {
        return NextResponse.json({ error: 'No se pudo conectar con WooCommerce. Revisa credenciales.' }, { status: 502 });
    }

    let updatedCount = 0;
    const notFound: string[] = [];
    const enriched = featured.map((p: any) => {
        // Multi-strategy match: SKU, exact name, contains, token overlap
        const norm = normalize(p.name || '');
        const tokens = norm.split(' ').filter(t => t.length >= 3);

        const bySku = p.sku ? wooProducts.find(w => (w.sku || '').trim() === p.sku) : null;
        const exactName = !bySku ? wooProducts.find(w => normalize(w.name || '') === norm) : null;
        const contains = !bySku && !exactName ? wooProducts.find(w => {
            const wn = normalize(w.name || '');
            return wn.includes(norm) || norm.includes(wn);
        }) : null;
        const tokenOverlap = !bySku && !exactName && !contains && tokens.length > 0
            ? wooProducts.find(w => {
                const wn = normalize(w.name || '');
                return tokens.every(t => wn.includes(t));
            })
            : null;

        const match = bySku || exactName || contains || tokenOverlap;
        if (!match) {
            notFound.push(p.name || p.id);
            return p;
        }

        const image = match.images?.[0]?.src || p.image || '';
        const url = match.permalink || p.url || '';
        const priceRaw = Number(match.price) || 0;
        const price = priceRaw > 0 ? formatCOP(priceRaw) : p.price || '';

        const changed = image !== (p.image || '') || url !== (p.url || '') || price !== (p.price || '');
        if (changed) updatedCount++;
        return {
            ...p,
            id: String(match.id || p.id),
            name: match.name || p.name,
            image,
            url,
            price,
            sku: match.sku || p.sku || '',
        };
    });

    await pool.query(
        `UPDATE crm_biolink_settings SET featured_products = $1::jsonb, updated_at = NOW() WHERE id = 'global'`,
        [JSON.stringify(enriched)]
    );

    return NextResponse.json({
        ok: true,
        updated: updatedCount,
        total: featured.length,
        notFound,
        wooCatalogSize: wooProducts.length,
        products: enriched,
    });
}
