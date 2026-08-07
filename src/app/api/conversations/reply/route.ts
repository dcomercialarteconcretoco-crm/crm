import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { loadFreshSession } from '@/lib/auth-session';
import { resolveWhatsAppConfig, assertWhatsAppConfig, graphRequest } from '../../whatsapp/_lib';
import { toWhatsAppPhone } from '@/lib/contact-links';
import type { WidgetConversation } from '../route';

/**
 * POST /api/conversations/reply — respuesta de un asesor a una conversación
 * del Concrebot. Body: { conversationId, text }.
 *
 * INCIDENTE (auditado 6-ago-2026 sobre datos de producción): el asesor
 * respondía desde el CRM y el cliente NUNCA recibía nada. Las 34
 * conversaciones existentes son del WIDGET WEB, y el widget
 * (src/app/widget/WidgetClient.tsx) sólo habla con /api/assistant: no
 * consulta respuestas nuevas. Es decir, toda respuesta humana escrita en el
 * CRM desde abr-2026 se guardó en crm_state y murió ahí. No había ningún
 * canal de entrega.
 *
 * Diseño (ArteConcreto NO usa la API de WhatsApp — ver memoria del proyecto):
 *  - La entrega real es el TELÉFONO del lead: se devuelve `waWebUrl`
 *    (wa.me con el texto pre-cargado) para que el asesor lo mande desde su
 *    WhatsApp. Aplica a CUALQUIER conversación con teléfono utilizable, sin
 *    importar el `source` — gatearlo por source==='whatsapp' no servía de
 *    nada porque no existe ni una sola conversación de ese canal.
 *  - Sin teléfono utilizable se responde `deliverable: false` para que la UI
 *    lo diga de frente en vez de simular un envío.
 *  - Si algún día se configura la Cloud API, el envío server-side se activa
 *    solo y manda de verdad (esa rama queda intacta).
 *  - Append por conversación releyendo el estado: el POST genérico de
 *    /api/conversations reemplaza la conversación entera y puede pisar
 *    mensajes entrantes.
 *  - Auth interna obligatoria: el middleware exime /api/conversations*.
 */
export async function POST(request: NextRequest) {
    const user = await loadFreshSession(request);
    if (!user) return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 });
    if (!hasDatabase()) return NextResponse.json({ ok: false, error: 'Base de datos no configurada.' }, { status: 503 });

    const body = await request.json().catch(() => ({}));
    const conversationId = String(body.conversationId || '').trim();
    const text = String(body.text || '').trim();
    if (!conversationId || !text) {
        return NextResponse.json({ ok: false, error: 'conversationId y text son requeridos.' }, { status: 400 });
    }

    await ensureCrmSchema();
    const pool = getPool();
    const { rows } = await pool.query(`SELECT value FROM crm_state WHERE key = 'widget_conversations'`);
    const all: WidgetConversation[] = (rows[0]?.value as WidgetConversation[]) || [];
    const conv = all.find(c => c.id === conversationId);
    if (!conv) return NextResponse.json({ ok: false, error: 'Conversación no encontrada.' }, { status: 404 });

    let sentVia: 'whatsapp' | 'crm' | 'wa-web' = 'crm';
    let waWebUrl: string | undefined;

    // Destino: el teléfono del lead (normalizado a formato wa.me). Para las
    // conversaciones nacidas en WhatsApp el id es `wa-<phone>` y sirve de
    // respaldo. Sin número no hay forma de entregar nada.
    const to = toWhatsAppPhone(conv.lead?.phone || conversationId.replace(/^wa-/, ''));

    if (to) {
        const config = resolveWhatsAppConfig();
        // SIN API de WhatsApp configurada (estado actual de ArteConcreto): no
        // se envía desde el servidor. Se registra la respuesta en el hilo y se
        // devuelve el link wa.me para que el asesor la mande desde SU WhatsApp,
        // con el texto ya escrito. Mismo mecanismo que el resto de botones de
        // WhatsApp del CRM; no exige token de Meta.
        if (!config.accessToken || !config.phoneNumberId) {
            waWebUrl = `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
            sentVia = 'wa-web';
        } else try {
            assertWhatsAppConfig(config);
            await graphRequest(
                `/${config.phoneNumberId}/messages`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to,
                        type: 'text',
                        text: { preview_url: false, body: text },
                    }),
                },
                config.accessToken
            );
            sentVia = 'whatsapp';
        } catch (error) {
            const err = error as Error & { metaCode?: number };
            const msg = err?.message || 'Error desconocido.';
            // 131047: fuera de la ventana de servicio de 24 horas. Meta solo
            // permite texto libre dentro de las 24h siguientes al último
            // mensaje del cliente; después exige plantillas aprobadas (que
            // este CRM no maneja todavía).
            if (err?.metaCode === 131047 || /re-?engagement|24 hour/i.test(msg)) {
                return NextResponse.json({
                    ok: false,
                    error: 'WhatsApp cerró la ventana de 24 horas: el cliente lleva más de un día sin escribir. Pídele que envíe un mensaje nuevo, o contáctalo desde el WhatsApp Business del celular.',
                }, { status: 502 });
            }
            if (/Falta WHATSAPP/.test(msg)) {
                return NextResponse.json({
                    ok: false,
                    error: `WhatsApp no está configurado en el servidor: ${msg}`,
                }, { status: 502 });
            }
            console.error('[conversations/reply] Meta rechazó el envío:', msg);
            return NextResponse.json({ ok: false, error: `Meta rechazó el mensaje: ${msg}` }, { status: 502 });
        }
    }

    // Envío OK, wa-web (lo manda el asesor) o conversación de widget: append
    // del mensaje releyendo el estado — nunca reemplazamos la conversación
    // completa que mandó el cliente.
    const updated: WidgetConversation = {
        ...conv,
        messages: [
            ...(conv.messages || []),
            // `via: 'advisor'` distingue a una persona del bot. Con eso el
            // widget silencia las respuestas automáticas mientras el asesor
            // está atendiendo — antes el bot contestaba encima y el cliente
            // recibía dos voces distintas en el mismo hilo.
            { role: 'assistant', content: text, timestamp: new Date().toISOString(), via: 'advisor' },
        ],
        updatedAt: new Date().toISOString(),
    };
    const next = all.map(c => (c.id === conversationId ? updated : c));
    await pool.query(
        `INSERT INTO crm_state (key, value, updated_at)
         VALUES ('widget_conversations', $1::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify(next)]
    );

    // `deliverable: false` = la respuesta quedó en el hilo pero NO hay canal
    // para hacérsela llegar (conversación sin teléfono utilizable). La UI lo
    // advierte en vez de dejar creer que se envió.
    return NextResponse.json({ ok: true, conversation: updated, sentVia, waWebUrl, deliverable: !!to });
}
