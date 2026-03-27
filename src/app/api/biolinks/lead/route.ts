import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase, getPool, ensureCrmSchema } from '@/lib/postgres';
import { rateLimit } from '@/lib/rate-limit';

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

        await pool.query(`
            INSERT INTO crm_clients
              (id, name, company, email, phone, status, value_text, ltv, last_contact, city, score, category, registration_date, updated_at)
            VALUES ($1,$2,$3,$4,$5,'Lead','Por cotizar',0,$6,$7,70,'Tarjeta Digital',$8,NOW())
            ON CONFLICT (email) DO UPDATE SET
              name = EXCLUDED.name,
              phone = COALESCE(NULLIF(EXCLUDED.phone,''), crm_clients.phone),
              city  = COALESCE(NULLIF(EXCLUDED.city,''),  crm_clients.city),
              last_contact = EXCLUDED.last_contact,
              updated_at = NOW()
        `, [id, name, name, email, phone || '', today, city || 'No especificada', today]);

        // Save a pipeline task tagged with the biolink source
        const { rows: cr } = await pool.query(`SELECT id FROM crm_clients WHERE email=$1 LIMIT 1`, [email]);
        const realClientId = cr[0]?.id || id;

        const { rows: tr } = await pool.query(`SELECT value FROM crm_state WHERE key='tasks'`);
        const existingTasks = tr[0]?.value || [];
        const newTask = {
            id: `t-bio-${Date.now()}`,
            title: `Lead tarjeta digital${employeeName ? ` — ${employeeName}` : ''}`,
            client: name, clientId: realClientId,
            contactName: name, value: 'Por definir', numericValue: 0,
            priority: 'Medium', tags: ['Tarjeta Digital', 'BioLink'],
            aiScore: 65, source: `Tarjeta Digital${employeeName ? ` (${employeeName})` : ''}`,
            assignedTo: '', email, phone: phone || '', city: city || '',
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
