import { NextRequest, NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";
import { loadFreshSession } from "@/lib/auth-session";
import { hasPermission } from "@/lib/permissions";
import { hashPassword } from "@/lib/password";
import { isGodUser } from "@/lib/god-user";

/**
 * POST /api/team/:id/force-reset-password
 *
 * Endpoint de emergencia para destrabar usuarios cuando Resend no entrega
 * el correo de activación/recuperación (dominio sin verificar, API key
 * faltante, cuenta suspendida, etc.). El admin escribe la nueva contraseña
 * directamente y queda guardada bcrypteada en crm_users.
 *
 * Reglas:
 *   - Requiere sesión activa con team.manage.
 *   - Bloquea cambiar la contraseña del god user a menos que seas vos mismo.
 *   - Limpia reset_token/reset_token_expires para invalidar links viejos
 *     que pudieran seguir vivos en algún correo.
 *
 * Body: { password: string }    (mínimo 6 caracteres)
 * Response: { ok: true, user: { id, name, email } }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const session = await loadFreshSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  }
  if (!hasPermission({ role: session.role, permissions: session.permissions }, "team.manage")) {
    return NextResponse.json({ error: "No tenés permiso para cambiar contraseñas." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({} as { password?: string }));
  const password = typeof body.password === "string" ? body.password.trim() : "";

  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres." },
      { status: 400 }
    );
  }

  await ensureCrmSchema();
  const pool = getPool();

  const { rows } = await pool.query(
    `SELECT id, name, email FROM crm_users WHERE id = $1 LIMIT 1`,
    [id]
  );
  const user = rows[0] as { id: string; name: string; email: string | null } | undefined;
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  // Proteger al god user: solo él mismo puede cambiar su propia clave por esta vía.
  if (isGodUser({ id: user.id, email: user.email }) && !isGodUser(session)) {
    return NextResponse.json(
      { error: "Esa cuenta está protegida. Solo el dueño puede cambiar su contraseña." },
      { status: 403 }
    );
  }

  // Asegurar columnas de reset (idempotente — mismo ALTER que usan los otros flujos).
  await pool.query(`
    ALTER TABLE crm_users
      ADD COLUMN IF NOT EXISTS reset_token TEXT,
      ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
  `);

  const hashed = await hashPassword(password);
  await pool.query(
    `UPDATE crm_users
        SET password = $1,
            reset_token = NULL,
            reset_token_expires = NULL,
            updated_at = NOW()
      WHERE id = $2`,
    [hashed, user.id]
  );

  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email },
  });
}
