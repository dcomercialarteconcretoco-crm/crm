import { NextRequest, NextResponse } from 'next/server';
import { getPool, ensureCrmSchema, hasDatabase } from '@/lib/postgres';
import {
  ALLOWED_ATTACHMENT_LABEL,
  MAX_LEGACY_ATTACHMENT_SIZE,
  formatAttachmentSize,
  resolveAttachmentMime,
} from '@/lib/attachments';

/**
 * Subida LEGACY: multipart contra la función, binario en base64 en la columna
 * `data`. Desde ago-2026 el camino normal es la URL prefirmada contra el Blob
 * (`./upload`), que no tiene el techo de 4,5 MB de la plataforma. Esta ruta
 * queda como respaldo para cuando no hay Blob store conectado, y por eso
 * conserva el tope chico.
 */

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) return NextResponse.json([], { status: 200 });
  const { id } = await params;
  try {
    await ensureCrmSchema();
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, name, filename, mimetype, size, kind, uploaded_by_id, uploaded_by_name, uploaded_at
       FROM crm_client_attachments
       WHERE client_id = $1
       ORDER BY uploaded_at DESC`,
      [id]
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/clients/[id]/attachments error:', err);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
  }

  const { id: clientId } = await params;
  try {
    await ensureCrmSchema();
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const customName = (formData.get('name') as string | null)?.trim();
    const kind = ((formData.get('kind') as string | null) || 'document').trim().toLowerCase();
    const uploadedById = (formData.get('uploaded_by_id') as string | null) || null;
    const uploadedByName = (formData.get('uploaded_by_name') as string | null) || null;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    }
    if (file.size > MAX_LEGACY_ATTACHMENT_SIZE) {
      return NextResponse.json(
        {
          error: `El archivo pesa ${formatAttachmentSize(file.size)} y por esta vía solo caben ${formatAttachmentSize(MAX_LEGACY_ATTACHMENT_SIZE)}.`,
        },
        { status: 400 }
      );
    }

    // El navegador no siempre reporta el tipo; resolvemos también por extensión.
    const mimetype = resolveAttachmentMime(file.name, file.type);
    if (!mimetype) {
      return NextResponse.json(
        { error: `Formato no permitido. Se aceptan ${ALLOWED_ATTACHMENT_LABEL}.` },
        { status: 400 }
      );
    }

    const pool = getPool();
    // Verify the client exists before attaching
    const clientExists = await pool.query(`SELECT 1 FROM crm_clients WHERE id = $1`, [clientId]);
    if (clientExists.rowCount === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const name = customName || file.name.replace(/\.[^/.]+$/, '');

    await pool.query(
      `INSERT INTO crm_client_attachments
         (id, client_id, name, filename, mimetype, size, data, uploaded_by_id, uploaded_by_name, kind)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, clientId, name, file.name, mimetype, file.size, base64, uploadedById, uploadedByName, kind]
    );

    return NextResponse.json({
      ok: true,
      id,
      name,
      filename: file.name,
      mimetype,
      size: file.size,
      kind,
      uploaded_by_id: uploadedById,
      uploaded_by_name: uploadedByName,
      uploaded_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('POST /api/clients/[id]/attachments error:', err);
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 });
  }
}
