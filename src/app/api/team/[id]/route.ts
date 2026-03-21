import { NextRequest, NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const { id } = await params;
  const payload = await request.json();
  await ensureCrmSchema();
  const pool = getPool();

  await pool.query(
    `
      UPDATE crm_users
      SET
        name = $2,
        avatar = $3,
        role = $4,
        email = $5,
        phone = $6,
        username = $7,
        status = $8,
        sales = $9,
        commission = $10,
        password = $11,
        updated_at = NOW()
      WHERE id = $1
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
      payload.password || null,
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
