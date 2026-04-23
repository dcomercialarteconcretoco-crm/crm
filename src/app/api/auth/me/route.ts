import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  parseSessionToken,
  SESSION_COOKIE_NAME,
  type SessionUser,
} from "@/lib/auth-session";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";

/**
 * /api/auth/me is the endpoint the SPA calls on every page load to resurrect
 * the session. We do three things here, in this order:
 *
 *   1. Verify the cookie signature (parseSessionToken accepts the full
 *      fallback-chain of secrets so a Vercel env rotation doesn't log
 *      everyone out).
 *   2. Pull a fresh snapshot of role/permissions/avatar/etc from the DB so
 *      profile edits and permission changes take effect on the next page load
 *      without forcing the user to re-log in.
 *   3. Re-issue the cookie with the CURRENT primary secret and a rolling
 *      7-day max-age. This self-heals cookies that were signed with a legacy
 *      secret and keeps an actively-used session from expiring.
 *
 * If any single one of those steps fails, we fall through gracefully instead
 * of returning 401 — the only way to get a 401 out of here is an invalid or
 * missing cookie.
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const tokenUser = await parseSessionToken(token);

  if (!tokenUser) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  let resolved: SessionUser & { onboardingCount?: number } = tokenUser;

  // Refresh from DB when available so profile/permission edits propagate
  // without requiring a logout.
  if (hasDatabase()) {
    try {
      await ensureCrmSchema();
      const pool = getPool();
      const { rows } = await pool.query(
        `SELECT id, name, email, username, role, status, avatar, phone, sales, commission, permissions, onboarding_count
         FROM crm_users WHERE id = $1 LIMIT 1`,
        [tokenUser.id]
      );
      if (rows[0]) {
        const dbUser = rows[0];
        // If the DB says the user is deactivated, revoke immediately. This
        // also clears the cookie so the client doesn't keep retrying.
        if (dbUser.status && dbUser.status !== "Activo") {
          const revoked = NextResponse.json({ user: null }, { status: 401 });
          revoked.cookies.set(SESSION_COOKIE_NAME, "", {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 0,
          });
          return revoked;
        }

        resolved = {
          ...tokenUser,
          name: dbUser.name ?? tokenUser.name,
          email: dbUser.email ?? tokenUser.email,
          username: dbUser.username ?? tokenUser.username,
          role: dbUser.role ?? tokenUser.role,
          status: dbUser.status ?? tokenUser.status,
          avatar: dbUser.avatar ?? tokenUser.avatar ?? undefined,
          phone: dbUser.phone ?? tokenUser.phone,
          sales: dbUser.sales ?? tokenUser.sales,
          commission: dbUser.commission ?? tokenUser.commission,
          permissions: dbUser.permissions ?? tokenUser.permissions,
          onboardingCount:
            typeof dbUser.onboarding_count === "number" ? dbUser.onboarding_count : 0,
        };
      }
    } catch {
      // Fall through to token data if DB unavailable; we still re-issue below.
    }
  }

  const response = NextResponse.json({ user: resolved });

  // Strip the client-only onboardingCount from the cookie payload — it's
  // derived data that should always come fresh from the DB, and keeping it
  // out of the signed token keeps the cookie small.
  const { onboardingCount: _oc, ...signable } = resolved;
  try {
    const freshToken = await createSessionToken(signable as SessionUser);
    response.cookies.set(SESSION_COOKIE_NAME, freshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // rolling 7-day session
    });
  } catch {
    // Re-signing failed — still return the 200 with the user. The caller
    // keeps using the existing cookie.
  }

  return response;
}
