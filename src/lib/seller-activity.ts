import type { AuditLog, CalendarEvent, Client, Quote, Seller } from '@/context/AppContext';

// ─────────────────────────────────────────────────────────────────────────────
// Aggregates the activity of every seller inside a date range (inclusive).
// Used by:
//   - /team/performance page (client-side, reads AppContext state)
//   - dashboard home widget (client-side)
//   - /api/daily-report/send (server-side, reads from Postgres)
// All timestamps are compared in America/Bogota timezone.
// ─────────────────────────────────────────────────────────────────────────────

export interface SellerActivity {
    seller: Seller;
    firstLogin: Date | null;
    lastLogout: Date | null;
    loginCount: number;
    clientsAdded: Client[];
    leadsCreated: Client[];
    callsMade: AuditLog[];
    whatsappsSent: AuditLog[];
    quotesSent: Quote[];
    quotesApproved: Quote[];
    eventsInRange: CalendarEvent[];
    otherActions: AuditLog[];
    totalRevenue: number;
    // Score — ponderación simple para ranking (cotizaciones pesan más que llamadas)
    score: number;
}

export interface ActivityTotals {
    activeSellers: number;
    silentSellers: number;
    clientsAdded: number;
    leadsCreated: number;
    callsMade: number;
    whatsapps: number;
    quotesSent: number;
    quotesApproved: number;
    revenue: number;
}

/** Returns the Bogota calendar-day string (YYYY-MM-DD) for a given Date. */
export function bogotaDayString(d: Date): string {
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/** True if the timestamp falls inside [fromDate, toDate] using Bogota day boundaries. */
function isInRange(ts: Date, from: Date, to: Date): boolean {
    const day = bogotaDayString(ts);
    return day >= bogotaDayString(from) && day <= bogotaDayString(to);
}

export interface AggregateInput {
    sellers: Seller[];
    clients: Client[];
    quotes: Quote[];
    auditLogs: AuditLog[];
    events: CalendarEvent[];
    from: Date;
    to: Date;
    /** Skip sellers marked Inactivo. Default true. */
    excludeInactive?: boolean;
    /** Skip SuperAdmin/Admin — no son vendedores, no deben aparecer en rankings. Default true. */
    excludeAdmins?: boolean;
}

export function aggregateSellerActivity(input: AggregateInput): SellerActivity[] {
    const {
        sellers, clients, quotes, auditLogs, events, from, to,
        excludeInactive = true,
        excludeAdmins = true,
    } = input;

    return sellers
        .filter((s) => !excludeInactive || s.status !== 'Inactivo')
        .filter((s) => !excludeAdmins || (s.role !== 'SuperAdmin' && s.role !== 'Admin' && s.role !== 'Auditor'))
        .map((seller): SellerActivity => {
            const sellerLogs = auditLogs.filter(
                (l) => l.userId === seller.id && isInRange(new Date(l.timestamp), from, to)
            );

            const loginTimes = sellerLogs
                .filter((l) => l.action === 'SYSTEM_LOGIN')
                .map((l) => new Date(l.timestamp));
            const logoutTimes = sellerLogs
                .filter((l) => l.action === 'SYSTEM_LOGOUT')
                .map((l) => new Date(l.timestamp));

            const firstLogin =
                loginTimes.length > 0 ? new Date(Math.min(...loginTimes.map((d) => d.getTime()))) : null;
            const lastLogout =
                logoutTimes.length > 0 ? new Date(Math.max(...logoutTimes.map((d) => d.getTime()))) : null;

            // Clients: registration inside range AND assigned to this seller
            const sellerClients = clients.filter((c) => {
                if (c.assignedTo !== seller.id) return false;
                if (!c.registrationDate) return false;
                const dayStr = c.registrationDate.slice(0, 10);
                return dayStr >= bogotaDayString(from) && dayStr <= bogotaDayString(to);
            });

            const clientsAdded = sellerClients.filter((c) => c.status !== 'Lead');
            const leadsCreated = sellerClients.filter((c) => c.status === 'Lead');

            // Quotes: sent inside range by this seller
            const sellerQuotes = quotes.filter((q) => {
                if (q.isHistorical) return false; // pre-CRM sistematizada: solo consulta
                const matchesSeller =
                    q.sentById === seller.id ||
                    q.sellerId === seller.id ||
                    q.sellerName === seller.name;
                if (!matchesSeller) return false;
                const dateRef = q.sentAt || q.date;
                if (!dateRef) return false;
                return isInRange(new Date(dateRef), from, to);
            });

            const quotesApproved = sellerQuotes.filter((q) => q.status === 'Approved');

            // Events
            const sellerEvents = events.filter((e) => {
                if (e.ownerUserId !== seller.id) return false;
                return e.date >= bogotaDayString(from) && e.date <= bogotaDayString(to);
            });

            const callsMade = sellerLogs.filter((l) => l.action === 'CALL_MADE');
            const whatsappsSent = sellerLogs.filter((l) => l.action === 'WHATSAPP_SENT');
            const otherActions = sellerLogs.filter(
                (l) =>
                    !['SYSTEM_LOGIN', 'SYSTEM_LOGOUT', 'CALL_MADE', 'WHATSAPP_SENT'].includes(l.action)
            );

            const totalRevenue = sellerQuotes.reduce((sum, q) => sum + (q.numericTotal || 0), 0);

            // Ranking score: cotizaciones y aprobadas pesan más
            const score =
                clientsAdded.length * 3 +
                leadsCreated.length * 1 +
                callsMade.length * 1 +
                whatsappsSent.length * 1 +
                sellerQuotes.length * 5 +
                quotesApproved.length * 10 +
                Math.floor(totalRevenue / 1_000_000); // 1 punto por cada millón cotizado

            return {
                seller,
                firstLogin,
                lastLogout,
                loginCount: loginTimes.length,
                clientsAdded,
                leadsCreated,
                callsMade,
                whatsappsSent,
                quotesSent: sellerQuotes,
                quotesApproved,
                eventsInRange: sellerEvents,
                otherActions,
                totalRevenue,
                score,
            };
        });
}

export function computeTotals(activities: SellerActivity[]): ActivityTotals {
    return activities.reduce<ActivityTotals>(
        (acc, a) => ({
            activeSellers: acc.activeSellers + (a.firstLogin ? 1 : 0),
            silentSellers: acc.silentSellers + (!a.firstLogin ? 1 : 0),
            clientsAdded: acc.clientsAdded + a.clientsAdded.length,
            leadsCreated: acc.leadsCreated + a.leadsCreated.length,
            callsMade: acc.callsMade + a.callsMade.length,
            whatsapps: acc.whatsapps + a.whatsappsSent.length,
            quotesSent: acc.quotesSent + a.quotesSent.length,
            quotesApproved: acc.quotesApproved + a.quotesApproved.length,
            revenue: acc.revenue + a.totalRevenue,
        }),
        {
            activeSellers: 0,
            silentSellers: 0,
            clientsAdded: 0,
            leadsCreated: 0,
            callsMade: 0,
            whatsapps: 0,
            quotesSent: 0,
            quotesApproved: 0,
            revenue: 0,
        }
    );
}

// ─── Presets de rango ────────────────────────────────────────────────────────
export type PeriodPreset = 'today' | 'week' | 'month' | 'custom';

/** Returns [from, to] for a preset. "week" = last 7 days ending today. "month" = last 30 days. */
export function getPresetRange(preset: Exclude<PeriodPreset, 'custom'>): { from: Date; to: Date } {
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    const from = new Date(to);
    if (preset === 'today') {
        from.setHours(0, 0, 0, 0);
    } else if (preset === 'week') {
        from.setDate(from.getDate() - 6);
        from.setHours(0, 0, 0, 0);
    } else if (preset === 'month') {
        from.setDate(from.getDate() - 29);
        from.setHours(0, 0, 0, 0);
    }
    return { from, to };
}

export function formatTimeBogota(d: Date | null): string {
    if (!d) return '—';
    return d.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Bogota',
    });
}

export function formatCOP(n: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(n);
}
