import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { loadFreshSession } from '@/lib/auth-session';

/**
 * Auditoría de Gestión Comercial — motor server-side.
 *
 * GET  → lista de asesores auditables (usuarios activos + nombres fantasma que
 *        aún tienen clientes asignados aunque el usuario ya no exista).
 * POST → ejecuta la auditoría para un rango de fechas y un subconjunto de
 *        asesores. Todo se calcula acá contra Postgres/crm_state; el cliente
 *        solo pinta el resultado.
 *
 * Solo SuperAdmin/Admin: esta vista expone la cartera y el desempeño de todo
 * el equipo, no es para vendedores.
 *
 * Fuentes y sus límites (auditoría jul-2026):
 *  - crm_clients.last_contact es texto ("Recién registrado" = nunca contactado).
 *  - Las cotizaciones viven en crm_state.quotes; su fecha real viene embebida
 *    en el id (q-<epoch-ms>). Nunca cambian de status, así que "aprobada" no
 *    es medible desde quotes: el cierre se lee del pipeline (tasks).
 *  - auditLogs NO retiene historial (el front lo sobreescribe), por eso no se
 *    usa como fuente.
 */

type Quote = {
    id: string;
    quoteNumber?: string;
    number?: string;
    status?: string;
    clientId?: string;
    client?: string;
    sellerId?: string;
    sellerName?: string;
    numericTotal?: number;
    taskId?: string;
    isHistorical?: boolean; // pre-CRM sistematizada: excluida de la auditoría
};

type TaskActivity = { type?: string; date?: string; timestamp?: string; content?: string };
type PipelineTask = {
    id: string;
    title?: string;
    value?: string;
    stageId?: string;
    clientId?: string;
    activities?: TaskActivity[];
};

type StageDef = { id: string; label: string; isWinStage?: boolean };

const MS_DAY = 86400000;

/** Los ids del CRM embeben el epoch de creación: q-1778688425678, c-..., t-... */
function epochFromId(id: string | undefined | null): Date | null {
    const m = /-(\d{13})/.exec(id || '');
    return m ? new Date(Number(m[1])) : null;
}

/** "$ 4.644.000" | "Por definir" → COP numérico (0 si no parsea). */
function parseMoney(v: string | number | undefined | null): number {
    if (typeof v === 'number') return v;
    const digits = String(v || '').replace(/[^\d]/g, '');
    return digits ? Number(digits) : 0;
}

function bogotaRange(from: string, to: string): { fromDate: Date; toDate: Date } {
    return {
        fromDate: new Date(`${from}T00:00:00.000-05:00`),
        toDate: new Date(`${to}T23:59:59.999-05:00`),
    };
}

function inRange(d: Date | null, fromDate: Date, toDate: Date): boolean {
    return !!d && d >= fromDate && d <= toDate;
}

/** Días hábiles (lun–vie) dentro del rango — denominador de la meta diaria. */
function businessDays(from: Date, to: Date): number {
    let n = 0;
    const d = new Date(from);
    while (d <= to) {
        const w = d.getDay();
        if (w !== 0 && w !== 6) n++;
        d.setDate(d.getDate() + 1);
    }
    return Math.max(n, 1);
}

// Meta gerencial de contactos diarios por asesor (definida por dirección:
// entre 5 y 10; usamos 5 como piso exigible).
const DAILY_CONTACT_GOAL = 5;

async function requireLeadership(request: NextRequest) {
    const session = await loadFreshSession(request);
    if (!session) {
        return { error: NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 }) };
    }
    if (session.role !== 'SuperAdmin' && session.role !== 'Admin' && session.role !== 'Auditor') {
        return { error: NextResponse.json({ error: 'Solo administradores y auditores pueden lanzar auditorías.' }, { status: 403 }) };
    }
    return { session };
}

export async function GET(request: NextRequest) {
    if (!hasDatabase()) {
        return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
    }
    const guard = await requireLeadership(request);
    if ('error' in guard) return guard.error;

    await ensureCrmSchema();
    const pool = getPool();

    const { rows: users } = await pool.query(`
        SELECT id, name, role, status FROM crm_users
        WHERE role IN ('Vendedor', 'Manager')
        ORDER BY name ASC
    `);

    // Nombres que tienen cartera asignada pero ya no existen como usuario
    // (ej. asesores retirados) — también deben poder auditarse.
    const { rows: ghosts } = await pool.query(`
        SELECT DISTINCT c.assigned_to AS id, c.assigned_to_name AS name
        FROM crm_clients c
        WHERE c.assigned_to IS NOT NULL
          AND c.assigned_to NOT IN (SELECT id FROM crm_users)
    `);

    const sellers = [
        ...users.map((u) => ({ id: u.id, name: u.name, role: u.role, status: u.status, isUser: true })),
        ...ghosts
            .filter((g) => g.id && g.name)
            .map((g) => ({ id: g.id, name: `${g.name} (retirado)`, role: 'Vendedor', status: 'Inactivo', isUser: false })),
    ];

    return NextResponse.json({ sellers });
}

export async function POST(request: NextRequest) {
    if (!hasDatabase()) {
        return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
    }
    const guard = await requireLeadership(request);
    if ('error' in guard) return guard.error;

    const body = await request.json().catch(() => ({}));
    const from: string = typeof body.from === 'string' ? body.from : '';
    const to: string = typeof body.to === 'string' ? body.to : '';
    const sellerIds: string[] = Array.isArray(body.sellerIds) ? body.sellerIds.filter(Boolean) : [];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
        return NextResponse.json({ error: 'Rango de fechas inválido.' }, { status: 400 });
    }

    const { fromDate, toDate } = bogotaRange(from, to);

    await ensureCrmSchema();
    const pool = getPool();

    const [{ rows: clients }, { rows: stateRows }, { rows: rawLeadRows }, { rows: eventRows }] = await Promise.all([
        pool.query(`
            SELECT id, name, company, status, last_contact, assigned_to, assigned_to_name,
                   created_at, updated_at,
                   COALESCE(jsonb_array_length(notes), 0) AS notes_count
            FROM crm_clients
        `),
        pool.query(`SELECT key, value FROM crm_state WHERE key IN ('quotes', 'tasks', 'settings')`),
        pool.query(`
            SELECT assigned_to, assigned_to_name,
                   COUNT(*) FILTER (WHERE status = 'assigned') AS pending,
                   COUNT(*) FILTER (WHERE status = 'contacted' AND contacted_at BETWEEN $1 AND $2) AS contacted_in_range
            FROM crm_raw_leads
            WHERE assigned_to IS NOT NULL
            GROUP BY assigned_to, assigned_to_name
        `, [fromDate.toISOString(), toDate.toISOString()]),
        // Bitácora inmutable de contactos: 1º, 2º y 3º contacto por cliente.
        pool.query(`
            SELECT client_id, ARRAY_AGG(created_at ORDER BY created_at ASC) AS times
            FROM crm_contact_events
            GROUP BY client_id
        `),
    ]);

    const eventsByClient = new Map<string, Date[]>(
        eventRows.map((r) => [r.client_id, (r.times as Date[]).map((t) => new Date(t))])
    );

    const state = new Map(stateRows.map((r) => [r.key, r.value]));
    const quotes: Quote[] = Array.isArray(state.get('quotes')) ? state.get('quotes') : [];
    const tasks: PipelineTask[] = Array.isArray(state.get('tasks')) ? state.get('tasks') : [];
    const settings = state.get('settings') || {};
    const stages: StageDef[] = Array.isArray(settings?.pipelineStages) ? settings.pipelineStages : [];
    const winStageIds = new Set(stages.filter((s) => s.isWinStage).map((s) => s.id));
    const winStageLabels = stages.filter((s) => s.isWinStage).map((s) => s.label);

    const clientById = new Map<string, (typeof clients)[number]>(clients.map((c) => [c.id, c]));
    const filterActive = sellerIds.length > 0;
    const wantSeller = (id: string | null | undefined) => !filterActive || (!!id && sellerIds.includes(id));

    // ── Acumulador por asesor ────────────────────────────────────────────
    type ClientRow = {
        id: string;
        name: string;
        company: string;
        lastContact: string;
        daysWaiting: number;
        quotes: number;
        quotesValue: number;
        notes: number;
        contacts: number;
        // true = hay evidencia de contacto (cotización/bitácora/nota) pero el
        // asesor nunca registró la gestión en el CRM (last_contact sigue en
        // "Recién registrado"). Es la falla de gestión-de-registro, distinta
        // de "nunca contactado".
        unregistered: boolean;
    };
    type SellerStats = {
        sellerId: string;
        sellerName: string;
        totalClients: number;
        newClientsInRange: number;
        // "Nunca contactado" = CERO evidencia: sin cotización, sin eventos en
        // bitácora, sin notas y sin fecha de contacto. (Definición corregida
        // 3-jul-2026: antes se miraba solo el campo last_contact y eso inflaba
        // el número — un cliente con cotización enviada SÍ fue contactado.)
        neverContacted: number;
        // Contactado con evidencia pero sin registro del asesor en el CRM
        // (ej. cotizó y el campo sigue en "Recién registrado").
        unregisteredManagement: number;
        pctNeverContacted: number;
        oldestWaitingDays: number;
        touchedInRange: number;
        lastActivity: string | null;
        quotesInRange: number;
        quotesValueInRange: number;
        quotesNoFollowUp: number;
        avgDaysLeadToQuote: number | null;
        closedInRange: number;
        closedValueInRange: number;
        avgCycleDays: number | null;
        rawContactedInRange: number;
        rawPendingAssigned: number;
        // Tiempos de respuesta (días): desde que el cliente entra a la cartera
        // del asesor hasta su 1º/2º/3º contacto registrado en la bitácora
        // inmutable (crm_contact_events: clicks de WhatsApp/llamada/correo y
        // anotaciones). La bitácora existe desde jul-2026; el "aprox" usa el
        // campo último contacto como estimación para el histórico anterior.
        avgFirstResponseDays: number | null;
        avgSecondContactDays: number | null;
        avgThirdContactDays: number | null;
        avgFirstResponseApproxDays: number | null;
        clientsWithTrackedContacts: number;
        // Meta diaria de contactos: eventos de bitácora en el rango + fechas de
        // contacto históricas en el rango + base fría contactada en el rango,
        // dividido entre días hábiles. Histórico = estimado; exacto desde jul-2026.
        contactsInRange: number;
        contactsPerDay: number;
        goalCompliancePct: number;
        contactedClients: ClientRow[];
        neverContactedClients: ClientRow[];
    };
    const perSeller = new Map<string, SellerStats>();
    const statsFor = (id: string | null | undefined, name: string | null | undefined): SellerStats => {
        const key = id || `name:${name || 'sin-asignar'}`;
        let s = perSeller.get(key);
        if (!s) {
            s = {
                sellerId: key,
                sellerName: name || '(sin asignar)',
                totalClients: 0, newClientsInRange: 0, neverContacted: 0, unregisteredManagement: 0, pctNeverContacted: 0,
                oldestWaitingDays: 0, touchedInRange: 0, lastActivity: null,
                quotesInRange: 0, quotesValueInRange: 0, quotesNoFollowUp: 0, avgDaysLeadToQuote: null,
                closedInRange: 0, closedValueInRange: 0, avgCycleDays: null,
                rawContactedInRange: 0, rawPendingAssigned: 0,
                avgFirstResponseDays: null, avgSecondContactDays: null, avgThirdContactDays: null,
                avgFirstResponseApproxDays: null, clientsWithTrackedContacts: 0,
                contactsInRange: 0, contactsPerDay: 0, goalCompliancePct: 0,
                contactedClients: [], neverContactedClients: [],
            };
            perSeller.set(key, s);
        }
        return s;
    };
    const leadToQuoteDays = new Map<string, number[]>();
    const cycleDays = new Map<string, number[]>();
    const firstRespDays = new Map<string, number[]>();
    const secondRespDays = new Map<string, number[]>();
    const thirdRespDays = new Map<string, number[]>();
    const firstRespApproxDays = new Map<string, number[]>();
    const pushTo = (map: Map<string, number[]>, key: string, v: number) => {
        if (v < 0) return; // fechas inconsistentes no ensucian el promedio
        const arr = map.get(key) || [];
        arr.push(v);
        map.set(key, arr);
    };

    // Cotizaciones históricas por cliente (para los anexos: cuánto se le ha
    // cotizado a cada cliente, sin importar el rango de la auditoría).
    const quotesByClient = new Map<string, Quote[]>();
    for (const q of quotes) {
        if (q.isHistorical) continue; // pre-CRM: no es evidencia de gestión en el CRM
        if (!q.clientId) continue;
        const arr = quotesByClient.get(q.clientId) || [];
        arr.push(q);
        quotesByClient.set(q.clientId, arr);
    }

    // ── Clientes ─────────────────────────────────────────────────────────
    const now = new Date();
    for (const c of clients) {
        if (!wantSeller(c.assigned_to)) continue;
        const s = statsFor(c.assigned_to, c.assigned_to_name);
        s.totalClients++;
        const created = new Date(c.created_at);
        const updated = new Date(c.updated_at);
        if (inRange(created, fromDate, toDate)) s.newClientsInRange++;
        const cQuotes = quotesByClient.get(c.id) || [];
        const cEvents = eventsByClient.get(c.id) || [];
        // ¿Hay EVIDENCIA de contacto? Una cotización enviada, un evento en la
        // bitácora, una nota o una fecha registrada — cualquiera cuenta.
        // El campo last_contact solo, sin nada más, NO define la métrica.
        const fieldRegistered = (c.last_contact || '') !== 'Recién registrado';
        const hasEvidence = cQuotes.length > 0 || cEvents.length > 0 || (Number(c.notes_count) || 0) > 0 || fieldRegistered;
        const row = {
            id: c.id,
            name: c.name,
            company: c.company || '',
            lastContact: c.last_contact || '',
            daysWaiting: Math.round((now.getTime() - created.getTime()) / MS_DAY),
            quotes: cQuotes.length,
            quotesValue: cQuotes.reduce((a, q) => a + (q.numericTotal || 0), 0),
            notes: Number(c.notes_count) || 0,
            contacts: cEvents.length,
            unregistered: hasEvidence && !fieldRegistered,
        };
        // Meta diaria: eventos de bitácora dentro del rango cuentan uno a uno;
        // si no hay eventos, la fecha del campo último contacto dentro del
        // rango cuenta como 1 contacto (estimación histórica).
        const eventsInRange = cEvents.filter((d) => inRange(d, fromDate, toDate)).length;
        if (eventsInRange > 0) {
            s.contactsInRange += eventsInRange;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(c.last_contact || '') && inRange(new Date(`${c.last_contact}T12:00:00-05:00`), fromDate, toDate)) {
            s.contactsInRange += 1;
        }
        // Tiempos de respuesta: la asignación al asesor ocurre al crear el
        // cliente (round-robin / registro manual), así que created_at es el
        // punto de partida. 1º/2º/3º contacto salen de la bitácora inmutable.
        if (cEvents.length > 0) {
            s.clientsWithTrackedContacts++;
            pushTo(firstRespDays, s.sellerId, (cEvents[0].getTime() - created.getTime()) / MS_DAY);
            if (cEvents.length > 1) pushTo(secondRespDays, s.sellerId, (cEvents[1].getTime() - created.getTime()) / MS_DAY);
            if (cEvents.length > 2) pushTo(thirdRespDays, s.sellerId, (cEvents[2].getTime() - created.getTime()) / MS_DAY);
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(c.last_contact || '')) {
            // Histórico previo a la bitácora: el campo último contacto es la
            // única fecha disponible; como el patrón dominante es un solo
            // contacto, sirve como aproximación del primer contacto.
            pushTo(firstRespApproxDays, s.sellerId, (new Date(c.last_contact).getTime() - created.getTime()) / MS_DAY);
        }
        if (!hasEvidence) {
            s.neverContacted++;
            s.oldestWaitingDays = Math.max(s.oldestWaitingDays, row.daysWaiting);
            s.neverContactedClients.push(row);
        } else {
            if (row.unregistered) s.unregisteredManagement++;
            s.contactedClients.push(row);
        }
        if (inRange(updated, fromDate, toDate) && updated > created) s.touchedInRange++;
        if (!s.lastActivity || updated.toISOString() > s.lastActivity) s.lastActivity = updated.toISOString();
    }

    // ── Cotizaciones en rango + seguimiento post-cotización ─────────────
    const abandonedQuotes: Array<{
        number: string; sellerName: string; clientName: string; value: number;
        sentAt: string; daysSinceSent: number; lastContact: string;
    }> = [];
    const quotedClientIds = new Set<string>();
    const monthly = new Map<string, { quotes: number; value: number }>();
    for (const q of quotes) {
        if (q.isHistorical) continue; // pre-CRM sistematizada: solo consulta
        if (!wantSeller(q.sellerId)) continue;
        const sentAt = epochFromId(q.id);
        if (!inRange(sentAt, fromDate, toDate)) continue;
        const s = statsFor(q.sellerId, q.sellerName);
        s.quotesInRange++;
        s.quotesValueInRange += q.numericTotal || 0;
        if (q.clientId) quotedClientIds.add(q.clientId);
        if (sentAt) {
            const monthKey = sentAt.toISOString().slice(0, 7);
            const m = monthly.get(monthKey) || { quotes: 0, value: 0 };
            m.quotes++;
            m.value += q.numericTotal || 0;
            monthly.set(monthKey, m);
        }

        const c = q.clientId ? clientById.get(q.clientId) : undefined;
        if (c && sentAt) {
            const base = epochFromId(c.id) || new Date(c.created_at);
            const days = (sentAt.getTime() - base.getTime()) / MS_DAY;
            if (days >= 0) {
                const arr = leadToQuoteDays.get(s.sellerId) || [];
                arr.push(days);
                leadToQuoteDays.set(s.sellerId, arr);
            }
        }
        // "Sin seguimiento" = el cliente no volvió a tocarse después de +24h
        // del envío. updated_at es el proxy disponible (no hay bitácora usada).
        const followedUp = !!(c && sentAt && new Date(c.updated_at).getTime() > sentAt.getTime() + MS_DAY);
        if (!followedUp) {
            s.quotesNoFollowUp++;
            abandonedQuotes.push({
                number: q.quoteNumber || q.number || q.id,
                sellerName: q.sellerName || '—',
                clientName: q.client || c?.name || '—',
                value: q.numericTotal || 0,
                sentAt: sentAt ? sentAt.toISOString().slice(0, 10) : '—',
                daysSinceSent: sentAt ? Math.round((now.getTime() - sentAt.getTime()) / MS_DAY) : 0,
                lastContact: c?.last_contact || 'cliente eliminado',
            });
        }
    }

    // ── Cierres (pipeline): negocios actualmente en etapa ganadora ──────
    const quoteByTaskId = new Map(quotes.filter((q) => q.taskId).map((q) => [q.taskId as string, q]));
    for (const t of tasks) {
        if (!t.stageId || !winStageIds.has(t.stageId)) continue;
        // Dueño del negocio: cotización enlazada → cliente asignado → texto
        // "creado por <nombre>" de la primera actividad del sistema.
        const linkedQuote = quoteByTaskId.get(t.id);
        const client = t.clientId ? clientById.get(t.clientId) : undefined;
        let ownerId: string | null = linkedQuote?.sellerId || client?.assigned_to || null;
        let ownerName: string | null = linkedQuote?.sellerName || client?.assigned_to_name || null;
        if (!ownerName) {
            for (const a of t.activities || []) {
                const m = /(?:creado por|generada? por)\s+(.+?)\.?$/i.exec(a.content || '');
                if (m) { ownerName = m[1].trim(); break; }
            }
        }
        if (!wantSeller(ownerId) && !(filterActive && !ownerId)) {
            if (filterActive) continue;
        }
        if (filterActive && (!ownerId || !sellerIds.includes(ownerId))) continue;

        const createdAt = epochFromId(t.id);
        let closedAt: Date | null = null;
        for (const a of t.activities || []) {
            const content = a.content || '';
            const isWinChange = winStageLabels.some((label) => content.includes(`→ ${label}`));
            if (isWinChange) {
                const d = a.date || a.timestamp;
                if (d) closedAt = new Date(d);
            }
        }
        const effectiveClose = closedAt || createdAt;
        if (!inRange(effectiveClose, fromDate, toDate)) continue;

        const s = statsFor(ownerId, ownerName);
        s.closedInRange++;
        s.closedValueInRange += parseMoney(t.value);
        if (createdAt && effectiveClose) {
            const days = (effectiveClose.getTime() - createdAt.getTime()) / MS_DAY;
            if (days >= 0) {
                const arr = cycleDays.get(s.sellerId) || [];
                arr.push(days);
                cycleDays.set(s.sellerId, arr);
            }
        }
    }

    // ── Base fría ────────────────────────────────────────────────────────
    for (const r of rawLeadRows) {
        if (!wantSeller(r.assigned_to)) continue;
        const s = statsFor(r.assigned_to, r.assigned_to_name);
        s.rawContactedInRange += Number(r.contacted_in_range) || 0;
        s.rawPendingAssigned += Number(r.pending) || 0;
    }

    // ── Promedios y totales ──────────────────────────────────────────────
    const avg = (arr: number[] | undefined) =>
        arr && arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

    const rangeBusinessDays = businessDays(fromDate, toDate);
    const rows = Array.from(perSeller.values()).map((s) => {
        // La base fría contactada en el rango también es gestión diaria.
        const totalContacts = s.contactsInRange + s.rawContactedInRange;
        const perDay = Math.round((totalContacts / rangeBusinessDays) * 10) / 10;
        return {
        ...s,
        contactsInRange: totalContacts,
        contactsPerDay: perDay,
        goalCompliancePct: Math.round((100 * perDay) / DAILY_CONTACT_GOAL),
        contactedClients: [...s.contactedClients].sort((a, b) => b.quotesValue - a.quotesValue),
        neverContactedClients: [...s.neverContactedClients].sort((a, b) => b.daysWaiting - a.daysWaiting),
        pctNeverContacted: s.totalClients ? Math.round((100 * s.neverContacted) / s.totalClients) : 0,
        avgDaysLeadToQuote: avg(leadToQuoteDays.get(s.sellerId)),
        avgCycleDays: avg(cycleDays.get(s.sellerId)),
        avgFirstResponseDays: avg(firstRespDays.get(s.sellerId)),
        avgSecondContactDays: avg(secondRespDays.get(s.sellerId)),
        avgThirdContactDays: avg(thirdRespDays.get(s.sellerId)),
        avgFirstResponseApproxDays: avg(firstRespApproxDays.get(s.sellerId)),
        };
    }).sort((a, b) => b.totalClients - a.totalClients);

    const totals = rows.reduce(
        (acc, s) => ({
            clients: acc.clients + s.totalClients,
            newClientsInRange: acc.newClientsInRange + s.newClientsInRange,
            neverContacted: acc.neverContacted + s.neverContacted,
            unregisteredManagement: acc.unregisteredManagement + s.unregisteredManagement,
            touchedInRange: acc.touchedInRange + s.touchedInRange,
            quotesInRange: acc.quotesInRange + s.quotesInRange,
            quotesValueInRange: acc.quotesValueInRange + s.quotesValueInRange,
            quotesNoFollowUp: acc.quotesNoFollowUp + s.quotesNoFollowUp,
            closedInRange: acc.closedInRange + s.closedInRange,
            closedValueInRange: acc.closedValueInRange + s.closedValueInRange,
            rawContactedInRange: acc.rawContactedInRange + s.rawContactedInRange,
        }),
        {
            clients: 0, newClientsInRange: 0, neverContacted: 0, unregisteredManagement: 0, touchedInRange: 0,
            quotesInRange: 0, quotesValueInRange: 0, quotesNoFollowUp: 0,
            closedInRange: 0, closedValueInRange: 0, rawContactedInRange: 0,
        }
    );

    abandonedQuotes.sort((a, b) => b.value - a.value);

    const contactedStock = rows.reduce((a, s) => a + s.contactedClients.length, 0);
    const quotedClientsInRange = Array.from(quotedClientIds).filter((id) => clientById.has(id)).length;

    return NextResponse.json({
        range: { from, to },
        generatedAt: new Date().toISOString(),
        totals: {
            ...totals,
            pctNeverContacted: totals.clients ? Math.round((100 * totals.neverContacted) / totals.clients) : 0,
        },
        funnel: {
            clients: totals.clients,
            contacted: contactedStock,
            quotedClients: quotedClientsInRange,
            closed: totals.closedInRange,
        },
        avgTicket: totals.quotesInRange ? Math.round(totals.quotesValueInRange / totals.quotesInRange) : 0,
        dailyGoal: DAILY_CONTACT_GOAL,
        rangeBusinessDays,
        monthly: Array.from(monthly.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, m]) => ({ month, ...m })),
        perSeller: rows,
        abandonedQuotes: abandonedQuotes.slice(0, 50),
        notes: [
            '"Nunca contactado" = cero evidencia de contacto: sin cotización, sin eventos en bitácora, sin notas y sin fecha registrada. Un cliente con cotización enviada cuenta como CONTACTADO aunque el asesor no haya registrado la gestión.',
            '"Sin registrar gestión" = hay evidencia de contacto (ej. cotización) pero el asesor nunca actualizó el CRM — es la falla de registro/seguimiento que debe corregirse con la bitácora.',
            'Tiempo de 1ª/2ª/3ª respuesta: desde la asignación hasta cada contacto en la bitácora inmutable (clicks de WhatsApp/llamada/correo y anotaciones). La bitácora existe desde el 3-jul-2026: "sin seguimiento" en fechas anteriores puede reflejar ausencia de registro, no necesariamente ausencia de gestión.',
            'Cierres = etapa ganadora del pipeline; ojo: hay cierres registrados retroactivamente, el ciclo real puede ser mayor.',
        ],
    });
}
