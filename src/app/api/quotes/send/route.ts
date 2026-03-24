import { NextRequest, NextResponse } from 'next/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'cotizaciones@arteconcreto.co';

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const { quoteNumber, clientName, clientEmail, clientCompany, sellerName, items, subtotal, tax, total } = payload;

  if (!clientEmail) {
    return NextResponse.json({ error: 'Email del cliente requerido.' }, { status: 400 });
  }

  const resendKey = RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY no configurada. Agrégala en Variables de Entorno de Vercel.' }, { status: 400 });
  }

  const formatCOP = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

  const itemRows = items.map((item: { name: string; price: number; quantity: number; unit: string }) => `
    <tr style="border-bottom:1px solid #f0e8d0;">
      <td style="padding:12px 16px;font-size:13px;color:#1a1a1d;font-weight:600;">${item.name}</td>
      <td style="padding:12px 16px;text-align:center;font-size:13px;color:#fab510;font-weight:900;">${item.quantity} ${item.unit || 'un'}</td>
      <td style="padding:12px 16px;text-align:right;font-size:13px;color:#555;">${formatCOP(item.price)}</td>
      <td style="padding:12px 16px;text-align:right;font-size:13px;font-weight:900;color:#1a1a1d;">${formatCOP(item.price * item.quantity)}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cotización ${quoteNumber}</title></head>
<body style="margin:0;padding:0;background:#f9f6ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:620px;margin:0 auto;padding:32px 16px;">
  <div style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#1a1a1d;padding:36px 40px;text-align:center;">
      <div style="font-size:11px;color:#fab510;letter-spacing:4px;font-weight:900;text-transform:uppercase;margin-bottom:8px;">Arte Concreto S.A.S</div>
      <div style="font-size:28px;color:#fff;font-weight:900;letter-spacing:-1px;">COTIZACIÓN</div>
      <div style="display:inline-block;background:rgba(250,181,16,0.15);border:1px solid rgba(250,181,16,0.4);border-radius:8px;padding:6px 16px;margin-top:12px;">
        <span style="font-size:13px;color:#fab510;font-weight:900;letter-spacing:2px;">${quoteNumber}</span>
      </div>
    </div>
    <div style="padding:32px 40px;">
      <p style="font-size:15px;color:#1a1a1d;margin:0 0 4px 0;">Estimado/a <strong>${clientName}</strong>${clientCompany ? ` — ${clientCompany}` : ''},</p>
      <p style="font-size:14px;color:#666;margin:8px 0 24px 0;">Adjuntamos la cotización solicitada. Para cualquier consulta, no dudes en contactarnos.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background:#f9f6ef;">
            <th style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#888;font-weight:900;">Descripción</th>
            <th style="padding:10px 16px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#888;font-weight:900;">Cant.</th>
            <th style="padding:10px 16px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#888;font-weight:900;">Precio</th>
            <th style="padding:10px 16px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#888;font-weight:900;">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="background:#f9f6ef;border-radius:12px;padding:20px 24px;text-align:right;">
        <div style="font-size:13px;color:#666;margin-bottom:4px;">Subtotal: <strong style="color:#1a1a1d;">${formatCOP(subtotal)}</strong></div>
        <div style="font-size:13px;color:#666;margin-bottom:8px;">IVA (19%): <strong style="color:#1a1a1d;">${formatCOP(tax)}</strong></div>
        <div style="font-size:20px;font-weight:900;color:#fab510;">TOTAL: ${formatCOP(total)}</div>
      </div>
    </div>
    <div style="background:#1a1a1d;padding:24px 40px;text-align:center;">
      <p style="font-size:12px;color:#888;margin:0;">Atendido por <strong style="color:#fab510;">${sellerName}</strong> · Arte Concreto S.A.S · Medellín, Colombia</p>
    </div>
  </div>
</div>
</body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [clientEmail],
      subject: `Cotización ${quoteNumber} — Arte Concreto S.A.S`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: err.message || 'Error enviando email via Resend.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, quoteNumber });
}
