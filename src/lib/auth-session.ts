/**
 * auth-session.ts
 * Uses Web Crypto API (globalThis.crypto.subtle) so tokens are signed and
 * verified identically in the Vercel Edge runtime (middleware) and in
 * Node.js route handlers.  Node.js ≥ 18 ships globalThis.crypto natively.
 *
 * Secret rotation tolerance:
 *   Cookies are always SIGNED with PRIMARY_SECRET (the first non-empty value
 *   of SESSION_SECRET, SUPERADMIN_PASSWORD, or a built-in dev fallback).
 *   They VERIFY against any candidate in the fallback chain so a live env
 *   rotation (e.g. someone adds SESSION_SECRET after weeks of relying on the
 *   password fallback) doesn't instantly invalidate every in-flight session.
 *   /api/auth/me re-issues the cookie with PRIMARY_SECRET on every call, so
 *   legacy cookies get silently migrated on the user's next page load.
 */

const SESSION_COOKIE = "crm_session";

const DEV_FALLBACK_SECRET = "ac-fallback-dev-secret-change-in-prod";

// Primary secret: used for SIGNING new cookies. First non-empty wins.
const PRIMARY_SECRET = (
  process.env.SESSION_SECRET ||
  process.env.SUPERADMIN_PASSWORD ||
  DEV_FALLBACK_SECRET
).trim();

// Every secret we'll accept when VERIFYING an incoming cookie — deduplicated,
// trimmed, and filtered to non-empty. Verifying against each candidate means
// a cookie signed under any historical member of the fallback chain still
// works, which prevents the "every refresh logs me out" failure mode when
// env vars change or drift between deploys.
const CANDIDATE_SECRETS: string[] = Array.from(
  new Set(
    [
      process.env.SESSION_SECRET,
      process.env.SUPERADMIN_PASSWORD,
      DEV_FALLBACK_SECRET,
    ]
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim())
  )
);

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

async function importKey(secret: string): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function hmacHexWith(secret: string, payload: string): Promise<string> {
  const key = await importKey(secret);
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

// Fields we're willing to embed in the signed cookie. Anything variable-size
// (avatar base64, permissions object, free-text sales/commission) is
// DELIBERATELY excluded — those MUST come fresh from the DB in /api/auth/me.
//
// Why: avatars in this CRM are often base64-encoded JPEGs stored inline in the
// users table. If we include them in the cookie payload, a single user with a
// profile photo blows the cookie past ~100 KB. Browsers silently drop cookies
// larger than ~4 KB, which meant Laureth's login "succeeded" (JSON body came
// back fine) but the Set-Cookie header was discarded — so every subsequent API
// call was unauthenticated, the UI rendered zeros, and any refresh bounced
// back to /login. Keeping the cookie small is the ONLY fix.
type CompactSessionPayload = {
  id: string;
  name: string;
  username?: string;
  email: string;
  role: SessionUser["role"];
  status: SessionUser["status"];
};

function toCompactPayload(user: SessionUser): CompactSessionPayload {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  const payload = b64urlEncode(JSON.stringify(toCompactPayload(user)));
  const sig = await hmacHexWith(PRIMARY_SECRET, payload);
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
    // Try each historical secret — cookies signed with any member of the
    // fallback chain still verify, which smooths out env rotations.
    for (const candidate of CANDIDATE_SECRETS) {
      const expected = await hmacHexWith(candidate, payload);
      if (expected === sig) {
        return JSON.parse(b64urlDecode(payload)) as SessionUser;
      }
    }
    return null;
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
