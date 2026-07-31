import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { externalizeQuoteImages, QUOTE_IMAGE_URL_PREFIX } from '@/lib/quote-images';

// Sube la imagen de un producto personalizado EN EL MOMENTO de elegirla en el
// QuoteEngine, para que el guardado de la cotización viaje con la referencia
// URL y nunca con el base64 (los PUT gordos con imágenes crudas fueron el
// candidato #1 del 413 que mató ART-567). Si esta subida falla, el cliente
// conserva el data-URL y la externalización server-side de mergeStateRecords
// lo captura igual al guardar — esto es optimización, no única defensa.
//
// El QuoteEngine ya reescala a máx 1200px JPEG 0.82 (~200 KB); el límite de
// acá es solo una red de seguridad contra payloads absurdos.
const MAX_DATA_URL_CHARS = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { dataUrl?: unknown } | null;
  const dataUrl = body?.dataUrl;
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return NextResponse.json(
      { error: 'Se espera { dataUrl } con una imagen en data-URL base64.' },
      { status: 400 }
    );
  }
  if (dataUrl.length > MAX_DATA_URL_CHARS) {
    return NextResponse.json(
      { error: 'La imagen excede el límite de 4 MB. Usa una imagen más liviana.' },
      { status: 413 }
    );
  }

  await ensureCrmSchema();
  const pool = getPool();

  // Reutilizamos el mismo extractor del choke point de escritura envolviendo
  // el data-URL en un pseudo-item — una sola implementación de parseo/hash.
  const [slim] = await externalizeQuoteImages(pool, [{ items: [{ image: dataUrl }] }]);
  const stored = (slim as { items: Array<{ image: string }> }).items[0].image;
  if (!stored.startsWith(QUOTE_IMAGE_URL_PREFIX)) {
    // El data-URL no parseó (base64 corrupto, mimetype raro) — el extractor lo
    // deja intacto. Mejor rechazar acá que guardar basura en la cotización.
    return NextResponse.json({ error: 'No se pudo leer la imagen enviada.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, url: stored });
}
