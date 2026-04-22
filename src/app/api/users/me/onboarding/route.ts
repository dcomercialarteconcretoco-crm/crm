import { NextRequest, NextResponse } from 'next/server';
import { parseSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth-session';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';

/**
 * Increment the authenticated user's onboarding wizard run count.
 *
 * Progression:
 *   0 → first login, wizard runs MANDATORY (no skip)
 *   1 → second login, wizard runs OPTIONAL (skip allowed)
 *   2+ → wizard never shown again
 *
 * We clamp the stored value at 2 so repeated calls don't inflate the counter
 * past the point where we'd stop showing the wizard anyway.
 */
export async function POST(req: NextRequest) {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const user = await parseSessionToken(token);
    if (!user) {
        return NextResponse.json({ error: 'No session' }, { status: 401 });
    }
    if (!hasDatabase()) {
        // No DB — frontend already treats the response as best-effort.
        return NextResponse.json({ onboardingCount: 1 });
    }

    try {
        await ensureCrmSchema();
        const pool = getPool();
        const { rows } = await pool.query(
            `UPDATE crm_users
             SET onboarding_count = LEAST(COALESCE(onboarding_count, 0) + 1, 2),
                 updated_at = NOW()
             WHERE id = $1
             RETURNING onboarding_count`,
            [user.id]
        );
        const count: number = rows[0]?.onboarding_count ?? 1;
        return NextResponse.json({ onboardingCount: count });
    } catch (err) {
        console.error('[users/me/onboarding] DB error:', err);
        return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }
}
