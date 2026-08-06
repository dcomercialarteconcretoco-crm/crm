import { NextRequest, NextResponse } from 'next/server';
import { getPool, hasDatabase } from '@/lib/postgres';
import { deleteAttachmentBlob, signedDownloadUrl } from '@/lib/client-attachments-blob';

type Params = Promise<{ id: string; attId: string }>;

export async function GET(req: NextRequest, { params }: { params: Params }) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
  }
  const { id: clientId, attId } = await params;
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT filename, mimetype, data, blob_pathname
     FROM crm_client_attachments
     WHERE id = $1 AND client_id = $2
     LIMIT 1`,
    [attId, clientId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const { filename, mimetype, data, blob_pathname: blobPathname } = rows[0];
  const download = req.nextUrl.searchParams.get('download') === '1';

  // Fila nueva: el binario vive en el Blob privado. Redirigimos a una URL
  // firmada de 5 minutos para que el navegador lo baje directo del CDN — así el
  // archivo NUNCA pasa por la función y no lo alcanza el tope de 4,5 MB de
  // respuesta. La sesión ya la exigió el middleware sobre ESTA ruta.
  if (blobPathname) {
    try {
      return NextResponse.redirect(await signedDownloadUrl(blobPathname), {
        status: 307,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    } catch (err) {
      console.error('GET attachment: no se pudo firmar la URL:', err);
      return NextResponse.json({ error: 'No se pudo abrir el archivo' }, { status: 502 });
    }
  }

  // Fila legacy (anteriores a ago-2026): base64 en la columna `data`.
  if (!data) {
    return NextResponse.json({ error: 'El archivo no tiene contenido' }, { status: 404 });
  }
  const buffer = Buffer.from(data, 'base64');

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': mimetype,
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(filename)}"`,
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
    `DELETE FROM crm_client_attachments
     WHERE id = $1 AND client_id = $2
     RETURNING blob_pathname`,
    [attId, clientId]
  );
  if (result.rowCount === 0) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  // El binario se borra DESPUÉS de la fila y sin bloquear la respuesta: un blob
  // huérfano cuesta centavos, una fila que no se deja borrar bloquea al usuario.
  const pathname = result.rows[0]?.blob_pathname as string | null;
  if (pathname) {
    try {
      await deleteAttachmentBlob(pathname);
    } catch (err) {
      console.error('DELETE attachment: la fila se borró pero el blob quedó huérfano:', pathname, err);
    }
  }

  return NextResponse.json({ ok: true });
}
