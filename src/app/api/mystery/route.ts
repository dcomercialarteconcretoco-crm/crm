import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { loadFreshSession } from '@/lib/auth-session';

/**
 * Cliente Oculto — API del programa de mystery shopper (plan URB jul-2026).
 *
 * GET  → misiones + cruce automático contra el CRM real + avisos de incógnito.
 * POST → crear misión (perfil, canal, identidad ficticia).
 * PUT  → actualizar misión (1ª respuesta, cotización, toques, rúbrica, notas).
 *
 * Solo SuperAdmin/Admin/Auditor: los vendedores NUNCA deben ver este módulo —
 * la gracia del estudio es que no sepan cuál lead es el evaluador.
 *
 * El cruce funciona así: la misión guarda el teléfono/correo del alias. El
 * sistema busca ese alias en crm_clients (el lead que el canal debió crear) y
 * en crm_contact_events (los contactos que el vendedor registró). Con eso
 * calcula si el proceso comercial hizo lo que debía según los benchmarks del
 * plan (1ª respuesta <1h, cotización <48h, ≥2 seguimientos en 7 días).
 */

const ROLES_OK = new Set(['SuperAdmin', 'Admin', 'Auditor']);
const MS_HOUR = 3600000;
const MS_DAY = 86400000;

// Rúbrica del plan: dimensión → peso (total 100).
const RUBRIC: Array<{ key: string; label: string; max: number }> = [
    { key: 'tpr', label: 'Tiempo de primera respuesta', max: 15 },
    { key: 'canal', label: 'Cobertura de canal', max: 10 },
    { key: 'cordialidad', label: 'Cordialidad y profesionalismo', max: 10 },
    { key: 'descubrimiento', label: 'Descubrimiento de necesidad', max: 15 },
    { key: 'asesoria', label: 'Asesoría técnica', max: 15 },
    { key: 'cotiz_velocidad', label: 'Cotización — velocidad', max: 10 },
    { key: 'cotiz_calidad', label: 'Cotización — calidad', max: 10 },
    { key: 'objeciones', label: 'Manejo de objeciones', max: 5 },
    { key: 'seguimiento', label: 'Seguimiento (follow-up)', max: 10 },
];

function normPhone(p: string | null | undefined): string {
    return String(p || '').replace(/\D/g, '').slice(-10);
}

async function guard(request: NextRequest) {
    const session = await loadFreshSession(request);
    if (!session) return { error: NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 }) };
    if (!ROLES_OK.has(session.role)) {
        return { error: NextResponse.json({ error: 'Solo administradores y auditores.' }, { status: 403 }) };
    }
    return { session };
}

export async function GET(request: NextRequest) {
    if (!hasDatabase()) return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
    const g = await guard(request);
    if ('error' in g) return g.error;

    await ensureCrmSchema();
    const pool = getPool();

    const [{ rows: missions }, { rows: clients }, { rows: quoteState }] = await Promise.all([
        pool.query(`SELECT * FROM crm_mystery_missions ORDER BY created_at DESC`),
        pool.query(`SELECT id, name, phone, email, assigned_to_name, last_contact, created_at FROM crm_clients`),
        pool.query(`SELECT value FROM crm_state WHERE key = 'quotes'`),
    ]);
    const quotes: Array<{ clientId?: string; quoteNumber?: string; numericTotal?: number; id: string }> =
        Array.isArray(quoteState[0]?.value) ? quoteState[0].value : [];

    // Índices para el cruce por teléfono/correo del alias.
    const byPhone = new Map<string, (typeof clients)[number]>();
    const byEmail = new Map<string, (typeof clients)[number]>();
    for (const c of clients) {
        const p = normPhone(c.phone);
        if (p) byPhone.set(p, c);
        if (c.email) byEmail.set(String(c.email).trim().toLowerCase(), c);
    }
    const clientIds = new Set(clients.map((c) => c.id));

    // Eventos de contacto por cliente (bitácora del vendedor).
    const { rows: eventRows } = await pool.query(`
        SELECT client_id, COUNT(*) AS n, MIN(created_at) AS first_at
        FROM crm_contact_events GROUP BY client_id
    `);
    const eventsByClient = new Map(eventRows.map((r) => [r.client_id, { n: Number(r.n), firstAt: new Date(r.first_at) }]));

    const now = Date.now();
    const enriched = missions.map((m) => {
        // 1) Ubicar el lead del alias en el CRM.
        const linked =
            (m.linked_client_id && clientIds.has(m.linked_client_id)
                ? clients.find((c) => c.id === m.linked_client_id)
                : undefined) ||
            (normPhone(m.alias_phone) ? byPhone.get(normPhone(m.alias_phone)) : undefined) ||
            (m.alias_email ? byEmail.get(String(m.alias_email).trim().toLowerCase()) : undefined);

        const crmEvents = linked ? eventsByClient.get(linked.id) : undefined;

        // 2) Métricas de la misión.
        const contactAt = m.contact_at ? new Date(m.contact_at).getTime() : null;
        const firstRespAt = m.first_response_at ? new Date(m.first_response_at).getTime() : null;
        const quoteAt = m.quote_at ? new Date(m.quote_at).getTime() : null;
        const tprHours = contactAt && firstRespAt ? Math.round(((firstRespAt - contactAt) / MS_HOUR) * 10) / 10 : null;
        const quoteHours = contactAt && quoteAt ? Math.round(((quoteAt - contactAt) / MS_HOUR) * 10) / 10 : null;
        const touches: unknown[] = Array.isArray(m.touches) ? m.touches : [];
        const scores: Record<string, number> = m.scores && typeof m.scores === 'object' ? m.scores : {};
        const totalScore = RUBRIC.reduce((a, r) => a + Math.min(Number(scores[r.key]) || 0, r.max), 0);
        const scored = Object.keys(scores).length > 0;

        // 3) Avisos de incógnito — benchmarks del plan (sección 9).
        const alerts: Array<{ code: string; severity: 'high' | 'medium'; text: string }> = [];
        const hoursSinceContact = contactAt ? (now - contactAt) / MS_HOUR : null;
        if (m.status !== 'planned' && contactAt) {
            if (!linked && hoursSinceContact! > 24) {
                alerts.push({ code: 'CRM_SIN_LEAD', severity: 'high', text: `El lead ficticio (${m.alias_name}) NO existe en el CRM después de ${Math.round(hoursSinceContact!)}h — el canal no lo registró o nadie lo creó.` });
            }
            if (!firstRespAt && hoursSinceContact! > 1 && m.status !== 'completed') {
                alerts.push({ code: 'SIN_RESPUESTA', severity: 'high', text: `Sin primera respuesta después de ${Math.round(hoursSinceContact!)}h (meta: <1h laboral).` });
            }
            if (firstRespAt && tprHours !== null && tprHours > 1) {
                alerts.push({ code: 'TPR_ALTO', severity: 'medium', text: `Primera respuesta tardó ${tprHours}h (meta: <1h, ideal <15 min).` });
            }
            if (!quoteAt && hoursSinceContact! > 48 && m.status !== 'completed') {
                alerts.push({ code: 'SIN_COTIZACION', severity: 'high', text: `Sin cotización después de ${Math.round(hoursSinceContact! / 24)} días (meta: <48h).` });
            }
            if (hoursSinceContact! > 7 * 24 && touches.length < 2) {
                alerts.push({ code: 'SIN_SEGUIMIENTO', severity: 'high', text: `Solo ${touches.length} seguimiento(s) en la ventana de 7 días (meta: ≥2 toques).` });
            }
            if (linked && (!crmEvents || crmEvents.n === 0) && hoursSinceContact! > 24) {
                alerts.push({ code: 'CRM_SIN_CONTACTO', severity: 'medium', text: `El lead existe en el CRM (asignado a ${linked.assigned_to_name || '—'}) pero el vendedor no ha registrado NINGÚN contacto en la bitácora.` });
            }
        }

        const linkedQuotes = linked ? quotes.filter((q) => q.clientId === linked.id) : [];

        return {
            ...m,
            tprHours,
            quoteHours,
            touchesCount: touches.length,
            totalScore: scored ? totalScore : null,
            crm: linked
                ? {
                      clientId: linked.id,
                      clientName: linked.name,
                      assignedTo: linked.assigned_to_name,
                      lastContact: linked.last_contact,
                      leadCreatedAt: linked.created_at,
                      contactEvents: crmEvents?.n || 0,
                      quotes: linkedQuotes.length,
                      quotesValue: linkedQuotes.reduce((a, q) => a + (q.numericTotal || 0), 0),
                  }
                : null,
            alerts,
        };
    });

    return NextResponse.json({ missions: enriched, rubric: RUBRIC });
}

export async function POST(request: NextRequest) {
    if (!hasDatabase()) return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
    const g = await guard(request);
    if ('error' in g) return g.error;

    const b = await request.json().catch(() => ({}));
    const required = ['profile', 'channel', 'aliasName'];
    for (const k of required) {
        if (!b[k] || typeof b[k] !== 'string') {
            return NextResponse.json({ error: `Campo requerido: ${k}` }, { status: 400 });
        }
    }

    await ensureCrmSchema();
    const pool = getPool();

    const { rows: countRows } = await pool.query(
        `SELECT COUNT(*) AS n FROM crm_mystery_missions WHERE profile = $1 AND channel = $2`,
        [b.profile, b.channel]
    );
    const seq = String(Number(countRows[0].n) + 1).padStart(2, '0');
    const code = `${b.profile}-${String(b.channel).toUpperCase().slice(0, 3)}-${seq}`;
    const id = `mm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await pool.query(
        `INSERT INTO crm_mystery_missions
            (id, code, profile, channel, alias_name, alias_company, alias_phone, alias_email,
             status, contact_at, notes, created_by, created_by_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
            id, code, b.profile, b.channel, b.aliasName,
            b.aliasCompany || null, b.aliasPhone || null, b.aliasEmail || null,
            b.contactAt ? 'active' : 'planned',
            b.contactAt || null,
            b.notes || null,
            g.session.id, g.session.name,
        ]
    );

    return NextResponse.json({ ok: true, id, code });
}

export async function PUT(request: NextRequest) {
    if (!hasDatabase()) return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
    const g = await guard(request);
    if ('error' in g) return g.error;

    const b = await request.json().catch(() => ({}));
    if (!b.id || typeof b.id !== 'string') {
        return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    }

    await ensureCrmSchema();
    const pool = getPool();

    // Campos editables — cada uno opcional; solo se actualiza lo enviado.
    const sets: string[] = [];
    const vals: unknown[] = [];
    const push = (sql: string, v: unknown) => { vals.push(v); sets.push(`${sql} = $${vals.length}`); };

    if (b.status !== undefined) push('status', b.status);
    if (b.contactAt !== undefined) push('contact_at', b.contactAt || null);
    if (b.firstResponseAt !== undefined) push('first_response_at', b.firstResponseAt || null);
    if (b.quoteAt !== undefined) push('quote_at', b.quoteAt || null);
    if (b.quoteFormat !== undefined) push('quote_format', b.quoteFormat || null);
    if (b.attendedBy !== undefined) push('attended_by', b.attendedBy || null);
    if (b.scores !== undefined) push('scores', JSON.stringify(b.scores || {}));
    if (b.touches !== undefined) push('touches', JSON.stringify(b.touches || []));
    if (b.notes !== undefined) push('notes', b.notes || null);
    if (b.linkedClientId !== undefined) push('linked_client_id', b.linkedClientId || null);

    if (sets.length === 0) return NextResponse.json({ ok: true });

    vals.push(b.id);
    await pool.query(
        `UPDATE crm_mystery_missions SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`,
        vals
    );
    return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
    if (!hasDatabase()) return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
    const g = await guard(request);
    if ('error' in g) return g.error;
    // Solo administración puede borrar misiones (el auditor conserva su registro).
    if (g.session.role === 'Auditor') {
        return NextResponse.json({ error: 'Solo administradores pueden eliminar misiones.' }, { status: 403 });
    }
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    await ensureCrmSchema();
    await getPool().query(`DELETE FROM crm_mystery_missions WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
}
