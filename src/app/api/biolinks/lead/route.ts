import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase, getPool, ensureCrmSchema } from '@/lib/postgres';
import { rateLimit } from '@/lib/rate-limit';
import { pickNextSeller } from '@/lib/round-robin';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = rateLimit(ip);
    if (!rl.ok) {
        return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en ' + rl.retryAfter + 's' }, { status: 429, headers: { ...CORS_HEADERS, 'Retry-After': String(rl.retryAfter) } });
    }
    try {
        const { name, email, phone, city, biolinkId, employeeName } = await req.json();
        if (!name || !email) {
            return NextResponse.json({ error: 'name y email son requeridos' }, { status: 400, headers: CORS_HEADERS });
        }

        if (!hasDatabase()) {
            return NextResponse.json({ ok: true, message: 'Sin DB — datos no persisted' }, { headers: CORS_HEADERS });
        }

        await ensureCrmSchema();
        const pool = getPool();

        const id = `c-bio-${Date.now()}`;
        const today = new Date().toISOString().split('T')[0];

        // Resolve the seller who owns this biolink so the captured lead lands in their queue.
        let ownerId: string | null = null;
        let ownerName: string | null = null;
        if (biolinkId) {
            const { rows: bl } = await pool.query(
                `SELECT seller_id, name FROM crm_biolinks WHERE id = $1 LIMIT 1`,
                [biolinkId]
            );
            if (bl[0]) {
                ownerId = bl[0].seller_id || null;
                ownerName = employeeName || bl[0].name || null;
                if (ownerId) {
                    const { rows: seller } = await pool.query(
                        `SELECT name FROM crm_users WHERE id = $1 LIMIT 1`,
                        [ownerId]
                    );
                    if (seller[0]) ownerName = seller[0].name;
                }
            }
        }
        // Fallback: biolink without a seller → round-robin to the next vendor
        if (!ownerId) {
            const rr = await pickNextSeller();
            if (rr) {
                ownerId = rr.id;
                ownerName = rr.name;
            }
        }

        // Check-then-upsert: avoids needing UNIQUE constraint on email.
        // A new lead always inherits the biolink owner. An existing client keeps their current owner
        // (don't steal leads from other sellers), but gets ownership if they previously had none.
        const { rows: existing } = await pool.query(
            `SELECT id, assigned_to FROM crm_clients WHERE email=$1 LIMIT 1`, [email]
        );
        if (existing.length > 0) {
            await pool.query(`
                UPDATE crm_clients SET
                  name = $1,
                  phone = COALESCE(NULLIF($2,''), phone),
                  city  = COALESCE(NULLIF($3,''), city),
                  last_contact = $4,
                  assigned_to = COALESCE(assigned_to, $6),
                  assigned_to_name = COALESCE(assigned_to_name, $7),
                  source = COALESCE(source, 'Tarjeta Digital'),
                  updated_at = NOW()
                WHERE email = $5
            `, [name, phone || '', city || '', today, email, ownerId, ownerName]);
        } else {
            await pool.query(`
                INSERT INTO crm_clients
                  (id, name, company, email, phone, status, value_text, ltv, last_contact, city, score, category, registration_date,
                   assigned_to, assigned_to_name, source, updated_at)
                VALUES ($1,$2,$3,$4,$5,'Lead','Por cotizar',0,$6,$7,70,'Tarjeta Digital',$8,$9,$10,'Tarjeta Digital',NOW())
            `, [id, name, name, email, phone || '', today, city || 'No especificada', today, ownerId, ownerName]);
        }

        // Save a pipeline task tagged with the biolink source and auto-assigned to the seller
        const { rows: cr } = await pool.query(`SELECT id FROM crm_clients WHERE email=$1 LIMIT 1`, [email]);
        const realClientId = cr[0]?.id || id;

        const { rows: tr } = await pool.query(`SELECT value FROM crm_state WHERE key='tasks'`);
        const existingTasks = tr[0]?.value || [];
        const newTask = {
            id: `t-bio-${Date.now()}`,
            title: `Lead tarjeta digital${ownerName ? ` — ${ownerName}` : ''}`,
            client: name, clientId: realClientId,
            contactName: name, value: 'Por definir', numericValue: 0,
            priority: 'Medium', tags: ['Tarjeta Digital', 'BioLink'],
            aiScore: 65, source: `Tarjeta Digital${ownerName ? ` (${ownerName})` : ''}`,
            assignedTo: ownerId || '',
            assignedToName: ownerName || '',
            email, phone: phone || '', city: city || '',
            activities: [], stageId: 'stage-1',
            biolinkId: biolinkId || null,
        };

        await pool.query(`
            INSERT INTO crm_state (key,value,updated_at) VALUES ('tasks',$1::jsonb,NOW())
            ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
        `, [JSON.stringify([newTask, ...existingTasks])]);

        // Optional: internal Resend notification
        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey && employeeName) {
            fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: 'ArteConcreto CRM <noreply@arteconcreto.co>',
                    to: ['marketing@arteconcreto.co'],
                    subject: `🪪 Nuevo lead desde tarjeta de ${employeeName}`,
                    html: `<p><strong>${name}</strong> dejó sus datos en la tarjeta digital de <strong>${employeeName}</strong>.<br>
                    Email: ${email} · Tel: ${phone || '—'} · Ciudad: ${city || '—'}</p>`,
                }),
            }).catch(console.error);
        }

        return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
    } catch (err: any) {
        console.error('biolinks/lead error:', err);
        return NextResponse.json({ error: err.message }, { status: 500, headers: CORS_HEADERS });
    }
}
