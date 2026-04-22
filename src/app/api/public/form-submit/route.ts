import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { pickNextSeller } from '@/lib/round-robin';
import { rateLimit } from '@/lib/rate-limit';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Public form submissions (QR codes, landing page embeds, FormBuilder forms).
 * Creates a lead with round-robin seller assignment, drops a pipeline task,
 * and bumps the form's submission counter — all in one round trip.
 */
export async function POST(req: NextRequest) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = rateLimit(ip, { key: 'form-submit' });
    if (!rl.ok) {
        return NextResponse.json(
            { error: 'Demasiadas solicitudes. Intenta en ' + rl.retryAfter + 's' },
            { status: 429, headers: { ...CORS_HEADERS, 'Retry-After': String(rl.retryAfter) } }
        );
    }

    try {
        const body = await req.json();
        const { formId, name, email, phone, city, company, interestedProducts = [] } = body;

        if (!name || !email) {
            return NextResponse.json({ error: 'name y email son requeridos' }, { status: 400, headers: CORS_HEADERS });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim())) {
            return NextResponse.json({ error: 'Correo electrónico no válido.' }, { status: 400, headers: CORS_HEADERS });
        }

        if (!hasDatabase()) {
            return NextResponse.json({ ok: true, message: 'Sin DB — datos no persistidos' }, { headers: CORS_HEADERS });
        }

        await ensureCrmSchema();
        const pool = getPool();

        const today = new Date().toISOString().split('T')[0];
        const normalizedEmail = String(email).trim().toLowerCase();

        // Resolve or create owner via round-robin, respecting any existing owner
        const rr = await pickNextSeller();
        const rrSellerId = rr?.id || null;
        const rrSellerName = rr?.name || null;

        const { rows: existing } = await pool.query(
            `SELECT id, assigned_to, assigned_to_name FROM crm_clients WHERE email = $1 LIMIT 1`,
            [normalizedEmail]
        );

        let clientId: string;
        let effectiveSellerId: string;
        let effectiveSellerName: string;

        if (existing.length > 0) {
            clientId = existing[0].id;
            effectiveSellerId = existing[0].assigned_to || rrSellerId || '';
            effectiveSellerName = existing[0].assigned_to_name || rrSellerName || '';
            await pool.query(
                `UPDATE crm_clients SET
                    name = COALESCE(NULLIF($1, ''), name),
                    phone = COALESCE(NULLIF($2, ''), phone),
                    city = COALESCE(NULLIF($3, ''), city),
                    company = COALESCE(NULLIF($4, ''), company),
                    last_contact = $5,
                    assigned_to = COALESCE(assigned_to, $6),
                    assigned_to_name = COALESCE(assigned_to_name, $7),
                    source = COALESCE(source, 'Formulario QR'),
                    updated_at = NOW()
                 WHERE id = $8`,
                [name, phone || '', city || '', company || '', today, rrSellerId, rrSellerName, clientId]
            );
        } else {
            clientId = `c-form-${Date.now()}`;
            effectiveSellerId = rrSellerId || '';
            effectiveSellerName = rrSellerName || '';
            await pool.query(
                `INSERT INTO crm_clients (
                    id, name, company, email, phone, status, value_text, ltv, last_contact,
                    city, score, category, registration_date,
                    assigned_to, assigned_to_name, source, updated_at
                 ) VALUES ($1,$2,$3,$4,$5,'Lead','Por cotizar',0,$6,$7,70,'Formulario QR',$8,$9,$10,'Formulario QR',NOW())`,
                [
                    clientId,
                    name,
                    company || name,
                    normalizedEmail,
                    phone || '',
                    today,
                    city || 'No especificada',
                    today,
                    effectiveSellerId || null,
                    effectiveSellerName || null,
                ]
            );
        }

        // Pipeline task with the products of interest inlined so the seller sees what they want
        const productsLabel = Array.isArray(interestedProducts) && interestedProducts.length > 0
            ? interestedProducts.map((p: any) => p.name || p).join(', ')
            : '';
        const { rows: tr } = await pool.query(`SELECT value FROM crm_state WHERE key = 'tasks'`);
        const existingTasks: any[] = Array.isArray(tr[0]?.value) ? tr[0].value : [];
        const newTask = {
            id: `t-form-${Date.now()}`,
            title: `Formulario QR: ${name}`,
            client: company || name,
            clientId,
            contactName: name,
            value: 'Por definir',
            numericValue: 0,
            priority: 'Medium',
            tags: ['Formulario', 'QR'],
            aiScore: 70,
            source: 'Formulario QR',
            assignedTo: effectiveSellerId,
            assignedToName: effectiveSellerName,
            email: normalizedEmail,
            phone: phone || '',
            city: city || '',
            activities: productsLabel ? [{
                id: `act-${Date.now()}`,
                type: 'system',
                content: `Productos de interés: ${productsLabel}`,
                timestamp: new Date().toISOString(),
            }] : [],
            stageId: 'stage-1',
        };
        await pool.query(
            `INSERT INTO crm_state (key, value, updated_at) VALUES ('tasks', $1::jsonb, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [JSON.stringify([newTask, ...existingTasks])]
        );

        // Bump the form's submission counter if formId was provided
        if (formId) {
            const { rows: fr } = await pool.query(`SELECT value FROM crm_state WHERE key = 'forms'`);
            const forms: any[] = Array.isArray(fr[0]?.value) ? fr[0].value : [];
            const updatedForms = forms.map((f: any) =>
                f.id === formId ? { ...f, submissions: (f.submissions || 0) + 1 } : f
            );
            await pool.query(
                `INSERT INTO crm_state (key, value, updated_at) VALUES ('forms', $1::jsonb, NOW())
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                [JSON.stringify(updatedForms)]
            );
        }

        return NextResponse.json({
            ok: true,
            clientId,
            assignedTo: effectiveSellerName || null,
        }, { headers: CORS_HEADERS });
    } catch (err: any) {
        console.error('[public/form-submit] error:', err);
        return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500, headers: CORS_HEADERS });
    }
}
