import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { loadFreshSession } from '@/lib/auth-session';

// Promueve uno o varios raw leads al directorio principal (crm_clients).
//
// Reglas:
//   - SuperAdmin/Admin pueden promover cualquiera.
//   - Vendedor puede promover sólo los que tiene asignados.
//   - El raw lead queda marcado como 'approved' con el client_id asociado
//     (no se borra: queremos conservar la trazabilidad de qué se promovió).
//   - Si el raw lead no tiene email se inserta sin email (igual que un
//     contacto normal — email no es UNIQUE en crm_clients).
//
// El cliente promovido entra como status='Lead' al directorio con la
// asignación que tenga el raw (assigned_to). Si está sin asignar, queda
// bajo el usuario que aprueba.

function isAdmin(role: string | undefined): boolean {
    return role === 'SuperAdmin' || role === 'Admin';
}

export async function POST(request: NextRequest) {
    const user = await loadFreshSession(request);
    if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    if (!hasDatabase()) return NextResponse.json({ error: 'DB no configurada.' }, { status: 503 });

    const body = await request.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0) return NextResponse.json({ error: 'ids[] requerido' }, { status: 400 });

    await ensureCrmSchema();
    const pool = getPool();

    // Filtramos por ownership si no es admin (vendedor sólo aprueba los suyos).
    const ownerGuard = isAdmin(user.role) ? '' : `AND assigned_to = $2`;
    const params: any[] = [ids];
    if (!isAdmin(user.role)) params.push(user.id);

    const { rows: rawLeads } = await pool.query(
        `SELECT id, name, email, phone, city, legal_id, reference,
                assigned_to, assigned_to_name
           FROM crm_raw_leads
          WHERE id = ANY($1::text[]) ${ownerGuard}
            AND status NOT IN ('approved', 'discarded')`,
        params
    );

    if (rawLeads.length === 0) {
        return NextResponse.json({ error: 'No hay leads válidos para promover.' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    const promotedIds: string[] = [];

    for (const lead of rawLeads) {
        const clientId = `c-prom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const ownerId = lead.assigned_to || user.id;
        const ownerName = lead.assigned_to_name || user.name;

        // "position" entre dobles comillas — palabra reservada SQL (mismo
        // patrón que /api/clients en 7b2654a).
        await pool.query(
            `INSERT INTO crm_clients (
                id, name, company, "position", email, phone, status, value_text, ltv, last_contact,
                city, score, category, registration_date,
                assigned_to, assigned_to_name, source, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,'Lead','Por cotizar',0,$7,$8,70,'Bandeja Crudos',$9,$10,$11,$12,NOW())`,
            [
                clientId,
                lead.name,
                lead.name, // company snapshot — el asesor edita después si tiene empresa
                null,      // position vacío — se llena al editar
                lead.email,
                lead.phone || '',
                today,
                lead.city || 'No especificada',
                today,
                ownerId,
                ownerName,
                lead.reference ? `Crudos: ${lead.reference}` : 'Bandeja de Leads Crudos',
            ]
        );

        // Marcamos el raw lead como aprobado y guardamos el id del cliente
        // creado para trazabilidad (si después alguien duda "¿este cliente
        // de dónde vino?", la fila raw_leads sigue ahí y apunta a él).
        await pool.query(
            `UPDATE crm_raw_leads
                SET status = 'approved', promoted_client_id = $1, updated_at = NOW()
              WHERE id = $2`,
            [clientId, lead.id]
        );

        promotedIds.push(clientId);
    }

    return NextResponse.json({ ok: true, promoted: rawLeads.length, clientIds: promotedIds });
}
