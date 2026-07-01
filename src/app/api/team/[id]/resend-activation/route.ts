import { NextRequest, NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";
import { loadFreshSession } from "@/lib/auth-session";
import { hasPermission } from "@/lib/permissions";
import { getFromEmail } from "@/lib/email";
import crypto from "crypto";

function getAppUrl(request: NextRequest) {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin).replace(/\/$/, "");
}

/**
 * POST /api/team/:id/resend-activation
 *
 * Genera un token de activación nuevo y le manda al user el correo de
 * bienvenida. Sirve para:
 *   - Usuarios viejos que se crearon antes del fix de envío automático
 *     y nunca recibieron el mensaje (caso "gestor3").
 *   - Casos donde el correo se perdió en spam o el user lo borró.
 *   - Tokens caducados (>24h).
 *
 * Solo admins con `team.manage` pueden disparar el reenvío. El payload de
 * respuesta dice si Resend aceptó el envío para que la UI muestre feedback
 * concreto en vez del clásico "ok: true" mentiroso.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const session = await loadFreshSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  }
  if (!hasPermission({ role: session.role, permissions: session.permissions }, "team.manage")) {
    return NextResponse.json({ error: "No tenés permiso para reenviar invitaciones." }, { status: 403 });
  }

  const { id } = await params;
  await ensureCrmSchema();
  const pool = getPool();

  // Asegurar columnas del token (idempotente — mismo ALTER del flujo de reset).
  await pool.query(`
    ALTER TABLE crm_users
      ADD COLUMN IF NOT EXISTS reset_token TEXT,
      ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
  `);

  const { rows } = await pool.query(
    `SELECT id, name, email, role FROM crm_users WHERE id = $1 LIMIT 1`,
    [id]
  );
  const user = rows[0] as { id: string; name: string; email: string | null; role: string } | undefined;

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }
  if (!user.email) {
    return NextResponse.json({ error: "Este usuario no tiene email registrado. Editalo primero y agregale uno." }, { status: 400 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await pool.query(
    `UPDATE crm_users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3`,
    [token, expires.toISOString(), user.id]
  );

  const activationUrl = `${getAppUrl(request)}/reset-password?token=${token}&welcome=1`;
  const resendKey = process.env.RESEND_API_KEY;

  if (!resendKey) {
    return NextResponse.json({
      ok: false,
      error: "RESEND_API_KEY no configurada en el server. Pasale el link manualmente.",
      activationUrl,
    }, { status: 500 });
  }

  const inviterName = session.name || "Tu equipo";
  const html = `<!DOCTYPE html>
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
          <h2 style="margin:0 0 8px;font-size:22px;color:#111;font-weight:800;">¡Bienvenido al equipo, ${user.name}!</h2>
          <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6;">
            <strong>${inviterName}</strong> te dio acceso al CRM Intelligence de ArteConcreto con el rol de <strong style="color:#fab510;">${user.role}</strong>.
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

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: getFromEmail(),
        to: [user.email],
        subject: "Bienvenido al CRM ArteConcreto — Activá tu cuenta",
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json({
        ok: false,
        error: `Resend HTTP ${res.status}: ${body.slice(0, 200)}`,
        activationUrl,
      }, { status: 500 });
    }
    const data = await res.json().catch(() => ({} as { id?: string }));
    console.info("[team/resend-activation] Resend accepted:", {
      to: user.email,
      resendId: data.id,
    });
    return NextResponse.json({ ok: true, sentTo: user.email });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      activationUrl,
    }, { status: 500 });
  }
}
