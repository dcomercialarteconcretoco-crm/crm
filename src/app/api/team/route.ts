import { NextRequest, NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";
import { hashPassword, isBcryptHash } from "@/lib/password";
import { isGodUser } from "@/lib/god-user";

export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json({ users: [], persistence: "local" });
  }

  await ensureCrmSchema();
  const pool = getPool();
  // ⚠️ Never return password hashes — omitted from SELECT intentionally
  const { rows } = await pool.query(`
    SELECT id, name, avatar, role, email, phone, username, status, sales, commission, permissions
    FROM crm_users
    ORDER BY created_at ASC
  `);

  return NextResponse.json({ users: rows, persistence: "postgres" });
}

export async function POST(request: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  await ensureCrmSchema();
  const payload = await request.json();
  const pool = getPool();

  // Nobody can create/overwrite the god account through the normal team endpoint.
  if (isGodUser({ id: payload.id, email: payload.email })) {
    return NextResponse.json(
      { error: 'Esa identidad está reservada para la cuenta principal del sistema.' },
      { status: 403 }
    );
  }

  let passwordToStore: string | null = null;
  if (payload.password) {
    passwordToStore = isBcryptHash(payload.password)
      ? payload.password
      : await hashPassword(payload.password);
  }

  await pool.query(
    `
      INSERT INTO crm_users (
        id, name, avatar, role, email, phone, username, status, sales, commission, password, permissions, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        avatar = EXCLUDED.avatar,
        role = EXCLUDED.role,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        username = EXCLUDED.username,
        status = EXCLUDED.status,
        sales = EXCLUDED.sales,
        commission = EXCLUDED.commission,
        password = EXCLUDED.password,
        permissions = EXCLUDED.permissions,
        updated_at = NOW()
    `,
    [
      payload.id,
      payload.name,
      payload.avatar || null,
      payload.role,
      payload.email,
      payload.phone || "",
      payload.username || null,
      payload.status || "Activo",
      payload.sales || "$0",
      payload.commission || "10%",
      passwordToStore,
      payload.permissions ? JSON.stringify(payload.permissions) : null,
    ]
  );

  return NextResponse.json({ ok: true });
}
