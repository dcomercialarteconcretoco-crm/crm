import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { QUOTE_IMAGE_ID_RE } from '@/lib/quote-images';

// Sirve la imagen de un item de cotización (antes vivía como base64 dentro del
// blob crm_state.key='quotes'; ver src/lib/quote-images.ts). El id es
// content-addressed, así que el contenido de una URL jamás cambia → cache
// inmutable de un año. `private`: solo sesiones autenticadas la piden (el
// middleware ya exige cookie para /api/quote-images) y no queremos copias en
// caches compartidos.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
  }
  const { id } = await params;
  if (!QUOTE_IMAGE_ID_RE.test(id)) {
    return NextResponse.json({ error: 'Id inválido' }, { status: 400 });
  }

  await ensureCrmSchema();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT mimetype, data FROM crm_quote_images WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const buffer = Buffer.from(rows[0].data, 'base64');
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': rows[0].mimetype,
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
