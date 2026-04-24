/**
 * daily-report-engine.ts
 *
 * Núcleo del informe diario. Vive FUERA de `src/app/api/...` porque Next.js
 * solo permite en un route.ts exportar los handlers HTTP (GET/POST/etc.) y
 * un puñado de configs — no funciones arbitrarias. El cron necesita llamar
 * la lógica sin pasar por HTTP (sino el middleware la corta con 401), así
 * que la lógica tiene que vivir en un módulo normal que tanto el route como
 * el cron puedan importar.
 */
import { hasDatabase, getPool, ensureCrmSchema } from '@/lib/postgres';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'ordenes@arteconcreto.co';
const LOGO_URL = 'https://arteconcreto.co/wp-content/uploads/2026/03/cropped-Logo-Web-72ppi-237x96-1.png';

type Role = 'Vendedor' | 'Manager' | 'Admin' | 'SuperAdmin';

interface Seller {
    id: string;
    name: string;
    email: string;
    role: Role;
    status?: 'Activo' | 'Inactivo';
}

interface Client {
    id: string;
    name: string;
    company?: string;
    city?: string;
    status: 'Active' | 'Lead' | 'Inactive';
    assignedTo?: string;
    registrationDate?: string;
}

interface Quote {
    id: string;
    quoteNumber?: string;
    number?: string;
    client: string;
    total: string;
    numericTotal?: number;
    sellerId?: string;
    sentById?: string;
    sentByName?: string;
    sentAt?: string;
    status: string;
    date?: string;
}

interface AuditLog {
    id: string;
    userId: string;
    userName: string;
    userRole: string;
    action: string;
    targetName?: string;
    timestamp: string | Date;
    details: string;
}

interface CalendarEvent {
    id: string;
    title: string;
    time: string;
    date: string;
    type: string;
    client: string;
    ownerUserId?: string;
    ownerName?: string;
}

interface SellerActivity {
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
    eventsToday: CalendarEvent[];
    otherActions: AuditLog[];
    totalRevenue: number;
}

function formatCOP(n: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(n);
}

function formatTime(d: Date | null): string {
    if (!d) return '—';
    return d.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Bogota',
    });
}

function formatDateLong(d: Date): string {
    return d.toLocaleDateString('es-CO', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'America/Bogota',
    });
}

function isSameBogotaDay(a: Date, b: Date): boolean {
    const fmt = (x: Date) =>
        x.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    return fmt(a) === fmt(b);
}

function buildSellerSection(act: SellerActivity): string {
    const totalActions =
        act.clientsAdded.length +
        act.leadsCreated.length +
        act.callsMade.length +
        act.whatsappsSent.length +
        act.quotesSent.length +
        act.eventsToday.length;

    const isSilent = totalActions === 0 && !act.firstLogin;

    const statusBadge = isSilent
        ? `<span style="background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;padding:4px 10px;border-radius:999px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;">Sin actividad</span>`
        : act.firstLogin
        ? `<span style="background:#dcfce7;color:#15803d;border:1px solid #bbf7d0;padding:4px 10px;border-radius:999px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;">Activo</span>`
        : `<span style="background:#fef9c3;color:#854d0e;border:1px solid #fde68a;padding:4px 10px;border-radius:999px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;">Sin login</span>`;

    const clientList = [...act.clientsAdded, ...act.leadsCreated]
        .slice(0, 10)
        .map(
            (c) => `
            <li style="font-size:12px;color:#333;padding:6px 0;border-bottom:1px dashed #f0f0f0;">
                <strong style="color:#1a1a1d;">${c.name}</strong>
                ${c.company ? `<span style="color:#777;"> · ${c.company}</span>` : ''}
                ${c.city ? `<span style="color:#aaa;font-size:11px;"> · ${c.city}</span>` : ''}
                <span style="float:right;font-size:10px;font-weight:900;color:${c.status === 'Lead' ? '#d97706' : '#059669'};text-transform:uppercase;">${c.status}</span>
            </li>`
        )
        .join('');

    const quoteList = act.quotesSent
        .slice(0, 8)
        .map(
            (q) => `
            <li style="font-size:12px;color:#333;padding:6px 0;border-bottom:1px dashed #f0f0f0;">
                <strong style="color:#fab510;">${q.quoteNumber || q.number}</strong>
                <span style="color:#555;"> · ${q.client}</span>
                <span style="float:right;font-weight:900;color:#1a1a1d;">${q.total}</span>
            </li>`
        )
        .join('');

    const callList = [...act.callsMade, ...act.whatsappsSent]
        .slice(0, 12)
        .map((l) => {
            const icon = l.action === 'CALL_MADE' ? '📞' : '💬';
            const label = l.action === 'CALL_MADE' ? 'Llamada' : 'WhatsApp';
            const time = new Date(l.timestamp).toLocaleTimeString('es-CO', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Bogota',
            });
            return `
            <li style="font-size:12px;color:#333;padding:6px 0;border-bottom:1px dashed #f0f0f0;">
                <span style="color:#aaa;font-size:10px;font-weight:900;">${time}</span>
                <span style="margin:0 8px;">${icon}</span>
                <span>${label} a <strong>${l.targetName || 'contacto'}</strong></span>
                <span style="display:block;margin-left:42px;color:#777;font-size:11px;margin-top:2px;">${l.details}</span>
            </li>`;
        })
        .join('');

    const eventList = act.eventsToday
        .slice(0, 8)
        .map(
            (e) => `
            <li style="font-size:12px;color:#333;padding:6px 0;border-bottom:1px dashed #f0f0f0;">
                <span style="color:#aaa;font-size:10px;font-weight:900;">${e.time}</span>
                <span style="margin:0 8px;">📅</span>
                <strong>${e.title}</strong>
                <span style="color:#777;"> · ${e.client}</span>
            </li>`
        )
        .join('');

    return `
    <div style="background:#fff;border:1px solid #ede8da;border-radius:16px;margin-bottom:20px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
      <!-- Header del vendedor -->
      <div style="background:linear-gradient(135deg,#1a1a1d 0%,#2a2a2d 100%);padding:18px 22px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:middle;">
              <div style="font-size:16px;color:#ffffff;font-weight:900;letter-spacing:-0.3px;">${act.seller.name}</div>
              <div style="font-size:10px;color:#fab510;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin-top:3px;">${act.seller.role}</div>
            </td>
            <td style="text-align:right;vertical-align:middle;">
              ${statusBadge}
            </td>
          </tr>
        </table>
      </div>

      <!-- Horario -->
      <div style="background:#faf7f0;padding:14px 22px;border-bottom:1px solid #ede8da;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="width:33%;text-align:center;padding:4px;">
              <div style="font-size:9px;color:#aaa;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;">Entrada</div>
              <div style="font-size:16px;color:#1a1a1d;font-weight:900;margin-top:4px;">${formatTime(act.firstLogin)}</div>
            </td>
            <td style="width:33%;text-align:center;padding:4px;border-left:1px solid #ede8da;border-right:1px solid #ede8da;">
              <div style="font-size:9px;color:#aaa;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;">Salida</div>
              <div style="font-size:16px;color:#1a1a1d;font-weight:900;margin-top:4px;">${formatTime(act.lastLogout)}</div>
            </td>
            <td style="width:34%;text-align:center;padding:4px;">
              <div style="font-size:9px;color:#aaa;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;">Sesiones</div>
              <div style="font-size:16px;color:#1a1a1d;font-weight:900;margin-top:4px;">${act.loginCount}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- KPIs del día -->
      <div style="padding:16px 22px;background:#fff;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="width:20%;text-align:center;padding:8px 4px;">
              <div style="font-size:22px;color:#fab510;font-weight:900;line-height:1;">${act.clientsAdded.length}</div>
              <div style="font-size:8px;color:#888;font-weight:900;text-transform:uppercase;letter-spacing:1.2px;margin-top:5px;">Clientes</div>
            </td>
            <td style="width:20%;text-align:center;padding:8px 4px;">
              <div style="font-size:22px;color:#d97706;font-weight:900;line-height:1;">${act.leadsCreated.length}</div>
              <div style="font-size:8px;color:#888;font-weight:900;text-transform:uppercase;letter-spacing:1.2px;margin-top:5px;">Leads</div>
            </td>
            <td style="width:20%;text-align:center;padding:8px 4px;">
              <div style="font-size:22px;color:#059669;font-weight:900;line-height:1;">${act.callsMade.length}</div>
              <div style="font-size:8px;color:#888;font-weight:900;text-transform:uppercase;letter-spacing:1.2px;margin-top:5px;">Llamadas</div>
            </td>
            <td style="width:20%;text-align:center;padding:8px 4px;">
              <div style="font-size:22px;color:#25d366;font-weight:900;line-height:1;">${act.whatsappsSent.length}</div>
              <div style="font-size:8px;color:#888;font-weight:900;text-transform:uppercase;letter-spacing:1.2px;margin-top:5px;">WhatsApp</div>
            </td>
            <td style="width:20%;text-align:center;padding:8px 4px;">
              <div style="font-size:22px;color:#1a1a1d;font-weight:900;line-height:1;">${act.quotesSent.length}</div>
              <div style="font-size:8px;color:#888;font-weight:900;text-transform:uppercase;letter-spacing:1.2px;margin-top:5px;">Cotizaciones</div>
            </td>
          </tr>
        </table>

        ${
            act.totalRevenue > 0
                ? `
        <div style="margin-top:14px;background:#faf7f0;border-left:4px solid #fab510;padding:10px 14px;border-radius:0 8px 8px 0;">
            <span style="font-size:9px;color:#aaa;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;">Valor cotizado hoy</span>
            <span style="float:right;font-size:15px;color:#fab510;font-weight:900;">${formatCOP(act.totalRevenue)}</span>
        </div>`
                : ''
        }
      </div>

      ${
          clientList
              ? `
      <div style="padding:0 22px 12px;">
        <div style="font-size:9px;color:#aaa;font-weight:900;text-transform:uppercase;letter-spacing:2px;padding:10px 0;">Clientes / Leads registrados</div>
        <ul style="list-style:none;padding:0;margin:0;">${clientList}</ul>
      </div>`
              : ''
      }

      ${
          quoteList
              ? `
      <div style="padding:0 22px 12px;">
        <div style="font-size:9px;color:#aaa;font-weight:900;text-transform:uppercase;letter-spacing:2px;padding:10px 0;">Cotizaciones enviadas</div>
        <ul style="list-style:none;padding:0;margin:0;">${quoteList}</ul>
      </div>`
              : ''
      }

      ${
          callList
              ? `
      <div style="padding:0 22px 12px;">
        <div style="font-size:9px;color:#aaa;font-weight:900;text-transform:uppercase;letter-spacing:2px;padding:10px 0;">Contactos realizados</div>
        <ul style="list-style:none;padding:0;margin:0;">${callList}</ul>
      </div>`
              : ''
      }

      ${
          eventList
              ? `
      <div style="padding:0 22px 12px;">
        <div style="font-size:9px;color:#aaa;font-weight:900;text-transform:uppercase;letter-spacing:2px;padding:10px 0;">Agenda del día</div>
        <ul style="list-style:none;padding:0;margin:0;">${eventList}</ul>
      </div>`
              : ''
      }

      ${
          isSilent
              ? `
      <div style="padding:14px 22px 22px;">
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px 16px;color:#b91c1c;font-size:12px;text-align:center;font-weight:700;">
              ⚠️ Este vendedor no registró actividad hoy.
          </div>
      </div>`
              : '<div style="padding-bottom:8px;"></div>'
      }
    </div>`;
}

function buildDemoActivities(targetDate: Date): SellerActivity[] {
    const mkDate = (h: number, m: number) => {
        const d = new Date(targetDate);
        d.setHours(h, m, 0, 0);
        return d;
    };

    return [
        {
            seller: {
                id: 'demo-1',
                name: 'Laura Jiménez',
                email: 'laura@arteconcreto.co',
                role: 'Vendedor',
                status: 'Activo',
            },
            firstLogin: mkDate(8, 3),
            lastLogout: mkDate(18, 45),
            loginCount: 2,
            clientsAdded: [
                { id: 'd1', name: 'Constructora Vanti', company: 'Vanti S.A.S', city: 'Bogotá', status: 'Active' },
                { id: 'd2', name: 'Edificios del Sur', company: 'EDS Ltda', city: 'Bucaramanga', status: 'Active' },
            ],
            leadsCreated: [
                { id: 'l1', name: 'Miguel Ángel Torres', company: 'Torres Inmobiliaria', city: 'Medellín', status: 'Lead' },
                { id: 'l2', name: 'Grupo Urbe', company: 'URBE', city: 'Cali', status: 'Lead' },
                { id: 'l3', name: 'Pedro Linares', company: '—', city: 'Floridablanca', status: 'Lead' },
            ],
            callsMade: [
                { id: 'c1', userId: 'demo-1', userName: 'Laura Jiménez', userRole: 'Vendedor', action: 'CALL_MADE', targetName: 'Miguel Torres', timestamp: mkDate(9, 22), details: 'Llamada de seguimiento — interesado en bancas urbanas' },
                { id: 'c2', userId: 'demo-1', userName: 'Laura Jiménez', userRole: 'Vendedor', action: 'CALL_MADE', targetName: 'Vanti S.A.S', timestamp: mkDate(11, 10), details: 'Confirmación de pedido — 12 materas grandes' },
                { id: 'c3', userId: 'demo-1', userName: 'Laura Jiménez', userRole: 'Vendedor', action: 'CALL_MADE', targetName: 'Grupo Urbe', timestamp: mkDate(15, 40), details: 'Presentación comercial inicial' },
            ],
            whatsappsSent: [
                { id: 'w1', userId: 'demo-1', userName: 'Laura Jiménez', userRole: 'Vendedor', action: 'WHATSAPP_SENT', targetName: 'Pedro Linares', timestamp: mkDate(10, 15), details: 'Catálogo enviado por WhatsApp' },
                { id: 'w2', userId: 'demo-1', userName: 'Laura Jiménez', userRole: 'Vendedor', action: 'WHATSAPP_SENT', targetName: 'Torres Inmobiliaria', timestamp: mkDate(14, 30), details: 'Seguimiento PDF cotización ART-257' },
            ],
            quotesSent: [
                { id: 'q1', quoteNumber: 'ART-257-2026', client: 'Constructora Vanti', total: '$18.400.000', numericTotal: 18400000, status: 'Sent', sentAt: mkDate(12, 18).toISOString() },
                { id: 'q2', quoteNumber: 'ART-258-2026', client: 'Torres Inmobiliaria', total: '$7.900.000', numericTotal: 7900000, status: 'Sent', sentAt: mkDate(16, 5).toISOString() },
            ],
            quotesApproved: [],
            eventsToday: [
                { id: 'e1', title: 'Visita obra Vanti', time: '09:00', date: targetDate.toISOString().split('T')[0], type: 'visit', client: 'Constructora Vanti' },
                { id: 'e2', title: 'Llamada técnica', time: '15:30', date: targetDate.toISOString().split('T')[0], type: 'call', client: 'Grupo Urbe' },
            ],
            otherActions: [],
            totalRevenue: 26300000,
        },
        {
            seller: {
                id: 'demo-2',
                name: 'Carlos Rodríguez',
                email: 'carlos@arteconcreto.co',
                role: 'Vendedor',
                status: 'Activo',
            },
            firstLogin: mkDate(7, 52),
            lastLogout: mkDate(17, 30),
            loginCount: 1,
            clientsAdded: [
                { id: 'd3', name: 'Alcaldía de Girón', company: 'Municipio', city: 'Girón', status: 'Active' },
            ],
            leadsCreated: [
                { id: 'l4', name: 'María Camila Peña', company: 'Arquitectura MCP', city: 'Bucaramanga', status: 'Lead' },
            ],
            callsMade: [
                { id: 'c4', userId: 'demo-2', userName: 'Carlos Rodríguez', userRole: 'Vendedor', action: 'CALL_MADE', targetName: 'Alcaldía de Girón', timestamp: mkDate(10, 0), details: 'Cierre orden parque infantil' },
            ],
            whatsappsSent: [
                { id: 'w3', userId: 'demo-2', userName: 'Carlos Rodríguez', userRole: 'Vendedor', action: 'WHATSAPP_SENT', targetName: 'Arquitectura MCP', timestamp: mkDate(13, 45), details: 'Envío catálogo materas' },
            ],
            quotesSent: [
                { id: 'q3', quoteNumber: 'ART-259-2026', client: 'Alcaldía de Girón', total: '$42.600.000', numericTotal: 42600000, status: 'Sent', sentAt: mkDate(11, 20).toISOString() },
            ],
            quotesApproved: [],
            eventsToday: [
                { id: 'e3', title: 'Reunión alcaldía', time: '10:00', date: targetDate.toISOString().split('T')[0], type: 'meeting', client: 'Alcaldía de Girón' },
            ],
            otherActions: [],
            totalRevenue: 42600000,
        },
        {
            seller: {
                id: 'demo-3',
                name: 'Ana Martínez',
                email: 'ana@arteconcreto.co',
                role: 'Vendedor',
                status: 'Activo',
            },
            firstLogin: null,
            lastLogout: null,
            loginCount: 0,
            clientsAdded: [],
            leadsCreated: [],
            callsMade: [],
            whatsappsSent: [],
            quotesSent: [],
            quotesApproved: [],
            eventsToday: [],
            otherActions: [],
            totalRevenue: 0,
        },
    ];
}

async function loadRealActivities(targetDate: Date): Promise<SellerActivity[]> {
    if (!hasDatabase()) return [];
    await ensureCrmSchema();
    const pool = getPool();

    // Load team + clients + state (quotes, audit logs, events)
    const [teamRes, clientsRes, stateRes] = await Promise.all([
        pool.query('SELECT id, name, email, role, status FROM crm_users ORDER BY name').catch(() => ({ rows: [] as any[] })),
        pool.query('SELECT id, name, company, city, status, assigned_to, registration_date FROM crm_clients').catch(() => ({ rows: [] as any[] })),
        pool.query(`SELECT key, value FROM crm_state WHERE key IN ('quotes', 'auditLogs', 'events')`).catch(() => ({ rows: [] as any[] })),
    ]);

    const sellers: Seller[] = teamRes.rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role as Role,
        status: r.status as 'Activo' | 'Inactivo',
    }));

    const clients: Client[] = clientsRes.rows.map((r) => ({
        id: r.id,
        name: r.name,
        company: r.company,
        city: r.city,
        status: r.status,
        assignedTo: r.assigned_to,
        registrationDate: r.registration_date,
    }));

    const stateMap = new Map(stateRes.rows.map((r: any) => [r.key, r.value]));
    const quotes: Quote[] = (stateMap.get('quotes') as Quote[]) || [];
    const auditLogs: AuditLog[] = (stateMap.get('auditLogs') as AuditLog[]) || [];
    const events: CalendarEvent[] = (stateMap.get('events') as CalendarEvent[]) || [];

    const targetDateStr = targetDate.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    return sellers
        .filter((s) => s.status !== 'Inactivo')
        // SuperAdmin/Admin no son vendedores — no deben aparecer en el reporte
        .filter((s) => s.role !== 'SuperAdmin' && s.role !== 'Admin')
        .map((seller): SellerActivity => {
            const sellerLogs = auditLogs.filter(
                (l) => l.userId === seller.id && isSameBogotaDay(new Date(l.timestamp), targetDate)
            );

            const logins = sellerLogs.filter((l) => l.action === 'SYSTEM_LOGIN').map((l) => new Date(l.timestamp));
            const logouts = sellerLogs.filter((l) => l.action === 'SYSTEM_LOGOUT').map((l) => new Date(l.timestamp));

            const firstLogin = logins.length > 0 ? new Date(Math.min(...logins.map((d) => d.getTime()))) : null;
            const lastLogout = logouts.length > 0 ? new Date(Math.max(...logouts.map((d) => d.getTime()))) : null;

            const sellerClients = clients.filter(
                (c) =>
                    c.assignedTo === seller.id &&
                    c.registrationDate &&
                    c.registrationDate.startsWith(targetDateStr)
            );

            const clientsAdded = sellerClients.filter((c) => c.status !== 'Lead');
            const leadsCreated = sellerClients.filter((c) => c.status === 'Lead');

            const sellerQuotes = quotes.filter(
                (q) =>
                    (q.sentById === seller.id || q.sellerId === seller.id) &&
                    q.sentAt &&
                    isSameBogotaDay(new Date(q.sentAt), targetDate)
            );

            const sellerEvents = events.filter(
                (e) => e.ownerUserId === seller.id && e.date === targetDateStr
            );

            const totalRevenue = sellerQuotes.reduce((sum, q) => sum + (q.numericTotal || 0), 0);

            return {
                seller,
                firstLogin,
                lastLogout,
                loginCount: logins.length,
                clientsAdded,
                leadsCreated,
                callsMade: sellerLogs.filter((l) => l.action === 'CALL_MADE'),
                whatsappsSent: sellerLogs.filter((l) => l.action === 'WHATSAPP_SENT'),
                quotesSent: sellerQuotes,
                quotesApproved: sellerQuotes.filter((q) => q.status === 'Approved'),
                eventsToday: sellerEvents,
                otherActions: sellerLogs.filter(
                    (l) => !['SYSTEM_LOGIN', 'SYSTEM_LOGOUT', 'CALL_MADE', 'WHATSAPP_SENT'].includes(l.action)
                ),
                totalRevenue,
            };
        });
}

function buildEmailHtml(
    targetDate: Date,
    activities: SellerActivity[],
    isDemo: boolean
): string {
    const fecha = formatDateLong(targetDate);

    const totals = activities.reduce(
        (acc, a) => ({
            clientsAdded: acc.clientsAdded + a.clientsAdded.length,
            leadsCreated: acc.leadsCreated + a.leadsCreated.length,
            callsMade: acc.callsMade + a.callsMade.length,
            whatsapps: acc.whatsapps + a.whatsappsSent.length,
            quotesSent: acc.quotesSent + a.quotesSent.length,
            revenue: acc.revenue + a.totalRevenue,
            activeSellers: acc.activeSellers + (a.firstLogin ? 1 : 0),
            silentSellers: acc.silentSellers + (!a.firstLogin ? 1 : 0),
        }),
        { clientsAdded: 0, leadsCreated: 0, callsMade: 0, whatsapps: 0, quotesSent: 0, revenue: 0, activeSellers: 0, silentSellers: 0 }
    );

    const sellerSections = activities.map(buildSellerSection).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Informe Diario — ${fecha}</title>
</head>
<body style="margin:0;padding:0;background:#f2ede4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="max-width:680px;margin:0 auto;padding:28px 16px 48px;">
  <div style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.12);">

    <!-- HEADER -->
    <div style="background:#1a1a1d;">
      <div style="height:5px;background:linear-gradient(90deg,#c88a00 0%,#fab510 40%,#ffd966 60%,#fab510 80%,#c88a00 100%);"></div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:28px 0 22px 32px;vertical-align:middle;width:55%;">
            <div style="display:inline-block;background:#ffffff;border-radius:14px;padding:10px 18px;box-shadow:0 2px 12px rgba(0,0,0,0.25);">
              <img src="${LOGO_URL}" alt="ArteConcreto" width="168" height="68" style="display:block;width:168px;height:68px;object-fit:contain;" />
            </div>
            ${isDemo ? `<div style="margin-top:10px;display:inline-block;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;padding:5px 12px;border-radius:999px;font-size:10px;font-weight:900;letter-spacing:2px;text-transform:uppercase;">🧪 DEMO — Datos de prueba</div>` : ''}
          </td>
          <td style="padding:28px 32px 22px 0;vertical-align:middle;text-align:right;">
            <div style="font-size:8px;color:#6b6b6b;letter-spacing:4px;text-transform:uppercase;font-weight:900;margin-bottom:8px;">Informe Diario</div>
            <div style="background:rgba(250,181,16,0.10);border:2px solid #fab510;border-radius:12px;padding:10px 20px;display:inline-block;">
              <span style="font-size:14px;color:#fab510;font-weight:900;letter-spacing:1px;">${fecha.toUpperCase()}</span>
            </div>
          </td>
        </tr>
      </table>

      <div style="height:1px;background:rgba(250,181,16,0.15);margin:0 32px;"></div>

      <div style="padding:18px 32px 28px;">
        <p style="margin:0;font-size:15px;color:#d0d0d0;line-height:1.7;">
          Resumen de actividad del equipo comercial de <strong style="color:#ffffff;">ArteConcreto</strong>.
        </p>
        <p style="margin:7px 0 0;font-size:13px;color:#7a7a7a;line-height:1.6;">
          Generado automáticamente el ${fecha} · Zona horaria: Bogotá
        </p>
      </div>
    </div>

    <!-- RESUMEN GLOBAL -->
    <div style="padding:28px 32px 8px;">
      <h2 style="margin:0 0 16px;font-size:11px;color:#aaa;font-weight:900;letter-spacing:3px;text-transform:uppercase;">Resumen del día</h2>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-radius:14px;overflow:hidden;background:#faf7f0;border:1px solid #ede8da;">
        <tr>
          <td style="width:16.66%;text-align:center;padding:18px 8px;border-right:1px solid #ede8da;">
            <div style="font-size:26px;color:#059669;font-weight:900;line-height:1;">${totals.activeSellers}</div>
            <div style="font-size:9px;color:#888;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;margin-top:6px;">Activos</div>
          </td>
          <td style="width:16.66%;text-align:center;padding:18px 8px;border-right:1px solid #ede8da;">
            <div style="font-size:26px;color:#b91c1c;font-weight:900;line-height:1;">${totals.silentSellers}</div>
            <div style="font-size:9px;color:#888;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;margin-top:6px;">Sin login</div>
          </td>
          <td style="width:16.66%;text-align:center;padding:18px 8px;border-right:1px solid #ede8da;">
            <div style="font-size:26px;color:#fab510;font-weight:900;line-height:1;">${totals.clientsAdded + totals.leadsCreated}</div>
            <div style="font-size:9px;color:#888;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;margin-top:6px;">Nuevos</div>
          </td>
          <td style="width:16.66%;text-align:center;padding:18px 8px;border-right:1px solid #ede8da;">
            <div style="font-size:26px;color:#059669;font-weight:900;line-height:1;">${totals.callsMade}</div>
            <div style="font-size:9px;color:#888;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;margin-top:6px;">Llamadas</div>
          </td>
          <td style="width:16.66%;text-align:center;padding:18px 8px;border-right:1px solid #ede8da;">
            <div style="font-size:26px;color:#25d366;font-weight:900;line-height:1;">${totals.whatsapps}</div>
            <div style="font-size:9px;color:#888;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;margin-top:6px;">WhatsApp</div>
          </td>
          <td style="width:16.66%;text-align:center;padding:18px 8px;">
            <div style="font-size:26px;color:#1a1a1d;font-weight:900;line-height:1;">${totals.quotesSent}</div>
            <div style="font-size:9px;color:#888;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;margin-top:6px;">Cotizaciones</div>
          </td>
        </tr>
      </table>

      ${
          totals.revenue > 0
              ? `
      <div style="margin-top:16px;background:linear-gradient(135deg,#1a1a1d 0%,#2a2a2d 100%);border-radius:14px;padding:18px 22px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td><div style="font-size:10px;color:#fab510;font-weight:900;text-transform:uppercase;letter-spacing:2.5px;">Valor total cotizado hoy</div></td>
            <td style="text-align:right;"><div style="font-size:26px;color:#fab510;font-weight:900;letter-spacing:-0.5px;">${formatCOP(totals.revenue)}</div></td>
          </tr>
        </table>
      </div>`
              : ''
      }
    </div>

    <!-- POR VENDEDOR -->
    <div style="padding:28px 24px 8px;">
      <h2 style="margin:0 0 20px;font-size:11px;color:#aaa;font-weight:900;letter-spacing:3px;text-transform:uppercase;">Actividad por vendedor</h2>
      ${sellerSections || '<p style="font-size:13px;color:#888;padding:20px;text-align:center;">No hay vendedores activos en el sistema.</p>'}
    </div>

    <!-- FOOTER -->
    <div style="background:#1a1a1d;padding:22px 32px;">
      <p style="margin:0;font-size:12px;color:#888;line-height:1.6;">
        Este informe se envía automáticamente cada día hábil desde el CRM de ArteConcreto.
      </p>
      <p style="margin:8px 0 0;font-size:11px;color:#555;">
        Para modificar destinatarios u horario: <span style="color:#fab510;">Configuración → Informe Diario</span>
      </p>
    </div>

    <div style="background:#111113;padding:11px 32px;text-align:center;border-top:1px solid #2a2a2d;">
      <p style="margin:0;font-size:10px;color:#3a3a3a;letter-spacing:0.3px;">
        MiWibiCRM &middot; Desarrollado para ArteConcreto por&nbsp;
        <a href="https://miwibi.com" target="_blank" style="color:#fab510;text-decoration:none;font-weight:700;">MiWibi.com</a>
      </p>
    </div>

  </div>
</div>
</body>
</html>`;
}

async function resolveRecipients(
    requestedEmails: string[] | undefined,
    recipientIds: string[] | undefined,
    extraEmails: string[] | undefined
): Promise<string[]> {
    const set = new Set<string>();

    (requestedEmails || []).forEach((e) => e && set.add(e.toLowerCase()));
    (extraEmails || []).forEach((e) => e && set.add(e.toLowerCase()));

    if (recipientIds && recipientIds.length > 0) {
        // The env-based "god" SuperAdmin (id "superadmin-server") has no row
        // in crm_users — resolve that synthetic id to the configured
        // SUPERADMIN_EMAIL directly so it also receives the report.
        const godEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
        if (godEmail && recipientIds.includes('superadmin-server')) {
            set.add(godEmail);
        }

        const realIds = recipientIds.filter((id) => id !== 'superadmin-server');
        if (realIds.length > 0 && hasDatabase()) {
            await ensureCrmSchema();
            const pool = getPool();
            const { rows } = await pool
                .query(`SELECT email FROM crm_users WHERE id = ANY($1::text[]) AND email IS NOT NULL`, [realIds])
                .catch(() => ({ rows: [] as any[] }));
            rows.forEach((r: any) => r.email && set.add(String(r.email).toLowerCase()));
        }
    }

    return Array.from(set).filter((e) => /.+@.+\..+/.test(e));
}

export type DailyReportInput = {
    demo?: boolean;
    date?: string;
    recipients?: string[];
    recipientIds?: string[];
    extraEmails?: string[];
};

export type DailyReportResult =
    | {
          ok: true;
          demo: boolean;
          sentTo: string[];
          sellersCovered: number;
          date: string;
          resendId: string | null;
      }
    | {
          ok: false;
          status: number;
          error: string;
          from?: string;
      };

export async function executeDailyReport(input: DailyReportInput): Promise<DailyReportResult> {
    const { demo = false, date, recipients, recipientIds, extraEmails } = input;

    if (!RESEND_API_KEY) {
        return { ok: false, status: 500, error: 'RESEND_API_KEY no configurada.' };
    }

    const targetDate = date ? new Date(date) : new Date();

    const activities = demo
        ? buildDemoActivities(targetDate)
        : await loadRealActivities(targetDate);

    const toEmails = await resolveRecipients(recipients, recipientIds, extraEmails);
    if (toEmails.length === 0) {
        return {
            ok: false,
            status: 400,
            error: 'No hay destinatarios válidos. Configura al menos un correo en Configuración → Informe Diario.',
        };
    }

    const html = buildEmailHtml(targetDate, activities, demo);
    const fecha = formatDateLong(targetDate);
    const subject = demo
        ? `🧪 [DEMO] Informe Diario ArteConcreto · ${fecha}`
        : `Informe Diario ArteConcreto · ${fecha}`;

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: FROM_EMAIL,
            to: toEmails,
            subject,
            html,
        }),
    });

    const resendBody = await res.json().catch(() => ({} as any));

    if (!res.ok) {
        console.error('[daily-report] Resend error:', {
            status: res.status,
            from: FROM_EMAIL,
            toCount: toEmails.length,
            body: resendBody,
        });
        const message =
            (resendBody as { message?: string }).message ||
            (resendBody as { error?: string }).error ||
            `Resend HTTP ${res.status}`;
        return {
            ok: false,
            status: 500,
            error: `Resend: ${message}`,
            from: FROM_EMAIL,
        };
    }

    const resendId = (resendBody as { id?: string }).id || null;
    console.log('[daily-report] Sent OK', { demo, resendId, to: toEmails });

    return {
        ok: true,
        demo,
        sentTo: toEmails,
        sellersCovered: activities.length,
        date: targetDate.toISOString(),
        resendId,
    };
}
