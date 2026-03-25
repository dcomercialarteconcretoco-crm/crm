import { NextRequest, NextResponse } from 'next/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'cotizaciones@arteconcreto.co';
const CC_EMAIL = 'marketing@arteconcreto.co';

// Logo con fondo claro — se muestra en píldora blanca dentro del header oscuro
const LOGO_URL = 'https://cuantium.com/wp-content/uploads/2026/02/logo.png';

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const {
    quoteNumber,
    clientName,
    clientEmail,
    clientCompany,
    sellerName,
    sellerId,
    items,
    subtotal,
    tax,
    total,
    sentAt,
    sentByName,
    sentById,
  } = payload;

  if (!clientEmail) {
    return NextResponse.json({ error: 'Email del cliente requerido.' }, { status: 400 });
  }

  const resendKey = RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY no configurada.' }, { status: 400 });
  }

  const formatCOP = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

  const sentDateStr = new Date(sentAt || Date.now()).toLocaleString('es-CO', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Bogota',
  });

  const fechaCorta = new Date(sentAt || Date.now()).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Bogota',
  });

  type EmailItem = { name: string; price: number; quantity: number; unit: string };

  const itemRows = items.map((item: EmailItem, idx: number) => `
    <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#fdfbf7'};">
      <td style="padding:14px 16px;font-size:13px;color:#1a1a1d;font-weight:600;border-bottom:1px solid #f0ebe0;">${item.name}</td>
      <td style="padding:14px 16px;text-align:center;font-size:13px;color:#fab510;font-weight:900;border-bottom:1px solid #f0ebe0;">${item.quantity}&nbsp;${item.unit || 'un'}</td>
      <td style="padding:14px 16px;text-align:right;font-size:13px;color:#777;border-bottom:1px solid #f0ebe0;">${formatCOP(item.price)}</td>
      <td style="padding:14px 16px;text-align:right;font-size:13px;font-weight:900;color:#1a1a1d;border-bottom:1px solid #f0ebe0;">${formatCOP(item.price * item.quantity)}</td>
    </tr>
  `).join('');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EMAIL AL CLIENTE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const htmlCliente = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Cotización ${quoteNumber} — ArteConcreto</title>
</head>
<body style="margin:0;padding:0;background:#f2ede4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

<div style="max-width:640px;margin:0 auto;padding:28px 16px 48px;">
<div style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.12);">

  <!-- ══ ENCABEZADO OSCURO ═══════════════════════════════════════════════════ -->
  <div style="background:#1a1a1d;">
    <!-- Franja dorada superior -->
    <div style="height:5px;background:linear-gradient(90deg,#c88a00 0%,#fab510 40%,#ffd966 60%,#fab510 80%,#c88a00 100%);"></div>

    <!-- Header en 2 columnas -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <!-- ── Columna izquierda: logo en píldora blanca ── -->
        <td style="padding:28px 0 22px 32px;vertical-align:middle;width:52%;">
          <div style="display:inline-block;background:#ffffff;border-radius:14px;padding:10px 18px;box-shadow:0 2px 12px rgba(0,0,0,0.25);">
            <img
              src="${LOGO_URL}"
              alt="ArteConcreto Mobiliario"
              width="168"
              height="68"
              style="display:block;width:168px;height:68px;object-fit:contain;"
            />
          </div>
        </td>
        <!-- ── Columna derecha: número cotización ── -->
        <td style="padding:28px 32px 22px 0;vertical-align:middle;text-align:right;">
          <div style="font-size:8px;color:#6b6b6b;letter-spacing:4px;text-transform:uppercase;font-weight:900;margin-bottom:8px;">Cotización Nro.</div>
          <div style="background:rgba(250,181,16,0.10);border:2px solid #fab510;border-radius:12px;padding:10px 20px;display:inline-block;">
            <span style="font-size:18px;color:#fab510;font-weight:900;letter-spacing:2px;">${quoteNumber}</span>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#555;letter-spacing:0.5px;">${fechaCorta}</div>
        </td>
      </tr>
    </table>

    <!-- Separador dorado sutil -->
    <div style="height:1px;background:rgba(250,181,16,0.15);margin:0 32px;"></div>

    <!-- Saludo dentro del header -->
    <div style="padding:18px 32px 28px;">
      <p style="margin:0;font-size:15px;color:#d0d0d0;line-height:1.7;">
        Estimado/a <strong style="color:#ffffff;">${clientName}</strong>${clientCompany ? `<span style="color:#fab510;"> &mdash; ${clientCompany}</span>` : ''},
      </p>
      <p style="margin:7px 0 0;font-size:13px;color:#7a7a7a;line-height:1.6;">
        Nos complace presentarle la siguiente propuesta comercial. Estamos a su disposición para cualquier consulta.
      </p>
    </div>
  </div>
  <!-- ══ FIN ENCABEZADO ═══════════════════════════════════════════════════════ -->

  <!-- TABLA PRODUCTOS -->
  <div style="padding:28px 32px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #ede8da;">
      <thead>
        <tr style="background:#f5f0e8;">
          <th style="padding:11px 16px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:2.5px;color:#aaa;font-weight:900;border-bottom:2px solid #e8e1d0;">Descripción</th>
          <th style="padding:11px 16px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:2.5px;color:#aaa;font-weight:900;border-bottom:2px solid #e8e1d0;">Cant.</th>
          <th style="padding:11px 16px;text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:2.5px;color:#aaa;font-weight:900;border-bottom:2px solid #e8e1d0;">P.&nbsp;Unit.</th>
          <th style="padding:11px 16px;text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:2.5px;color:#aaa;font-weight:900;border-bottom:2px solid #e8e1d0;">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
  </div>

  <!-- TOTALES -->
  <div style="margin:4px 32px 28px;background:#faf7f0;border-radius:14px;padding:20px 24px;border:1px solid #ede8da;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="font-size:13px;color:#999;padding:5px 0;">Subtotal</td>
        <td style="font-size:13px;color:#444;font-weight:700;text-align:right;padding:5px 0;">${formatCOP(subtotal)}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#999;padding:5px 0;">IVA (19%)</td>
        <td style="font-size:13px;color:#444;font-weight:700;text-align:right;padding:5px 0;">${formatCOP(tax)}</td>
      </tr>
      <tr>
        <td colspan="2"><div style="height:1px;background:#e0d9cc;margin:12px 0;"></div></td>
      </tr>
      <tr>
        <td style="font-size:10px;color:#fab510;font-weight:900;text-transform:uppercase;letter-spacing:3px;padding-bottom:2px;">Total a Pagar</td>
        <td style="font-size:26px;color:#fab510;font-weight:900;text-align:right;letter-spacing:-0.5px;line-height:1;">${formatCOP(total)}</td>
      </tr>
    </table>
  </div>

  <!-- FOOTER OSCURO: asesor + contacto -->
  <div style="background:#1a1a1d;padding:20px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="vertical-align:middle;">
          <p style="margin:0;font-size:13px;color:#aaa;">
            Asesor: <strong style="color:#fab510;">${sellerName}</strong>
          </p>
          <p style="margin:5px 0 0;font-size:12px;color:#555;">
            <span style="color:#888;">cotizaciones&#64;arteconcreto&#46;co</span>
            &nbsp;&middot;&nbsp;
            <span style="color:#666;">Medell&#237;n, Colombia</span>
          </p>
        </td>
        <td style="text-align:right;vertical-align:middle;">
          <div style="width:40px;height:40px;background:rgba(250,181,16,0.10);border:1.5px solid rgba(250,181,16,0.35);border-radius:50%;display:inline-table;line-height:40px;text-align:center;">
            <span style="font-size:18px;display:table-cell;vertical-align:middle;">🏗️</span>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <!-- CRÉDITO MIWIBI -->
  <div style="background:#111113;padding:11px 32px;text-align:center;border-top:1px solid #2a2a2d;">
    <p style="margin:0;font-size:10px;color:#3a3a3a;letter-spacing:0.3px;">
      MiWibiCRM &nbsp;&middot;&nbsp; Desarrollado para ArteConcreto por&nbsp;
      <a href="https://miwibi.com" target="_blank"
         style="color:#fab510;text-decoration:none;font-weight:700;">MiWibi.com</a>
    </p>
  </div>

</div><!-- /card -->
</div><!-- /wrapper -->
</body>
</html>`;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EMAIL INTERNO — copia para marketing
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const htmlInterno = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Copia Interna — ${quoteNumber}</title></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:28px 16px 48px;">
  <div style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#1a1a1d;padding:0;">
      <div style="height:4px;background:linear-gradient(90deg,#fab510,#ffd966,#fab510);"></div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:22px 0 22px 28px;vertical-align:middle;width:55%;">
            <div style="display:inline-block;background:#fff;border-radius:10px;padding:8px 14px;">
              <img src="${LOGO_URL}" alt="ArteConcreto" width="130" height="53" style="display:block;width:130px;height:53px;object-fit:contain;" />
            </div>
            <div style="margin-top:7px;font-size:9px;color:#fab510;letter-spacing:3px;text-transform:uppercase;font-weight:900;">CRM &middot; Copia Interna</div>
          </td>
          <td style="padding:22px 28px 22px 0;vertical-align:middle;text-align:right;">
            <div style="font-size:8px;color:#666;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">Cotización</div>
            <div style="background:rgba(250,181,16,0.12);border:1.5px solid rgba(250,181,16,0.5);border-radius:9px;padding:6px 14px;display:inline-block;">
              <span style="font-size:15px;color:#fab510;font-weight:900;">${quoteNumber}</span>
            </div>
          </td>
        </tr>
      </table>
    </div>
    <div style="padding:24px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        ${[
          ['Cliente', `${clientName}${clientCompany ? ` &mdash; ${clientCompany}` : ''}`],
          ['Email cliente', clientEmail],
          ['Enviado por', `<strong style="color:#fab510;">${sentByName || sellerName}</strong>`],
          ['Fecha y hora', sentDateStr],
          ['Total cotizado', `<strong style="color:#fab510;font-size:17px;">${formatCOP(total)}</strong>`],
        ].map(([label, value]) => `
          <tr style="border-bottom:1px solid #f0f0f0;">
            <td style="padding:11px 0;font-size:10px;color:#aaa;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;width:36%;">${label}</td>
            <td style="padding:11px 0;font-size:13px;color:#1a1a1d;">${value}</td>
          </tr>
        `).join('')}
      </table>
      <div style="margin-top:18px;background:#faf7f0;border-radius:12px;padding:16px 20px;border:1px solid #ede8da;">
        <p style="margin:0 0 10px;font-size:9px;color:#aaa;font-weight:900;text-transform:uppercase;letter-spacing:2px;">Productos cotizados</p>
        ${items.map((item: EmailItem) =>
          `<p style="margin:6px 0 0;font-size:12px;color:#444;">
            <span style="color:#fab510;font-weight:900;">${item.quantity}&nbsp;${item.unit || 'un'}</span>
            &times; ${item.name}
            <span style="float:right;font-weight:700;color:#1a1a1d;">${formatCOP(item.price * item.quantity)}</span>
          </p>`
        ).join('')}
      </div>
    </div>
    <div style="background:#1a1a1d;padding:14px 28px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#555;">Correo autom&#225;tico del CRM &middot; No responder</p>
    </div>
    <div style="background:#111113;padding:10px 28px;text-align:center;border-top:1px solid #2a2a2d;">
      <p style="margin:0;font-size:10px;color:#3a3a3a;">
        MiWibiCRM &middot; Desarrollado para ArteConcreto por&nbsp;
        <a href="https://miwibi.com" target="_blank" style="color:#fab510;text-decoration:none;font-weight:700;">MiWibi.com</a>
      </p>
    </div>
  </div>
</div>
</body>
</html>`;

  // ─── Enviar al cliente ───────────────────────────────────────────────────────
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [clientEmail],
      subject: `Cotización ${quoteNumber} — ArteConcreto S.A.S`,
      html: htmlCliente,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: (err as { message?: string }).message || 'Error enviando email.' }, { status: 500 });
  }

  // ─── Copia interna a marketing ───────────────────────────────────────────────
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [CC_EMAIL],
      subject: `[CRM] ${quoteNumber} → ${clientName} · Enviado por ${sentByName || sellerName}`,
      html: htmlInterno,
    }),
  });

  return NextResponse.json({
    ok: true,
    quoteNumber,
    sentAt: sentAt || new Date().toISOString(),
    sentByName: sentByName || sellerName,
    sentById: sentById || sellerId,
  });
}
