import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase, getPool, ensureCrmSchema } from '@/lib/postgres';
import {
    executeDailyReport,
    isLastWeekdayOfMonth,
    readLastSent,
    type ReportType,
    type LastSentMap,
} from '@/lib/daily-report-engine';

/**
 * Vercel Cron handler — único disparador de los reportes automáticos.
 *
 * Vercel Hobby permite 1 cron al día. Lo configuramos en vercel.json para
 * fire L–V a las 23:00 UTC (= 18:00 Bogotá), y dentro del handler decidimos
 * QUÉ reportes mandar:
 *   - daily   → siempre que sea día hábil
 *   - weekly  → si hoy es Viernes (Lun→Vie de la semana)
 *   - monthly → si hoy es el último día hábil del mes (mes-a-fecha)
 *
 * Cada tipo se deduplica por su propio `lastSentAt[type]` así que si Vercel
 * dispara dos veces el mismo día (raro pero posible), solo se envía una vez.
 *
 * Por qué desaparece el gate de `sendTime`: antes el cron se saltaba el envío
 * si la hora configurada por el user (`cfg.sendTime`) aún no había pasado.
 * Ese gate solo tenía sentido cuando el cron corría cada hora — con un cron
 * único al día, el cron mismo ES el horario, y el gate solo introducía bugs
 * silenciosos. Si el user quiere otra hora, se cambia el cron en vercel.json.
 */
export async function GET(request: NextRequest) {
    // Auth: Vercel agrega `x-vercel-cron` automáticamente cuando dispara el cron
    // configurado. Para llamadas manuales (testing, force) aceptamos un secret.
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

    const recipientIds: string[] = Array.isArray(cfg.recipients) ? cfg.recipients : [];
    const extraEmails: string[] = Array.isArray(cfg.extraEmails) ? cfg.extraEmails : [];

    if (recipientIds.length === 0 && extraEmails.length === 0) {
        return NextResponse.json({ skipped: true, reason: 'No recipients configured' });
    }

    // Hoy en Bogotá. El truco "toLocaleString → new Date" produce un Date cuyas
    // funciones .getHours()/.getDay() devuelven el wall-clock de Bogotá cuando
    // el server corre en UTC (Vercel). Sirve para getDay() y getDate() — que
    // es todo lo que necesitamos acá.
    const nowBogota = new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' });
    const today = new Date(nowBogota);
    const dow = today.getDay(); // 0=Sun, 6=Sat
    const todayBogotaStr = today.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    // Modo force=daily|weekly|monthly|all desde query — útil para testing manual.
    const forceParam = request.nextUrl.searchParams.get('force');

    // Decidimos qué reportes mandar. La lógica:
    //   - daily   → si es día hábil (L–V)
    //   - weekly  → si es Viernes (cierre de la semana)
    //   - monthly → si es el último día hábil del mes
    //
    // En modo force=X mandamos solo ese tipo (saltando reglas de día y dedup).
    const types: ReportType[] = [];
    if (forceParam === 'daily' || forceParam === 'weekly' || forceParam === 'monthly') {
        types.push(forceParam);
    } else if (forceParam === 'all') {
        types.push('daily', 'weekly', 'monthly');
    } else {
        // Modo automático: día hábil + reglas de cadencia.
        if (dow >= 1 && dow <= 5) types.push('daily');
        if (dow === 5) types.push('weekly');
        if (isLastWeekdayOfMonth(today)) types.push('monthly');
    }

    if (types.length === 0) {
        return NextResponse.json({
            skipped: true,
            reason: `No reports scheduled for ${todayBogotaStr} (dow=${dow})`,
        });
    }

    const lastSent: LastSentMap = readLastSent(cfg.lastSentAt);
    const sent: Array<{ type: ReportType; result: any }> = [];
    const skipped: Array<{ type: ReportType; reason: string }> = [];

    for (const type of types) {
        // Dedup por tipo: si ya se envió ese tipo hoy y no es modo force, saltar.
        if (!forceParam && lastSent[type]) {
            const lastBogota = new Date(lastSent[type]!).toLocaleDateString('en-CA', {
                timeZone: 'America/Bogota',
            });
            if (lastBogota === todayBogotaStr) {
                skipped.push({ type, reason: 'Already sent today' });
                continue;
            }
        }

        try {
            const result = await executeDailyReport({
                demo: false,
                recipientIds,
                extraEmails,
                reportType: type,
            });
            sent.push({ type, result });
            if (result.ok) {
                lastSent[type] = new Date().toISOString();
            }
        } catch (error) {
            console.error(`[daily-report] error sending ${type}:`, error);
            skipped.push({
                type,
                reason: `Engine threw: ${error instanceof Error ? error.message : 'unknown'}`,
            });
        }
    }

    // Persistir los lastSent actualizados (no bloqueante si falla).
    if (sent.some((s) => s.result.ok)) {
        const nextSettings = {
            ...settings,
            dailyReport: { ...cfg, lastSentAt: lastSent },
        };
        await pool
            .query(
                `INSERT INTO crm_state (key, value, updated_at) VALUES ('settings', $1::jsonb, NOW())
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                [JSON.stringify(nextSettings)]
            )
            .catch((e) => console.warn('[daily-report] failed to persist lastSent:', e));
    }

    return NextResponse.json({
        ok: sent.some((s) => s.result.ok),
        today: todayBogotaStr,
        dow,
        scheduled: types,
        sent: sent.map((s) => ({
            type: s.type,
            ok: s.result.ok,
            sentTo: s.result.ok ? s.result.sentTo : undefined,
            error: !s.result.ok ? s.result.error : undefined,
        })),
        skipped,
    });
}
