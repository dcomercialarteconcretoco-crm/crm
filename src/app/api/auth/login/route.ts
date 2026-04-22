import { NextRequest, NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";
import { createSessionToken, SESSION_COOKIE_NAME, type SessionUser } from "@/lib/auth-session";
import { hashPassword, isBcryptHash, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase() || "";
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD?.trim() || "";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const limit = rateLimit(ip, { maxRequests: 8, windowMs: 60_000, key: "login" });
    if (!limit.ok) {
      return NextResponse.json(
        { error: `Demasiados intentos. Espera ${limit.retryAfter}s.` },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    const body = (await req.json()) as {
      username?: string;
      password?: string;
    };

    const username = body.username?.trim().toLowerCase() || "";
    const password = body.password?.trim() || "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Usuario y contraseña requeridos." },
        { status: 400 }
      );
    }

    // Superadmin login (only attempted if env vars are configured)
    if (SUPERADMIN_EMAIL && SUPERADMIN_PASSWORD && username === SUPERADMIN_EMAIL && password === SUPERADMIN_PASSWORD) {
      const user: SessionUser = {
        id: "superadmin-server",
        name: "Juan Sierra",
        username: SUPERADMIN_EMAIL,
        email: SUPERADMIN_EMAIL,
        role: "SuperAdmin",
        status: "Activo",
        avatar:
          "https://ui-avatars.com/api/?name=Juan+Sierra&background=fab510&color=000",
      };

      const response = NextResponse.json({ user });
      response.cookies.set(SESSION_COOKIE_NAME, await createSessionToken(user), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      return response;
    }

    if (hasDatabase()) {
      await ensureCrmSchema();
      const pool = getPool();
      const { rows } = await pool.query(
        `
          SELECT id, name, avatar, role, email, phone, username, status, sales, commission, password, permissions
          FROM crm_users
          WHERE lower(email) = $1 OR lower(username) = $1
          LIMIT 1
        `,
        [username]
      );

      const user = rows[0];

      if (user && (await verifyPassword(password, user.password))) {
        // Migration: if the stored password is still plain text, upgrade to bcrypt
        if (user.password && !isBcryptHash(user.password)) {
          try {
            const hashed = await hashPassword(password);
            await pool.query(`UPDATE crm_users SET password = $1 WHERE id = $2`, [hashed, user.id]);
          } catch (err) {
            console.warn("Failed to upgrade password hash for user", user.id, err);
          }
        }
        const sessionUser: SessionUser = {
          id: user.id,
          name: user.name,
          username: user.username || user.email,
          email: user.email,
          role: user.role,
          status: user.status || "Activo",
          avatar: user.avatar || undefined,
          phone: user.phone || "",
          sales: user.sales || "$0",
          commission: user.commission || "10%",
          permissions: user.permissions ?? undefined,
        };

        const response = NextResponse.json({ user: sessionUser });
        response.cookies.set(SESSION_COOKIE_NAME, await createSessionToken(sessionUser), {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
        });
        return response;
      }
    }

    return NextResponse.json(
      { error: "Credenciales inválidas." },
      { status: 401 }
    );
  } catch (error) {
    console.error("Auth login route error:", error);
    return NextResponse.json(
      { error: "No fue posible validar el acceso." },
      { status: 500 }
    );
  }
}
