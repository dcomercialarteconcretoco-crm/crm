/**
 * Loader de imágenes para el PDF. Resuelve los 3 problemas del playbook:
 *  1. @react-pdf NO embebe WEBP/SVG confiable → sharp convierte TODO a JPEG/PNG.
 *  2. En Vercel `public/` no está en el lambda → fallback fetch al CDN.
 *  3. Imágenes grandes/numerosas → sharp reescala (maxPx) y comprime (quality).
 *
 * Las fotos de producto de arteconcreto.co ya vienen como URLs absolutas del
 * CDN (https://arteconcreto.co/wp-content/...), así que el camino normal es
 * fetch + sharp. El branch de disco sirve para assets locales (logo).
 */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const SITE = (process.env.WOOCOMMERCE_URL || 'https://arteconcreto.co').replace(/\/$/, '');

async function rawBuffer(src: string): Promise<Buffer | null> {
    const isAbsolute = /^https?:/i.test(src);
    // 1) disco (local / si el tracing incluyó el asset)
    if (!isAbsolute && src.startsWith('/')) {
        try {
            const b = await fs.readFile(path.join(process.cwd(), 'public', src.slice(1)));
            if (b?.length) return b;
        } catch { /* sigue al CDN */ }
    }
    // 2) CDN público (confiable en serverless) con timeout + cache
    const url = isAbsolute ? src : `${SITE}${src.startsWith('/') ? '' : '/'}${src}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15_000);
    try {
        const res = await fetch(url, { cache: 'force-cache', signal: ctrl.signal });
        if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch { /* devuelve null */ }
    finally { clearTimeout(t); }
    return null;
}

interface LoadOpts {
    maxPx?: number;
    quality?: number;
    bg?: string;       // color de fondo al aplanar (debe ser el del contenedor)
    keepAlpha?: boolean; // logos: PNG con transparencia
}

/** Devuelve una data URL (JPEG o PNG) lista para <Image src>, o null si falla. */
export async function loadImageDataUrl(
    src: string | null | undefined,
    { maxPx = 460, quality = 76, bg = '#ffffff', keepAlpha = false }: LoadOpts = {},
): Promise<string | null> {
    if (!src) return null;
    const buf = await rawBuffer(src);
    if (!buf) return null;
    try {
        if (keepAlpha) {
            const png = await sharp(buf)
                .resize({ width: maxPx, height: maxPx, fit: 'inside', withoutEnlargement: true })
                .png()
                .toBuffer();
            return `data:image/png;base64,${png.toString('base64')}`;
        }
        const jpg = await sharp(buf)
            .resize({ width: maxPx, height: maxPx, fit: 'inside', withoutEnlargement: true })
            .flatten({ background: bg })
            .jpeg({ quality })
            .toBuffer();
        return `data:image/jpeg;base64,${jpg.toString('base64')}`;
    } catch {
        return null;
    }
}

/** Convierte N items con concurrencia acotada (evita OOM del lambda con sharp). */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
    const out = new Array<R>(items.length);
    let next = 0;
    async function worker() {
        while (next < items.length) {
            const i = next++;
            out[i] = await fn(items[i], i);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, worker));
    return out;
}
