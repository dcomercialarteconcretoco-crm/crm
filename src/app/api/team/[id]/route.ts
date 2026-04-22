import { NextRequest, NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";
import { hashPassword, isBcryptHash } from "@/lib/password";
import { isGodUser, isCurrentUserGod } from "@/lib/god-user";
import { parseSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { hasPermission } from "@/lib/permissions";

async function loadSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return parseSessionToken(token);
}

async function loadTarget(pool: ReturnType<typeof getPool>, id: string) {
  const { rows } = await pool.query(`SELECT id, email FROM crm_users WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] || null;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const { id } = await params;
  const payload = await request.json();
  await ensureCrmSchema();
  const pool = getPool();

  const session = await loadSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });
  }
  if (!hasPermission({ role: session.role, permissions: session.permissions }, 'team.manage')) {
    return NextResponse.json({ error: 'No tienes permiso para editar miembros del equipo.' }, { status: 403 });
  }

  // Guard: god's row is immutable to everyone except god themselves.
  const target = await loadTarget(pool, id);
  const targetIsGod = isGodUser(target || { id, email: payload.email });
  if (targetIsGod && !isCurrentUserGod(session)) {
    return NextResponse.json(
      { error: 'Esta cuenta está protegida. Solo el propietario principal puede editarla.' },
      { status: 403 }
    );
  }
  // Also refuse to silently promote someone to god's email.
  const tryingToBecomeGod = isGodUser({ id: payload.id || id, email: payload.email }) && !targetIsGod;
  if (tryingToBecomeGod) {
    return NextResponse.json(
      { error: 'No se puede asignar esa identidad al usuario.' },
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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const { id } = await params;
  await ensureCrmSchema();
  const pool = getPool();

  const session = await loadSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });
  }
  if (!hasPermission({ role: session.role, permissions: session.permissions }, 'team.delete')) {
    return NextResponse.json({ error: 'No tienes permiso para eliminar miembros del equipo.' }, { status: 403 });
  }

  // Guard: god can never be deleted — not by other SuperAdmins, not by Admins, not by anyone.
  const target = await loadTarget(pool, id);
  if (isGodUser(target || { id })) {
    return NextResponse.json(
      { error: 'La cuenta principal del sistema no puede ser eliminada.' },
      { status: 403 }
    );
  }

  await pool.query(`DELETE FROM crm_users WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
