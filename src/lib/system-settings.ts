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

export type AutoSendChannel = 'web' | 'woo' | 'whatsapp' | 'bot';

/**
 * Channel-aware auto-send check. Auto-send fires only when:
 *   (a) the master toggle `autoSendPublicQuotes` is ON, AND
 *   (b) the specific channel is not explicitly disabled in `autoSendChannels`.
 * A missing per-channel flag is treated as enabled (conservative default when
 * master is already ON — the admin opted in globally).
 */
export async function isAutoSendEnabledForChannel(channel: AutoSendChannel): Promise<boolean> {
    const s = await readSystemSettings();
    if (!s.autoSendPublicQuotes) return false;
    const channels = (s.autoSendChannels && typeof s.autoSendChannels === 'object')
        ? (s.autoSendChannels as Record<string, unknown>)
        : {};
    const val = channels[channel];
    return val === undefined ? true : Boolean(val);
}

/**
 * Returns the optional internal CC address set by the admin for auto-sent quotes.
 * Endpoints should fall back to their hardcoded default when this is empty.
 */
export async function getAutoSendCopyEmail(): Promise<string> {
    const s = await readSystemSettings();
    const raw = typeof s.autoSendCopyEmail === 'string' ? s.autoSendCopyEmail.trim() : '';
    return raw;
}
