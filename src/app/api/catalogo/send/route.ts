import { NextRequest, NextResponse } from 'next/server';
import { loadFreshSession } from '@/lib/auth-session';
import { generateCatalogPdfBuffer } from '@/lib/catalog/catalog-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const LOGO_URL = 'https://arteconcreto.co/wp-content/uploads/2026/03/cropped-Logo-Web-72ppi-237x96-1.png';

// Remitente del email. Inline (sin depender de helpers externos) para no
// acoplar esta ruta a archivos que pudieran no estar versionados.
const FROM_ADDR = (process.env.FROM_EMAIL || '').trim() || 'cotizaciones@arteconcreto.co';
const FROM_EMAIL = FROM_ADDR.includes('<') ? FROM_ADDR : `ArteConcreto <${FROM_ADDR}>`;

/**
 * POST /api/catalogo/send — el vendedor envía el catálogo PDF a un cliente desde
 * la ficha. Genera el PDF con la portada personalizada ("Preparado para X") y lo
 * adjunta al email (Resend). Gateado a sesión.
 *
 * Body: { clientEmail, clientName?, clientCompany?, sellerName?, sellerPhone? }
 */
export async function POST(request: NextRequest) {
    const user = await loadFreshSession(request);
    if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    if (!RESEND_API_KEY) return NextResponse.json({ error: 'RESEND_API_KEY no configurada.' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const clientEmail = String(body.clientEmail || '').trim();
    const clientName = String(body.clientName || '').trim();
    const clientCompany = String(body.clientCompany || '').trim();
    const sellerName = String(body.sellerName || user.name || '').trim();
    const sellerPhone = String(body.sellerPhone || '').trim();

    if (!/.+@.+\..+/.test(clientEmail)) {
        return NextResponse.json({ error: 'Email del cliente inválido.' }, { status: 400 });
    }

    let pdf: Uint8Array;
    try {
        pdf = await generateCatalogPdfBuffer({ name: clientName || undefined, company: clientCompany || undefined });
    } catch (error) {
        console.error('[catalogo/send] error generando PDF:', error);
        return NextResponse.json({ error: 'No se pudo generar el catálogo.' }, { status: 500 });
    }
    const base64 = Buffer.from(pdf).toString('base64');
    const fecha = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    const saludo = clientName ? `Estimado/a <strong style="color:#fff;">${clientName}</strong>${clientCompany ? `<span style="color:#fab510;"> — ${clientCompany}</span>` : ''},` : 'Hola,';

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Catálogo ArteConcreto</title></head>
<body style="margin:0;padding:0;background:#f2ede4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:28px 16px 48px;">
  <div style="background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.12);">
    <div style="background:#1a1a1d;">
      <div style="height:5px;background:linear-gradient(90deg,#c88a00,#fab510,#ffd966,#fab510,#c88a00);"></div>
      <div style="padding:26px 32px 8px;">
        <div style="display:inline-block;background:#fff;border-radius:12px;padding:9px 16px;">
          <img src="${LOGO_URL}" alt="ArteConcreto" width="150" height="58" style="display:block;width:150px;height:58px;object-fit:contain;" />
        </div>
      </div>
      <div style="padding:8px 32px 26px;">
        <p style="margin:0;font-size:15px;color:#d0d0d0;line-height:1.7;">${saludo}</p>
        <p style="margin:8px 0 0;font-size:13px;color:#8a8a8a;line-height:1.6;">Adjunto encontrará nuestro <strong style="color:#fab510;">catálogo de productos</strong> en concreto: mobiliario urbano, bancas, materas, calados y más. Quedo atento/a para asesorarle en su proyecto.</p>
      </div>
    </div>
    <div style="padding:26px 32px;text-align:center;">
      <div style="display:inline-block;background:#faf7f0;border:1px solid #ede8da;border-radius:14px;padding:18px 26px;">
        <p style="margin:0;font-size:9px;color:#aaa;font-weight:900;text-transform:uppercase;letter-spacing:2px;">Adjunto</p>
        <p style="margin:6px 0 0;font-size:15px;color:#1a1a1d;font-weight:900;">📄 Catálogo ArteConcreto.pdf</p>
        <p style="margin:4px 0 0;font-size:11px;color:#999;">Documento informativo · No es una cotización</p>
      </div>
    </div>
    <div style="background:#1a1a1d;padding:18px 32px;">
      <p style="margin:0;font-size:13px;color:#aaa;">Asesor: <strong style="color:#fab510;">${sellerName}</strong></p>
      ${sellerPhone ? `<p style="margin:3px 0 0;font-size:12px;color:#fab510;font-weight:700;">${sellerPhone}</p>` : ''}
      <p style="margin:5px 0 0;font-size:12px;color:#666;">arteconcreto.co · WhatsApp +57 317 8929477 · Floridablanca, Santander</p>
    </div>
    <div style="background:#111113;padding:11px 32px;text-align:center;border-top:1px solid #2a2a2d;">
      <p style="margin:0;font-size:10px;color:#3a3a3a;">MiWibiCRM · Desarrollado para ArteConcreto por <a href="https://miwibi.com" style="color:#fab510;text-decoration:none;font-weight:700;">MiWibi.com</a></p>
    </div>
  </div>
</div></body></html>`;

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: FROM_EMAIL,
                to: [clientEmail],
                subject: 'Catálogo de productos — ArteConcreto',
                html,
                attachments: [{ filename: `Catalogo-ArteConcreto-${fecha}.pdf`, content: base64 }],
            }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return NextResponse.json({ error: (err as { message?: string }).message || 'Error enviando el email.' }, { status: 500 });
        }
    } catch (error) {
        console.error('[catalogo/send] error Resend:', error);
        return NextResponse.json({ error: 'Error de red enviando el email.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sentTo: clientEmail });
}
