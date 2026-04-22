/**
 * The "god" user — immutable in every corner of the CRM.
 *
 * No one except god can edit, delete, or demote this account. Not other SuperAdmins,
 * not Admins, not any seeding script. Even the admin seed endpoint skips this row.
 *
 * Identification is by stable id (the server-issued SuperAdmin session id) or by
 * the configured email. Match is case-insensitive and accepts either axis so a
 * compromised DB row can't be used to impersonate god.
 */

const GOD_ID = 'superadmin-server';
const GOD_EMAIL = (process.env.SUPERADMIN_EMAIL || 'juanchosierra@gmail.com').trim().toLowerCase();

export function isGodUser(target: { id?: string | null; email?: string | null } | null | undefined): boolean {
    if (!target) return false;
    if (target.id && target.id === GOD_ID) return true;
    if (target.email && target.email.trim().toLowerCase() === GOD_EMAIL) return true;
    return false;
}

export function isCurrentUserGod(session: { id?: string | null; email?: string | null; role?: string | null } | null | undefined): boolean {
    if (!session) return false;
    return isGodUser(session);
}

export const GOD_EMAIL_LITERAL = GOD_EMAIL;
export const GOD_ID_LITERAL = GOD_ID;
