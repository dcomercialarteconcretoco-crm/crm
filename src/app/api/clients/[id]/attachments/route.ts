import { NextRequest, NextResponse } from 'next/server';
import { getPool, ensureCrmSchema, hasDatabase } from '@/lib/postgres';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB — lets users upload old quote PDFs + photos
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
];

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
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo excede el límite de 10 MB' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de archivo no permitido. Usa PDF, Word, Excel o imágenes.' },
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
      [id, clientId, name, file.name, file.type, file.size, base64, uploadedById, uploadedByName, kind]
    );

    return NextResponse.json({
      ok: true,
      id,
      name,
      filename: file.name,
      mimetype: file.type,
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
