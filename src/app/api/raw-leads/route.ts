import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { loadFreshSession } from '@/lib/auth-session';

// ── Bandeja de Leads Crudos ─────────────────────────────────────────────
// Universo de pre-leads que el SuperAdmin sube y el equipo aún no ha
// calificado. Endpoints:
//   GET     ?status=new|assigned|...   → lista con filtros
//   POST                                → crea uno (manual) o varios (bulk)
//   PATCH                               → multi-asignar / cambiar estado
//   DELETE  ?ids=a,b,c                  → eliminar permanentemente
//
// Permisos:
//   - SuperAdmin/Admin: lee todo, crea, asigna, descarta, promueve.
//   - Vendedor: sólo lee los que tiene asignados; puede marcarlos contacted
//     o descartar/aprobar; NO puede crear ni asignar a otros.

type RawLeadStatus = 'new' | 'assigned' | 'contacted' | 'approved' | 'discarded';

function isAdmin(role: string | undefined): boolean {
    return role === 'SuperAdmin' || role === 'Admin';
}

export async function GET(request: NextRequest) {
    const user = await loadFreshSession(request);
    if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    if (!hasDatabase()) return NextResponse.json({ leads: [] });

    await ensureCrmSchema();
    const pool = getPool();

    const status = request.nextUrl.searchParams.get('status') || '';
    const restrictedToOwner = !isAdmin(user.role);

    const conditions: string[] = [];
    const params: any[] = [];
    if (status) { conditions.push(`status = $${params.length + 1}`); params.push(status); }
    if (restrictedToOwner) { conditions.push(`assigned_to = $${params.length + 1}`); params.push(user.id); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
        `SELECT
            id, name, email, phone, city, country,
            legal_id AS "legalId", reference, status,
            assigned_to AS "assignedTo", assigned_to_name AS "assignedToName",
            assigned_at AS "assignedAt", contacted_at AS "contactedAt",
            promoted_client_id AS "promotedClientId",
            uploaded_by AS "uploadedBy", uploaded_by_name AS "uploadedByName",
            created_at AS "createdAt", updated_at AS "updatedAt"
         FROM crm_raw_leads
         ${where}
         ORDER BY created_at DESC
         LIMIT 1000`,
        params
    );
    return NextResponse.json({ leads: rows });
}

export async function POST(request: NextRequest) {
    const user = await loadFreshSession(request);
    if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    if (!isAdmin(user.role)) return NextResponse.json({ error: 'Requiere SuperAdmin/Admin.' }, { status: 403 });
    if (!hasDatabase()) return NextResponse.json({ error: 'DB no configurada.' }, { status: 503 });

    const body = await request.json();
    // Aceptamos `lead` (uno) o `leads` (array) en el mismo endpoint para no
    // duplicar lógica. CSV masivo manda `leads`, formulario manual manda `lead`.
    const incoming: any[] = Array.isArray(body.leads)
        ? body.leads
        : (body.lead ? [body.lead] : []);
    if (incoming.length === 0) {
        return NextResponse.json({ error: 'lead o leads[] requerido' }, { status: 400 });
    }

    await ensureCrmSchema();
    const pool = getPool();

    const ids: string[] = [];
    const names: string[] = [];
    const emails: (string | null)[] = [];
    const phones: (string | null)[] = [];
    const cities: (string | null)[] = [];
    const countries: (string | null)[] = [];
    const legalIds: (string | null)[] = [];
    const references: (string | null)[] = [];

    for (const r of incoming) {
        const name = String(r.name || '').trim();
        if (!name) continue; // skip silenciosamente filas sin nombre
        ids.push(`raw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        names.push(name);
        emails.push((r.email || '').trim() || null);
        phones.push((r.phone || '').trim() || null);
        cities.push((r.city || '').trim() || null);
        countries.push((r.country || '').trim() || null);
        legalIds.push((r.legalId || r.legal_id || r.documento || '').trim() || null);
        references.push((r.reference || r.referencia || '').trim() || null);
    }
    if (ids.length === 0) {
        return NextResponse.json({ error: 'Ninguna fila válida (todas sin nombre).' }, { status: 400 });
    }

    const result = await pool.query(
        `INSERT INTO crm_raw_leads (
            id, name, email, phone, city, country, legal_id, reference,
            status, uploaded_by, uploaded_by_name
         )
         SELECT * FROM UNNEST (
            $1::text[], $2::text[], $3::text[], $4::text[],
            $5::text[], $6::text[], $7::text[], $8::text[]
         ) AS t(id, name, email, phone, city, country, legal_id, reference)
         CROSS JOIN (SELECT 'new' AS status, $9::text AS uploaded_by, $10::text AS uploaded_by_name) u
         RETURNING id`,
        [ids, names, emails, phones, cities, countries, legalIds, references, user.id, user.name]
    );

    return NextResponse.json({ ok: true, inserted: result.rowCount, ids: result.rows.map((r: any) => r.id) });
}

export async function PATCH(request: NextRequest) {
    const user = await loadFreshSession(request);
    if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    if (!hasDatabase()) return NextResponse.json({ error: 'DB no configurada.' }, { status: 503 });

    const body = await request.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
    const action: 'assign' | 'mark-contacted' | 'discard' = body.action;
    if (ids.length === 0 || !action) {
        return NextResponse.json({ error: 'ids[] y action requeridos' }, { status: 400 });
    }

    await ensureCrmSchema();
    const pool = getPool();

    if (action === 'assign') {
        if (!isAdmin(user.role)) return NextResponse.json({ error: 'Solo Admin/SuperAdmin asigna.' }, { status: 403 });
        const sellerId = String(body.sellerId || '').trim();
        const sellerName = String(body.sellerName || '').trim();
        if (!sellerId) return NextResponse.json({ error: 'sellerId requerido' }, { status: 400 });
        await pool.query(
            `UPDATE crm_raw_leads
                SET assigned_to = $1, assigned_to_name = $2, assigned_at = NOW(),
                    status = CASE WHEN status = 'new' THEN 'assigned' ELSE status END,
                    updated_at = NOW()
              WHERE id = ANY($3::text[])`,
            [sellerId, sellerName, ids]
        );
        return NextResponse.json({ ok: true, assigned: ids.length });
    }

    if (action === 'mark-contacted') {
        // Vendedor sólo puede marcar los suyos.
        const ownerGuard = isAdmin(user.role) ? '' : `AND assigned_to = $2`;
        const params: any[] = [ids];
        if (!isAdmin(user.role)) params.push(user.id);
        await pool.query(
            `UPDATE crm_raw_leads
                SET status = 'contacted', contacted_at = NOW(), updated_at = NOW()
              WHERE id = ANY($1::text[]) ${ownerGuard}`,
            params
        );
        return NextResponse.json({ ok: true });
    }

    if (action === 'discard') {
        const ownerGuard = isAdmin(user.role) ? '' : `AND assigned_to = $2`;
        const params: any[] = [ids];
        if (!isAdmin(user.role)) params.push(user.id);
        await pool.query(
            `UPDATE crm_raw_leads
                SET status = 'discarded', updated_at = NOW()
              WHERE id = ANY($1::text[]) ${ownerGuard}`,
            params
        );
        return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'action inválida' }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
    const user = await loadFreshSession(request);
    if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    if (!isAdmin(user.role)) return NextResponse.json({ error: 'Requiere SuperAdmin/Admin.' }, { status: 403 });
    if (!hasDatabase()) return NextResponse.json({ error: 'DB no configurada.' }, { status: 503 });

    const ids = (request.nextUrl.searchParams.get('ids') || '').split(',').filter(Boolean);
    if (ids.length === 0) return NextResponse.json({ error: 'ids requerido' }, { status: 400 });

    await ensureCrmSchema();
    const pool = getPool();
    const result = await pool.query(`DELETE FROM crm_raw_leads WHERE id = ANY($1::text[])`, [ids]);
    return NextResponse.json({ ok: true, deleted: result.rowCount });
}
