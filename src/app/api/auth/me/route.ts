import { NextRequest, NextResponse } from "next/server";
import { parseSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const tokenUser = parseSessionToken(token);

  if (!tokenUser) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // Always return fresh data from DB so profile changes (avatar, name, etc.) persist
  if (hasDatabase()) {
    try {
      await ensureCrmSchema();
      const pool = getPool();
      const { rows } = await pool.query(
        `SELECT id, name, email, username, role, status, avatar, phone, sales, commission
         FROM crm_users WHERE id = $1 LIMIT 1`,
        [tokenUser.id]
      );
      if (rows[0]) {
        const dbUser = rows[0];
        return NextResponse.json({
          user: {
            ...tokenUser,
            name: dbUser.name ?? tokenUser.name,
            email: dbUser.email ?? tokenUser.email,
            username: dbUser.username ?? tokenUser.username,
            role: dbUser.role ?? tokenUser.role,
            status: dbUser.status ?? tokenUser.status,
            avatar: dbUser.avatar ?? tokenUser.avatar ?? null,
            phone: dbUser.phone ?? tokenUser.phone,
            sales: dbUser.sales ?? tokenUser.sales,
            commission: dbUser.commission ?? tokenUser.commission,
          },
        });
      }
    } catch {
      // Fall through to token data if DB unavailable
    }
  }

  return NextResponse.json({ user: tokenUser });
}
