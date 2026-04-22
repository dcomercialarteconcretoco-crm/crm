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
      city, score, category, registration_date AS "registrationDate",
      assigned_to AS "assignedTo",
      assigned_to_name AS "assignedToName",
      source
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
        id, name, company, email, phone, status, value_text, ltv, last_contact, city, score, category, registration_date,
        assigned_to, assigned_to_name, source, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
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
        assigned_to = COALESCE(EXCLUDED.assigned_to, crm_clients.assigned_to),
        assigned_to_name = COALESCE(EXCLUDED.assigned_to_name, crm_clients.assigned_to_name),
        source = COALESCE(EXCLUDED.source, crm_clients.source),
        updated_at = NOW()
    `,
    [
      payload.id,
      payload.name,
      payload.company || '',
      payload.email || '',
      payload.phone || '',
      payload.status || 'Activo',
      payload.value || '$0',
      payload.ltv || 0,
      payload.lastContact || new Date().toISOString().split('T')[0],
      payload.city || '',
      payload.score || 0,
      payload.category || 'General',
      payload.registrationDate || new Date().toISOString().split('T')[0],
      payload.assignedTo || null,
      payload.assignedToName || null,
      payload.source || null,
    ]
  );

  return NextResponse.json({ ok: true });
}
