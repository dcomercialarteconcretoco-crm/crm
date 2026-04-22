import type { Pool } from 'pg';
import { getPool, hasDatabase } from './postgres';

/**
 * Round-robin lead assignment.
 *
 * Keeps an advancing cursor in the `crm_state` key-value store so every
 * inbound lead without an explicit owner (web form, WordPress plugin,
 * Concrebot widget, biolink without seller, etc.) gets assigned to the
 * next Vendedor in the rotation.
 *
 * Order is deterministic: sellers sorted by created_at ASC, filtered to
 * active Vendedores (and Managers, since they also carry cases). SuperAdmin
 * and plain Admin are excluded — they supervise, they don't carry leads.
 */

type RRSeller = { id: string; name: string };

const STATE_KEY = 'lead_assignment_rr';

async function loadRotation(pool: Pool): Promise<RRSeller[]> {
    const { rows } = await pool.query(`
        SELECT id, name
        FROM crm_users
        WHERE status = 'Activo'
          AND role IN ('Vendedor', 'Manager')
        ORDER BY created_at ASC
    `);
    return rows.map(r => ({ id: r.id, name: r.name }));
}

async function readCursor(pool: Pool): Promise<number> {
    const { rows } = await pool.query(
        `SELECT value FROM crm_state WHERE key = $1 LIMIT 1`,
        [STATE_KEY]
    );
    const v = rows[0]?.value;
    if (typeof v === 'number') return v;
    if (v && typeof v.cursor === 'number') return v.cursor;
    return 0;
}

async function writeCursor(pool: Pool, cursor: number): Promise<void> {
    await pool.query(
        `INSERT INTO crm_state (key, value, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [STATE_KEY, JSON.stringify({ cursor })]
    );
}

/**
 * Advances the rotation and returns the seller that should get the next lead.
 * Returns null if there are no eligible sellers (setup not ready yet).
 */
export async function pickNextSeller(): Promise<RRSeller | null> {
    if (!hasDatabase()) return null;
    const pool = getPool();
    const rotation = await loadRotation(pool);
    if (rotation.length === 0) return null;

    const cursor = await readCursor(pool);
    const idx = ((cursor % rotation.length) + rotation.length) % rotation.length;
    const picked = rotation[idx];
    await writeCursor(pool, idx + 1);
    return picked;
}
