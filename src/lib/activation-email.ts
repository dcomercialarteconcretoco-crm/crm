import crypto from "crypto";
import type { getPool } from "./postgres";
import { getFromEmail } from "./email";

/**
 * Correo de bienvenida + activación de cuenta.
 *
 * Vivía dentro de /api/team/route.ts. Se extrajo cuando el relevo de personal
 * (/api/team/handover) pasó a necesitar exactamente el mismo envío: el
 * reemplazo que entra tiene que recibir su invitación igual que cualquier alta
 * normal, y duplicar el HTML garantizaba que un día se despeguen.
 */

type PoolLike = ReturnType<typeof getPool>;

export function buildActivationEmail(
  name: string,
  role: string,
  activationUrl: string,
  inviterName: string
): string {
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
export async function sendActivationEmail(opts: {
  pool: PoolLike;
  userId: string;
  name: string;
  email: string;
  role: string;
  inviterName: string;
  appUrl: string;
}): Promise<{ ok: boolean; error?: string; activationUrl?: string }> {
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
    return {
      ok: false,
      activationUrl,
      error:
        "RESEND_API_KEY no configurada en el server. Pasale el link al usuario manualmente: " +
        activationUrl,
    };
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
      return {
        ok: false,
        activationUrl,
        error: `Resend HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
    }
    const data = await res.json().catch(() => ({} as { id?: string }));
    console.info("[team/activation] Resend accepted:", {
      to: opts.email,
      resendId: data.id,
    });
    return { ok: true, activationUrl };
  } catch (err) {
    console.error("[team/activation] error de red:", err);
    return {
      ok: false,
      activationUrl,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
