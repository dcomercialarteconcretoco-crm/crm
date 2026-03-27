import { NextRequest, NextResponse } from 'next/server';

const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function formatDate(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${d} de ${MONTH_NAMES[m - 1]} de ${y}`;
}

function typeLabel(type: string) {
    const map: Record<string, string> = {
        meeting: 'Reunión', visit: 'Visita', call: 'Llamada', delivery: 'Entrega', other: 'Evento'
    };
    return map[type] || 'Evento';
}

export async function POST(req: NextRequest) {
    try {
        const { title, date, time, type, meetingLink, description, invitees, organizer } = await req.json();

        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) return NextResponse.json({ ok: false, error: 'No RESEND_API_KEY' });

        const recipients = (invitees as { name: string; email: string }[]).filter(i => i.email?.includes('@'));
        if (!recipients.length) return NextResponse.json({ ok: true, sent: 0 });

        const dateStr = formatDate(date);
        const kind = typeLabel(type);

        const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <tr><td style="background:#111;padding:28px 36px;text-align:center;">
        <img src="https://arteconcreto.co/wp-content/uploads/2026/03/cropped-Logo-Web-72ppi-237x96-1.png" alt="ArteConcreto" height="44" style="height:44px;object-fit:contain;" />
      </td></tr>
      <tr><td style="background:#fab510;height:4px;"></td></tr>
      <tr><td style="padding:36px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:#fab510;">${kind} confirmado</p>
        <h2 style="margin:0 0 24px;font-size:22px;font-weight:900;color:#111;">${title}</h2>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1.5px solid #f0f0f0;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
          <tr>
            <td style="padding:8px 0;color:#555;font-size:13px;">📅 <strong>Fecha</strong></td>
            <td style="padding:8px 0;font-size:13px;font-weight:700;color:#111;text-align:right;">${dateStr}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#555;font-size:13px;">🕐 <strong>Hora</strong></td>
            <td style="padding:8px 0;font-size:13px;font-weight:700;color:#111;text-align:right;">${time} hrs</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#555;font-size:13px;">👤 <strong>Organiza</strong></td>
            <td style="padding:8px 0;font-size:13px;font-weight:700;color:#111;text-align:right;">${organizer || 'ArteConcreto'}</td>
          </tr>
          ${meetingLink ? `<tr>
            <td style="padding:8px 0;color:#555;font-size:13px;">🔗 <strong>Link</strong></td>
            <td style="padding:8px 0;text-align:right;"><a href="${meetingLink}" style="color:#fab510;font-weight:700;font-size:13px;">Unirse a la reunión</a></td>
          </tr>` : ''}
        </table>

        ${description ? `<div style="background:#fffbee;border:1.5px solid #fab51030;border-radius:10px;padding:14px 18px;margin-bottom:24px;">
          <p style="margin:0;font-size:13px;color:#555;line-height:1.6;">${description}</p>
        </div>` : ''}

        ${meetingLink ? `<div style="text-align:center;margin-bottom:24px;">
          <a href="${meetingLink}" style="display:inline-block;background:#fab510;color:#000;font-weight:900;font-size:12px;text-decoration:none;padding:14px 32px;border-radius:12px;letter-spacing:1px;text-transform:uppercase;">
            Unirse ahora →
          </a>
        </div>` : ''}

        <p style="margin:0;font-size:12px;color:#999;">
          Agregaste este evento desde el CRM Intelligence de ArteConcreto. Si tienes dudas, contáctanos a <span style="color:#fab510;">contacto@arteconcreto.co</span>
        </p>
      </td></tr>
      <tr><td style="background:#111;padding:18px 36px;text-align:center;">
        <p style="margin:0;font-size:10px;color:#555;letter-spacing:2px;text-transform:uppercase;">ArteConcreto S.A.S · CRM Intelligence</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

        const results = await Promise.allSettled(recipients.map(inv =>
            fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: 'ArteConcreto Agenda <agenda@arteconcreto.co>',
                    to: [inv.email],
                    subject: `📅 ${kind}: ${title} — ${dateStr}`,
                    html,
                }),
            })
        ));

        const sent = results.filter(r => r.status === 'fulfilled').length;
        return NextResponse.json({ ok: true, sent });
    } catch (err) {
        console.error('agenda/notify error:', err);
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
