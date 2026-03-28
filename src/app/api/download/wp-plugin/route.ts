import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// ── ZIP builder (single-file, sin dependencias externas) ─────────────────────
// Formato ZIP estándar: Local file header + data + Central directory + EOCD

function u16(n: number) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
}
function u32(n: number) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

function crc32(buf: Buffer): number {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(filename: string, content: Buffer): Buffer {
  const deflated   = zlib.deflateRawSync(content, { level: 9 });
  const crc        = crc32(content);
  const fnBuf      = Buffer.from(filename, 'utf8');
  const now        = new Date();
  const dosDate    = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const dosTime    = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);

  // Local file header (sig 0x04034b50)
  const localHeader = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]), // signature
    u16(20),                // version needed
    u16(0),                 // flags
    u16(8),                 // compression: deflate
    u16(dosTime),
    u16(dosDate),
    u32(crc),
    u32(deflated.length),
    u32(content.length),
    u16(fnBuf.length),
    u16(0),                 // extra field length
    fnBuf,
  ]);

  const localOffset = 0;
  const fileData = Buffer.concat([localHeader, deflated]);

  // Central directory header (sig 0x02014b50)
  const cdHeader = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x01, 0x02]), // signature
    u16(20),                // version made by
    u16(20),                // version needed
    u16(0),                 // flags
    u16(8),                 // compression
    u16(dosTime),
    u16(dosDate),
    u32(crc),
    u32(deflated.length),
    u32(content.length),
    u16(fnBuf.length),
    u16(0),                 // extra field length
    u16(0),                 // file comment length
    u16(0),                 // disk number start
    u16(0),                 // internal attrs
    u32(0),                 // external attrs
    u32(localOffset),       // relative offset of local header
    fnBuf,
  ]);

  // End of central directory (sig 0x06054b50)
  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]), // signature
    u16(0),                 // disk number
    u16(0),                 // disk with start of CD
    u16(1),                 // entries on this disk
    u16(1),                 // total entries
    u32(cdHeader.length),
    u32(fileData.length),   // offset of start of CD
    u16(0),                 // comment length
  ]);

  return Buffer.concat([fileData, cdHeader, eocd]);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const pluginPath = path.join(process.cwd(), 'wordpress-plugin', 'arteconcreto-cotizacion.php');

    if (!fs.existsSync(pluginPath)) {
      return NextResponse.json({ error: 'Plugin no encontrado en el servidor.' }, { status: 404 });
    }

    const phpContent = fs.readFileSync(pluginPath);

    // Extraer versión del plugin para incluirla en el nombre del ZIP
    const phpText    = phpContent.toString('utf8', 0, 512);
    const versionMatch = phpText.match(/Version:\s*([\d.]+)/i);
    const version    = versionMatch?.[1] ?? '1.0.0';

    // El ZIP debe contener la carpeta del plugin para que WP lo reconozca
    const zipFilename = `arteconcreto-cotizacion-v${version}.zip`;
    const entryName   = `arteconcreto-cotizacion/arteconcreto-cotizacion.php`;

    const zipBuffer = buildZip(entryName, phpContent);

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Content-Length':      String(zipBuffer.length),
        'Cache-Control':       'no-store',
      },
    });
  } catch (err) {
    console.error('[download/wp-plugin]', err);
    return NextResponse.json({ error: 'Error generando el archivo ZIP.' }, { status: 500 });
  }
}
