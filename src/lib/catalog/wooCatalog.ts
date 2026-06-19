/**
 * Capa de datos del catálogo PDF: trae los productos de WooCommerce y los
 * normaliza a un shape plano y limpio para el builder del PDF.
 *
 * ⚠️ REGLA DE ORO — VISIBILIDAD DE PRECIO:
 * arteconcreto.co decide producto-por-producto si muestra el precio mediante el
 * campo custom `_cq_disponible_online` (meta de WooCommerce):
 *    "1" → muestra el precio        (21 productos hoy)
 *    "0" / ausente → "Precio a consultar"  (196 productos hoy)
 * Verificado contra `price_html` en vivo con correlación 100%. El catálogo
 * NUNCA debe imprimir el precio de un producto con showPrice=false, aunque
 * WooCommerce tenga un número guardado (todos lo tienen).
 */

const WOO_URL = (process.env.WOOCOMMERCE_URL || '').replace(/\/$/, '');
const WOO_KEY = process.env.WOOCOMMERCE_KEY || '';
const WOO_SECRET = process.env.WOOCOMMERCE_SECRET || '';

export interface CatalogProduct {
    id: number;
    name: string;
    slug: string;
    permalink: string;          // link "Ver en la web"
    sku: string;
    categoryId: number | null;
    category: string;           // nombre de la categoría (sección del catálogo)
    image: string | null;       // url de la foto principal
    shortDescription: string;   // texto corto sin HTML
    dimensions: string;         // "120 × 60 × 45 cm" o ''
    // Precios (números en COP). Solo se RENDERIZAN si showPrice === true.
    regularPrice: number;
    salePrice: number | null;   // null si no está en oferta
    price: number;              // precio efectivo (oferta si aplica, si no regular)
    onSale: boolean;
    // EL flag. true ⇒ se puede mostrar el precio; false ⇒ "Precio a consultar".
    showPrice: boolean;
    stockStatus: string;        // 'instock' | 'onbackorder' | 'outofstock'
}

interface WooImage { src?: string }
interface WooCategory { id?: number; name?: string }
interface WooMeta { key?: string; value?: unknown }
interface WooDimensions { length?: string; width?: string; height?: string }
interface WooProduct {
    id: number;
    name?: string;
    slug?: string;
    permalink?: string;
    sku?: string;
    type?: string;
    status?: string;
    stock_status?: string;
    short_description?: string;
    description?: string;
    regular_price?: string;
    sale_price?: string;
    price?: string;
    on_sale?: boolean;
    categories?: WooCategory[];
    images?: WooImage[];
    dimensions?: WooDimensions;
    meta_data?: WooMeta[];
}

function authHeader(): string {
    return 'Basic ' + Buffer.from(`${WOO_KEY}:${WOO_SECRET}`).toString('base64');
}

const stripHtml = (s: string | undefined): string =>
    (s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const toNum = (v: unknown): number => {
    const n = parseFloat(String(v ?? ''));
    return Number.isFinite(n) ? n : 0;
};

const toDim = (v: unknown): number | null => {
    const n = parseFloat(String(v ?? ''));
    return Number.isFinite(n) && n > 0 ? n : null;
};

// Categorías "etiqueta" que NO son una sección real del catálogo. En
// arteconcreto.co casi todo producto lleva 2 categorías: la genérica
// ("Cotización" o "Producto", que marcan el flujo comercial) + la real
// ("Bancas", "Macetas", etc.). Para las secciones del PDF saltamos las
// genéricas y usamos la primera categoría con significado.
const GENERIC_CATEGORIES = new Set([
    'cotización', 'cotizacion', 'producto', 'productos',
    'uncategorized', 'sin categoría', 'sin categoria',
]);

// Orden explícito de las secciones; las no listadas van al final alfabéticas,
// y "Otros" siempre de último. Solo aparecen las que tienen productos.
export const CATEGORY_ORDER = [
    'Bancas', 'Mesas', 'Macetas', 'Bolardos', 'Cerramientos y Calados',
    'Canecas de Basura', 'Bicicleteros', 'Lavamanos', 'Pisos', 'Ónix', 'Amatista',
];

/** Primera categoría no-genérica del producto, o 'Otros' si todas lo son. */
function pickSection(categories: WooCategory[] | undefined): { id: number | null; name: string } {
    for (const c of categories || []) {
        const name = stripHtml(c.name);
        if (name && !GENERIC_CATEGORIES.has(name.toLowerCase())) {
            return { id: c.id ?? null, name };
        }
    }
    return { id: null, name: 'Otros' };
}

/** Lee el flag de visibilidad de precio desde meta_data. */
function readShowPrice(meta: WooMeta[] | undefined): boolean {
    const m = (meta || []).find((x) => x.key === '_cq_disponible_online');
    // El valor llega como "1" / "0" (string) o a veces 1 / 0 (number). Solo "1" muestra.
    return String(m?.value ?? '').trim() === '1';
}

function mapProduct(w: WooProduct): CatalogProduct {
    const regular = toNum(w.regular_price);
    const sale = w.sale_price ? toNum(w.sale_price) : 0;
    const price = toNum(w.price) || regular;
    const onSale = !!w.on_sale && sale > 0 && sale < regular;

    const len = toDim(w.dimensions?.length);
    const wid = toDim(w.dimensions?.width);
    const hei = toDim(w.dimensions?.height);
    const dimensions = (len && wid && hei) ? `${len} × ${wid} × ${hei} cm` : '';

    const section = pickSection(w.categories);

    return {
        id: w.id,
        name: stripHtml(w.name) || `Producto ${w.id}`,
        slug: w.slug || '',
        permalink: w.permalink || '',
        sku: w.sku || '',
        categoryId: section.id,
        category: section.name,
        image: w.images?.[0]?.src || null,
        shortDescription: stripHtml(w.short_description),
        dimensions,
        regularPrice: regular,
        salePrice: onSale ? sale : null,
        price,
        onSale,
        showPrice: readShowPrice(w.meta_data),
        stockStatus: w.stock_status || 'instock',
    };
}

/**
 * Trae TODOS los productos publicados de WooCommerce (paginado) y los mapea.
 * Lanza si faltan credenciales — el caller decide cómo responder.
 */
export async function fetchCatalogProducts(): Promise<CatalogProduct[]> {
    if (!WOO_URL || !WOO_KEY || !WOO_SECRET) {
        throw new Error('Credenciales de WooCommerce no configuradas (WOOCOMMERCE_URL/KEY/SECRET).');
    }

    const MAX_PAGES = 10; // 1000 productos tope de seguridad
    const all: WooProduct[] = [];
    let totalPages = 1;

    for (let page = 1; page <= MAX_PAGES; page++) {
        const qs = new URLSearchParams({ per_page: '100', status: 'publish', page: String(page) });
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 25_000);
        let res: Response;
        try {
            res = await fetch(`${WOO_URL}/wp-json/wc/v3/products?${qs}`, {
                headers: { Authorization: authHeader(), 'User-Agent': 'CRM-ArteConcreto-Catalogo/1.0' },
                cache: 'no-store',
                signal: ctrl.signal,
            });
        } finally {
            clearTimeout(t);
        }
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`WooCommerce ${res.status}: ${body.slice(0, 200)}`);
        }
        const batch = (await res.json()) as WooProduct[];
        if (!Array.isArray(batch)) throw new Error('Respuesta inválida de WooCommerce (esperaba array).');
        all.push(...batch);
        if (page === 1) {
            const header = res.headers.get('x-wp-totalpages');
            totalPages = header ? Math.min(parseInt(header, 10) || 1, MAX_PAGES) : 1;
        }
        if (page >= totalPages || batch.length === 0) break;
    }

    return all.map(mapProduct);
}
