import { NextRequest, NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";
import { hashPassword, isBcryptHash } from "@/lib/password";
import { isGodUser } from "@/lib/god-user";
import { loadFreshSession } from "@/lib/auth-session";
import { hasPermission } from "@/lib/permissions";
import { getFromEmail } from "@/lib/email";
import crypto from "crypto";

function getAppUrl(request: NextRequest) {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin).replace(/\/$/, "");
}

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

/**
 * Genera el HTML del correo de bienvenida + activación. Mismo look-and-feel
 * que el reset-password (logo, banda dorada, tipografía oscura) para que el
 * usuario reconozca que es de ArteConcreto y no lo mande a Spam.
 */
function buildActivationEmail(name: string, role: string, activationUrl: string, inviterName: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:#111;padding:32px 40px;text-align:center;">
          <img src="https://arteconcreto.co/wp-content/uploads/2026/03/cropped-Logo-Web-72ppi-237x96-1.png" alt="ArteConcreto" height="48" style="height:48px;object-fit:contain;" />
        </td></tr>
        <tr><td style="background:#fab510;height:4px;"></td></tr>
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 8px;font-size:22px;color:#111;font-weight:800;">¡Bienvenido al equipo, ${name}!</h2>
          <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6;">
            ${inviterName ? `<strong>${inviterName}</strong> te dio acceso` : 'Tenés acceso'} al CRM Intelligence de ArteConcreto con el rol de <strong style="color:#fab510;">${role}</strong>.
          </p>
          <p style="margin:0 0 32px;font-size:14px;color:#555;line-height:1.6;">
            Para empezar a usarlo, definí tu contraseña haciendo clic en el botón. El enlace es válido durante <strong>24 horas</strong>.
          </p>
          <div style="text-align:center;margin-bottom:32px;">
            <a href="${activationUrl}" style="display:inline-block;background:#fab510;color:#111;text-decoration:none;font-weight:900;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;padding:16px 40px;border-radius:12px;">
              Activar mi cuenta
            </a>
          </div>
          <p style="margin:0 0 8px;font-size:12px;color:#999;line-height:1.6;">
            Si el enlace expira, pedile al administrador que te reenvíe la invitación.
          </p>
          <p style="margin:0;font-size:11px;color:#bbb;">
            O copiá y pegá este enlace en tu navegador:<br/>
            <span style="color:#fab510;word-break:break-all;">${activationUrl}</span>
          </p>
        </td></tr>
        <tr><td style="background:#111;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.2em;">
            ArteConcreto S.A.S • CRM Intelligence
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Manda el correo de activación. Devuelve { ok, error? } así el caller decide
 * qué hacer con el resultado. No tira si falla — el usuario igual quedó creado
 * en la DB, sólo que sin correo (el admin puede reenviar).
 */
async function sendActivationEmail(opts: {
  pool: ReturnType<typeof getPool>;
  userId: string;
  name: string;
  email: string;
  role: string;
  inviterName: string;
  appUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  // Reusamos las mismas columnas que el reset-password — un token y un
  // expires. Garantizamos que existen (idempotente, mismo ALTER del flujo
  // de reset).
  await opts.pool.query(`
    ALTER TABLE crm_users
      ADD COLUMN IF NOT EXISTS reset_token TEXT,
      ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
  `);

  const token = crypto.randomBytes(32).toString("hex");
  // 24 horas para activación inicial — más laxo que el 1h del reset porque
  // el user puede tardar más en revisar el correo y elegir password.
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await opts.pool.query(
    `UPDATE crm_users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3`,
    [token, expires.toISOString(), opts.userId]
  );

  // Reusamos /reset-password como página de seteo de contraseña — funciona
  // idéntico para "primera contraseña" que para "olvidé contraseña" desde
  // la perspectiva del backend (ambos validan el token y guardan el hash).
  const activationUrl = `${opts.appUrl}/reset-password?token=${token}&welcome=1`;

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("[team/activation] RESEND_API_KEY no configurada. URL:", activationUrl);
    return { ok: false, error: "RESEND_API_KEY no configurada en el server. Pasale el link al usuario manualmente: " + activationUrl };
  }

  const html = buildActivationEmail(opts.name, opts.role, activationUrl, opts.inviterName);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: getFromEmail(),
        to: [opts.email],
        subject: `Bienvenido al CRM ArteConcreto — Activá tu cuenta`,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[team/activation] Resend rechazó:", res.status, body);
      return { ok: false, error: `Resend HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = await res.json().catch(() => ({} as { id?: string }));
    console.info("[team/activation] Resend accepted:", {
      to: opts.email,
      resendId: data.id,
    });
    return { ok: true };
  } catch (err) {
    console.error("[team/activation] error de red:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
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

  // Detectamos si esto es INSERT o UPDATE para decidir si mandamos correo de
  // activación. Truco de Postgres: xmax = 0 en inserts, distinto en updates.
  // RETURNING (xmax = 0) AS inserted nos lo dice en una sola query.
  const result = await pool.query(
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
      RETURNING (xmax = 0) AS inserted
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

  // Mandar correo de activación SOLO cuando:
  //   - fue un INSERT (no update de un usuario existente)
  //   - el user tiene email
  //   - no se forzó skip vía payload.skipActivationEmail (útil para imports/seeds)
  //
  // Antes de este flujo, /api/team POST creaba al user en la DB y nada más:
  // el "gestor3" se creaba pero nunca le llegaba mensaje, y el admin tenía que
  // o bien decirle la contraseña por WhatsApp, o usar "Olvidé mi contraseña"
  // como hack para que pudiera entrar. Ahora va el correo formal.
  const wasInserted = result.rows[0]?.inserted === true;
  let activation: { sent: boolean; error?: string } = { sent: false };
  if (wasInserted && payload.email && !payload.skipActivationEmail) {
    const r = await sendActivationEmail({
      pool,
      userId: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role || 'Vendedor',
      inviterName: session.name || '',
      appUrl: getAppUrl(request),
    });
    activation = { sent: r.ok, error: r.error };
  }

  return NextResponse.json({ ok: true, inserted: wasInserted, activation });
}
