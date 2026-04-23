import { NextRequest, NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";
import { hashPassword, isBcryptHash } from "@/lib/password";
import { isGodUser } from "@/lib/god-user";
import { loadFreshSession } from "@/lib/auth-session";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json({ users: [], persistence: "local" });
  }

  await ensureCrmSchema();
  const pool = getPool();
  // ⚠️ Never return password hashes — omitted from SELECT intentionally
  const { rows } = await pool.query(`
    SELECT id, name, avatar, role, email, phone, username, status, sales, commission, permissions,
           COALESCE(receives_leads, TRUE) AS "receivesLeads"
    FROM crm_users
    ORDER BY created_at ASC
  `);

  return NextResponse.json({ users: rows, persistence: "postgres" });
}

export async function POST(request: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  // Permission guard: only users with team.manage can create/edit sellers via this endpoint.
  // Role + permissions are read fresh from the DB so promotions/demotions apply immediately.
  const session = await loadFreshSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });
  }
  if (!hasPermission({ role: session.role, permissions: session.permissions }, 'team.manage')) {
    return NextResponse.json({ error: 'No tienes permiso para crear o editar miembros del equipo.' }, { status: 403 });
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

  // receivesLeads defaults to true when not provided (backward compat for existing callers).
  const receivesLeads = payload.receivesLeads === false ? false : true;

  await pool.query(
    `
      INSERT INTO crm_users (
        id, name, avatar, role, email, phone, username, status, sales, commission, password, permissions,
        receives_leads, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
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
        receives_leads = EXCLUDED.receives_leads,
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
      receivesLeads,
    ]
  );

  return NextResponse.json({ ok: true });
}
