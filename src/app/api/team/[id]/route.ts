import { NextRequest, NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";
import { hashPassword, isBcryptHash } from "@/lib/password";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const { id } = await params;
  const payload = await request.json();
  await ensureCrmSchema();
  const pool = getPool();

  let passwordToStore: string | null = null;
  if (payload.password) {
    passwordToStore = isBcryptHash(payload.password)
      ? payload.password
      : await hashPassword(payload.password);
  }

  await pool.query(
    `
      INSERT INTO crm_users (id, name, avatar, role, email, phone, username, status, sales, commission, password, permissions, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
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
      id,
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

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const { id } = await params;
  await ensureCrmSchema();
  const pool = getPool();
  await pool.query(`DELETE FROM crm_users WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
