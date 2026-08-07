import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import type { WidgetConversation } from '../route';

/**
 * GET /api/conversations/[id] — el chat del visitante consulta si el asesor
 * le respondió. Es lo que convierte el widget en una conversación de verdad:
 * antes sólo hablaba con el bot y nunca se enteraba de las respuestas humanas
 * (auditoría 6-ago-2026: meses de respuestas que no llegaron a nadie).
 *
 * Público a propósito (el middleware exime /api/conversations*): quien chatea
 * no tiene sesión del CRM. Por eso devuelve SÓLO los mensajes y la fecha —
 * nunca los datos del lead, el clientId ni el resto de conversaciones. El id
 * de sesión (`wchat-<base36>-<random>`) hace de credencial.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!id) return NextResponse.json({ ok: false, error: 'Falta el id.' }, { status: 400 });
    if (!hasDatabase()) return NextResponse.json({ ok: true, messages: [], updatedAt: null });

    await ensureCrmSchema();
    const pool = getPool();
    const { rows } = await pool.query(`SELECT value FROM crm_state WHERE key = 'widget_conversations'`);
    const all: WidgetConversation[] = (rows[0]?.value as WidgetConversation[]) || [];
    const conv = all.find(c => c.id === id);
    // 200 con lista vacía en vez de 404: la conversación todavía puede no
    // existir (el visitante aún no manda el primer mensaje) y el widget no
    // debe tratar eso como un error.
    if (!conv) return NextResponse.json({ ok: true, messages: [], updatedAt: null });

    // ¿Hay un asesor atendiendo ahora? Si respondió en la última hora, el
    // widget silencia al bot: dos voces contestando confunden al cliente.
    const UNA_HORA = 60 * 60 * 1000;
    const advisorActive = (conv.messages || []).some(m =>
        m.via === 'advisor' && Date.now() - new Date(m.timestamp).getTime() < UNA_HORA
    );

    return NextResponse.json({
        ok: true,
        messages: conv.messages || [],
        updatedAt: conv.updatedAt || null,
        advisorActive,
    });
}
