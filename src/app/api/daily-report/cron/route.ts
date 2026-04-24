import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase, getPool, ensureCrmSchema } from '@/lib/postgres';

// Vercel Cron: este endpoint se dispara por Vercel según la config en vercel.json.
// Sólo envía el informe si:
//   - dailyReport.enabled = true
//   - hay al menos un destinatario (ID de vendedor o email extra)
//   - no es sábado/domingo cuando weekdaysOnly = true
// Cualquier 200 OK con { skipped: true } significa "día válido pero nada que hacer".

export async function GET(request: NextRequest) {
    // Protección: Vercel agrega el header automáticamente en crons configurados.
    // En otros entornos aceptamos un CRON_SECRET via query param o header.
    const cronSecret = process.env.CRON_SECRET;
    const vercelCronHeader = request.headers.get('x-vercel-cron');
    const providedSecret =
        request.headers.get('x-cron-secret') || request.nextUrl.searchParams.get('secret');

    if (cronSecret && !vercelCronHeader && providedSecret !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasDatabase()) {
        return NextResponse.json({ skipped: true, reason: 'No database configured' });
    }

    await ensureCrmSchema();
    const pool = getPool();

    const { rows } = await pool
        .query(`SELECT value FROM crm_state WHERE key = 'settings'`)
        .catch(() => ({ rows: [] as any[] }));

    const settings = (rows[0]?.value as any) || {};
    const cfg = settings.dailyReport;

    if (!cfg || !cfg.enabled) {
        return NextResponse.json({ skipped: true, reason: 'Daily report disabled' });
    }

    // Check día de la semana en zona horaria Colombia
    const nowBogota = new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' });
    const today = new Date(nowBogota);
    const dow = today.getDay(); // 0=Sun, 6=Sat

    if (cfg.weekdaysOnly !== false && (dow === 0 || dow === 6)) {
        return NextResponse.json({ skipped: true, reason: 'Weekend (weekdaysOnly=true)' });
    }

    // Check hora configurada por el usuario (HH:MM en Bogotá).
    //
    // Limitación Vercel Hobby: solo 1 cron/día. Ese cron fira al final del día
    // (23:00 UTC = 18:00 Bogotá) y procesa CUALQUIER config cuya sendTime ya
    // haya pasado hoy y que no se haya enviado aún. El dedup por lastSentAt
    // más abajo previene doble envío. Con esto:
    //   - sendTime 09:00 → al disparar a las 18:00 ya pasó → se envía
    //   - sendTime 17:50 → al disparar a las 18:00 ya pasó → se envía ✓
    //   - sendTime 20:00 → al disparar a las 18:00 aún NO ha pasado → se salta
    //     (y como el cron solo corre 1x/día, no se alcanza a enviar ese día).
    //     El SuperAdmin debería configurar sendTime ≤ 18:00 para que llegue.
    const sendTime: string = typeof cfg.sendTime === 'string' && /^\d{2}:\d{2}$/.test(cfg.sendTime)
        ? cfg.sendTime
        : '17:50';
    const [sendH, sendM] = sendTime.split(':').map(Number);
    const currentMinutes = today.getHours() * 60 + today.getMinutes();
    const targetMinutes  = sendH * 60 + sendM;
    const delta = currentMinutes - targetMinutes;
    if (delta < 0) {
        return NextResponse.json({ skipped: true, reason: `sendTime ${sendTime} aún no ha pasado (ahora ${today.getHours()}:${String(today.getMinutes()).padStart(2,'0')})` });
    }

    // Evitar doble-envío: si ya se envió hoy (Bogotá), salir
    if (cfg.lastSentAt) {
        const lastSentBogota = new Date(cfg.lastSentAt).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
        const todayBogota    = today.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
        if (lastSentBogota === todayBogota) {
            return NextResponse.json({ skipped: true, reason: 'Already sent today' });
        }
    }

    const recipientIds: string[] = Array.isArray(cfg.recipients) ? cfg.recipients : [];
    const extraEmails: string[] = Array.isArray(cfg.extraEmails) ? cfg.extraEmails : [];

    if (recipientIds.length === 0 && extraEmails.length === 0) {
        return NextResponse.json({ skipped: true, reason: 'No recipients configured' });
    }

    // Internal call al endpoint de envío
    const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        `https://${request.headers.get('host')}` ||
        '';

    const sendRes = await fetch(`${baseUrl}/api/daily-report/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            demo: false,
            recipientIds,
            extraEmails,
        }),
    });

    const sendData = await sendRes.json().catch(() => ({}));

    // Marca lastSentAt en settings (no bloqueante)
    if (sendRes.ok) {
        const nextSettings = {
            ...settings,
            dailyReport: { ...cfg, lastSentAt: new Date().toISOString() },
        };
        await pool
            .query(
                `INSERT INTO crm_state (key, value, updated_at) VALUES ('settings', $1::jsonb, NOW())
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                [JSON.stringify(nextSettings)]
            )
            .catch(() => undefined);
    }

    return NextResponse.json({
        ok: sendRes.ok,
        status: sendRes.status,
        result: sendData,
    });
}
