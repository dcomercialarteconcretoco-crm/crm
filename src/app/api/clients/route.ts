import { NextRequest, NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";

export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json({ clients: [], persistence: "local" });
  }

  await ensureCrmSchema();
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      id, name, company, email, phone, status,
      value_text AS value,
      ltv, last_contact AS "lastContact",
      city, score, category, registration_date AS "registrationDate"
    FROM crm_clients
    ORDER BY created_at DESC
  `);

  return NextResponse.json({ clients: rows, persistence: "postgres" });
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
      INSERT INTO crm_clients (
        id, name, company, email, phone, status, value_text, ltv, last_contact, city, score, category, registration_date, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        company = EXCLUDED.company,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        status = EXCLUDED.status,
        value_text = EXCLUDED.value_text,
        ltv = EXCLUDED.ltv,
        last_contact = EXCLUDED.last_contact,
        city = EXCLUDED.city,
        score = EXCLUDED.score,
        category = EXCLUDED.category,
        registration_date = EXCLUDED.registration_date,
        updated_at = NOW()
    `,
    [
      payload.id,
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
