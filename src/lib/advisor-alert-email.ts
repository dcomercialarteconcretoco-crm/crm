import { getFromEmail } from '@/lib/email';

const DEFAULT_RECIPIENT = 'dcomercial@arteconcreto.co';

type AdvisorAlertInput = {
    leadName?: string;
    phone?: string;
    email?: string;
    company?: string;
    city?: string;
    message?: string;
    source: 'ConcreBOT' | 'WhatsApp';
    conversationId: string;
    clientId?: string | null;
    appUrl: string;
    recipient?: string;
};

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizePhone(phone?: string) {
    const digits = (phone || '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.length === 10 ? `57${digits}` : digits;
}

function appLink(appUrl: string, path: string) {
    return `${appUrl.replace(/\/$/, '')}${path}`;
}

export async function sendAdvisorNeededEmail(input: AdvisorAlertInput) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.warn('[advisor-alert] RESEND_API_KEY no configurada');
        return { ok: false, skipped: true, reason: 'RESEND_API_KEY missing' };
    }

    const leadName = (input.leadName || '').trim() || 'Un cliente';
    const phone = normalizePhone(input.phone);
    const message = (input.message || '').trim() || 'El cliente escribió y requiere atención comercial.';
    const panelUrl = appLink(input.appUrl, `/bot?conversation=${encodeURIComponent(input.conversationId)}`);
    const leadUrl = input.clientId ? appLink(input.appUrl, `/leads/${encodeURIComponent(input.clientId)}`) : '';
    const whatsappUrl = phone ? `https://wa.me/${phone}` : '';

    const safeLead = escapeHtml(leadName);
    const details = [
        input.company ? `Empresa: ${input.company}` : '',
        input.city ? `Ciudad: ${input.city}` : '',
        input.email ? `Email: ${input.email}` : '',
        phone ? `Teléfono: ${phone}` : '',
    ].filter(Boolean).map(escapeHtml);

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f7f2;font-family:Arial,Helvetica,sans-serif;color:#202124;">
  <div style="max-width:640px;margin:0 auto;padding:32px 18px;">
    <div style="background:#fff;border-radius:18px;border:1px solid #e6e8df;overflow:hidden;box-shadow:0 8px 28px rgba(20,30,10,0.08);">
      <div style="background:#1a1a1d;padding:22px 28px;border-bottom:4px solid #fab510;">
        <p style="margin:0;font-size:11px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:#fab510;">${escapeHtml(input.source)} · Atención requerida</p>
        <h1 style="margin:8px 0 0;font-size:25px;line-height:1.2;color:#fff;">ASESOR — ${safeLead} necesita atención</h1>
      </div>
      <div style="padding:28px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;"><strong>Cliente:</strong> ${safeLead}${phone ? ` (${escapeHtml(phone)})` : ''}</p>
        ${details.length ? `<div style="margin:0 0 18px;padding:14px 16px;background:#faf7ed;border:1px solid #f0dfb6;border-radius:12px;">
          ${details.map(d => `<p style="margin:4px 0;font-size:13px;color:#555;">${d}</p>`).join('')}
        </div>` : ''}
        <p style="margin:0 0 22px;font-size:16px;line-height:1.7;"><strong>Qué pasó:</strong> te respondió: "${escapeHtml(message)}"</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px;">
          ${whatsappUrl ? `<a href="${whatsappUrl}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:900;font-size:13px;padding:12px 18px;border-radius:12px;">Responder por WhatsApp</a>` : ''}
          <a href="${panelUrl}" style="display:inline-block;background:#fab510;color:#000;text-decoration:none;font-weight:900;font-size:13px;padding:12px 18px;border-radius:12px;">Abrir conversación en CRM</a>
          ${leadUrl ? `<a href="${leadUrl}" style="display:inline-block;background:#f1f3f4;color:#202124;text-decoration:none;font-weight:900;font-size:13px;padding:12px 18px;border-radius:12px;">Ver ficha del cliente</a>` : ''}
        </div>
        <p style="margin:0;font-size:12px;color:#777;line-height:1.6;">Este correo fue generado automáticamente para que Dirección Comercial pueda asignar la conversación al asesor correspondiente.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: getFromEmail('ConcreBOT ArteConcreto'),
            to: [input.recipient || DEFAULT_RECIPIENT],
            subject: `ASESOR — ${leadName} necesita atención (${input.source})`,
            html,
        }),
    });

    if (!response.ok) {
        const err = await response.text().catch(() => '');
        console.error('[advisor-alert] error enviando correo:', err || response.status);
        return { ok: false, status: response.status };
    }

    return { ok: true };
}
