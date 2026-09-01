import { NextRequest, NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";
import { hashPassword, isBcryptHash } from "@/lib/password";
import { isGodUser, isCurrentUserGod } from "@/lib/god-user";
import { loadFreshSession } from "@/lib/auth-session";
import { hasPermission } from "@/lib/permissions";
import { collectFootprint, type TeamMemberRow } from "@/lib/handover";

async function loadSession(request: NextRequest) {
  return loadFreshSession(request);
}

async function loadTarget(pool: ReturnType<typeof getPool>, id: string) {
  const { rows } = await pool.query(
    `SELECT id, name, email, archived_at, original_email, original_username FROM crm_users WHERE id = $1 LIMIT 1`,
    [id]
  );
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

  // ── Archivados ───────────────────────────────────────────────────────────
  // Una fila archivada es el registro de alguien que ya salió: es lo que hace
  // que sus cotizaciones, sus tiempos de respuesta y su bitácora sigan
  // resolviendo a una persona real en una auditoría. Editarla es exactamente
  // el "renombrar al que se fue" que el relevo vino a reemplazar, así que el
  // PUT normal no la toca. Sólo se puede REACTIVAR (`unarchive: true`), para
  // deshacer una baja hecha por error.
  if (target?.archived_at) {
    if (!payload.unarchive) {
      return NextResponse.json(
        {
          error:
            'Esta persona fue dada de baja. Su ficha queda congelada para la auditoría: si necesitas a alguien en ese puesto, registra un reemplazo; si la baja fue un error, reactivá la cuenta.',
        },
        { status: 409 }
      );
    }

    // Reactivar: se le devuelve el correo original si nadie más lo tomó (el
    // reemplazo suele habérselo quedado). La contraseña quedó anulada al
    // archivar, así que el admin tiene que reenviarle la invitación.
    const original = target.original_email as string | null;
    const originalUser = target.original_username as string | null;
    const { rows: taken } = await pool.query(
      `SELECT 1 FROM crm_users
       WHERE id <> $1 AND (($2::text IS NOT NULL AND LOWER(email) = LOWER($2))
                        OR ($3::text IS NOT NULL AND LOWER(username) = LOWER($3)))
       LIMIT 1`,
      [id, original, originalUser]
    );
    const canRestoreIdentity = original && taken.length === 0;

    await pool.query(
      `UPDATE crm_users SET
         status = 'Activo',
         archived_at = NULL,
         archived_by = NULL,
         archived_by_name = NULL,
         archived_reason = NULL,
         replaced_by_id = NULL,
         email = CASE WHEN $2::boolean THEN COALESCE($3, email) ELSE email END,
         username = CASE WHEN $2::boolean THEN COALESCE($4, username) ELSE username END,
         original_email = NULL,
         original_username = NULL,
         updated_at = NOW()
       WHERE id = $1`,
      [id, Boolean(canRestoreIdentity), original, originalUser]
    );

    return NextResponse.json({
      ok: true,
      reinstated: true,
      identityRestored: Boolean(canRestoreIdentity),
      note: canRestoreIdentity
        ? 'Cuenta reactivada con su correo original. Reenviale la invitación para que defina contraseña.'
        : 'Cuenta reactivada, pero su correo original ya lo tiene otra persona. Editá el correo y reenviale la invitación.',
    });
  }

  let passwordToStore: string | null = null;
  if (payload.password) {
    passwordToStore = isBcryptHash(payload.password)
      ? payload.password
      : await hashPassword(payload.password);
  }

  const receivesLeads = payload.receivesLeads === false ? false : true;

  await pool.query(
    `
      INSERT INTO crm_users (id, name, avatar, role, email, phone, username, status, sales, commission, password, permissions, receives_leads, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
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
        password = COALESCE(EXCLUDED.password, crm_users.password),
        permissions = EXCLUDED.permissions,
        receives_leads = EXCLUDED.receives_leads,
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
      receivesLeads,
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
  if (!target) {
    return NextResponse.json({ ok: true, alreadyGone: true });
  }

  // ── Borrar ≠ dar de baja ─────────────────────────────────────────────────
  // Borrar la fila deja huérfana toda la evidencia que apunta a ese id:
  // cotizaciones (sellerId), crm_contact_events, adjuntos, negocios cerrados.
  // En una auditoría eso es peor que el problema que se quería evitar — nadie
  // puede decir quién atendió. Por eso el DELETE sólo procede para cuentas sin
  // ningún rastro (un alta con el correo mal escrito, una prueba). Para todo lo
  // demás va el relevo, que archiva y transfiere.
  const footprint = await collectFootprint(pool, target as TeamMemberRow);
  const total =
    footprint.movable.clients +
    footprint.movable.rawLeads +
    footprint.movable.openDeals +
    footprint.kept.quotes +
    footprint.kept.closedDeals +
    footprint.kept.contactEvents +
    footprint.kept.attachments;

  if (total > 0) {
    return NextResponse.json(
      {
        error:
          `${target.name} tiene historial en el sistema (${footprint.kept.quotes} cotizaciones, ` +
          `${footprint.movable.clients} clientes, ${footprint.kept.contactEvents} registros de contacto). ` +
          'Borrarlo dejaría esos registros sin dueño y sin nombre en una auditoría. ' +
          'Usá "Dar de baja / Relevar": la persona sale del sistema y su cartera pasa a quien la reemplace.',
        requiresHandover: true,
        footprint,
      },
      { status: 409 }
    );
  }

  await pool.query(`DELETE FROM crm_users WHERE id = $1`, [id]);
  await pool.query(`DELETE FROM crm_biolinks WHERE seller_id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
