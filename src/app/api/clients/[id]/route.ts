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

  // Misma lógica que /api/clients POST: si vino companyId valida; si vino un
  // nombre libre busca/crea. Permite que la pantalla de detalle del lead
  // asigne empresa a un cliente que no la tenía sin endpoint extra.
  let companyId: string | null = payload.companyId ?? null;
  let companyName: string = (payload.company || '').trim();

  if (companyId) {
    const { rows: cr } = await pool.query(
      `SELECT name FROM crm_companies WHERE id = $1 LIMIT 1`,
      [companyId]
    );
    if (cr[0]) companyName = cr[0].name;
    else companyId = null;
  } else if (companyName) {
    const { rows: existing } = await pool.query(
      `SELECT id, name FROM crm_companies WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [companyName]
    );
    if (existing[0]) {
      companyId = existing[0].id;
      companyName = existing[0].name;
    } else {
      const newId = `cmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      await pool.query(
        `INSERT INTO crm_companies (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [newId, companyName]
      );
      companyId = newId;
    }
  }

  await pool.query(
    `
      UPDATE crm_clients
      SET
        name = $2,
        company = $3,
        company_id = $4,
        email = $5,
        phone = $6,
        status = $7,
        value_text = $8,
        ltv = $9,
        last_contact = $10,
        city = $11,
        score = $12,
        category = $13,
        registration_date = $14,
        assigned_to = COALESCE($15, assigned_to),
        assigned_to_name = COALESCE($16, assigned_to_name),
        source = COALESCE($17, source),
        updated_at = NOW()
      WHERE id = $1
    `,
    [
      id,
      payload.name,
      companyName,
      companyId,
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

  return NextResponse.json({ ok: true, companyId });
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
