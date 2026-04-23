import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { loadFreshSession } from '@/lib/auth-session';
import { hasPermission } from '@/lib/permissions';

/**
 * Read-only preview of the round-robin rotation. Useful to verify that the
 * "Recibe leads automáticos" toggle is actually filtering sellers: you see the
 * current queue, the cursor, and who is next — without creating any fake
 * leads in production.
 *
 * Guarded for team.view so only members of leadership (SuperAdmin, Admin,
 * Manager) can poke at it.
 */
export async function GET(request: NextRequest) {
    if (!hasDatabase()) {
        return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
    }
    const session = await loadFreshSession(request);
    if (!session) {
        return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 });
    }
    if (!hasPermission({ role: session.role, permissions: session.permissions }, 'team.view')) {
        return NextResponse.json({ error: 'No tienes permiso.' }, { status: 403 });
    }

    await ensureCrmSchema();
    const pool = getPool();

    // Active participants — the EXACT same query pickNextSeller uses
    const { rows: active } = await pool.query(`
        SELECT id, name, role, COALESCE(receives_leads, TRUE) AS "receivesLeads"
        FROM crm_users
        WHERE status = 'Activo'
          AND role IN ('Vendedor', 'Manager')
          AND COALESCE(receives_leads, TRUE) = TRUE
        ORDER BY created_at ASC
    `);

    // Everyone who would be eligible by role but is currently opted-out
    const { rows: excluded } = await pool.query(`
        SELECT id, name, role, status, COALESCE(receives_leads, TRUE) AS "receivesLeads"
        FROM crm_users
        WHERE role IN ('Vendedor', 'Manager')
          AND (status <> 'Activo' OR COALESCE(receives_leads, TRUE) = FALSE)
        ORDER BY created_at ASC
    `);

    // Current rotation cursor (how the round-robin picks the next seller)
    const { rows: cursorRows } = await pool.query(
        `SELECT value FROM crm_state WHERE key = 'lead_assignment_rr' LIMIT 1`
    );
    const v = cursorRows[0]?.value;
    const cursor = typeof v === 'number' ? v : (v && typeof v.cursor === 'number' ? v.cursor : 0);

    const nextIdx = active.length > 0
        ? ((cursor % active.length) + active.length) % active.length
        : -1;

    return NextResponse.json({
        rotationSize: active.length,
        cursor,
        nextSeller: nextIdx >= 0 ? active[nextIdx] : null,
        rotation: active.map((s, i) => ({
            ...s,
            position: i,
            isNext: i === nextIdx,
        })),
        excluded: excluded.map(s => ({
            ...s,
            reason: s.status !== 'Activo' ? 'Inactivo' : !s.receivesLeads ? 'Opt-out (toggle OFF)' : 'Rol no elegible',
        })),
        // Next 8 picks without actually advancing the cursor
        upcomingSequence: active.length > 0
            ? Array.from({ length: 8 }, (_, k) => active[((cursor + k) % active.length + active.length) % active.length].name)
            : [],
    });
}
