import crypto from "crypto";
import type { Pool, PoolClient } from "pg";

/**
 * Imágenes de items de cotización FUERA del blob `crm_state.key='quotes'`.
 *
 * POR QUÉ (deuda del caso ART-567, jul-2026): las fotos de productos
 * personalizados entraban como data-URLs base64 dentro de `items[].image` y el
 * blob de quotes llegó a 2,3 MB por ~90 cotizaciones. Cada boot/refetch bajaba
 * ESO completo por GET /api/state, y cada PUT con imágenes nuevas era candidato
 * a 413. Ahora la imagen vive en la tabla `crm_quote_images` y el item guarda
 * solo la referencia `/api/quote-images/<id>`.
 *
 * El id es content-addressed (sha256 del data-URL): la misma imagen re-enviada
 * por un flush viejo, un snapshot stale o dos cotizaciones que comparten foto
 * mapea SIEMPRE a la misma fila — el INSERT es ON CONFLICT DO NOTHING y la
 * extracción resulta idempotente. Nunca se borran filas: una imagen puede estar
 * referenciada por versiones viejas de la cotización o por su gemelo dedupeado,
 * y el costo de conservarlas es KBs.
 */

export const QUOTE_IMAGE_URL_PREFIX = "/api/quote-images/";

export const QUOTE_IMAGE_ID_RE = /^qi-[0-9a-f]{40}$/;

/** Data-URL de imagen base64 — lo único que externalizamos. */
const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i;

export interface QuoteImageRow {
  id: string;
  mimetype: string;
  /** Payload base64 SIN el prefijo data-URL. */
  data: string;
}

export function quoteImageIdFor(dataUrl: string): string {
  return `qi-${crypto.createHash("sha256").update(dataUrl).digest("hex").slice(0, 40)}`;
}

function parseDataUrl(src: string): { mimetype: string; data: string } | null {
  const m = DATA_URL_RE.exec(src);
  if (!m) return null;
  const data = m[2].replace(/\s+/g, "");
  if (!data) return null;
  return { mimetype: m[1].toLowerCase(), data };
}

/**
 * Recorre registros de cotización y reemplaza cada `items[].image` que sea un
 * data-URL por su referencia `/api/quote-images/<id>`, recolectando las
 * imágenes a persistir. Pura: no toca la DB y no muta los registros de entrada.
 * Registros o items con forma inesperada pasan intactos.
 */
export function extractInlineQuoteImages(records: unknown[]): {
  records: unknown[];
  images: QuoteImageRow[];
} {
  const images = new Map<string, QuoteImageRow>();

  const out = records.map((rec) => {
    if (typeof rec !== "object" || rec === null) return rec;
    const items = (rec as { items?: unknown }).items;
    if (!Array.isArray(items)) return rec;

    let touched = false;
    const newItems = items.map((item) => {
      if (typeof item !== "object" || item === null) return item;
      const image = (item as { image?: unknown }).image;
      if (typeof image !== "string" || !image.startsWith("data:")) return item;
      const parsed = parseDataUrl(image);
      if (!parsed) return item; // data-URL ilegible: se conserva tal cual
      const id = quoteImageIdFor(image);
      if (!images.has(id)) {
        images.set(id, { id, mimetype: parsed.mimetype, data: parsed.data });
      }
      touched = true;
      return { ...item, image: `${QUOTE_IMAGE_URL_PREFIX}${id}` };
    });

    if (!touched) return rec;
    return { ...rec, items: newItems };
  });

  return { records: out, images: Array.from(images.values()) };
}

/**
 * Inserta las imágenes extraídas. Orden fijo por id para que dos escritores
 * concurrentes con sets solapados no puedan armar un deadlock de inserts.
 */
export async function persistQuoteImages(
  db: Pool | PoolClient,
  images: QuoteImageRow[]
): Promise<void> {
  const sorted = [...images].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const img of sorted) {
    await db.query(
      `INSERT INTO crm_quote_images (id, mimetype, size, data)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [img.id, img.mimetype, Buffer.byteLength(img.data, "base64"), img.data]
    );
  }
}

/**
 * Choke point de escritura: data-URLs → filas + referencias. Las filas se
 * insertan ANTES y FUERA de la transacción del merge (autocommit): si el merge
 * luego falla, quedan filas huérfanas content-addressed que el próximo intento
 * reutiliza — inofensivo. Lo importante es que ningún data-URL llegue al blob.
 */
export async function externalizeQuoteImages(
  pool: Pool,
  records: unknown[]
): Promise<unknown[]> {
  const { records: slim, images } = extractInlineQuoteImages(records);
  if (images.length > 0) await persistQuoteImages(pool, images);
  return slim;
}
