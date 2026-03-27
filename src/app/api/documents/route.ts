import { NextRequest, NextResponse } from 'next/server';
import { getPool, ensureCrmSchema, hasDatabase } from '@/lib/postgres';

export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json([], { status: 200 });
  }
  try {
    await ensureCrmSchema();
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, name, filename, mimetype, size, uploaded_by, uploaded_at
       FROM crm_documents
       ORDER BY uploaded_at DESC`
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/documents error:', err);
    // Return empty array instead of error so UI shows empty state gracefully
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
  }
  try {
    await ensureCrmSchema();
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const customName = formData.get('name') as string | null;
    const uploadedBy = formData.get('uploaded_by') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo excede el límite de 5 MB' }, { status: 400 });
    }

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de archivo no permitido. Solo PDF e imágenes.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const name = customName?.trim() || file.name.replace(/\.[^/.]+$/, '');

    const pool = getPool();
    await pool.query(
      `INSERT INTO crm_documents (id, name, filename, mimetype, size, data, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, name, file.name, file.type, file.size, base64, uploadedBy || null]
    );

    return NextResponse.json({ ok: true, id, name, filename: file.name, size: file.size });
  } catch (err) {
    console.error('POST /api/documents error:', err);
    return NextResponse.json({ error: 'Error al subir documento' }, { status: 500 });
  }
}
