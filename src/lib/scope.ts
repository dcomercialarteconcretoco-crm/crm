/**
 * Visibility scoping helpers.
 *
 * A Vendedor only sees records assigned to them.
 * Admin, Manager, and SuperAdmin see every record regardless of ownership.
 * Anyone else (null / unknown role) sees nothing for safety.
 */

import type { Seller } from '@/context/AppContext';

export function canSeeAll(user: Seller | null | undefined): boolean {
    if (!user) return false;
    return user.role === 'SuperAdmin' || user.role === 'Admin' || user.role === 'Manager';
}

/**
 * Returns true if the user should see a record owned by the given assignedTo/assignedToName.
 * - SuperAdmin/Admin/Manager: always true
 * - Vendedor: only if assigned to them (by id, username or display name)
 */
export function ownsRecord(
    user: Seller | null | undefined,
    record: {
        assignedTo?: string | null;
        assignedToName?: string | null;
        sellerId?: string | null;
        sellerName?: string | null;
    }
): boolean {
    if (!user) return false;
    if (canSeeAll(user)) return true;

    const candidates = [record.assignedTo, record.assignedToName, record.sellerId, record.sellerName]
        .filter((v): v is string => Boolean(v))
        .map(v => v.toLowerCase());

    const ids = [user.id, user.username, user.name]
        .filter((v): v is string => Boolean(v))
        .map(v => v.toLowerCase());

    return candidates.some(c => ids.includes(c));
}
