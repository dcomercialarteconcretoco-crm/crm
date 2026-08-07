import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { loadFreshSession } from '@/lib/auth-session';
import { resolveWhatsAppConfig, assertWhatsAppConfig, graphRequest } from '../../whatsapp/_lib';
import type { WidgetConversation } from '../route';

/**
 * POST /api/conversations/reply — respuesta de un asesor a una conversación
 * del Concrebot. Body: { conversationId, text }.
 *
 * Nace del incidente de la reunión 6-ago-2026: el asesor respondía desde el
 * CRM, el mensaje se pintaba en el hilo... y el cliente en WhatsApp nunca lo
 * recibía. `sendHumanReply` solo persistía la conversación en crm_state — en
 * ningún punto llamaba a la API de WhatsApp.
 *
 * Diseño:
 *  - Server-side y atómico: si la conversación es de WhatsApp, PRIMERO se
 *    envía por Meta Cloud API y SOLO si Meta aceptó se persiste el mensaje.
 *    Un rechazo (ventana de 24h, token, etc.) vuelve como error legible y el
 *    hilo no se ensucia con mensajes que nunca salieron.
 *  - Append por conversación: se relee el estado y se agrega UN mensaje. El
 *    POST genérico de /api/conversations reemplaza la conversación entera
 *    (last-write-wins) y podía pisar mensajes entrantes llegados entre polls.
 *  - Las conversaciones del widget web (source 'widget') no tienen sesión de
 *    WhatsApp — se persisten sin envío, como siempre (el visitante las ve en
 *    el chat de la página).
 *  - Auth interna obligatoria: el middleware exime /api/conversations* para
 *    que el widget público funcione, así que acá se valida sesión a mano.
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

    if (conv.source === 'whatsapp') {
        // El webhook guarda el phone ya normalizado con prefijo país y usa
        // id `wa-<phone>` — cualquiera de los dos sirve como destino.
        const to = ((conv.lead?.phone || '') || conversationId.replace(/^wa-/, '')).replace(/\D/g, '');
        if (!to) return NextResponse.json({ ok: false, error: 'La conversación no tiene teléfono de destino.' }, { status: 400 });

        const config = resolveWhatsAppConfig();
        // SIN API de WhatsApp configurada (estado actual de ArteConcreto): no
        // se envía desde el servidor. Se registra la respuesta en el hilo y se
        // devuelve el link wa.me para que el asesor la mande desde SU WhatsApp
        // Web, con el texto ya escrito. Es el mismo mecanismo de los botones
        // de WhatsApp del resto del CRM y no exige token de Meta.
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
            { role: 'assistant', content: text, timestamp: new Date().toISOString() },
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

    return NextResponse.json({ ok: true, conversation: updated, sentVia, waWebUrl });
}
