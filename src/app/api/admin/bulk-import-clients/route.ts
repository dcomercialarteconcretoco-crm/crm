import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { loadFreshSession } from '@/lib/auth-session';

// Bulk insert client records in ONE query using UNNEST — mucho más eficiente que
// POSTs individuales a /api/clients y evita saturar el pool de Neon.
// SuperAdmin/Admin only.
export async function POST(request: NextRequest) {
    const user = await loadFreshSession(request);
    if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    if (user.role !== 'SuperAdmin' && user.role !== 'Admin') {
        return NextResponse.json({ error: 'Requiere SuperAdmin.' }, { status: 403 });
    }
    if (!hasDatabase()) {
        return NextResponse.json({ error: 'DB no configurada.' }, { status: 503 });
    }

    const body = (await request.json()) as { clients?: any[] };
    const rows = Array.isArray(body.clients) ? body.clients : [];
    if (rows.length === 0) {
        return NextResponse.json({ error: 'clients[] vacío' }, { status: 400 });
    }

    await ensureCrmSchema();
    const pool = getPool();

    // Build parallel arrays for UNNEST
    const ids: string[] = [];
    const names: string[] = [];
    const companies: string[] = [];
    const emails: (string | null)[] = [];
    const phones: string[] = [];
    const statuses: string[] = [];
    const values: string[] = [];
    const ltvs: number[] = [];
    const lastContacts: string[] = [];
    const cities: string[] = [];
    const scores: number[] = [];
    const categories: string[] = [];
    const registrationDates: string[] = [];
    const assignedTos: (string | null)[] = [];
    const assignedToNames: (string | null)[] = [];
    const sources: (string | null)[] = [];

    for (const c of rows) {
        ids.push(c.id);
        names.push(c.name || '');
        companies.push(c.company || '');
        // Email vacío → NULL para que el UNIQUE constraint no trate strings vacíos como duplicados.
        emails.push(c.email && String(c.email).trim() ? String(c.email).trim() : null);
        phones.push(c.phone || '');
        statuses.push(c.status || 'Lead');
        values.push(c.value || '$0');
        ltvs.push(Number(c.ltv) || 0);
        lastContacts.push(c.lastContact || new Date().toISOString().split('T')[0]);
        cities.push(c.city || '');
        scores.push(Number(c.score) || 0);
        categories.push(c.category || 'General');
        registrationDates.push(c.registrationDate || new Date().toISOString().split('T')[0]);
        assignedTos.push(c.assignedTo || null);
        assignedToNames.push(c.assignedToName || null);
        sources.push(c.source || null);
    }

    try {
        const result = await pool.query(
            `INSERT INTO crm_clients (
                id, name, company, email, phone, status, value_text, ltv, last_contact,
                city, score, category, registration_date,
                assigned_to, assigned_to_name, source, updated_at
            )
            SELECT * FROM UNNEST (
                $1::text[],  $2::text[],  $3::text[],  $4::text[],  $5::text[],
                $6::text[],  $7::text[],  $8::numeric[], $9::text[],
                $10::text[], $11::numeric[], $12::text[], $13::text[],
                $14::text[], $15::text[], $16::text[]
            ) AS t(id, name, company, email, phone, status, value_text, ltv, last_contact,
                    city, score, category, registration_date,
                    assigned_to, assigned_to_name, source)
            CROSS JOIN (SELECT NOW() AS updated_at) u
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                company = EXCLUDED.company,
                email = EXCLUDED.email,
                phone = EXCLUDED.phone,
                status = EXCLUDED.status,
                assigned_to = COALESCE(EXCLUDED.assigned_to, crm_clients.assigned_to),
                assigned_to_name = COALESCE(EXCLUDED.assigned_to_name, crm_clients.assigned_to_name),
                source = COALESCE(EXCLUDED.source, crm_clients.source),
                updated_at = NOW()
            RETURNING id`,
            [
                ids, names, companies, emails, phones, statuses, values, ltvs,
                lastContacts, cities, scores, categories, registrationDates,
                assignedTos, assignedToNames, sources,
            ]
        );

        return NextResponse.json({
            ok: true,
            inserted: result.rowCount,
            ids: result.rows.map((r: any) => r.id),
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('bulk-import-clients error:', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
