import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { loadFreshSession } from '@/lib/auth-session';
import { extractInlineQuoteImages, persistQuoteImages } from '@/lib/quote-images';

// Migración one-shot (idempotente, re-ejecutable): saca las imágenes base64
// embebidas en crm_state.key='quotes' hacia crm_quote_images y deja en cada
// items[].image la referencia /api/quote-images/<id>. Es lo que recorta el
// GET /api/state de 2,3 MB a KBs para las ~90 cotizaciones históricas; las
// escrituras nuevas ya nunca traen base64 (mergeStateRecords externaliza y el
// QuoteEngine sube la imagen aparte al elegirla).
//
// Correr DESPUÉS de deployar este código: si el blob se migra antes de que
// exista la ruta /api/quote-images, las referencias quedarían 404 en la UI.
//
// Body opcional: { "dryRun": true } → reporta qué haría sin escribir nada.
//
// Concurrencia: la reescritura corre en una transacción con FOR UPDATE sobre
// la fila de quotes — cualquier mergeStateRecords concurrente espera el lock.
// Un cliente viejo que re-mande base64 después de la migración no la deshace:
// el choke point de mergeStateRecords lo externaliza de nuevo al mismo id.
export async function POST(request: NextRequest) {
    const user = await loadFreshSession(request);
    if (!user) {
        return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    if (user.role !== 'SuperAdmin' && user.role !== 'Admin') {
        return NextResponse.json({ error: 'Requiere permisos de SuperAdmin.' }, { status: 403 });
    }
    if (!hasDatabase()) {
        return NextResponse.json({ error: 'Base de datos no configurada.' }, { status: 503 });
    }

    const body = (await request.json().catch(() => ({}))) as { dryRun?: unknown };
    const dryRun = body?.dryRun === true;

    await ensureCrmSchema();
    const pool = getPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const cur = await client.query(
            `SELECT value FROM crm_state WHERE key = 'quotes' FOR UPDATE`
        );
        const quotes: unknown[] = Array.isArray(cur.rows[0]?.value) ? cur.rows[0].value : [];
        const bytesBefore = JSON.stringify(quotes).length;

        const { records: slim, images } = extractInlineQuoteImages(quotes);
        const bytesAfter = JSON.stringify(slim).length;
        const stats = {
            ok: true,
            dryRun,
            quotesTotal: quotes.length,
            imagesExternalized: images.length,
            bytesBefore,
            bytesAfter,
            savedMB: Number(((bytesBefore - bytesAfter) / 1024 / 1024).toFixed(2)),
        };

        if (dryRun || images.length === 0) {
            await client.query('ROLLBACK');
            return NextResponse.json(stats);
        }

        await persistQuoteImages(client, images);
        await client.query(
            `UPDATE crm_state SET value = $1::jsonb, updated_at = NOW() WHERE key = 'quotes'`,
            [JSON.stringify(slim)]
        );
        await client.query('COMMIT');
        console.log(
            `[externalize-quote-images] ${user.name} migró ${images.length} imágenes; ` +
            `blob quotes ${bytesBefore} → ${bytesAfter} bytes`
        );
        return NextResponse.json(stats);
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('[externalize-quote-images] falló:', error);
        return NextResponse.json(
            { error: 'La migración falló; no se modificó nada. Revisa logs y reintenta.' },
            { status: 500 }
        );
    } finally {
        client.release();
    }
}
