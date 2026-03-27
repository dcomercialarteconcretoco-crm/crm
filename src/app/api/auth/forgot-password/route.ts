import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase, getPool } from '@/lib/postgres';
import crypto from 'crypto';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-sand-three.vercel.app';

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();
    if (!username?.trim()) {
      return NextResponse.json({ error: 'Usuario requerido' }, { status: 400 });
    }

    if (!hasDatabase()) {
      return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
    }

    const pool = getPool();

    // Ensure reset token columns exist (idempotent)
    await pool.query(`
      ALTER TABLE crm_users
        ADD COLUMN IF NOT EXISTS reset_token TEXT,
        ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
    `);

    // Look up user by username OR email
    const { rows } = await pool.query(
      `SELECT id, name, email FROM crm_users WHERE username = $1 OR email = $1 LIMIT 1`,
      [username.trim()]
    );

    // Always return success to prevent user enumeration
    if (!rows.length || !rows[0].email) {
      return NextResponse.json({ ok: true });
    }

    const user = rows[0] as { id: string; name: string; email: string };
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      `UPDATE crm_users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3`,
      [token, expires.toISOString(), user.id]
    );

    const resetUrl = `${APP_URL}/reset-password?token=${token}`;

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.error('RESEND_API_KEY not configured — reset link:', resetUrl);
      return NextResponse.json({ ok: true });
    }

    const emailHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:#111;padding:32px 40px;text-align:center;">
          <img src="https://arteconcreto.co/wp-content/uploads/2026/03/cropped-Logo-Web-72ppi-237x96-1.png" alt="Arte Concreto" height="48" style="height:48px;object-fit:contain;" />
        </td></tr>
        <tr><td style="background:#fab510;height:4px;"></td></tr>
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 8px;font-size:22px;color:#111;font-weight:800;">Hola, ${user.name}</h2>
          <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta en el CRM Intelligence de Arte Concreto.
          </p>
          <p style="margin:0 0 32px;font-size:14px;color:#555;line-height:1.6;">
            Haz clic en el botón a continuación para crear una nueva contraseña. Este enlace es válido durante <strong>1 hora</strong>.
          </p>
          <div style="text-align:center;margin-bottom:32px;">
            <a href="${resetUrl}" style="display:inline-block;background:#fab510;color:#111;text-decoration:none;font-weight:900;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;padding:16px 40px;border-radius:12px;">
              Restablecer contraseña
            </a>
          </div>
          <p style="margin:0 0 8px;font-size:12px;color:#999;line-height:1.6;">
            Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña no cambiará.
          </p>
          <p style="margin:0;font-size:11px;color:#bbb;">
            O copia y pega este enlace en tu navegador:<br/>
            <span style="color:#fab510;word-break:break-all;">${resetUrl}</span>
          </p>
        </td></tr>
        <tr><td style="background:#111;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.2em;">
            Arte Concreto S.A.S • CRM Intelligence
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ArteConcreto CRM <noreply@arteconcreto.co>',
        to: [user.email],
        subject: 'Recuperación de contraseña — CRM Intelligence',
        html: emailHtml,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('forgot-password error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
