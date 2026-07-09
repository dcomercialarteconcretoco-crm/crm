import type { Pool } from 'pg';

export type ServerNotification = {
    title: string;
    description: string;
    type: 'lead' | 'ai' | 'alert' | 'success' | 'task' | 'order';
    forAdmin?: boolean;
    quoteId?: string;
    targetUserId?: string | null;
    clientId?: string | null;
};

export async function appendNotification(pool: Pool, notification: ServerNotification) {
    const nextNotification = {
        ...notification,
        id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        time: 'Ahora',
        read: false,
        createdAt: new Date().toISOString(),
    };

    await pool.query(
        `
        INSERT INTO crm_state (key, value, updated_at)
        VALUES ('notifications', $1::jsonb, NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = (
            SELECT jsonb_agg(item)
            FROM (
                SELECT item
                FROM jsonb_array_elements(($1::jsonb || COALESCE(crm_state.value, '[]'::jsonb))) AS item
                LIMIT 120
            ) AS limited
        ),
        updated_at = NOW()
        `,
        [JSON.stringify([nextNotification])]
    );

    return nextNotification;
}
