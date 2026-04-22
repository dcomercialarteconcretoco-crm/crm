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

    // Check hora configurada por el usuario (HH:MM en Bogotá). El cron fira cada 30 min
    // en vercel.json — dispara el envío solo dentro de una ventana de ±29 min
    // alrededor de sendTime para honrar lo que el SuperAdmin configuró.
    const sendTime: string = typeof cfg.sendTime === 'string' && /^\d{2}:\d{2}$/.test(cfg.sendTime)
        ? cfg.sendTime
        : '17:50';
    const [sendH, sendM] = sendTime.split(':').map(Number);
    const currentMinutes = today.getHours() * 60 + today.getMinutes();
    const targetMinutes  = sendH * 60 + sendM;
    const delta = currentMinutes - targetMinutes;
    // Ventana: [sendTime, sendTime + 29min] — da margen para que al menos uno de los
    // dos disparos de 30 min del cron caiga dentro y active el envío.
    if (delta < 0 || delta > 29) {
        return NextResponse.json({ skipped: true, reason: `Outside send window (target=${sendTime}, now=${today.getHours()}:${String(today.getMinutes()).padStart(2,'0')})` });
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
