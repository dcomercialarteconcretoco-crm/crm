import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { appendNotification } from '@/lib/server-notifications';

type CalendarEvent = {
    id: string;
    title: string;
    date: string;
    time: string;
    type?: string;
    client?: string;
    ownerUserId?: string;
    ownerName?: string;
    description?: string;
    meetingLink?: string;
};

function bogotaNowParts() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (type: string) => parts.find(p => p.type === type)?.value || '';
    const date = `${get('year')}-${get('month')}-${get('day')}`;
    const hour = Number(get('hour') || 0);
    const minute = Number(get('minute') || 0);
    return { date, minutes: hour * 60 + minute };
}

function eventMinutes(event: CalendarEvent) {
    const [h, m] = (event.time || '00:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

function eventLabel(event: CalendarEvent) {
    const note = event.description ? ` · ${event.description.slice(0, 90)}` : '';
    return `${event.time} · ${event.title}${event.client ? ` · ${event.client}` : ''}${note}`;
}

export async function GET(request: NextRequest) {
    const cronSecret = process.env.CRON_SECRET;
    const vercelCronHeader = request.headers.get('x-vercel-cron');
    const providedSecret =
        request.headers.get('x-cron-secret') || request.nextUrl.searchParams.get('secret');

    if (!vercelCronHeader && (!cronSecret || providedSecret !== cronSecret)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasDatabase()) {
        return NextResponse.json({ skipped: true, reason: 'No database configured' });
    }

    await ensureCrmSchema();
    const pool = getPool();
    const kind = request.nextUrl.searchParams.get('kind') === 'morning' ? 'morning' : 'upcoming';
    const now = bogotaNowParts();

    const { rows } = await pool.query(`SELECT key, value FROM crm_state WHERE key = ANY($1::text[])`, [['events', 'agendaReminderLog']]);
    const state = new Map(rows.map(row => [row.key, row.value]));
    const events: CalendarEvent[] = Array.isArray(state.get('events')) ? state.get('events') as CalendarEvent[] : [];
    const log: Record<string, string> = state.get('agendaReminderLog') && typeof state.get('agendaReminderLog') === 'object'
        ? state.get('agendaReminderLog') as Record<string, string>
        : {};

    const todaysEvents = events
        .filter(event => event.date === now.date && event.ownerUserId)
        .sort((a, b) => eventMinutes(a) - eventMinutes(b));

    let sent = 0;
    const nextLog = { ...log };

    if (kind === 'morning') {
        const byOwner = new Map<string, CalendarEvent[]>();
        for (const event of todaysEvents) {
            const key = `morning:${now.date}:${event.ownerUserId}`;
            if (nextLog[key]) continue;
            byOwner.set(event.ownerUserId!, [...(byOwner.get(event.ownerUserId!) || []), event]);
        }

        for (const [ownerId, ownerEvents] of byOwner) {
            const first = ownerEvents[0];
            await appendNotification(pool, {
                title: 'Agenda de hoy',
                description: ownerEvents.length === 1
                    ? eventLabel(first)
                    : `${ownerEvents.length} eventos programados hoy. Primero: ${eventLabel(first)}`,
                type: 'task',
                targetUserId: ownerId,
            });
            nextLog[`morning:${now.date}:${ownerId}`] = new Date().toISOString();
            sent += 1;
        }
    } else {
        for (const event of todaysEvents) {
            const diff = eventMinutes(event) - now.minutes;
            if (diff < 0 || diff > 70) continue;
            const key = `upcoming:${event.id}:${event.date}:${event.time}`;
            if (nextLog[key]) continue;
            await appendNotification(pool, {
                title: 'Evento en menos de una hora',
                description: eventLabel(event),
                type: 'task',
                targetUserId: event.ownerUserId,
            });
            nextLog[key] = new Date().toISOString();
            sent += 1;
        }
    }

    if (sent > 0) {
        await pool.query(
            `INSERT INTO crm_state (key, value, updated_at)
             VALUES ('agendaReminderLog', $1::jsonb, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [JSON.stringify(nextLog)]
        );
    }

    return NextResponse.json({ ok: true, kind, sent, today: now.date, events: todaysEvents.length });
}
