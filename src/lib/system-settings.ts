import { getPool, hasDatabase } from './postgres';

/**
 * Reads the client-side settings object that the CRM UI persists into
 * `crm_state` under the key 'settings'. Used by public endpoints that
 * need to know things like whether auto-quote-sending is enabled.
 */
export async function readSystemSettings(): Promise<Record<string, unknown>> {
    if (!hasDatabase()) return {};
    const pool = getPool();
    const { rows } = await pool.query(
        `SELECT value FROM crm_state WHERE key = 'settings' LIMIT 1`
    );
    const v = rows[0]?.value;
    return (v && typeof v === 'object') ? (v as Record<string, unknown>) : {};
}

export async function isAutoSendPublicQuotesEnabled(): Promise<boolean> {
    const s = await readSystemSettings();
    return Boolean(s.autoSendPublicQuotes);
}
