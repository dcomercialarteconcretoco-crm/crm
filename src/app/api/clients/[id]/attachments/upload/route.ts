import { NextRequest, NextResponse } from 'next/server';
import { head, issueSignedToken } from '@vercel/blob';
import { handleUploadPresigned, type HandleUploadPresignedBody } from '@vercel/blob/client';
import { getPool, ensureCrmSchema, hasDatabase } from '@/lib/postgres';
import { loadFreshSession } from '@/lib/auth-session';
import { hasBlobStore } from '@/lib/client-attachments-blob';
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_SIZE } from '@/lib/attachments';

/**
 * Emisión de URLs prefirmadas para subir archivos del cliente DIRECTO al Blob
 * store, sin que el binario pase por la función (ver [[src/lib/attachments.ts]]
 * para el caso REDCOL que originó esto).
 *
 * OJO CON EL MIDDLEWARE: esta ruta está exenta de la cookie de sesión, porque
 * la usa DOS clientes distintos —
 *   1. el navegador del asesor, pidiendo la URL de subida  → autenticado acá
 *      dentro con `loadFreshSession`, que es lo que exige la doc de Vercel
 *      ("You must authenticate and authorize the user inside this function");
 *   2. Vercel Blob, avisando que la subida terminó            → autenticado por
 *      la firma del webhook contra `BLOB_WEBHOOK_PUBLIC_KEY`.
 * El segundo llega sin cookie, así que si el middleware la exigiera nunca se
 * escribiría la fila. Por eso la autenticación vive acá y no allá.
 */

const TOKEN_TTL_MS = 30 * 60 * 1000;

type TokenPayload = {
  clientId: string;
  name: string;
  uploadedById: string | null;
  uploadedByName: string | null;
  kind: string;
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;

  if (!hasBlobStore()) {
    // La UI lee este código para caer a la ruta legacy contra Postgres.
    return NextResponse.json({ error: 'blob-no-configurado' }, { status: 501 });
  }

  const body = (await req.json()) as HandleUploadPresignedBody;

  try {
    const jsonResponse = await handleUploadPresigned({
      body,
      request: req,

      getSignedToken: async (pathname, clientPayload) => {
        const session = await loadFreshSession(req);
        if (!session) throw new Error('No autenticado');
        if (!hasDatabase()) throw new Error('Base de datos no configurada');

        await ensureCrmSchema();
        const pool = getPool();
        const exists = await pool.query(`SELECT 1 FROM crm_clients WHERE id = $1`, [clientId]);
        if (exists.rowCount === 0) throw new Error('Cliente no encontrado');

        const parsed = clientPayload ? (JSON.parse(clientPayload) as { name?: string; kind?: string }) : {};
        const payload: TokenPayload = {
          clientId,
          name: (parsed.name || pathname.split('/').pop() || 'Archivo').slice(0, 200),
          uploadedById: session.id,
          uploadedByName: session.name,
          kind: (parsed.kind || 'document').toLowerCase(),
        };

        // Los límites viajan DENTRO de la delegación: los aplica el CDN sobre el
        // PUT, así que el navegador no los puede saltar aunque controle el body.
        const token = await issueSignedToken({
          pathname,
          operations: ['put'],
          allowedContentTypes: ALLOWED_ATTACHMENT_TYPES,
          maximumSizeInBytes: MAX_ATTACHMENT_SIZE,
          validUntil: Date.now() + TOKEN_TTL_MS,
        });

        return {
          token,
          urlOptions: {
            access: 'private',
            allowedContentTypes: ALLOWED_ATTACHMENT_TYPES,
            maximumSizeInBytes: MAX_ATTACHMENT_SIZE,
            addRandomSuffix: true,
            allowOverwrite: false,
            tokenPayload: JSON.stringify(payload),
          },
        };
      },

      // Lo dispara Vercel Blob cuando el archivo terminó de subir. Es LA
      // escritura de la fila: si la hiciera el navegador, cerrar la pestaña a
      // mitad dejaría el binario en el store sin registro en el CRM.
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) throw new Error('Falta el payload firmado');
        const meta = JSON.parse(tokenPayload) as TokenPayload;

        // `PutBlobResult` no trae el tamaño, y sin él la UI listaría "0 B".
        // Lo pedimos al store en vez de creerle al navegador.
        let size = 0;
        try {
          size = (await head(blob.pathname)).size;
        } catch (err) {
          console.error('onUploadCompleted: no se pudo leer el tamaño de', blob.pathname, err);
        }

        await ensureCrmSchema();
        const pool = getPool();
        const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        // Idempotente por pathname: Vercel reintenta el callback hasta 5 veces
        // si no recibe un 200, y no queremos 5 filas del mismo archivo.
        await pool.query(
          `INSERT INTO crm_client_attachments
             (id, client_id, name, filename, mimetype, size, blob_pathname,
              uploaded_by_id, uploaded_by_name, kind)
           SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
           WHERE NOT EXISTS (
             SELECT 1 FROM crm_client_attachments WHERE blob_pathname = $7
           )`,
          [
            id,
            meta.clientId,
            meta.name,
            blob.pathname.split('/').pop() || meta.name,
            blob.contentType || 'application/octet-stream',
            size,
            blob.pathname,
            meta.uploadedById,
            meta.uploadedByName,
            meta.kind,
          ]
        );
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('POST /api/clients/[id]/attachments/upload error:', message);
    return NextResponse.json({ error: message }, { status: message === 'No autenticado' ? 401 : 400 });
  }
}

/** La UI pregunta acá si puede usar el camino del Blob antes de elegir ruta. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await params;
  return NextResponse.json({ blobEnabled: hasBlobStore(), maxSize: MAX_ATTACHMENT_SIZE });
}
