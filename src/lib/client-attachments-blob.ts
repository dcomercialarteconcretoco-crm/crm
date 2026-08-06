import { del, issueSignedToken, presignUrl } from "@vercel/blob";

/**
 * Acceso al Blob store privado `archivos-clientes` (creado ago-2026, región IAD1).
 *
 * AUTENTICACIÓN — sin credenciales estáticas. El SDK usa OIDC: `BLOB_STORE_ID`
 * + `VERCEL_OIDC_TOKEN`, que Vercel rota solo en cada deploy. Por eso NO
 * usamos `handleUpload`, que exige sí o sí un read-write token de vida larga
 * ("OIDC is not accepted for this method"), sino `handleUploadPresigned` +
 * `issueSignedToken`, que sí aceptan OIDC. El callback de subida completada se
 * verifica con `BLOB_WEBHOOK_PUBLIC_KEY` en vez del token.
 *
 * ENTREGA — el binario NUNCA vuelve a pasar por la función. Un blob privado se
 * podría streamear con `get()`, pero eso reintroduce el costo (y el riesgo de
 * tope) de mover megabytes por el runtime. En vez de eso firmamos una URL de
 * GET con vida de minutos y redirigimos ahí: el navegador la baja del CDN.
 */

/** Vida de la URL firmada de descarga. Corta: se usa dentro del mismo click. */
const DOWNLOAD_URL_TTL_MS = 5 * 60 * 1000;

/**
 * Vida del token de delegación. `issueSignedToken` pega contra la API de control
 * de Blob, así que cacheamos el token en memoria del runtime y lo reusamos
 * mientras siga vigente en vez de pagar un round-trip por cada descarga.
 */
const DELEGATION_TTL_MS = 30 * 60 * 1000;

/** Margen antes del vencimiento para no entregar un token que expira en vuelo. */
const DELEGATION_RENEW_MARGIN_MS = 60 * 1000;

/**
 * ¿Hay Blob store conectado? Si no, la UI cae a la ruta legacy contra Postgres
 * (tope 4 MB). Pasa en local sin `vercel env pull` y si alguien desconecta el
 * store del proyecto: preferimos degradar a que subir deje de funcionar.
 */
export function hasBlobStore(): boolean {
  return Boolean(
    process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN
  );
}

type Delegation = Awaited<ReturnType<typeof issueSignedToken>>;

let cachedReadToken: Delegation | null = null;

async function readDelegation(): Promise<Delegation> {
  const now = Date.now();
  if (cachedReadToken && cachedReadToken.validUntil - DELEGATION_RENEW_MARGIN_MS > now) {
    return cachedReadToken;
  }
  cachedReadToken = await issueSignedToken({
    pathname: "*",
    operations: ["get"],
    validUntil: now + DELEGATION_TTL_MS,
  });
  return cachedReadToken;
}

/**
 * URL firmada para que el navegador baje el archivo directo del CDN.
 * Quien llama DEBE haber verificado la sesión y el permiso sobre el cliente
 * antes: esta URL abre el archivo a cualquiera que la tenga, hasta que expire.
 */
export async function signedDownloadUrl(pathname: string): Promise<string> {
  const { presignedUrl } = await presignUrl(await readDelegation(), {
    operation: "get",
    pathname,
    access: "private",
    validUntil: Date.now() + DOWNLOAD_URL_TTL_MS,
  });
  return presignedUrl;
}

/**
 * Borra el binario del store. Se llama al eliminar el adjunto — si no, la fila
 * desaparece de la UI pero el archivo sigue ocupando (y cobrando) en el store.
 * No revienta el DELETE de la fila si esto falla: un huérfano cuesta centavos,
 * una fila que no se puede borrar bloquea al usuario.
 */
export async function deleteAttachmentBlob(pathname: string): Promise<void> {
  await del(pathname);
}
