import { NextRequest, NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";
import { loadFreshSession } from "@/lib/auth-session";

export async function GET(request: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ clients: [], persistence: "local" });
  }

  await ensureCrmSchema();
  const pool = getPool();

  // Ownership scoping: Vendedores only get their own clients from this endpoint,
  // so even a direct API call (bypassing the UI filter) can't leak other sellers' data.
  // Admins, Managers, and SuperAdmins see everything.
  // Role is read fresh from the DB (not the signed cookie) so role changes take
  // effect immediately without requiring the user to log out and back in.
  const session = await loadFreshSession(request);
  const canSeeAll = !session ? false : (session.role === 'SuperAdmin' || session.role === 'Admin' || session.role === 'Manager');

  const where: string[] = [];
  const params: unknown[] = [];
  if (session && !canSeeAll) {
    where.push(`(
      assigned_to = $1
      OR LOWER(COALESCE(assigned_to_name, '')) = LOWER($2)
      OR LOWER(COALESCE(assigned_to_name, '')) = LOWER($3)
    )`);
    params.push(session.id);
    params.push(session.name || '');
    params.push(session.username || session.email || '');
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT
       id, name, company, company_id AS "companyId", position, email, phone, status,
       value_text AS value,
       ltv, last_contact AS "lastContact",
       city, score, category, registration_date AS "registrationDate",
       assigned_to AS "assignedTo",
       assigned_to_name AS "assignedToName",
       source
     FROM crm_clients
     ${whereSql}
     ORDER BY created_at DESC`,
    params
  );

  return NextResponse.json({ clients: rows, persistence: "postgres" });
}

export async function POST(request: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  await ensureCrmSchema();
  const payload = await request.json();
  const pool = getPool();

  // Si vino companyId pero no companyName, lo resolvemos desde crm_companies
  // para mantener la denormalización consistente. Y al revés: si vino un nombre
  // de empresa libre sin id, creamos/buscamos la company y enlazamos.
  let companyId: string | null = payload.companyId || null;
  let companyName: string = (payload.company || '').trim();

  if (companyId) {
    const { rows: cr } = await pool.query(
      `SELECT name FROM crm_companies WHERE id = $1 LIMIT 1`,
      [companyId]
    );
    if (cr[0]) companyName = cr[0].name;
    else companyId = null; // id inválido → no rompemos, pero quitamos referencia
  } else if (companyName) {
    // Buscar por nombre (case-insensitive); si no existe, crear.
    const { rows: existing } = await pool.query(
      `SELECT id, name FROM crm_companies WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [companyName]
    );
    if (existing[0]) {
      companyId = existing[0].id;
      companyName = existing[0].name; // honra capitalización original
    } else {
      const newId = `cmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      await pool.query(
        `INSERT INTO crm_companies (id, name) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [newId, companyName]
      );
      companyId = newId;
    }
  }

  // Email vacío → NULL para que no choque contra el UNIQUE index parcial
  // cuando varios contactos de la misma empresa no tienen correo declarado.
  const emailValue = (payload.email || '').trim() || null;
  // Cargo: trim + cadena vacía → NULL para que el front pueda preguntar
  // `if (client.position)` sin chequear espacios.
  const positionValue = (payload.position || '').trim() || null;

  try {
    await pool.query(
      `
        INSERT INTO crm_clients (
          id, name, company, company_id, position, email, phone, status, value_text, ltv, last_contact, city, score, category, registration_date,
          assigned_to, assigned_to_name, source, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          company = EXCLUDED.company,
          company_id = EXCLUDED.company_id,
          position = EXCLUDED.position,
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
        companyName,
        companyId,
        positionValue,
        emailValue,
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
  } catch (error: unknown) {
    // Si algo falla en el INSERT/UPDATE (rara vez ahora que email no es
    // único), devolvemos un mensaje legible para que el front pueda
    // notificarlo en vez de un 500 críptico.
    const msg = error instanceof Error ? error.message : '';
    console.error('Failed to upsert client', error);
    return NextResponse.json(
      { error: msg || 'No se pudo guardar el contacto.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, companyId });
}
