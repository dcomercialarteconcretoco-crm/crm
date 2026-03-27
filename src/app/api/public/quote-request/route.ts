import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase, getPool, ensureCrmSchema } from '@/lib/postgres';
import { rateLimit } from '@/lib/rate-limit';

const FROM_EMAIL = process.env.FROM_EMAIL || 'cotizaciones@arteconcreto.co';
const CC_EMAIL   = 'marketing@arteconcreto.co';
const LOGO_URL   = 'https://arteconcreto.co/wp-content/uploads/2026/03/cropped-Logo-Web-72ppi-237x96-1.png';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

function generateQuoteNumber() {
    return `AC-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;
}

function formatCOP(value: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

interface QuoteItem { name: string; sku: string; price: number; image: string; quantity: number; }

function buildEmail(data: {
    quoteNumber: string; clientName: string; sentAt: string;
    items: QuoteItem[]; subtotal: number; tax: number; total: number;
}) {
    const { quoteNumber, clientName, sentAt, items, subtotal, tax, total } = data;
    const dateStr = new Date(sentAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });

    const itemRows = items.map(it => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
          <div style="display:flex;align-items:center;gap:12px;">
            ${it.image ? `<img src="${it.image}" alt="${it.name}" style="width:40px;height:40px;object-fit:cover;border-radius:8px;border:1px solid #eee;" />` : ''}
            <div>
              <p style="margin:0;font-size:13px;font-weight:900;color:#111;">${it.name}</p>
              ${it.sku ? `<p style="margin:0;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px;">SKU: ${it.sku}</p>` : ''}
            </div>
          </div>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:13px;color:#555;">${it.quantity}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;font-weight:700;color:#111;">${formatCOP(it.price)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;font-weight:900;color:#fab510;">${formatCOP(it.price * it.quantity)}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f0e8;">
<div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">

  <!-- Header -->
  <div style="background:#111;padding:28px 36px;text-align:center;">
    <img src="${LOGO_URL}" alt="ArteConcreto" style="height:48px;object-fit:contain;" />
  </div>
  <div style="height:5px;background:linear-gradient(90deg,#fab510,#f59e0b,#d97706);"></div>

  <!-- Body -->
  <div style="padding:40px 36px;">
    <div style="display:inline-block;background:#fab510;color:#000;font-size:10px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:6px 14px;border-radius:8px;margin-bottom:20px;">${quoteNumber}</div>
    <p style="margin:0 0 4px;font-size:12px;color:#999;">${dateStr}</p>
    <h2 style="margin:0 0 24px;font-size:22px;font-weight:900;color:#111;">Hola, ${clientName} 👋</h2>
    <p style="margin:0 0 28px;color:#555;font-size:15px;line-height:1.6;">Gracias por tu interés en <strong>Arte Concreto</strong>. Aquí tienes tu cotización oficial.</p>

    <!-- Items table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <thead>
        <tr style="border-bottom:2px solid #111;">
          <th style="text-align:left;font-size:10px;font-weight:900;color:#999;letter-spacing:2px;text-transform:uppercase;padding-bottom:10px;">Producto</th>
          <th style="text-align:center;font-size:10px;font-weight:900;color:#999;letter-spacing:2px;text-transform:uppercase;padding-bottom:10px;">Cant.</th>
          <th style="text-align:right;font-size:10px;font-weight:900;color:#999;letter-spacing:2px;text-transform:uppercase;padding-bottom:10px;">P. Unit.</th>
          <th style="text-align:right;font-size:10px;font-weight:900;color:#999;letter-spacing:2px;text-transform:uppercase;padding-bottom:10px;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <!-- Totals -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="font-size:13px;color:#666;padding:4px 0;">Subtotal</td>
        <td style="text-align:right;font-size:13px;font-weight:700;color:#111;">${formatCOP(subtotal)}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#666;padding:4px 0;">IVA (19%)</td>
        <td style="text-align:right;font-size:13px;font-weight:700;color:#111;">${formatCOP(tax)}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:0;"><div style="height:2px;background:#111;margin:8px 0;"></div></td>
      </tr>
      <tr>
        <td style="font-size:16px;font-weight:900;color:#111;padding:4px 0;">TOTAL</td>
        <td style="text-align:right;font-size:22px;font-weight:900;color:#fab510;">${formatCOP(total)}</td>
      </tr>
    </table>

    <!-- Conditions -->
    <div style="background:#fffbee;border:1.5px solid #fab51030;border-radius:12px;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0;font-size:13px;color:#555;line-height:1.8;">
        📋 <strong>Vigencia:</strong> 15 días calendario desde la fecha de emisión.<br>
        📦 <strong>Plazo de entrega:</strong> 10 a 15 días hábiles.<br>
        💳 <strong>Forma de pago:</strong> 50% anticipo — 50% contra entrega.<br>
        📞 <strong>¿Preguntas?</strong> <span style="color:#fab510;font-weight:700;">cotizaciones&#64;arteconcreto&#46;co</span>
      </p>
    </div>

    <div style="text-align:center;">
      <a href="https://arteconcreto.co" style="display:inline-block;background:#fab510;color:#000;font-weight:900;font-size:13px;text-decoration:none;padding:14px 32px;border-radius:12px;letter-spacing:1px;text-transform:uppercase;">Ver catálogo completo →</a>
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#111;padding:24px 36px;text-align:center;">
    <p style="margin:0 0 4px;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:2px;">Arte Concreto S.A.S · Bogotá · Medellín · Cartagena</p>
    <p style="margin:0;font-size:10px;color:#444;">cotizaciones&#64;arteconcreto&#46;co · arteconcreto.co</p>
  </div>
</div>
</body>
</html>`;
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = rateLimit(ip);
    if (!rl.ok) {
        return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en ' + rl.retryAfter + 's' }, { status: 429, headers: { ...CORS_HEADERS, 'Retry-After': String(rl.retryAfter) } });
    }
    try {
        const body = await req.json();
        const { name, email, phone, city, company } = body;

        if (!name || !email) {
            return NextResponse.json({ error: 'name y email son requeridos' }, { status: 400, headers: CORS_HEADERS });
        }

        // Normalize items — accept either items[] (new) or single product fields (legacy)
        let items: QuoteItem[];
        if (Array.isArray(body.items) && body.items.length > 0) {
            items = body.items.map((i: any) => ({
                name:     i.name     || 'Producto',
                sku:      i.sku      || '',
                price:    Number(i.price)    || 0,
                image:    i.image    || '',
                quantity: Number(i.quantity) || 1,
            }));
        } else {
            // Legacy single-product
            items = [{
                name:     body.productName  || 'Producto',
                sku:      body.productSku   || '',
                price:    Number(body.productPrice) || 0,
                image:    body.productImage || '',
                quantity: Number(body.quantity) || 1,
            }];
        }

        const subtotal    = items.reduce((s, i) => s + i.price * i.quantity, 0);
        const tax         = Math.round(subtotal * 0.19);
        const total       = subtotal + tax;
        const quoteNumber = generateQuoteNumber();
        const sentAt      = new Date().toISOString();
        const today       = sentAt.split('T')[0];
        const clientId    = `c-pub-${Date.now()}`;
        const quoteId     = `q-pub-${Date.now()}`;

        // --- Save to DB ---
        if (hasDatabase()) {
            await ensureCrmSchema();
            const pool = getPool();

            await pool.query(`
                INSERT INTO crm_clients (id,name,company,email,phone,status,value_text,ltv,last_contact,city,score,category,registration_date,updated_at)
                VALUES ($1,$2,$3,$4,$5,'Lead',$6,0,$7,$8,60,'Web Lead',$9,NOW())
                ON CONFLICT (email) DO UPDATE SET
                    name = EXCLUDED.name,
                    phone = COALESCE(NULLIF(EXCLUDED.phone,''), crm_clients.phone),
                    city  = COALESCE(NULLIF(EXCLUDED.city,''),  crm_clients.city),
                    last_contact = EXCLUDED.last_contact, updated_at = NOW()
            `, [clientId, name, company || name, email, phone || '', formatCOP(total), today, city || 'No especificada', today]);

            const { rows: cr } = await pool.query(`SELECT id FROM crm_clients WHERE email=$1 LIMIT 1`, [email]);
            const realClientId = cr[0]?.id || clientId;

            const { rows: sr } = await pool.query(`SELECT value FROM crm_state WHERE key='quotes'`);
            const existingQuotes = sr[0]?.value || [];
            const newQuote = {
                id: quoteId, number: quoteNumber,
                client: company || name, clientId: realClientId,
                clientEmail: email, clientCompany: company || name,
                date: today, total: formatCOP(total), numericTotal: total,
                subtotal, tax,
                items: items.map((it, idx) => ({
                    id: String(idx + 1), name: it.name, price: it.price,
                    quantity: it.quantity, unit: 'un', total: it.price * it.quantity,
                })),
                status: 'Sent', sentAt, sentByName: 'Cotizador Web', sentById: 'web-widget',
            };
            await pool.query(`
                INSERT INTO crm_state (key,value,updated_at) VALUES ('quotes',$1::jsonb,NOW())
                ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
            `, [JSON.stringify([newQuote, ...existingQuotes])]);

            const { rows: tr } = await pool.query(`SELECT value FROM crm_state WHERE key='tasks'`);
            const existingTasks = tr[0]?.value || [];
            const newTask = {
                id: `t-pub-${Date.now()}`,
                title: `Solicitud web: ${items.map(i => i.name).join(', ').slice(0, 80)}`,
                client: company || name, clientId: realClientId,
                contactName: name, value: formatCOP(total), numericValue: total,
                priority: 'High', tags: ['Web', 'Auto-Cotización'],
                aiScore: 80, source: 'Cotizador Web',
                assignedTo: '', email, phone: phone || '', city: city || '',
                activities: [], stageId: 'stage-1',
            };
            await pool.query(`
                INSERT INTO crm_state (key,value,updated_at) VALUES ('tasks',$1::jsonb,NOW())
                ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
            `, [JSON.stringify([newTask, ...existingTasks])]);
        }

        // --- Send email ---
        const apiKey = process.env.RESEND_API_KEY;
        if (apiKey) {
            const html = buildEmail({ quoteNumber, clientName: name, sentAt, items, subtotal, tax, total });
            await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: FROM_EMAIL,
                    to: [email],
                    cc: [CC_EMAIL],
                    subject: `📋 Cotización ${quoteNumber} — Arte Concreto`,
                    html,
                }),
            });
        }

        return NextResponse.json({ ok: true, quoteNumber, total: formatCOP(total) }, { headers: CORS_HEADERS });

    } catch (error: any) {
        console.error('quote-request error:', error);
        return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
    }
}
