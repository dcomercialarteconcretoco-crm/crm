import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase, getPool, ensureCrmSchema } from '@/lib/postgres';

const LOGO_URL = 'https://cuantium.com/wp-content/uploads/2026/02/logo.png';
const FROM_EMAIL = process.env.FROM_EMAIL || 'cotizaciones@arteconcreto.co';
const CC_EMAIL = 'marketing@arteconcreto.co';

function generateQuoteNumber() {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = String(Math.floor(Math.random() * 9000) + 1000);
    return `COT-${y}${m}${d}-${rand}`;
}

function formatCOP(value: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

function buildEmail(data: {
    quoteNumber: string;
    clientName: string;
    clientEmail: string;
    productName: string;
    productSku: string;
    productPrice: number;
    productImage: string;
    quantity: number;
    subtotal: number;
    tax: number;
    total: number;
    city: string;
    sentAt: string;
}) {
    const { quoteNumber, clientName, productName, productSku, productPrice, productImage, quantity, subtotal, tax, total, sentAt } = data;
    const dateStr = new Date(sentAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cotización ${quoteNumber}</title></head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f0e8;">

<div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">

  <!-- Gold stripe -->
  <div style="height:6px;background:linear-gradient(90deg,#fab510,#f59e0b,#d97706);"></div>

  <!-- Header -->
  <div style="background:#0a0a0b;padding:28px 36px;display:flex;align-items:center;justify-content:space-between;">
    <div style="background:#ffffff;border-radius:14px;padding:10px 18px;box-shadow:0 2px 16px rgba(250,181,16,0.15);">
      <img src="${LOGO_URL}" alt="Arte Concreto" style="height:48px;display:block;" />
    </div>
    <div style="text-align:right;">
      <div style="background:#fab510;color:#000;font-size:10px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:6px 14px;border-radius:8px;">${quoteNumber}</div>
      <div style="color:#ffffff40;font-size:11px;margin-top:6px;">${dateStr}</div>
    </div>
  </div>

  <!-- Body -->
  <div style="padding:40px 36px;">
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#0a0a0b;">Hola, ${clientName} 👋</h2>
    <p style="margin:0 0 28px;color:#555;font-size:15px;line-height:1.6;">Gracias por tu interés en <strong>Arte Concreto</strong>. Aquí tienes tu cotización oficial para el producto seleccionado.</p>

    <!-- Product Card -->
    <div style="border:1.5px solid #e8e4da;border-radius:16px;overflow:hidden;margin-bottom:28px;">
      ${productImage ? `<div style="background:#f4f0e8;text-align:center;padding:20px;"><img src="${productImage}" alt="${productName}" style="max-height:160px;max-width:100%;object-fit:contain;border-radius:8px;" /></div>` : ''}
      <div style="padding:20px 24px;">
        <p style="margin:0 0 4px;font-size:17px;font-weight:900;color:#0a0a0b;">${productName}</p>
        <p style="margin:0 0 16px;font-size:12px;color:#888;letter-spacing:1px;text-transform:uppercase;">SKU: ${productSku || 'N/A'}</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
          <tr>
            <td style="color:#666;padding:6px 0;">Precio unitario</td>
            <td style="text-align:right;font-weight:700;color:#0a0a0b;">${formatCOP(productPrice)}</td>
          </tr>
          <tr>
            <td style="color:#666;padding:6px 0;">Cantidad</td>
            <td style="text-align:right;font-weight:700;color:#0a0a0b;">${quantity} unid.</td>
          </tr>
          <tr>
            <td style="color:#666;padding:6px 0;">Subtotal</td>
            <td style="text-align:right;font-weight:700;color:#0a0a0b;">${formatCOP(subtotal)}</td>
          </tr>
          <tr>
            <td style="color:#666;padding:6px 0;">IVA (19%)</td>
            <td style="text-align:right;font-weight:700;color:#0a0a0b;">${formatCOP(tax)}</td>
          </tr>
          <tr style="border-top:2px solid #0a0a0b;">
            <td style="padding:12px 0 0;font-size:16px;font-weight:900;color:#0a0a0b;">TOTAL</td>
            <td style="text-align:right;padding:12px 0 0;font-size:20px;font-weight:900;color:#fab510;">${formatCOP(total)}</td>
          </tr>
        </table>
      </div>
    </div>

    <div style="background:#fffbee;border:1.5px solid #fab51030;border-radius:12px;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0;font-size:13px;color:#555;line-height:1.6;">
        📦 <strong>Tiempos de entrega:</strong> 10 a 15 días hábiles.<br>
        🚚 <strong>Envío:</strong> Gratis en Bogotá y Medellín. Resto del país: cotización personalizada.<br>
        📞 <strong>¿Tienes preguntas?</strong> Escríbenos a <span style="color:#fab510;font-weight:700;">cotizaciones&#64;arteconcreto&#46;co</span>
      </p>
    </div>

    <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 28px;">Esta cotización tiene vigencia de <strong>15 días calendario</strong> desde la fecha de emisión.</p>

    <div style="text-align:center;">
      <a href="https://arteconcreto.co" style="display:inline-block;background:#fab510;color:#000;font-weight:900;font-size:13px;text-decoration:none;padding:14px 32px;border-radius:12px;letter-spacing:1px;text-transform:uppercase;">Ver catálogo completo →</a>
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#f4f0e8;padding:24px 36px;border-top:1px solid #e8e4da;text-align:center;">
    <p style="margin:0 0 6px;font-size:12px;color:#888;">Arte Concreto S.A.S · Bogotá · Medellín · Cartagena</p>
    <p style="margin:0 0 6px;font-size:11px;color:#aaa;">cotizaciones&#64;arteconcreto&#46;co</p>
    <p style="margin:0;font-size:10px;color:#bbb;">MiWibiCRM · Desarrollado para Arte Concreto por <a href="https://miwibi.com" style="color:#fab510;text-decoration:none;">MiWibi.com</a></p>
  </div>
</div>
</body>
</html>`;
}

// CORS headers for cross-origin requests from WordPress
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            name, email, phone, city, company,
            productName, productSku, productPrice, productImage,
            quantity = 1,
        } = body;

        if (!name || !email || !productName) {
            return NextResponse.json({ error: 'Faltan datos requeridos: name, email, productName' }, { status: 400, headers: CORS_HEADERS });
        }

        const price = Number(productPrice) || 0;
        const qty = Number(quantity) || 1;
        const subtotal = price * qty;
        const tax = Math.round(subtotal * 0.19);
        const total = subtotal + tax;
        const quoteNumber = generateQuoteNumber();
        const sentAt = new Date().toISOString();
        const clientId = `c-pub-${Date.now()}`;
        const quoteId = `q-pub-${Date.now()}`;
        const today = new Date().toISOString().split('T')[0];

        // --- 1. Save client + quote to DB (if available) ---
        if (hasDatabase()) {
            await ensureCrmSchema();
            const pool = getPool();

            // Upsert client by email
            await pool.query(`
                INSERT INTO crm_clients (id, name, company, email, phone, status, value_text, ltv, last_contact, city, score, category, registration_date, updated_at)
                VALUES ($1,$2,$3,$4,$5,'Lead',$6,0,$7,$8,60,'Web Lead',$9,NOW())
                ON CONFLICT (email) DO UPDATE SET
                    name = EXCLUDED.name,
                    phone = COALESCE(NULLIF(EXCLUDED.phone,''), crm_clients.phone),
                    city = COALESCE(NULLIF(EXCLUDED.city,''), crm_clients.city),
                    last_contact = EXCLUDED.last_contact,
                    updated_at = NOW()
            `, [clientId, name, company || name, email, phone || '', formatCOP(total), today, city || 'No especificada', today]);

            // Get actual client id (in case email already existed)
            const { rows: clientRows } = await pool.query(`SELECT id FROM crm_clients WHERE email = $1 LIMIT 1`, [email]);
            const realClientId = clientRows[0]?.id || clientId;

            // Save quote to crm_state
            const { rows: stateRows } = await pool.query(`SELECT value FROM crm_state WHERE key = 'quotes'`);
            const existingQuotes = stateRows[0]?.value || [];
            const newQuote = {
                id: quoteId,
                number: quoteNumber,
                client: company || name,
                clientId: realClientId,
                clientEmail: email,
                clientCompany: company || name,
                date: today,
                total: formatCOP(total),
                numericTotal: total,
                subtotal,
                tax,
                items: [{ id: '1', name: productName, price, quantity: qty, unit: 'un', total: subtotal }],
                status: 'Sent',
                sentAt,
                sentByName: 'Cotizador Web',
                sentById: 'web-widget',
            };
            const updatedQuotes = [newQuote, ...existingQuotes];
            await pool.query(`
                INSERT INTO crm_state (key, value, updated_at) VALUES ('quotes', $1::jsonb, NOW())
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            `, [JSON.stringify(updatedQuotes)]);

            // Save pipeline task
            const { rows: taskRows } = await pool.query(`SELECT value FROM crm_state WHERE key = 'tasks'`);
            const existingTasks = taskRows[0]?.value || [];
            const newTask = {
                id: `t-pub-${Date.now()}`,
                title: `Solicitud web: ${productName}`,
                client: company || name,
                clientId: realClientId,
                contactName: name,
                value: formatCOP(total),
                numericValue: total,
                priority: 'High',
                tags: ['Web', 'Auto-Cotización'],
                aiScore: 80,
                source: 'Cotizador Web',
                assignedTo: '',
                email,
                phone: phone || '',
                city: city || '',
                activities: [],
                stageId: 'stage-1',
            };
            await pool.query(`
                INSERT INTO crm_state (key, value, updated_at) VALUES ('tasks', $1::jsonb, NOW())
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            `, [JSON.stringify([newTask, ...existingTasks])]);
        }

        // --- 2. Send email via Resend (direct fetch, no SDK needed) ---
        const apiKey = process.env.RESEND_API_KEY;
        if (apiKey) {
            const html = buildEmail({ quoteNumber, clientName: name, clientEmail: email, productName, productSku: productSku || '', productPrice: price, productImage: productImage || '', quantity: qty, subtotal, tax, total, city: city || '', sentAt });

            await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: FROM_EMAIL,
                    to: [email],
                    cc: [CC_EMAIL],
                    subject: `📋 Tu Cotización ${quoteNumber} — Arte Concreto`,
                    html,
                }),
            });
        }

        return NextResponse.json({
            ok: true,
            quoteNumber,
            total: formatCOP(total),
            message: 'Cotización enviada exitosamente a tu correo.'
        }, { headers: CORS_HEADERS });

    } catch (error: any) {
        console.error('quote-request error:', error);
        return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
    }
}
