/**
 * auth-session.ts
 * Uses Web Crypto API (globalThis.crypto.subtle) so tokens are signed and
 * verified identically in the Vercel Edge runtime (middleware) and in
 * Node.js route handlers.  Node.js ≥ 18 ships globalThis.crypto natively.
 */

const SESSION_COOKIE = "crm_session";

const SESSION_SECRET = (
  process.env.SESSION_SECRET ||
  process.env.SUPERADMIN_PASSWORD ||
  "ac-fallback-dev-secret-change-in-prod"
).trim();

export type SessionUser = {
  id: string;
  name: string;
  username?: string;
  email: string;
  role: "Vendedor" | "Manager" | "Admin" | "SuperAdmin";
  status: "Activo" | "Inactivo";
  avatar?: string;
  phone?: string;
  sales?: string;
  commission?: string;
  permissions?: Record<string, boolean>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const enc = new TextEncoder();

async function getKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function hmacHex(payload: string): Promise<string> {
  const key = await getKey();
  const buf = await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function b64urlEncode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function b64urlDecode(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(escape(atob(padded)));
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function createSessionToken(user: SessionUser): Promise<string> {
  const payload = b64urlEncode(JSON.stringify(user));
  const sig = await hmacHex(payload);
  return `${payload}.${sig}`;
}

export async function parseSessionToken(
  token?: string | null
): Promise<SessionUser | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const expected = await hmacHex(payload);
    if (expected !== sig) return null;
    return JSON.parse(b64urlDecode(payload)) as SessionUser;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
