import { NextRequest, NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";

export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json({ users: [], persistence: "local" });
  }

  await ensureCrmSchema();
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT id, name, avatar, role, email, phone, username, status, sales, commission, password
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

  await pool.query(
    `
      INSERT INTO crm_users (
        id, name, avatar, role, email, phone, username, status, sales, commission, password, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
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
      payload.password || null,
    ]
  );

  return NextResponse.json({ ok: true });
}
