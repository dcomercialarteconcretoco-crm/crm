/**
 * Reglas compartidas de los archivos del cliente (`crm_client_attachments`).
 *
 * POR QUÉ (caso REDCOL HOLDING, ago-2026): Lisseth intentó subir una póliza
 * firmada de 6,3 MB y la UI respondió "Error de red al subir el archivo". No era
 * la red: Vercel corta el body de una función en 4,5 MB y devuelve un 413
 * (FUNCTION_PAYLOAD_TOO_LARGE) con una página HTML, así que el `res.json()` del
 * front reventaba y caía al `catch` genérico. Encima el copy prometía 10 MB y el
 * server validaba 10 MB — un límite que la plataforma nunca iba a dejar pasar.
 *
 * El tope de 4,5 MB aplica al body de ida Y al de vuelta, y estos archivos viajan
 * por la función en ambos sentidos (multipart al subir, base64 de la columna
 * `data` al descargar). Por eso el techo real es la plataforma, no lo que
 * queramos: 4 MB deja aire para el sobre multipart y para el inflado base64.
 *
 * Para pasar de ahí hay que sacar el binario de Postgres y subirlo directo del
 * navegador a un object store (Vercel Blob / S3), que es otra conversación.
 */

export const MAX_ATTACHMENT_SIZE = 4 * 1024 * 1024;

/** Etiqueta que ve el usuario — que nunca se despegue de MAX_ATTACHMENT_SIZE. */
export const MAX_ATTACHMENT_LABEL = "4 MB";

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

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
