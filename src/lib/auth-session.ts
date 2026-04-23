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

// ── Fresh session loader (Node runtime only) ──────────────────────────────────
// Reads the session cookie AND refreshes role/permissions/status from the DB so
// a user promoted/demoted after login no longer carries a stale role in their
// signed cookie. Must only be used from API routes (needs `pg`). Returns null
// if the cookie is invalid, the user no longer exists, or they are Inactive.
//
// Endpoints that authorize by role MUST use this instead of parseSessionToken.

type CookieReader = { get: (name: string) => { value: string } | undefined };
type RequestLike = { cookies: CookieReader };

export async function loadFreshSession(
  request: RequestLike
): Promise<SessionUser | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const cookieUser = await parseSessionToken(token);
  if (!cookieUser) return null;

  // Superadmin-via-env bypass: no DB row exists for this synthetic user, and the
  // only way to obtain this cookie is to log in with SUPERADMIN_EMAIL/PASSWORD,
  // so the role is trustworthy as-is.
  if (cookieUser.id === "superadmin-server") return cookieUser;

  // Lazy import to keep this module usable from the Edge runtime (middleware)
  // as long as the caller doesn't invoke loadFreshSession there.
  const { hasDatabase, getPool, ensureCrmSchema } = await import("./postgres");
  if (!hasDatabase()) return cookieUser; // no DB → best we can do

  try {
    await ensureCrmSchema();
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, name, email, username, role, status, avatar, phone, sales, commission, permissions
       FROM crm_users WHERE id = $1 LIMIT 1`,
      [cookieUser.id]
    );
    const dbUser = rows[0];
    if (!dbUser) return null; // user was deleted → revoke
    if (dbUser.status && dbUser.status !== "Activo") return null; // deactivated → revoke

    return {
      id: dbUser.id,
      name: dbUser.name ?? cookieUser.name,
      username: dbUser.username ?? cookieUser.username,
      email: dbUser.email ?? cookieUser.email,
      role: dbUser.role ?? cookieUser.role,
      status: dbUser.status ?? cookieUser.status,
      avatar: dbUser.avatar ?? cookieUser.avatar,
      phone: dbUser.phone ?? cookieUser.phone,
      sales: dbUser.sales ?? cookieUser.sales,
      commission: dbUser.commission ?? cookieUser.commission,
      permissions: dbUser.permissions ?? cookieUser.permissions,
    };
  } catch (err) {
    console.warn("loadFreshSession: DB lookup failed, falling back to cookie", err);
    return cookieUser;
  }
}
