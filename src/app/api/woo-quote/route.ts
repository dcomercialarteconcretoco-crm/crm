import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';

// CORS headers so the WooCommerce site (arteconcreto.co) can call this endpoint
const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
    const body = await req.json();

    const {
        name,
        email,
        phone = '',
        city = '',
        company = '',
        message = '',
        product,       // { name, sku, price, qty, image, url }
        source = 'WooCommerce',
    } = body;

    if (!name || !email || !product?.name) {
        return NextResponse.json({ error: 'Faltan campos obligatorios.' }, { status: 400, headers: CORS });
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const clientId = `c-woo-${email.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}`;
    const quoteId = `q-woo-${Date.now()}`;
    const taskId = `t-qt-${quoteId}`;
    const quoteNumber = `AC-${now.getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;

    const qty = Number(product.qty) || 1;
    const unitPrice = Number(product.price) || 0;
    const subtotal = qty * unitPrice;
    const tax = Math.round(subtotal * 0.19);
    const total = subtotal + tax;

    const quoteItem = {
        id: `item-${Date.now()}`,
        name: product.name,
        sku: product.sku || '',
        price: unitPrice,
        quantity: qty,
        unit: 'un',
        total: subtotal,
    };

    const newClient = {
        id: clientId,
        name,
        company: company || name,
        email,
        phone,
        city,
        status: 'Activo',
        value: `$${total.toLocaleString('es-CO')}`,
        ltv: 0,
        lastContact: dateStr,
        score: 65,
        category: 'WooCommerce Lead',
        source: 'WooCommerce',
        registrationDate: dateStr,
    };

    const newQuote = {
        id: quoteId,
        number: quoteNumber,
        client: name,
        clientId,
        clientEmail: email,
        clientCompany: company || name,
        leadCity: city,
        items: [quoteItem],
        subtotal,
        tax,
        total,
        numericTotal: total,
        status: 'Sent',
        date: dateStr,
        sellerName: 'Sin asignar',
        source,
        productSku: product.sku || '',
        productImage: product.image || '',
        productUrl: product.url || '',
        taskId,
    };

    const newTask = {
        id: taskId,
        title: name,
        client: company || name,
        clientId,
        contactName: name,
        value: `$${total.toLocaleString('es-CO')}`,
        numericValue: total,
        priority: 'High',
        tags: ['cotización', 'woocommerce'],
        aiScore: 65,
        source,
        assignedTo: '',
        email,
        activities: [
            ...(message ? [{
                id: `note-${Date.now()}`,
                type: 'note',
                content: `💬 Mensaje del cliente: "${message}"`,
                timestamp: now.toISOString(),
            }] : []),
            {
                id: `sys-${Date.now()}`,
                type: 'system',
                content: `Cotización solicitada desde WooCommerce · ${product.name} × ${qty}`,
                timestamp: now.toISOString(),
            },
        ],
        quoteId,
        stageId: 'sent',
        openedAt: null,
        sentAt: dateStr,
    };

    if (hasDatabase()) {
        try {
            await ensureCrmSchema();
            const pool = getPool();

            // Upsert client — get real ID (existing or new)
            const { rows: upsertRows } = await pool.query(`
                INSERT INTO crm_clients (id, name, company, email, phone, status, value_text, ltv, last_contact, city, score, category, registration_date, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
                ON CONFLICT (email) DO UPDATE SET
                    name = EXCLUDED.name, phone = EXCLUDED.phone, city = EXCLUDED.city,
                    last_contact = EXCLUDED.last_contact, updated_at = NOW()
                RETURNING id
            `, [newClient.id, newClient.name, newClient.company, newClient.email, newClient.phone,
                newClient.status, newClient.value, newClient.ltv, newClient.lastContact,
                newClient.city, newClient.score, newClient.category, newClient.registrationDate]);

            // Use the real existing client ID (avoids creating orphan quotes/tasks)
            const realClientId: string = upsertRows[0]?.id || newClient.id;
            newQuote.clientId = realClientId;
            newTask.clientId = realClientId;

            // Check if this client already has an active pipeline task
            const { rows: tRows } = await pool.query(`SELECT value FROM crm_state WHERE key = 'tasks'`);
            const existingTasks: any[] = tRows[0]?.value ?? [];
            const existingClientTask = existingTasks.find((t: any) =>
                t.clientId === realClientId && t.stageId !== 'won' && t.stageId !== 'lost'
            );

            // Append quote
            const { rows: qRows } = await pool.query(`SELECT value FROM crm_state WHERE key = 'quotes'`);
            const existingQuotes: unknown[] = qRows[0]?.value ?? [];
            await pool.query(`
                INSERT INTO crm_state (key, value, updated_at) VALUES ('quotes', $1::jsonb, NOW())
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            `, [JSON.stringify([...existingQuotes, newQuote])]);

            if (existingClientTask) {
                // Merge: add a new activity to the existing task and accumulate value
                const mergedActivities = [newTask.activities[0], ...(existingClientTask.activities || [])];
                const mergedValue = (existingClientTask.numericValue || 0) + newTask.numericValue;
                const updatedTasks = existingTasks.map((t: any) =>
                    t.id === existingClientTask.id
                        ? { ...t, numericValue: mergedValue, value: `$${mergedValue.toLocaleString('es-CO')}`, activities: mergedActivities }
                        : t
                );
                await pool.query(`
                    INSERT INTO crm_state (key, value, updated_at) VALUES ('tasks', $1::jsonb, NOW())
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
                `, [JSON.stringify(updatedTasks)]);
            } else {
                // New task for this client
                await pool.query(`
                    INSERT INTO crm_state (key, value, updated_at) VALUES ('tasks', $1::jsonb, NOW())
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
                `, [JSON.stringify([...existingTasks, newTask])]);
            }

        } catch (err) {
            console.error('[woo-quote] DB error:', err);
        }
    }

    // Send notification email via Resend if configured
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
        try {
            await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: 'CRM ArteConcreto <noreply@arteconcreto.co>',
                    to: ['ventas@arteconcreto.co'],
                    subject: `🧾 Nueva solicitud de cotización — ${product.name}`,
                    html: `
                        <h2>Nueva cotización desde la tienda</h2>
                        <p><b>Cliente:</b> ${name}${company ? ` · ${company}` : ''} · ${email} · ${phone}</p>
                        <p><b>Ciudad:</b> ${city || 'N/A'}</p>
                        <hr/>
                        <p><b>Producto:</b> ${product.name} (SKU: ${product.sku || 'N/A'})</p>
                        <p><b>Cantidad:</b> ${qty} un · <b>Precio aprox.:</b> $${total.toLocaleString('es-CO')}</p>
                        ${message ? `<hr/><p><b>💬 Mensaje del cliente:</b><br/><em style="color:#555;">"${message}"</em></p>` : ''}
                        <hr/>
                        <p>Cotización <b>${quoteNumber}</b> creada automáticamente en el CRM.</p>
                    `,
                }),
            });
        } catch { /* non-fatal */ }
    }

    return NextResponse.json({ ok: true, quoteId, quoteNumber }, { status: 200, headers: CORS });
}
