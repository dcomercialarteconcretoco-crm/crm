import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { loadFreshSession } from '@/lib/auth-session';

/**
 * Bitácora inmutable de contactos con clientes.
 *
 * POST: registra un contacto real (click en WhatsApp, click en llamar, correo
 * o anotación) hecho por el usuario logueado sobre un cliente. Se dispara
 * fire-and-forget desde el front (hoja de vida, pipeline). Además actualiza
 * `last_contact` del cliente a la fecha de hoy (Bogotá), que es lo que las
 * vistas y la auditoría usan como "último contacto".
 *
 * Esta tabla es append-only a propósito: es la fuente para medir tiempo de
 * 1ª/2ª/3ª respuesta por asesor. No hay DELETE ni UPDATE expuestos.
 */

const VALID_TYPES = new Set(['whatsapp', 'call', 'email', 'note']);

export async function POST(request: NextRequest) {
    if (!hasDatabase()) {
        return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
    }
    const session = await loadFreshSession(request);
    if (!session) {
        return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
    const type = typeof body.type === 'string' ? body.type.trim() : '';
    const detail = typeof body.detail === 'string' ? body.detail.slice(0, 500) : null;

    if (!clientId || !VALID_TYPES.has(type)) {
        return NextResponse.json({ error: 'clientId y type (whatsapp|call|email|note) son requeridos.' }, { status: 400 });
    }

    await ensureCrmSchema();
    const pool = getPool();

    const { rows } = await pool.query(`SELECT id, name FROM crm_clients WHERE id = $1`, [clientId]);
    if (rows.length === 0) {
        return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 });
    }

    const id = `ce-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await pool.query(
        `INSERT INTO crm_contact_events (id, client_id, client_name, seller_id, seller_name, type, detail)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, clientId, rows[0].name, session.id, session.name, type, detail]
    );

    // last_contact es la fecha (Bogotá) del contacto más reciente.
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    await pool.query(
        `UPDATE crm_clients SET last_contact = $1, updated_at = NOW() WHERE id = $2`,
        [today, clientId]
    );

    return NextResponse.json({ ok: true, id });
}
