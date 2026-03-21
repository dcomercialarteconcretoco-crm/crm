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
      UPDATE crm_clients
      SET
        name = $2,
        company = $3,
        email = $4,
        phone = $5,
        status = $6,
        value_text = $7,
        ltv = $8,
        last_contact = $9,
        city = $10,
        score = $11,
        category = $12,
        registration_date = $13,
        updated_at = NOW()
      WHERE id = $1
    `,
    [
      id,
      payload.name,
      payload.company,
      payload.email,
      payload.phone,
      payload.status,
      payload.value,
      payload.ltv,
      payload.lastContact,
      payload.city,
      payload.score,
      payload.category,
      payload.registrationDate,
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
  await pool.query(`DELETE FROM crm_clients WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
