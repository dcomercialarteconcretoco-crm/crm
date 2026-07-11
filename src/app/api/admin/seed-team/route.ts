import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { tombstoneAllCurrentIds } from '@/lib/state-merge';
import { hashPassword } from '@/lib/password';
import { loadFreshSession } from '@/lib/auth-session';

/**
 * One-shot seeding endpoint for Arte Concreto go-live.
 *
 * - Guarded: only the SuperAdmin (server session) can trigger it.
 * - Wipes every piece of demo data from the shared Neon DB (keeps the SuperAdmin row).
 * - Creates the real Arte Concreto sellers with a shared temporary password.
 * - Provisions a digital business card (biolink) for every seller.
 * - Emails each seller their credentials via Resend.
 */

interface SeedSeller {
    name: string;
    email: string;
    phone: string;
    role: 'Admin' | 'Vendedor' | 'Manager';
    cedula: string;
}

const SEED_PASSWORD = 'Arteconcreto2026*';

const SELLERS: SeedSeller[] = [
    { name: 'Laureth Valentina Quiroga Rueda', email: 'dcomercial@arteconcreto.co', phone: '+57 315 023 1956', role: 'Admin',    cedula: '1005307347' },
    { name: 'Juan David Navarro Rincon',       email: 'asesor1@arteconcreto.co',    phone: '+57 317 892 9477', role: 'Vendedor', cedula: '1005321671' },
    { name: 'Lisseth Barrera Arias',           email: 'asesor2@arteconcreto.co',    phone: '+57 317 892 9477', role: 'Vendedor', cedula: '1098785352' },
    { name: 'Brayan Esparza Martinez',         email: 'asesor3@arteconcreto.co',    phone: '+57 316 510 5675', role: 'Vendedor', cedula: '1142714434' },
    { name: 'Jefferson Cadavid Bueno',         email: 'asesor4@arteconcreto.co',    phone: '+57 317 892 9477', role: 'Vendedor', cedula: '1097494243' },
    { name: 'Eliecer Castro Perez',            email: 'gestor3@arteconcreto.co',    phone: '+57 317 160 1340', role: 'Manager',  cedula: '1083556957' },
    { name: 'Carlos Andrés Vega Perez',        email: 'comercial@veroco.com',       phone: '+57 315 325 9594', role: 'Vendedor', cedula: '1098774743' },
];

function slugify(name: string, id: string) {
    return name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '-' + id.slice(-4);
}

function credentialsEmail(seller: SeedSeller, password: string) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.arteconcreto.co';
    return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f0e8;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">
  <div style="background:#111;padding:28px;text-align:center;">
    <img src="https://arteconcreto.co/wp-content/uploads/2026/03/cropped-Logo-Web-72ppi-237x96-1.png" alt="Arte Concreto" style="height:48px;object-fit:contain;" />
  </div>
  <div style="height:5px;background:linear-gradient(90deg,#fab510,#f59e0b,#d97706);"></div>
  <div style="padding:36px 32px;">
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#111;">Bienvenido al CRM de Arte Concreto, ${seller.name.split(' ')[0]}</h2>
    <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">
      Estas son tus credenciales de acceso al CRM. Por favor cambia la contraseña la primera vez que ingreses.
    </p>
    <div style="background:#f8f8fa;border:1px solid #eee;border-radius:16px;padding:20px 22px;margin-bottom:22px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:900;color:#999;letter-spacing:2px;text-transform:uppercase;">Usuario (correo)</p>
      <p style="margin:0 0 16px;font-size:16px;font-weight:800;color:#111;">${seller.email}</p>
      <p style="margin:0 0 6px;font-size:11px;font-weight:900;color:#999;letter-spacing:2px;text-transform:uppercase;">Contraseña temporal</p>
      <p style="margin:0;font-size:16px;font-weight:800;color:#111;font-family:monospace;">${password}</p>
    </div>
    <a href="${appUrl}/login" style="display:inline-block;background:#fab510;color:#000;font-weight:900;font-size:14px;padding:14px 28px;border-radius:12px;text-decoration:none;letter-spacing:0.05em;">
      Ingresar al CRM →
    </a>
    <p style="margin:24px 0 0;color:#999;font-size:12px;line-height:1.5;">
      Rol asignado: <strong>${seller.role}</strong>. Si tienes dudas, contacta al administrador.
    </p>
  </div>
  <div style="background:#f8f8fa;padding:16px;text-align:center;font-size:10px;color:#999;">
    Arte Concreto S.A.S · CRM Interno
  </div>
</div>
</body></html>`;
}

export async function POST(req: NextRequest) {
    if (!hasDatabase()) {
        return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
    }

    // Guard: only the SuperAdmin session can run this (role read fresh from DB)
    const user = await loadFreshSession(req);
    if (!user || user.role !== 'SuperAdmin') {
        return NextResponse.json({ error: 'Solo el SuperAdmin puede ejecutar seed' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({})) as { wipeDemo?: boolean; sendEmails?: boolean };
    const wipeDemo = body.wipeDemo !== false; // default true
    const sendEmails = body.sendEmails !== false; // default true

    await ensureCrmSchema();
    const pool = getPool();
    const report: Record<string, unknown> = { created: [], emailsSent: [], emailsFailed: [], wiped: {} };

    // 1. Wipe demo data (not the superadmin row, not settings)
    if (wipeDemo) {
        const wiped: Record<string, number> = {};
        const cClients = await pool.query(`DELETE FROM crm_clients`);
        wiped.clients = cClients.rowCount || 0;
        const cDocs = await pool.query(`DELETE FROM crm_client_attachments`);
        wiped.attachments = cDocs.rowCount || 0;
        const cBio = await pool.query(`DELETE FROM crm_biolinks`);
        wiped.biolinks = cBio.rowCount || 0;
        // Tombstonear los ids de quotes/tasks antes del wipe: el PUT de
        // /api/state hace merge-por-id y sin tombstones una sesión abierta con
        // snapshot viejo resucitaría los datos demo en su próximo guardado.
        // Si falla, abortamos — un wipe sin tombstones se deshace solo.
        try {
            await tombstoneAllCurrentIds(pool, ['quotes', 'tasks']);
        } catch (e) {
            console.error('[seed-team] tombstone step failed — wipe abortado:', e);
            return NextResponse.json({
                error: 'No se pudo proteger el wipe contra sesiones abiertas (tombstones). No se borró nada — reintenta.',
            }, { status: 500 });
        }
        // Wipe state buckets except settings + global biolink settings.
        // Una clave por sentencia y en el orden de lock del merge (quotes,
        // tasks, resto): un DELETE multi-fila lockea en orden de scan
        // (indefinido) y podía deadlockear contra un merge concurrente.
        for (const key of ['quotes', 'tasks', 'events', 'notifications', 'auditLogs', 'anomalies', 'forms', 'widget_conversations', 'lead_assignment_rr']) {
            await pool.query(`DELETE FROM crm_state WHERE key = $1`, [key]);
        }
        wiped.state = 10;
        // Wipe non-superadmin users
        const cUsers = await pool.query(`DELETE FROM crm_users WHERE role <> 'SuperAdmin'`);
        wiped.users = cUsers.rowCount || 0;
        report.wiped = wiped;
    }

    // 2. Create sellers
    const hashedPassword = await hashPassword(SEED_PASSWORD);
    const createdSellers: { id: string; name: string; email: string; role: string }[] = [];
    for (const s of SELLERS) {
        const id = `s-${s.cedula}`;
        await pool.query(
            `INSERT INTO crm_users (
                id, name, avatar, role, email, phone, username, status, sales, commission, password, permissions, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,'Activo','$0','10%',$8,NULL,NOW())
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                role = EXCLUDED.role,
                email = EXCLUDED.email,
                phone = EXCLUDED.phone,
                username = EXCLUDED.username,
                status = 'Activo',
                password = EXCLUDED.password,
                updated_at = NOW()`,
            [
                id,
                s.name,
                `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=fab510&color=000`,
                s.role,
                s.email,
                s.phone,
                s.email,
                hashedPassword,
            ]
        );
        createdSellers.push({ id, name: s.name, email: s.email, role: s.role });

        // 3. Create biolink for this seller
        const biolinkId = `bl-${id}`;
        const biolinkSlug = slugify(s.name, biolinkId);
        await pool.query(
            `INSERT INTO crm_biolinks (
                id, seller_id, slug, photo, name, title, phone, email, whatsapp, active
            ) VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8,true)
            ON CONFLICT (id) DO UPDATE SET
                seller_id = EXCLUDED.seller_id,
                slug = EXCLUDED.slug,
                name = EXCLUDED.name,
                title = EXCLUDED.title,
                phone = EXCLUDED.phone,
                email = EXCLUDED.email,
                whatsapp = EXCLUDED.whatsapp,
                active = true,
                updated_at = NOW()`,
            [
                biolinkId, id, biolinkSlug, s.name,
                s.role === 'Admin' ? 'Directora Comercial' : s.role === 'Manager' ? 'Gestor Comercial' : 'Asesor Comercial',
                s.phone, s.email, s.phone.replace(/\D/g, ''),
            ]
        );
    }
    report.created = createdSellers;

    // 4. Email credentials via Resend
    if (sendEmails) {
        const apiKey = process.env.RESEND_API_KEY;
        const from = process.env.FROM_EMAIL || 'cotizaciones@arteconcreto.co';
        if (!apiKey) {
            report.emailsFailed = SELLERS.map(s => ({ email: s.email, error: 'RESEND_API_KEY no configurada' }));
        } else {
            const sent: string[] = [];
            const failed: { email: string; error: string }[] = [];
            for (const s of SELLERS) {
                try {
                    const res = await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            from,
                            to: [s.email],
                            subject: '🔐 Tus credenciales del CRM Arte Concreto',
                            html: credentialsEmail(s, SEED_PASSWORD),
                        }),
                    });
                    if (res.ok) sent.push(s.email);
                    else failed.push({ email: s.email, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` });
                } catch (err: any) {
                    failed.push({ email: s.email, error: err.message });
                }
            }
            report.emailsSent = sent;
            report.emailsFailed = failed;
        }
    }

    return NextResponse.json({ ok: true, ...report });
}
