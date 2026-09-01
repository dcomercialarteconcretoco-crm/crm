import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { loadFreshSession } from '@/lib/auth-session';
import { hasPermission } from '@/lib/permissions';
import { isGodUser } from '@/lib/god-user';
import { hashPassword, isBcryptHash } from '@/lib/password';
import { sendActivationEmail } from '@/lib/activation-email';
import {
    DEFAULT_TRANSFER,
    loadMember,
    performHandover,
    type IncomingMember,
    type TransferOptions,
} from '@/lib/handover';

/**
 * POST /api/team/handover — relevo de puesto.
 *
 * Dos modos:
 *   'replace'  → entra alguien nuevo y hereda la cartera del que sale.
 *   'offboard' → el que sale se archiva sin reemplazo; la cartera puede
 *                redirigirse a otro integrante activo (`fallbackOwnerId`).
 *
 * QUIÉN PUEDE:
 *   - Cualquiera con `team.manage` (SuperAdmin, Admin).
 *   - El propio usuario sobre SU cuenta ("entrego mi puesto"). Es el caso que
 *     el cliente pidió para mercadeo: el buzón del cargo lo administra quien
 *     lo ocupa, y cuando esa persona se va tiene que poder pasarle el puesto a
 *     la siguiente sin depender de nadie. En ese caso el rol y los permisos del
 *     que entra se CLAVAN a los del que sale — nadie puede usar su propia
 *     salida para fabricarse un sucesor con más poder del que tenía.
 *
 * Lo que NO se puede, pase lo que pase: tocar la cuenta principal del sistema,
 * ni dejar la empresa sin ningún SuperAdmin activo.
 */

type HandoverBody = {
    mode?: 'replace' | 'offboard';
    outgoingId?: string;
    incoming?: {
        name?: string;
        email?: string;
        username?: string;
        phone?: string;
        avatar?: string;
        role?: string;
        permissions?: Record<string, boolean>;
        receivesLeads?: boolean;
        commission?: string;
        password?: string;
    };
    /** El que entra se queda con el correo/usuario corporativo del que sale. */
    inheritIdentity?: boolean;
    /** Copiar exactamente los permisos del que sale (mismas responsabilidades). */
    clonePermissions?: boolean;
    transfer?: Partial<TransferOptions>;
    fallbackOwnerId?: string;
    reason?: string;
    skipActivationEmail?: boolean;
};

function getAppUrl(request: NextRequest) {
    return (process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin).replace(/\/$/, '');
}

export async function POST(request: NextRequest) {
    if (!hasDatabase()) {
        return NextResponse.json({ error: 'Base de datos no configurada.' }, { status: 503 });
    }

    const session = await loadFreshSession(request);
    if (!session) {
        return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as HandoverBody;
    const outgoingId = (body.outgoingId || '').trim();
    const mode = body.mode === 'offboard' ? 'offboard' : 'replace';

    if (!outgoingId) {
        return NextResponse.json({ error: 'Falta indicar a quién se releva.' }, { status: 400 });
    }

    const canManage = hasPermission(
        { role: session.role, permissions: session.permissions },
        'team.manage'
    );
    const isSelf = session.id === outgoingId;
    if (!canManage && !isSelf) {
        return NextResponse.json(
            { error: 'No tienes permiso para dar de baja a otro integrante del equipo.' },
            { status: 403 }
        );
    }
    if (!canManage && mode === 'offboard') {
        return NextResponse.json(
            { error: 'Para entregar tu puesto tienes que registrar a quién se lo dejas.' },
            { status: 400 }
        );
    }

    await ensureCrmSchema();
    const pool = getPool();

    const outgoing = await loadMember(pool, outgoingId);
    if (!outgoing) {
        return NextResponse.json({ error: 'El usuario que sale no existe.' }, { status: 404 });
    }
    if (isGodUser({ id: outgoing.id, email: outgoing.email })) {
        return NextResponse.json(
            { error: 'La cuenta principal del sistema no se puede relevar ni dar de baja.' },
            { status: 403 }
        );
    }
    if (outgoing.archived_at) {
        return NextResponse.json(
            { error: `${outgoing.name} ya está archivado. Revisa el historial del equipo.` },
            { status: 409 }
        );
    }

    // ── Reemplazo ────────────────────────────────────────────────────────────
    let incoming: IncomingMember | null = null;
    if (mode === 'replace') {
        const raw = body.incoming || {};
        const name = (raw.name || '').trim();
        const email = (raw.email || '').trim().toLowerCase();

        if (!name) {
            return NextResponse.json({ error: 'El reemplazo necesita nombre.' }, { status: 400 });
        }
        // Si hereda la identidad del cargo, el correo del que sale es el suyo.
        const finalEmail = body.inheritIdentity && outgoing.email ? outgoing.email : email;
        if (!finalEmail) {
            return NextResponse.json({ error: 'El reemplazo necesita correo.' }, { status: 400 });
        }
        if (isGodUser({ email: finalEmail })) {
            return NextResponse.json(
                { error: 'Esa identidad está reservada para la cuenta principal del sistema.' },
                { status: 403 }
            );
        }

        // Entregar el puesto PROPIO clona el puesto tal cual: mismo rol, mismos
        // permisos, sin excepción. Dos razones, y las dos importan:
        //   - Seguridad: nadie usa su propia salida para fabricarse un sucesor
        //     con más poder del que tenía.
        //   - Coherencia: si el rol saliera del formulario, un SuperAdmin que
        //     entrega su puesto crearía por defecto un Vendedor y el sistema
        //     rebotaría con «quedarías sin ningún SuperAdmin» — que es
        //     exactamente lo que pasaba antes de este ajuste.
        // Relevando a OTRA persona, con team.manage, el admin sí decide.
        const cloneEverything = isSelf || !canManage;
        const role = cloneEverything ? outgoing.role : (raw.role || outgoing.role);
        const permissions = cloneEverything
            ? outgoing.permissions
            : body.clonePermissions
              ? outgoing.permissions
              : (raw.permissions ?? null);

        const inheritedUsername =
            body.inheritIdentity && outgoing.username ? outgoing.username : (raw.username || '').trim();

        let passwordHash: string | null = null;
        if (raw.password) {
            passwordHash = isBcryptHash(raw.password) ? raw.password : await hashPassword(raw.password);
        }

        incoming = {
            id: `s-${Date.now()}`,
            name,
            email: finalEmail,
            username: inheritedUsername || finalEmail,
            phone: raw.phone || outgoing.phone || '',
            avatar:
                raw.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f5f0e8&color=1a1a1a`,
            role,
            permissions,
            receivesLeads: raw.receivesLeads !== false,
            commission: raw.commission || outgoing.commission,
            passwordHash,
        };

        // El correo sólo se puede reutilizar si se lo liberamos al que sale.
        if (!body.inheritIdentity) {
            const { rows } = await pool.query(
                `SELECT id, name FROM crm_users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2) LIMIT 1`,
                [incoming.email, incoming.username]
            );
            if (rows[0]) {
                return NextResponse.json(
                    {
                        error:
                            rows[0].id === outgoing.id
                                ? `Ese correo es el de ${outgoing.name}. Marca "heredar el correo del cargo" para que el reemplazo se quede con él.`
                                : `El correo o usuario ya lo tiene ${rows[0].name}.`,
                    },
                    { status: 409 }
                );
            }
        }
    }

    // ── No dejar la empresa sin SuperAdmin ───────────────────────────────────
    if (outgoing.role === 'SuperAdmin') {
        const { rows } = await pool.query(
            `SELECT COUNT(*)::int AS n FROM crm_users
             WHERE role = 'SuperAdmin' AND status = 'Activo' AND archived_at IS NULL AND id <> $1`,
            [outgoing.id]
        );
        const othersLeft = rows[0].n as number;
        if (othersLeft === 0 && incoming?.role !== 'SuperAdmin') {
            return NextResponse.json(
                {
                    error:
                        'No se puede dar de baja al único SuperAdmin activo. Crea o promueve otro administrador antes de relevar a esta cuenta.',
                },
                { status: 409 }
            );
        }
    }

    // ── Destino de la cartera cuando no hay reemplazo ────────────────────────
    let fallbackOwner: { id: string; name: string } | null = null;
    if (mode === 'offboard' && body.fallbackOwnerId) {
        const target = await loadMember(pool, body.fallbackOwnerId);
        if (!target || target.archived_at || target.status !== 'Activo') {
            return NextResponse.json(
                { error: 'El destinatario de la cartera tiene que ser un integrante activo.' },
                { status: 400 }
            );
        }
        // Entregarle el correo del cargo a un compañero que ya está en el
        // equipo es una operación distinta a crear un reemplazo: hay que
        // verificar aparte que el destinatario pueda recibirlo.
        if (body.inheritIdentity) {
            if (isGodUser({ id: target.id, email: target.email })) {
                return NextResponse.json(
                    { error: 'La cuenta principal del sistema no cambia de correo.' },
                    { status: 403 }
                );
            }
            if (!outgoing.email) {
                return NextResponse.json(
                    { error: `${outgoing.name} no tiene correo registrado, así que no hay correo de cargo que pasar.` },
                    { status: 400 }
                );
            }
        }
        fallbackOwner = { id: target.id, name: target.name };
    }
    if (mode === 'offboard' && body.inheritIdentity && !fallbackOwner) {
        return NextResponse.json(
            { error: 'Para pasar el correo del cargo hay que decir a quién se le pasa.' },
            { status: 400 }
        );
    }

    const transfer: TransferOptions = { ...DEFAULT_TRANSFER, ...(body.transfer || {}) };

    // ── Ejecución ────────────────────────────────────────────────────────────
    let result;
    try {
        result = await performHandover(pool, {
            outgoing,
            incoming,
            fallbackOwner,
            transfer,
            inheritIdentity: Boolean(body.inheritIdentity),
            reason: (body.reason || '').trim(),
            performedBy: { id: session.id, name: session.name || session.email },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[team/handover] falló el relevo:', message);
        // Todo corre en una sola transacción: si algo revienta, no quedó nada
        // a medias — ni el archivado ni la cartera movida.
        if (/duplicate key|unique/i.test(message)) {
            return NextResponse.json(
                { error: 'El correo o el usuario del reemplazo ya existe en el sistema.' },
                { status: 409 }
            );
        }
        return NextResponse.json(
            { error: `No se pudo completar el relevo: ${message}` },
            { status: 500 }
        );
    }

    // ── Invitación al que entra ──────────────────────────────────────────────
    let activation: { sent: boolean; error?: string; activationUrl?: string } = { sent: false };
    if (incoming && !body.skipActivationEmail && !incoming.passwordHash) {
        const r = await sendActivationEmail({
            pool,
            userId: incoming.id,
            name: incoming.name,
            email: incoming.email,
            role: incoming.role,
            inviterName: session.name || '',
            appUrl: getAppUrl(request),
        });
        activation = { sent: r.ok, error: r.error, activationUrl: r.activationUrl };
    }

    return NextResponse.json({
        ok: true,
        handoverId: result.handoverId,
        outgoing: {
            id: outgoing.id,
            name: outgoing.name,
            archivedEmail: result.archivedIdentity.email,
        },
        incoming: incoming
            ? { id: incoming.id, name: incoming.name, email: incoming.email, role: incoming.role }
            : null,
        moved: result.moved,
        kept: result.kept,
        identityHandedTo: result.identityHandedTo,
        activation,
    });
}

/**
 * GET /api/team/handover — actas de relevo (historial de rotación).
 * Es lo que un auditor lee para entender por qué una cartera cambió de dueño.
 */
export async function GET(request: NextRequest) {
    if (!hasDatabase()) {
        return NextResponse.json({ handovers: [] });
    }
    const session = await loadFreshSession(request);
    if (!session) {
        return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });
    }
    if (!hasPermission({ role: session.role, permissions: session.permissions }, 'team.view')) {
        return NextResponse.json({ error: 'No tienes permiso para ver el equipo.' }, { status: 403 });
    }

    await ensureCrmSchema();
    const pool = getPool();
    const { rows } = await pool.query(`
        SELECT id, outgoing_id  AS "outgoingId",  outgoing_name  AS "outgoingName",
               outgoing_email   AS "outgoingEmail", outgoing_role AS "outgoingRole",
               incoming_id      AS "incomingId",  incoming_name  AS "incomingName",
               incoming_email   AS "incomingEmail",
               performed_by_name AS "performedByName",
               reason, options, moved, kept, created_at AS "createdAt"
        FROM crm_handovers
        ORDER BY created_at DESC
        LIMIT 200
    `);
    return NextResponse.json({ handovers: rows });
}
