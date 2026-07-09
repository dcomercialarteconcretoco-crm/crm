import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { loadFreshSession } from '@/lib/auth-session';
import { releaseUnworkedAssignedLeads } from '@/lib/raw-leads';

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

function isAdmin(role: string | undefined): boolean {
    return role === 'SuperAdmin' || role === 'Admin';
}

export async function GET(request: NextRequest) {
    const user = await loadFreshSession(request);
    if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    if (!hasDatabase()) return NextResponse.json({ leads: [], total: 0, counts: {}, page: 1, pageSize: 50 });

    await ensureCrmSchema();
    const pool = getPool();

    const sp = request.nextUrl.searchParams;
    const status = sp.get('status') || '';
    const department = sp.get('department') || '';
    const city = sp.get('city') || '';
    const size = sp.get('size') || '';
    const activity = sp.get('activity') || '';
    const assigned = sp.get('assigned') || ''; // sellerId o 'unassigned'
    const q = (sp.get('q') || '').trim();
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(sp.get('pageSize') || '50', 10) || 50));
    const restrictedToOwner = !isAdmin(user.role);

    // Construimos dos sets de filtros: uno SIN status (para los counts por
    // tab) y otro CON status (para la página actual). Así los tabs muestran
    // los conteos respetando departamento/ciudad/búsqueda activos.
    const baseConditions: string[] = [];
    const baseParams: any[] = [];
    const ph = () => `$${baseParams.length + 1}`;
    if (restrictedToOwner) { baseConditions.push(`assigned_to = ${ph()}`); baseParams.push(user.id); }
    if (department) { baseConditions.push(`department = ${ph()}`); baseParams.push(department); }
    if (city) { baseConditions.push(`city = ${ph()}`); baseParams.push(city); }
    if (size) { baseConditions.push(`company_size = ${ph()}`); baseParams.push(size); }
    if (activity) { baseConditions.push(`activities && ARRAY[${ph()}]::text[]`); baseParams.push(activity); }
    if (assigned === 'unassigned') {
        baseConditions.push(`assigned_to IS NULL`);
    } else if (assigned) {
        baseConditions.push(`assigned_to = ${ph()}`);
        baseParams.push(assigned);
    }
    if (q) {
        // Búsqueda en los campos relevantes. ILIKE con trigram index acelera
        // sobre name; el resto cae a seq scan pero es aceptable con los
        // filtros anteriores reduciendo el set.
        const wild = `%${q}%`;
        const p = ph();
        baseConditions.push(
            `(LOWER(name) LIKE LOWER(${p}) OR email ILIKE ${p} OR phone LIKE ${p} OR legal_id LIKE ${p} OR legal_rep ILIKE ${p})`
        );
        baseParams.push(wild);
    }

    const baseWhere = baseConditions.length ? `WHERE ${baseConditions.join(' AND ')}` : '';

    // Counts por status (respetando los otros filtros, NO el filtro de status).
    const countsRes = await pool.query(
        `SELECT status, COUNT(*)::int AS count
           FROM crm_raw_leads
           ${baseWhere}
          GROUP BY status`,
        baseParams
    );
    const counts: Record<string, number> = { all: 0, new: 0, assigned: 0, contacted: 0, approved: 0, discarded: 0 };
    for (const r of countsRes.rows) {
        counts[r.status] = r.count;
        counts.all += r.count;
    }

    // Query principal con el filtro de status aplicado encima.
    const pageConditions = [...baseConditions];
    const pageParams = [...baseParams];
    if (status && status !== 'all') {
        pageParams.push(status);
        pageConditions.push(`status = $${pageParams.length}`);
    }
    const pageWhere = pageConditions.length ? `WHERE ${pageConditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;
    pageParams.push(pageSize, offset);

    // Total derivado de los counts ya calculados — evita un COUNT(*) OVER()
    // que forzaría un scan extra de toda la tabla (caro con 153k+ filas).
    const total = (status && status !== 'all') ? (counts[status] || 0) : counts.all;

    const { rows: leads } = await pool.query(
        `SELECT
            id, name, email, phone, city, country, department, address,
            legal_id AS "legalId", id_type AS "idType", legal_rep AS "legalRep",
            activities, company_size AS "companySize", registration_date AS "registrationDate",
            reference, status,
            assigned_to AS "assignedTo", assigned_to_name AS "assignedToName",
            assigned_at AS "assignedAt", contacted_at AS "contactedAt",
            promoted_client_id AS "promotedClientId",
            uploaded_by AS "uploadedBy", uploaded_by_name AS "uploadedByName",
            created_at AS "createdAt", updated_at AS "updatedAt"
         FROM crm_raw_leads
         ${pageWhere}
         ORDER BY created_at DESC
         LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
        pageParams
    );
    return NextResponse.json({ leads, total, counts, page, pageSize });
}

// Hasta 5000 filas por POST. La UI parte el CSV en chunks de ~1000 — este
// tope protege contra payloads accidentales muy grandes que tumben el lambda.
const MAX_BULK_ROWS = 5000;

export async function POST(request: NextRequest) {
    const user = await loadFreshSession(request);
    if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
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
    if (incoming.length > MAX_BULK_ROWS) {
        return NextResponse.json({ error: `Máximo ${MAX_BULK_ROWS} filas por POST. Partí el CSV en chunks.` }, { status: 413 });
    }

    // Bulk (CSV) requiere admin — toca la cola compartida del equipo.
    // Single lead (formulario manual del vendedor) lo puede hacer cualquier
    // usuario logueado: caso reportado 20-may-2026 — los chicos necesitan
    // poner manualmente leads de licitaciones en pre-directorio antes de
    // saber si ganan el proyecto.
    const isBulk = Array.isArray(body.leads);
    if (isBulk && !isAdmin(user.role)) {
        return NextResponse.json({ error: 'Bulk requiere SuperAdmin/Admin.' }, { status: 403 });
    }

    await ensureCrmSchema();
    const pool = getPool();

    // Normalización: aceptamos camelCase o snake_case del cliente. Filtramos
    // arrays a strings no vacíos para que el GIN index sobre `activities` no
    // matchee con cadenas vacías.
    const trim = (v: any): string | null => {
        const s = String(v ?? '').trim();
        return s.length ? s : null;
    };
    const parseDate = (v: any): string | null => {
        if (!v) return null;
        const s = String(v).trim();
        if (!s) return null;
        // Soportamos MM/DD/YYYY (formato del CSV) y YYYY-MM-DD.
        const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (us) {
            const [, mm, dd, yyyy] = us;
            return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
        }
        const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return iso ? iso[0] : null;
    };
    const rows = incoming
        .map((r: any) => ({
            name: trim(r.name),
            email: trim(r.email),
            phone: trim(r.phone),
            city: trim(r.city),
            country: trim(r.country) ?? 'Colombia',
            department: trim(r.department),
            address: trim(r.address),
            legal_id: trim(r.legalId ?? r.legal_id ?? r.documento),
            id_type: trim(r.idType ?? r.id_type),
            legal_rep: trim(r.legalRep ?? r.legal_rep),
            company_size: trim(r.companySize ?? r.company_size),
            registration_date: parseDate(r.registrationDate ?? r.registration_date),
            reference: trim(r.reference ?? r.referencia),
            activities: Array.isArray(r.activities)
                ? r.activities.map((a: any) => String(a ?? '').trim()).filter(Boolean)
                : [],
        }))
        .filter(r => r.name); // skip silencioso filas sin nombre

    if (rows.length === 0) {
        return NextResponse.json({ error: 'Ninguna fila válida (todas sin nombre).' }, { status: 400 });
    }

    // jsonb_to_recordset descomprime el array de objetos en un set tabular
    // dentro de Postgres. Más limpio que 14 UNNEST en paralelo y maneja bien
    // los nulls. La concatenación del id incluye row_number para asegurar
    // unicidad dentro del lote.
    const result = await pool.query(
        `INSERT INTO crm_raw_leads (
            id, name, email, phone, city, country, department, address,
            legal_id, id_type, legal_rep, activities, company_size,
            registration_date, reference, status, uploaded_by, uploaded_by_name
         )
         SELECT
            'raw-' || $2 || '-' || ROW_NUMBER() OVER () || '-' || substr(md5(random()::text), 1, 6),
            name, email, phone, city, country, department, address,
            legal_id, id_type, legal_rep, activities, company_size,
            registration_date, reference, 'new', $3, $4
         FROM jsonb_to_recordset($1::jsonb) AS t(
            name text, email text, phone text, city text, country text,
            department text, address text, legal_id text, id_type text,
            legal_rep text, activities text[], company_size text,
            registration_date date, reference text
         )
         RETURNING id`,
        [JSON.stringify(rows), Date.now().toString(36), user.id, user.name]
    );

    return NextResponse.json({ ok: true, inserted: result.rowCount });
}

export async function PATCH(request: NextRequest) {
    const user = await loadFreshSession(request);
    if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    if (!hasDatabase()) return NextResponse.json({ error: 'DB no configurada.' }, { status: 503 });

    const body = await request.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
    const action: 'assign' | 'mark-contacted' | 'discard' | 'release-stale' = body.action;
    if (!action) {
        return NextResponse.json({ error: 'action requerido' }, { status: 400 });
    }
    // release-stale es una operación masiva (no por ids): libera todos los
    // 'assigned' sin contactar. El resto de acciones sí operan sobre ids[].
    if (action !== 'release-stale' && ids.length === 0) {
        return NextResponse.json({ error: 'ids[] requeridos' }, { status: 400 });
    }

    await ensureCrmSchema();
    const pool = getPool();

    if (action === 'release-stale') {
        // Compat legacy: ya no devuelve leads asignados a la bandeja. El
        // cliente pidió conservarlos visibles para el vendedor aunque no los
        // haya contactado ese mismo día.
        if (!isAdmin(user.role)) return NextResponse.json({ error: 'Solo Admin/SuperAdmin.' }, { status: 403 });
        const sellerId = body.sellerId ? String(body.sellerId).trim() : undefined;
        const released = await releaseUnworkedAssignedLeads(pool, sellerId || undefined);
        return NextResponse.json({ ok: true, released });
    }

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
