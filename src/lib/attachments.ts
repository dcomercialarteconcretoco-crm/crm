/**
 * Reglas compartidas de los archivos del cliente (`crm_client_attachments`).
 *
 * POR QUÉ (caso REDCOL HOLDING, ago-2026): Lisseth intentó subir una póliza
 * firmada de 6,3 MB y la UI respondió "Error de red al subir el archivo". No era
 * la red: Vercel corta el body de una función en 4,5 MB y devuelve un 413
 * (FUNCTION_PAYLOAD_TOO_LARGE) en texto plano, así que el `res.json()` del front
 * reventaba y caía al `catch` genérico. Probado contra producción: un POST de
 * 5,5 MB responde 413 SIN cookie de sesión, mientras que uno de 1 KB responde
 * 401 — el body muere en la infraestructura, antes del middleware.
 *
 * Ese tope aplica al body de ida Y al de vuelta, así que mientras el binario
 * viajara por la función en ambos sentidos (multipart al subir, base64 de la
 * columna `data` al descargar) el techo real eran ~4 MB, no los 10 que prometía
 * el copy.
 *
 * SOLUCIÓN: el binario ya no pasa por la función. Sube del navegador DIRECTO a
 * un Blob store privado con una URL prefirmada, y baja igual de directo con otra
 * URL firmada de vida corta. Ver [[src/lib/client-attachments-blob.ts]].
 * `MAX_ATTACHMENT_SIZE` ya no lo dicta la plataforma sino nosotros: 25 MB cubre
 * pólizas y contratos escaneados sin volver eterna la descarga.
 */

export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

/** Etiqueta que ve el usuario — que nunca se despegue de MAX_ATTACHMENT_SIZE. */
export const MAX_ATTACHMENT_LABEL = "25 MB";

/**
 * Techo de la ruta legacy (multipart contra la función), que se sigue usando
 * como respaldo cuando el Blob store no está configurado — en local, por
 * ejemplo. 4 MB deja aire para el sobre multipart y el inflado base64.
 */
export const MAX_LEGACY_ATTACHMENT_SIZE = 4 * 1024 * 1024;

/**
 * Extensión → mimetype. El navegador NO siempre reporta `File.type`: los picker
 * de Android y algunos "Compartir" de iOS mandan cadena vacía o
 * `application/octet-stream`, y con eso un PDF perfectamente válido se rechazaba
 * como "Tipo de archivo no permitido".
 */
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
};

export const ALLOWED_ATTACHMENT_TYPES = Array.from(new Set(Object.values(MIME_BY_EXT)));

/** Formatos aceptados, en cristiano, para los mensajes de error y el copy. */
export const ALLOWED_ATTACHMENT_LABEL =
  "PDF, Word (.doc, .docx), Excel (.xls, .xlsx) e imágenes (JPG, PNG, WEBP, GIF, HEIC)";

/**
 * Mimetype confiable a partir del nombre + lo que reportó el navegador.
 * Devuelve "" si el archivo no es de un formato permitido.
 */
export function resolveAttachmentMime(filename: string, reportedType: string | null): string {
  const reported = (reportedType || "").trim().toLowerCase();
  if (reported && ALLOWED_ATTACHMENT_TYPES.includes(reported)) return reported;

  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return MIME_BY_EXT[ext] || "";
}

/**
 * Ruta del archivo dentro del Blob store. Se agrupa por cliente para que el
 * store sea navegable desde el dashboard de Vercel y para poder acotar un token
 * firmado a un solo cliente si algún día hace falta. El sufijo aleatorio lo pone
 * el propio Blob (`addRandomSuffix`), así que dos archivos del mismo nombre no
 * se pisan.
 */
export function attachmentBlobPathname(clientId: string, filename: string): string {
  const safe = filename.replace(/[^\w.\-]+/g, "_").slice(-120);
  return `clientes/${clientId}/${safe}`;
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
