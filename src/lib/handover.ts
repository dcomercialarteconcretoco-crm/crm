import type { Pool, PoolClient } from 'pg';

/**
 * Relevo de personal — entrega de puesto de un integrante que sale a uno que entra.
 *
 * PROBLEMA QUE RESUELVE (ago-2026, rotación alta en ArteConcreto)
 * ---------------------------------------------------------------
 * Cuando alguien se iba, la salida se resolvía RENOMBRANDO su fila de
 * crm_users: el asesor nuevo entraba con el id del anterior y heredaba en el
 * mismo movimiento su cartera... y también sus cotizaciones, sus tiempos de
 * respuesta y sus errores. En una auditoría eso es indefendible: la evidencia
 * queda a nombre de quien no la hizo. En producción quedaron dos casos así
 * (s-1142714434 y s-1098774743), con usuario, cartera y tarjeta digital
 * mostrando TRES nombres distintos para la misma identidad.
 *
 * La alternativa obvia — crear al nuevo desde cero — tampoco servía: reasignar
 * a mano 344 clientes, 146 leads y 49 negocios es inviable, así que en la
 * práctica nadie lo hacía.
 *
 * MODELO
 * ------
 * El que sale NO se borra y NO se renombra: se ARCHIVA. Su fila queda intacta
 * para que todo registro histórico siga resolviendo a un nombre real, pero:
 *   - status pasa a 'Inactivo' y archived_at queda estampado → sale de los
 *     desplegables, del round-robin, de los rankings y del login;
 *   - se le anula la contraseña y el token de reset → no puede volver a entrar;
 *   - se le libera el correo corporativo (asesor2@… → asesor2+ex-AAAAMMDD@…)
 *     para que el reemplazo pueda quedárselo, guardando el original en
 *     original_email.
 *
 * El que entra es una fila NUEVA (id nuevo, hired_at hoy, historial en cero)
 * que recibe la CARTERA, nunca el historial.
 *
 * QUÉ SE MUEVE (trabajo por delante, es de quien atiende hoy)
 *   - crm_clients.assigned_to / assigned_to_name
 *   - crm_raw_leads pendientes (new / assigned / contacted)
 *   - crm_state.tasks — SOLO los negocios abiertos del pipeline
 *   - crm_state.events — SOLO la agenda de hoy en adelante
 *   - crm_state.notifications — SOLO las no leídas dirigidas al que sale
 *   - crm_biolinks — la tarjeta pública del que sale se DESACTIVA (su foto y su
 *     nombre están publicados en internet) y el que entra recibe una propia
 *
 * QUÉ NO SE MUEVE JAMÁS (evidencia; moverla sería falsificarla)
 *   - crm_state.quotes — una cotización es un documento firmado y enviado a un
 *     cliente. sellerId/sellerName son la firma.
 *   - crm_state.tasks ya cerrados (etapa ganadora o '__lost__') — sostienen
 *     ranking, comisiones y motivos de pérdida del período.
 *   - crm_contact_events, crm_client_attachments, crm_mystery_missions,
 *     crm_documents, auditLogs.
 *
 * Cada relevo deja un acta inmutable en crm_handovers con quién, cuándo, por
 * qué, qué se movió y qué se dejó quieto a propósito.
 */

// ── Tipos ────────────────────────────────────────────────────────────────────

export type TransferOptions = {
    clients: boolean;
    rawLeads: boolean;
    openDeals: boolean;
    futureEvents: boolean;
    notifications: boolean;
};

export const DEFAULT_TRANSFER: TransferOptions = {
    clients: true,
    rawLeads: true,
    openDeals: true,
    futureEvents: true,
    notifications: true,
};

/** Lo que se movería (o se movió) al reemplazo. */
export type MovedCounts = {
    clients: number;
    rawLeads: number;
    openDeals: number;
    futureEvents: number;
    notifications: number;
    biolinksDeactivated: number;
};

/** Lo que se queda a nombre del que sale, para siempre. */
export type KeptCounts = {
    quotes: number;
    closedDeals: number;
    contactEvents: number;
    attachments: number;
    pastEvents: number;
};

export type Footprint = {
    user: TeamMemberRow;
    movable: MovedCounts;
    kept: KeptCounts;
};

export type TeamMemberRow = {
    id: string;
    name: string;
    email: string | null;
    username: string | null;
    role: string;
    avatar: string | null;
    phone: string | null;
    status: string;
    permissions: Record<string, boolean> | null;
    receives_leads: boolean;
    archived_at: Date | null;
    commission: string | null;
};

const MEMBER_COLUMNS = `id, name, email, username, role, avatar, phone, status,
        permissions, COALESCE(receives_leads, TRUE) AS receives_leads, archived_at, commission`;

export async function loadMember(
    q: Pool | PoolClient,
    id: string
): Promise<TeamMemberRow | null> {
    const { rows } = await q.query(
        `SELECT ${MEMBER_COLUMNS} FROM crm_users WHERE id = $1 LIMIT 1`,
        [id]
    );
    return (rows[0] as TeamMemberRow) ?? null;
}

// ── Helpers de crm_state ─────────────────────────────────────────────────────

type StateRecord = Record<string, unknown>;

async function readStateArray(q: Pool | PoolClient, key: string): Promise<StateRecord[]> {
    const { rows } = await q.query(`SELECT value FROM crm_state WHERE key = $1`, [key]);
    return Array.isArray(rows[0]?.value) ? (rows[0].value as StateRecord[]) : [];
}

/**
 * Ids de etapa que cuentan como negocio CERRADO. Se leen de settings porque el
 * equipo edita las etapas desde /settings; '__lost__' es el marcador especial
 * que pone el pipeline al marcar un negocio como perdido (no es una columna).
 */
export async function loadClosedStageIds(q: Pool | PoolClient): Promise<Set<string>> {
    const { rows } = await q.query(
        `SELECT value->'pipelineStages' AS stages FROM crm_state WHERE key = 'settings'`
    );
    const stages = Array.isArray(rows[0]?.stages)
        ? (rows[0].stages as Array<{ id?: string; isWinStage?: boolean }>)
        : [];
    const closed = new Set<string>(['__lost__']);
    for (const st of stages) {
        if (st?.isWinStage && typeof st.id === 'string') closed.add(st.id);
    }
    return closed;
}

/**
 * ¿Este registro del pipeline / agenda es del usuario?
 *
 * `Task.assignedTo` es un campo mixto por historia: el modal de detalle guarda
 * el NOMBRE del asesor y el de creación guarda el ID. Hay datos vivos de las
 * dos formas (en producción, 81 tareas por nombre y 8 por id para el mismo
 * vendedor), así que hay que reconocer ambas — y al transferir, RESPETAR la
 * forma original para no cambiarle la semántica al registro.
 */
function matchesUser(value: unknown, user: { id: string; name: string }): 'id' | 'name' | null {
    if (typeof value !== 'string' || !value) return null;
    if (value === user.id) return 'id';
    if (value.trim().toLowerCase() === user.name.trim().toLowerCase()) return 'name';
    return null;
}

/** YYYY-MM-DD de hoy en Bogotá — la agenda guarda fechas como string. */
export function bogotaToday(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

function eventDay(rec: StateRecord): string {
    const d = rec.date;
    return typeof d === 'string' ? d.slice(0, 10) : '';
}

// ── Huella del usuario ───────────────────────────────────────────────────────

/**
 * Cuenta todo lo que cuelga de un integrante, separado en "se puede mover" vs
 * "se queda para la auditoría". Alimenta la pantalla de relevo: el admin ve
 * exactamente qué va a pasar ANTES de confirmar.
 */
export async function collectFootprint(pool: Pool, user: TeamMemberRow): Promise<Footprint> {
    const closedStages = await loadClosedStageIds(pool);
    const today = bogotaToday();

    const [clientsRes, rawRes, bioRes, ceRes, attRes, tasks, quotes, events, notifications] =
        await Promise.all([
            pool.query(`SELECT COUNT(*)::int AS n FROM crm_clients WHERE assigned_to = $1`, [user.id]),
            pool.query(
                `SELECT COUNT(*)::int AS n FROM crm_raw_leads
                 WHERE assigned_to = $1 AND status IN ('new','assigned','contacted')`,
                [user.id]
            ),
            pool.query(
                `SELECT COUNT(*)::int AS n FROM crm_biolinks WHERE seller_id = $1 AND active`,
                [user.id]
            ),
            pool.query(`SELECT COUNT(*)::int AS n FROM crm_contact_events WHERE seller_id = $1`, [user.id]),
            pool.query(
                `SELECT COUNT(*)::int AS n FROM crm_client_attachments WHERE uploaded_by_id = $1`,
                [user.id]
            ),
            readStateArray(pool, 'tasks'),
            readStateArray(pool, 'quotes'),
            readStateArray(pool, 'events'),
            readStateArray(pool, 'notifications'),
        ]);

    let openDeals = 0;
    let closedDeals = 0;
    for (const t of tasks) {
        if (!matchesUser(t.assignedTo, user)) continue;
        const stage = typeof t.stageId === 'string' ? t.stageId : '';
        if (closedStages.has(stage)) closedDeals++;
        else openDeals++;
    }

    const quoteCount = quotes.filter(
        (qt) => matchesUser(qt.sellerId, user) || matchesUser(qt.sellerName, user)
    ).length;

    let futureEvents = 0;
    let pastEvents = 0;
    for (const ev of events) {
        if (!matchesUser(ev.ownerUserId, user) && !matchesUser(ev.ownerName, user)) continue;
        if (eventDay(ev) >= today) futureEvents++;
        else pastEvents++;
    }

    const unreadNotifications = notifications.filter(
        (n) => n.targetUserId === user.id && n.read !== true
    ).length;

    return {
        user,
        movable: {
            clients: clientsRes.rows[0].n,
            rawLeads: rawRes.rows[0].n,
            openDeals,
            futureEvents,
            notifications: unreadNotifications,
            biolinksDeactivated: bioRes.rows[0].n,
        },
        kept: {
            quotes: quoteCount,
            closedDeals,
            contactEvents: ceRes.rows[0].n,
            attachments: attRes.rows[0].n,
            pastEvents,
        },
    };
}

// ── Liberación del correo corporativo ────────────────────────────────────────

/**
 * `asesor2@arteconcreto.co` → `asesor2+ex-20260901@arteconcreto.co`.
 *
 * Existe porque email y username son UNIQUE en crm_users: sin liberar el del
 * que sale, el reemplazo NO puede quedarse con el buzón corporativo del cargo,
 * que es justo lo que la empresa necesita (el correo pertenece al puesto, no a
 * la persona). El valor original queda en original_email para la auditoría.
 */
function tagEmail(email: string, stamp: string, attempt: number): string {
    const suffix = attempt === 0 ? `ex-${stamp}` : `ex-${stamp}-${attempt + 1}`;
    const at = email.lastIndexOf('@');
    if (at <= 0) return `${email}.${suffix}`;
    return `${email.slice(0, at)}+${suffix}${email.slice(at)}`;
}

function tagUsername(username: string, stamp: string, attempt: number): string {
    const suffix = attempt === 0 ? `ex-${stamp}` : `ex-${stamp}-${attempt + 1}`;
    return `${username}#${suffix}`;
}

/** Busca un par (email, username) archivado que no choque con nada existente. */
async function freeIdentity(
    client: PoolClient,
    user: TeamMemberRow
): Promise<{ email: string | null; username: string | null }> {
    const stamp = bogotaToday().replace(/-/g, '');
    for (let attempt = 0; attempt < 25; attempt++) {
        const email = user.email ? tagEmail(user.email, stamp, attempt) : null;
        const username = user.username ? tagUsername(user.username, stamp, attempt) : null;
        const { rows } = await client.query(
            `SELECT 1 FROM crm_users
             WHERE id <> $1 AND (($2::text IS NOT NULL AND email = $2) OR ($3::text IS NOT NULL AND username = $3))
             LIMIT 1`,
            [user.id, email, username]
        );
        if (rows.length === 0) return { email, username };
    }
    // 25 relevos del mismo cargo el mismo día es imposible en la práctica; si
    // pasara, mejor abortar que escribir una identidad ambigua.
    throw new Error('No se pudo liberar el correo corporativo del usuario que sale.');
}

// ── Relevo ───────────────────────────────────────────────────────────────────

export type IncomingMember = {
    id: string;
    name: string;
    email: string;
    username?: string | null;
    phone?: string | null;
    avatar?: string | null;
    role: string;
    permissions?: Record<string, boolean> | null;
    receivesLeads?: boolean;
    commission?: string | null;
    passwordHash?: string | null;
};

export type HandoverInput = {
    outgoing: TeamMemberRow;
    /** null = baja sin reemplazo (la cartera puede ir a `fallbackOwner`). */
    incoming: IncomingMember | null;
    /** Para bajas sin reemplazo: a quién se le pasa la cartera (opcional). */
    fallbackOwner: { id: string; name: string } | null;
    transfer: TransferOptions;
    /** El que entra se queda con el correo/usuario corporativo del que sale. */
    inheritIdentity: boolean;
    reason: string;
    performedBy: { id: string; name: string };
};

export type HandoverResult = {
    handoverId: string;
    incomingId: string | null;
    moved: MovedCounts;
    kept: KeptCounts;
    /** Correo/usuario con el que quedó archivado el que sale. */
    archivedIdentity: { email: string | null; username: string | null };
    /** Cuando el correo del cargo pasó a un compañero que ya estaba. */
    identityHandedTo: { id: string; email: string | null } | null;
};

export async function performHandover(
    pool: Pool,
    input: HandoverInput
): Promise<HandoverResult> {
    const { outgoing, incoming, fallbackOwner, transfer, reason, performedBy } = input;

    // Destino de la cartera: el reemplazo, o el asesor que el admin eligió al
    // dar de baja sin reemplazo. Si no hay ninguno, no se mueve nada — los
    // registros quedan a nombre del archivado y un admin los reasigna a mano.
    const receiver: { id: string; name: string } | null = incoming
        ? { id: incoming.id, name: incoming.name }
        : fallbackOwner;

    const closedStages = await loadClosedStageIds(pool);
    const today = bogotaToday();

    const moved: MovedCounts = {
        clients: 0,
        rawLeads: 0,
        openDeals: 0,
        futureEvents: 0,
        notifications: 0,
        biolinksDeactivated: 0,
    };
    const kept: KeptCounts = {
        quotes: 0,
        closedDeals: 0,
        contactEvents: 0,
        attachments: 0,
        pastEvents: 0,
    };

    const client = await pool.connect();
    let archivedIdentity: { email: string | null; username: string | null } = {
        email: outgoing.email,
        username: outgoing.username,
    };
    let identityHandedTo: { id: string; email: string | null } | null = null;
    const handoverId = `ho-${Date.now()}`;

    try {
        await client.query('BEGIN');

        // ── 0. Candado sobre el que sale ─────────────────────────────────────
        // El chequeo de "ya está archivado" que hace la ruta corre FUERA de la
        // transacción: dos relevos disparados a la vez sobre la misma persona
        // (doble clic, reintento de red) pueden pasarlo los dos. Con el lock de
        // fila el segundo espera, ve archived_at ya escrito y aborta limpio en
        // vez de re-archivar y pisar el replaced_by_id del primero.
        const { rows: locked } = await client.query(
            `SELECT archived_at FROM crm_users WHERE id = $1 FOR UPDATE`,
            [outgoing.id]
        );
        if (locked.length === 0) {
            throw new Error('El usuario que sale ya no existe.');
        }
        if (locked[0].archived_at) {
            throw new Error(`${outgoing.name} ya fue dado de baja por otra operación.`);
        }

        // ── 1. Identidades ───────────────────────────────────────────────────
        // Primero las filas de crm_users: son las únicas que pueden fallar por
        // constraint (email/username UNIQUE). Si revientan, el ROLLBACK ocurre
        // antes de haber tocado un solo cliente.
        // El correo del cargo se libera tanto para un reemplazo nuevo como para
        // un compañero que YA está en el equipo y absorbe el puesto (caso real
        // ago-2026: sale el asesor 1 y el asesor 3 pasa a atender su cartera
        // con el correo asesor1@). En los dos casos el correo pertenece al
        // puesto, no a la persona.
        const identityGoesToExistingMember = Boolean(
            input.inheritIdentity && !incoming && receiver
        );
        if (input.inheritIdentity && (incoming || identityGoesToExistingMember)) {
            archivedIdentity = await freeIdentity(client, outgoing);
        }

        await client.query(
            `UPDATE crm_users SET
                status = 'Inactivo',
                receives_leads = FALSE,
                password = NULL,
                reset_token = NULL,
                reset_token_expires = NULL,
                archived_at = NOW(),
                archived_by = $2,
                archived_by_name = $3,
                archived_reason = $4,
                replaced_by_id = $5,
                email = COALESCE($6, email),
                username = $7,
                original_email = COALESCE(original_email, $8),
                original_username = COALESCE(original_username, $9),
                updated_at = NOW()
             WHERE id = $1`,
            [
                outgoing.id,
                performedBy.id,
                performedBy.name,
                reason || null,
                incoming?.id ?? null,
                archivedIdentity.email,
                archivedIdentity.username,
                outgoing.email,
                outgoing.username,
            ]
        );

        // El compañero que absorbe el puesto se queda con el correo y el usuario
        // del cargo. Su correo anterior (asesor3@…) queda libre para quien
        // ocupe ESE puesto después; nada histórico lo referencia, porque todo
        // en el sistema apunta a su id, no a su correo.
        if (identityGoesToExistingMember && receiver) {
            await client.query(
                `UPDATE crm_users
                 SET email = COALESCE($2, email),
                     username = COALESCE($3, username),
                     updated_at = NOW()
                 WHERE id = $1`,
                [receiver.id, outgoing.email, outgoing.username]
            );
            // La tarjeta digital muestra el correo del asesor: si no se
            // actualiza, el cliente que la abra escribe al buzón de alguien
            // que ya no está.
            await client.query(
                `UPDATE crm_biolinks SET email = $2, updated_at = NOW()
                 WHERE seller_id = $1 AND COALESCE(email, '') <> ''`,
                [receiver.id, outgoing.email]
            );
            identityHandedTo = { id: receiver.id, email: outgoing.email };
        }

        if (incoming) {
            await client.query(
                `INSERT INTO crm_users (
                    id, name, avatar, role, email, phone, username, status, sales, commission,
                    password, permissions, receives_leads, replaces_id, hired_at, created_at, updated_at
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,'Activo','$0',$8,$9,$10,$11,$12,NOW(),NOW(),NOW())`,
                [
                    incoming.id,
                    incoming.name,
                    incoming.avatar || null,
                    incoming.role,
                    incoming.email,
                    incoming.phone || '',
                    incoming.username || incoming.email,
                    incoming.commission || outgoing.commission || '10%',
                    incoming.passwordHash || null,
                    incoming.permissions ? JSON.stringify(incoming.permissions) : null,
                    incoming.receivesLeads !== false,
                    outgoing.id,
                ]
            );
        }

        // ── 2. Tarjeta digital pública ───────────────────────────────────────
        // La del que sale se apaga siempre: su foto, su nombre y su WhatsApp
        // están publicados en /b/<slug> y el QR puede estar impreso en tarjetas
        // físicas que siguen circulando. (En producción hay tarjetas con el
        // nombre de un asesor que ya no está — resabio del renombrado.)
        const bio = await client.query(
            `UPDATE crm_biolinks SET active = FALSE, updated_at = NOW()
             WHERE seller_id = $1 AND active RETURNING id`,
            [outgoing.id]
        );
        moved.biolinksDeactivated = bio.rowCount ?? 0;

        if (incoming) {
            const bioId = `bl-${incoming.id}`;
            const slugBase = incoming.name
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            await client.query(
                `INSERT INTO crm_biolinks (id, seller_id, slug, photo, name, title, phone, email, whatsapp, active)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE)
                 ON CONFLICT DO NOTHING`,
                [
                    bioId,
                    incoming.id,
                    `${slugBase}-${incoming.id.slice(-4)}`,
                    incoming.avatar || null,
                    incoming.name,
                    incoming.role,
                    incoming.phone || null,
                    incoming.email,
                    incoming.phone || null,
                ]
            );
        }

        // ── 3. Cartera en tablas propias ─────────────────────────────────────
        if (receiver && transfer.clients) {
            const r = await client.query(
                `UPDATE crm_clients
                 SET assigned_to = $2, assigned_to_name = $3, updated_at = NOW()
                 WHERE assigned_to = $1`,
                [outgoing.id, receiver.id, receiver.name]
            );
            moved.clients = r.rowCount ?? 0;
        }

        if (receiver && transfer.rawLeads) {
            const r = await client.query(
                `UPDATE crm_raw_leads
                 SET assigned_to = $2, assigned_to_name = $3, updated_at = NOW()
                 WHERE assigned_to = $1 AND status IN ('new','assigned','contacted')`,
                [outgoing.id, receiver.id, receiver.name]
            );
            moved.rawLeads = r.rowCount ?? 0;
        }

        // ── 4. crm_state ─────────────────────────────────────────────────────
        // Orden de locks: primero las claves con merge-por-id en el orden de
        // MERGED_STATE_KEYS (acá sólo 'tasks'), después las planas. Es el mismo
        // orden que usa src/lib/state-merge.ts, así que un PUT concurrente
        // espera en vez de trenzarse en deadlock.
        const lockState = async (key: string): Promise<StateRecord[]> => {
            await client.query(
                `INSERT INTO crm_state (key, value) VALUES ($1, '[]'::jsonb) ON CONFLICT (key) DO NOTHING`,
                [key]
            );
            const { rows } = await client.query(
                `SELECT value FROM crm_state WHERE key = $1 FOR UPDATE`,
                [key]
            );
            return Array.isArray(rows[0]?.value) ? (rows[0].value as StateRecord[]) : [];
        };
        const writeState = async (key: string, value: unknown[]) => {
            await client.query(
                `UPDATE crm_state SET value = $2::jsonb, updated_at = NOW() WHERE key = $1`,
                [key, JSON.stringify(value)]
            );
        };

        // Negocios del pipeline
        const tasks = await lockState('tasks');
        const nowIso = new Date().toISOString();
        let tasksTouched = false;
        const nextTasks = tasks.map((t) => {
            const how = matchesUser(t.assignedTo, outgoing);
            if (!how) return t;
            const stage = typeof t.stageId === 'string' ? t.stageId : '';
            if (closedStages.has(stage)) {
                kept.closedDeals++;
                return t; // cerrado: es historia del que se va, no se toca
            }
            if (!receiver || !transfer.openDeals) return t;
            moved.openDeals++;
            tasksTouched = true;
            // Se conserva la FORMA del valor original (id o nombre) para no
            // cambiarle la semántica a un registro que otras vistas leen.
            // `updatedAt` se estampa a propósito: sin él, una pestaña abierta
            // con el snapshot viejo revierte la reasignación en su próximo
            // guardado (el merge por id da last-writer-wins cuando falta el
            // sello — ver src/lib/state-merge.ts).
            return {
                ...t,
                assignedTo: how === 'id' ? receiver.id : receiver.name,
                updatedAt: nowIso,
            };
        });
        if (tasksTouched) await writeState('tasks', nextTasks);

        // Agenda: sólo de hoy en adelante. Las visitas pasadas son evidencia.
        const events = await lockState('events');
        let eventsTouched = false;
        const nextEvents = events.map((ev) => {
            if (!matchesUser(ev.ownerUserId, outgoing) && !matchesUser(ev.ownerName, outgoing)) return ev;
            if (eventDay(ev) < today) {
                kept.pastEvents++;
                return ev;
            }
            if (!receiver || !transfer.futureEvents) return ev;
            moved.futureEvents++;
            eventsTouched = true;
            return { ...ev, ownerUserId: receiver.id, ownerName: receiver.name };
        });
        if (eventsTouched) await writeState('events', nextEvents);

        // Avisos pendientes: los no leídos son trabajo por hacer.
        const notifications = await lockState('notifications');
        let notifsTouched = false;
        const nextNotifs = notifications.map((n) => {
            if (n.targetUserId !== outgoing.id || n.read === true) return n;
            if (!receiver || !transfer.notifications) return n;
            moved.notifications++;
            notifsTouched = true;
            return { ...n, targetUserId: receiver.id };
        });
        if (notifsTouched) await writeState('notifications', nextNotifs);

        // ── 5. Lo que se queda (para el acta) ────────────────────────────────
        const quotes = await readStateArray(client, 'quotes');
        kept.quotes = quotes.filter(
            (qt) => matchesUser(qt.sellerId, outgoing) || matchesUser(qt.sellerName, outgoing)
        ).length;
        const ce = await client.query(
            `SELECT COUNT(*)::int AS n FROM crm_contact_events WHERE seller_id = $1`,
            [outgoing.id]
        );
        kept.contactEvents = ce.rows[0].n;
        const att = await client.query(
            `SELECT COUNT(*)::int AS n FROM crm_client_attachments WHERE uploaded_by_id = $1`,
            [outgoing.id]
        );
        kept.attachments = att.rows[0].n;

        // ── 6. Acta ──────────────────────────────────────────────────────────
        await client.query(
            `INSERT INTO crm_handovers (
                id, outgoing_id, outgoing_name, outgoing_email, outgoing_role,
                incoming_id, incoming_name, incoming_email,
                performed_by, performed_by_name, reason, options, moved, kept
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb)`,
            [
                handoverId,
                outgoing.id,
                outgoing.name,
                outgoing.email,
                outgoing.role,
                incoming?.id ?? null,
                incoming?.name ?? null,
                incoming?.email ?? null,
                performedBy.id,
                performedBy.name,
                reason || null,
                JSON.stringify({
                    ...transfer,
                    inheritIdentity: input.inheritIdentity,
                    fallbackOwnerId: fallbackOwner?.id ?? null,
                    archivedIdentity,
                    identityHandedTo,
                }),
                JSON.stringify(moved),
                JSON.stringify(kept),
            ]
        );

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }

    return {
        handoverId,
        incomingId: incoming?.id ?? null,
        moved,
        kept,
        archivedIdentity,
        identityHandedTo,
    };
}
