import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { loadFreshSession } from '@/lib/auth-session';

// ⚠️ DESTRUCTIVO — borra TODOS los clientes, leads, tasks, cotizaciones, audit logs,
// notificaciones, anomalías y eventos del calendario. Preserva: vendedores, productos,
// configuración, biolinks, forms.
//
// Sólo SuperAdmin/Admin puede invocar este endpoint.
export async function POST(request: NextRequest) {
    const user = await loadFreshSession(request);
    if (!user) {
        return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    if (user.role !== 'SuperAdmin' && user.role !== 'Admin') {
        return NextResponse.json({ error: 'Requiere permisos de SuperAdmin.' }, { status: 403 });
    }

    if (!hasDatabase()) {
        return NextResponse.json({ error: 'Base de datos no configurada.' }, { status: 503 });
    }

    await ensureCrmSchema();
    const pool = getPool();

    const results: Record<string, number> = {};

    // 1) Borrar tabla crm_clients (clients)
    try {
        const r = await pool.query(`DELETE FROM crm_clients RETURNING id`);
        results.clients = r.rowCount || 0;
    } catch (e) {
        results.clients = -1;
    }

    // 2) Resetear todas las keys transaccionales en crm_state
    const stateKeysToWipe = [
        'tasks',
        'quotes',
        'notifications',
        'auditLogs',
        'anomalies',
        'events',
    ];

    for (const key of stateKeysToWipe) {
        try {
            await pool.query(
                `INSERT INTO crm_state (key, value, updated_at)
                 VALUES ($1, '[]'::jsonb, NOW())
                 ON CONFLICT (key) DO UPDATE
                 SET value = '[]'::jsonb, updated_at = NOW()`,
                [key]
            );
            results[key] = 0; // post-reset count
        } catch (e) {
            results[key] = -1;
        }
    }

    // Registrar el wipe en audit log (pero después de vaciarlo, queda este solo como rastro)
    try {
        const auditEntry = [{
            id: `audit-wipe-${Date.now()}`,
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            action: 'SETTINGS_CHANGED',
            details: `Borró todos los datos de prueba (clients, tasks, quotes, auditLogs, notifications, anomalies, events)`,
            timestamp: new Date().toISOString(),
            verified: true,
        }];
        await pool.query(
            `INSERT INTO crm_state (key, value, updated_at)
             VALUES ('auditLogs', $1::jsonb, NOW())
             ON CONFLICT (key) DO UPDATE
             SET value = EXCLUDED.value, updated_at = NOW()`,
            [JSON.stringify(auditEntry)]
        );
    } catch {
        /* no-op */
    }

    return NextResponse.json({
        ok: true,
        wipedBy: user.name,
        wipedAt: new Date().toISOString(),
        results,
        preserved: ['sellers/team', 'settings', 'products', 'biolinks', 'forms'],
    });
}
