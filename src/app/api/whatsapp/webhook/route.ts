import { NextRequest, NextResponse } from 'next/server';
import { resolveWhatsAppConfig } from '../_lib';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { pickNextSeller } from '@/lib/round-robin';
import { appendNotification } from '@/lib/server-notifications';
import { sendAdvisorNeededEmail } from '@/lib/advisor-alert-email';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const config = resolveWhatsAppConfig();

    if (mode === 'subscribe' && token && token === config.verifyToken) {
        return new NextResponse(challenge || 'ok', { status: 200 });
    }

    return NextResponse.json({ ok: false, error: 'Webhook verification failed.' }, { status: 403 });
}

interface InboundMessage {
    from: string;
    text?: string;
    contactName?: string;
    timestamp: string;
}

function parseInboundMessages(payload: any): InboundMessage[] {
    const messages: InboundMessage[] = [];
    try {
        const entries = Array.isArray(payload?.entry) ? payload.entry : [];
        for (const entry of entries) {
            const changes = Array.isArray(entry.changes) ? entry.changes : [];
            for (const change of changes) {
                const value = change.value || {};
                const contactsByPhone = new Map<string, string>();
                for (const c of value.contacts || []) {
                    if (c.wa_id) contactsByPhone.set(c.wa_id, c.profile?.name || '');
                }
                for (const m of value.messages || []) {
                    if (!m.from) continue;
                    const text = m.text?.body
                        || m.interactive?.button_reply?.title
                        || m.interactive?.list_reply?.title
                        || m.button?.text
                        || '[' + (m.type || 'mensaje') + ']';
                    messages.push({
                        from: m.from,
                        text,
                        contactName: contactsByPhone.get(m.from) || '',
                        timestamp: m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString(),
                    });
                }
            }
        }
    } catch {
        // ignore parse errors — we still want the webhook to return 200 so Meta doesn't disable it
    }
    return messages;
}

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();
        const messages = parseInboundMessages(payload);

        if (messages.length === 0 || !hasDatabase()) {
            return NextResponse.json({ ok: true });
        }

        await ensureCrmSchema();
        const pool = getPool();

        for (const msg of messages) {
            const normalizedPhone = (msg.from || '').replace(/\D/g, '');
            if (!normalizedPhone) continue;

            // Upsert client — if new, round-robin assign; if existing, keep current owner
            const { rows: existing } = await pool.query(
                `SELECT id, assigned_to, assigned_to_name FROM crm_clients WHERE phone = $1 LIMIT 1`,
                [normalizedPhone]
            );

            let clientId: string;
            let ownerId: string | null;
            let ownerName: string | null;

            if (existing.length > 0) {
                clientId = existing[0].id;
                ownerId = existing[0].assigned_to || null;
                ownerName = existing[0].assigned_to_name || null;
                await pool.query(
                    `UPDATE crm_clients SET
                        name = COALESCE(NULLIF($1, ''), name),
                        last_contact = $2,
                        updated_at = NOW()
                     WHERE id = $3`,
                    [msg.contactName || '', new Date().toISOString().split('T')[0], clientId]
                );
            } else {
                clientId = `c-wa-${Date.now()}-${normalizedPhone.slice(-4)}`;
                const rr = await pickNextSeller();
                ownerId = rr?.id || null;
                ownerName = rr?.name || null;

                await pool.query(
                    `INSERT INTO crm_clients (
                        id, name, company, email, phone, status, value_text, ltv, last_contact,
                        city, score, category, registration_date,
                        assigned_to, assigned_to_name, source, updated_at
                     ) VALUES ($1,$2,$3,'',$4,'Lead','Por cotizar',0,$5,'No especificada',60,'WhatsApp',$5,$6,$7,'WhatsApp',NOW())`,
                    [
                        clientId,
                        msg.contactName || `WhatsApp ${normalizedPhone}`,
                        msg.contactName || 'WhatsApp Lead',
                        normalizedPhone,
                        new Date().toISOString().split('T')[0],
                        ownerId,
                        ownerName,
                    ]
                );

                // Add a pipeline task for the new WhatsApp lead
                const { rows: tr } = await pool.query(`SELECT value FROM crm_state WHERE key = 'tasks'`);
                const existingTasks: any[] = Array.isArray(tr[0]?.value) ? tr[0].value : [];
                const newTask = {
                    id: `t-wa-${Date.now()}-${normalizedPhone.slice(-4)}`,
                    title: `WhatsApp: ${msg.contactName || normalizedPhone}`,
                    client: msg.contactName || `WhatsApp ${normalizedPhone}`,
                    clientId,
                    contactName: msg.contactName || '',
                    value: 'Por definir',
                    numericValue: 0,
                    priority: 'Medium',
                    tags: ['WhatsApp', 'Entrante'],
                    aiScore: 60,
                    source: 'WhatsApp',
                    assignedTo: ownerId || '',
                    assignedToName: ownerName || '',
                    email: '',
                    phone: normalizedPhone,
                    city: '',
                    activities: [{
                        id: `act-${Date.now()}`,
                        type: 'whatsapp',
                        content: msg.text || '',
                        timestamp: msg.timestamp,
                    }],
                    stageId: 'stage-1',
                };
                await pool.query(
                    `INSERT INTO crm_state (key, value, updated_at) VALUES ('tasks', $1::jsonb, NOW())
                     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                    [JSON.stringify([newTask, ...existingTasks])]
                );
            }

            // Append the inbound message to the conversation thread for this phone
            const conversationId = `wa-${normalizedPhone}`;
            const { rows: cr } = await pool.query(`SELECT value FROM crm_state WHERE key = 'widget_conversations'`);
            const allConvs: any[] = Array.isArray(cr[0]?.value) ? cr[0].value : [];
            const idx = allConvs.findIndex(c => c.id === conversationId);
            const newMessage = { role: 'user', content: msg.text || '', timestamp: msg.timestamp };
            if (idx >= 0) {
                allConvs[idx] = {
                    ...allConvs[idx],
                    messages: [...(allConvs[idx].messages || []), newMessage],
                    updatedAt: new Date().toISOString(),
                    clientId,
                    status: 'active',
                };
            } else {
                allConvs.unshift({
                    id: conversationId,
                    lead: {
                        name: msg.contactName || '',
                        email: '',
                        phone: normalizedPhone,
                        city: '',
                        company: '',
                    },
                    messages: [newMessage],
                    createdAt: msg.timestamp,
                    updatedAt: new Date().toISOString(),
                    status: 'active',
                    clientId,
                    source: 'whatsapp',
                });
            }
            await pool.query(
                `INSERT INTO crm_state (key, value, updated_at) VALUES ('widget_conversations', $1::jsonb, NOW())
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                [JSON.stringify(allConvs.slice(0, 200))]
            );

            await appendNotification(pool, {
                title: 'WhatsApp entrante',
                description: `${msg.contactName || normalizedPhone}: ${(msg.text || '').slice(0, 120) || 'Nuevo mensaje'}`,
                type: 'lead',
                targetUserId: ownerId,
                clientId,
            });

            sendAdvisorNeededEmail({
                leadName: msg.contactName || `WhatsApp ${normalizedPhone}`,
                phone: normalizedPhone,
                message: msg.text,
                source: 'WhatsApp',
                conversationId,
                clientId,
                appUrl: process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin,
            }).catch(error => console.error('[advisor-alert] whatsapp email failed:', error));
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[whatsapp/webhook] error:', error);
        // Always return 200 to Meta so it doesn't disable the subscription
        return NextResponse.json({ ok: true, handled: false });
    }
}
