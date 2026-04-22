import { NextRequest, NextResponse } from 'next/server';
import { getPool, hasDatabase } from '@/lib/postgres';

type Params = Promise<{ id: string; attId: string }>;

export async function GET(req: NextRequest, { params }: { params: Params }) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
  }
  const { id: clientId, attId } = await params;
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT filename, mimetype, data
     FROM crm_client_attachments
     WHERE id = $1 AND client_id = $2
     LIMIT 1`,
    [attId, clientId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const { filename, mimetype, data } = rows[0];
  const buffer = Buffer.from(data, 'base64');
  const disposition = req.nextUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline';

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': mimetype,
      'Content-Disposition': `${disposition}; filename="${encodeURIComponent(filename)}"`,
      'Cache-Control': 'private, max-age=60',
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
  }
  const { id: clientId, attId } = await params;
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM crm_client_attachments WHERE id = $1 AND client_id = $2`,
    [attId, clientId]
  );
  if (result.rowCount === 0) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
