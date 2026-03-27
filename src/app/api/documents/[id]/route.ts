import { NextRequest, NextResponse } from 'next/server';
import { getPool, hasDatabase } from '@/lib/postgres';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
  }
  try {
    const { id } = await params;
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, name, filename, mimetype, data FROM crm_documents WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/documents/[id] error:', err);
    return NextResponse.json({ error: 'Error al obtener documento' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
  }
  try {
    const { id } = await params;
    const pool = getPool();
    const result = await pool.query(
      `DELETE FROM crm_documents WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error('DELETE /api/documents/[id] error:', err);
    return NextResponse.json({ error: 'Error al eliminar documento' }, { status: 500 });
  }
}
