/**
 * Supabase service layer — all DB operations.
 * All functions are fire-and-forget safe (log warnings on error, never throw).
 * Uses snake_case columns in Supabase, maps to/from camelCase app interfaces.
 */
import { getSupabase } from './supabase';
import type { Client, Task, Quote, Seller, CalendarEvent, Product } from '@/context/AppContext';

// ── Mappers: DB → App ────────────────────────────────────────────────────────

const toClient = (r: any): Client => ({
    id: r.id,
    name: r.name || '',
    company: r.company || '',
    email: r.email || '',
    phone: r.phone || '',
    status: r.status || 'Lead',
    value: r.value || '$0',
    ltv: r.ltv || 0,
    lastContact: r.last_contact || '',
    city: r.city || '',
    score: r.score || 0,
    category: r.category || '',
    registrationDate: r.registration_date || '',
});

const toTask = (r: any): Task => ({
    id: r.id,
    title: r.title || '',
    client: r.client_name || '',
    clientId: r.client_id || '',
    contactName: r.contact_name || '',
    value: r.value || '$0',
    numericValue: r.numeric_value || 0,
    priority: r.priority || 'Medium',
    tags: r.tags || [],
    aiScore: r.ai_score || 0,
    source: r.source || '',
    assignedTo: r.assigned_to || '',
    email: r.email || '',
    phone: r.phone || '',
    city: r.city || '',
    category: r.category || '',
    activities: r.activities || [],
    quoteId: r.quote_id ?? undefined,
    stageId: r.stage_id ?? undefined,
});

const toQuote = (r: any): Quote => ({
    id: r.id,
    number: r.number || '',
    client: r.client_name || '',
    clientId: r.client_id || '',
    date: r.date || '',
    total: r.total || '$0',
    numericTotal: r.numeric_total || 0,
    status: r.status || 'Draft',
    taskId: r.task_id ?? undefined,
    opens: r.opens || 0,
});

const toSeller = (r: any): Seller => ({
    id: r.id,
    name: r.name || '',
    avatar: r.avatar || '',
    role: r.role || 'Vendedor',
    email: r.email || '',
    phone: r.phone || '',
    username: r.username || '',
    status: r.status || 'Activo',
    sales: r.sales || '',
    commission: r.commission || '',
    password: r.password || '',
});

const toEvent = (r: any): CalendarEvent => ({
    id: r.id,
    title: r.title || '',
    time: r.time || '',
    date: r.date || '',
    type: r.type || 'meeting',
    client: r.client_name || '',
    location: r.location || '',
    meetingLink: r.meeting_link || '',
    invitees: r.invitees || [],
    description: r.description || '',
});

const toProduct = (r: any): Product => ({
    id: r.id,
    name: r.name || '',
    category: r.category || '',
    sku: r.sku || '',
    stock: r.stock || 0,
    isStockTracked: r.is_stock_tracked || false,
    price: r.price || 0,
    salePrice: r.sale_price ?? undefined,
    saleDateStart: r.sale_date_start ?? undefined,
    saleDateEnd: r.sale_date_end ?? undefined,
    shortDescription: r.short_description || '',
    image: r.image || '',
    gallery: r.gallery || [],
    dimensions: r.dimensions || '',
    status: r.status || 'In Stock',
    wooId: r.woo_id ?? undefined,
    slug: r.slug || '',
    isActive: r.is_active ?? true,
    isDeleted: r.is_deleted ?? false,
});

// ── Mappers: App → DB ────────────────────────────────────────────────────────

const fromClient = (c: Client) => ({
    id: c.id, name: c.name, company: c.company, email: c.email, phone: c.phone,
    status: c.status, value: c.value, ltv: c.ltv, last_contact: c.lastContact,
    city: c.city, score: c.score, category: c.category, registration_date: c.registrationDate,
});

const fromTask = (t: Task) => ({
    id: t.id, title: t.title, client_name: t.client, client_id: t.clientId,
    contact_name: t.contactName, value: t.value, numeric_value: t.numericValue,
    priority: t.priority, tags: t.tags, ai_score: t.aiScore, source: t.source,
    assigned_to: t.assignedTo, email: t.email, phone: t.phone, city: t.city,
    category: t.category, activities: t.activities,
    quote_id: t.quoteId ?? null, stage_id: t.stageId ?? null,
});

const fromQuote = (q: Quote) => ({
    id: q.id, number: q.number, client_name: q.client, client_id: q.clientId,
    date: q.date, total: q.total, numeric_total: q.numericTotal, status: q.status,
    task_id: q.taskId ?? null, opens: q.opens || 0,
});

const fromSeller = (s: Seller) => ({
    id: s.id, name: s.name, avatar: s.avatar, role: s.role, email: s.email,
    phone: s.phone, username: s.username, status: s.status,
    sales: s.sales, commission: s.commission, password: s.password,
});

const fromEvent = (e: CalendarEvent) => ({
    id: e.id, title: e.title, time: e.time, date: e.date, type: e.type,
    client_name: e.client, location: e.location, meeting_link: e.meetingLink,
    invitees: e.invitees, description: e.description,
});

const fromProduct = (p: Product) => ({
    id: p.id, name: p.name, category: p.category, sku: p.sku, stock: p.stock,
    is_stock_tracked: p.isStockTracked, price: p.price,
    sale_price: p.salePrice ?? null, sale_date_start: p.saleDateStart ?? null,
    sale_date_end: p.saleDateEnd ?? null, short_description: p.shortDescription,
    image: p.image, gallery: p.gallery, dimensions: p.dimensions, status: p.status,
    woo_id: p.wooId ?? null, slug: p.slug,
    is_active: p.isActive ?? true, is_deleted: p.isDeleted ?? false,
});

// ── Fetch all data on startup ────────────────────────────────────────────────

export interface SupabaseSnapshot {
    clients: Client[] | null;
    tasks: Task[] | null;
    quotes: Quote[] | null;
    sellers: Seller[] | null;
    events: CalendarEvent[] | null;
    products: Product[] | null;
}

export async function fetchAllData(): Promise<SupabaseSnapshot | null> {
    const sb = getSupabase();
    if (!sb) return null;

    const [cr, lr, qr, sr, er, pr] = await Promise.allSettled([
        sb.from('clients').select('*').order('created_at', { ascending: false }),
        sb.from('leads').select('*').order('created_at', { ascending: false }),
        sb.from('quotes').select('*').order('created_at', { ascending: false }),
        sb.from('sellers').select('*'),
        sb.from('events').select('*').order('date', { ascending: true }),
        sb.from('products').select('*').eq('is_deleted', false),
    ]);

    const safe = <T>(res: PromiseSettledResult<{ data: any[] | null; error: any }>, map: (r: any) => T): T[] | null => {
        if (res.status !== 'fulfilled' || res.value.error) {
            if (res.status === 'fulfilled' && res.value.error) {
                console.warn('[Supabase] fetch error:', res.value.error.message);
            }
            return null;
        }
        return (res.value.data || []).map(map);
    };

    return {
        clients: safe(cr, toClient),
        tasks: safe(lr, toTask),
        quotes: safe(qr, toQuote),
        sellers: safe(sr, toSeller),
        events: safe(er, toEvent),
        products: safe(pr, toProduct),
    };
}

// ── Client CRUD ──────────────────────────────────────────────────────────────

export async function upsertClient(c: Client) {
    const sb = getSupabase(); if (!sb) return;
    const { error } = await sb.from('clients').upsert(fromClient(c));
    if (error) console.warn('[Supabase] upsertClient:', error.message);
}

export async function deleteClientDb(id: string) {
    const sb = getSupabase(); if (!sb) return;
    const { error } = await sb.from('clients').delete().eq('id', id);
    if (error) console.warn('[Supabase] deleteClient:', error.message);
}

// ── Task / Lead CRUD ─────────────────────────────────────────────────────────

export async function upsertTask(t: Task) {
    const sb = getSupabase(); if (!sb) return;
    const { error } = await sb.from('leads').upsert(fromTask(t));
    if (error) console.warn('[Supabase] upsertTask:', error.message);
}

export async function deleteTaskDb(id: string) {
    const sb = getSupabase(); if (!sb) return;
    const { error } = await sb.from('leads').delete().eq('id', id);
    if (error) console.warn('[Supabase] deleteTask:', error.message);
}

// ── Quote CRUD ───────────────────────────────────────────────────────────────

export async function upsertQuote(q: Quote) {
    const sb = getSupabase(); if (!sb) return;
    const { error } = await sb.from('quotes').upsert(fromQuote(q));
    if (error) console.warn('[Supabase] upsertQuote:', error.message);
}

export async function deleteQuoteDb(id: string) {
    const sb = getSupabase(); if (!sb) return;
    const { error } = await sb.from('quotes').delete().eq('id', id);
    if (error) console.warn('[Supabase] deleteQuote:', error.message);
}

// ── Seller CRUD ──────────────────────────────────────────────────────────────

export async function upsertSeller(s: Seller) {
    const sb = getSupabase(); if (!sb) return;
    const { error } = await sb.from('sellers').upsert(fromSeller(s));
    if (error) console.warn('[Supabase] upsertSeller:', error.message);
}

export async function deleteSellerDb(id: string) {
    const sb = getSupabase(); if (!sb) return;
    const { error } = await sb.from('sellers').delete().eq('id', id);
    if (error) console.warn('[Supabase] deleteSeller:', error.message);
}

// ── Event CRUD ───────────────────────────────────────────────────────────────

export async function upsertEvent(e: CalendarEvent) {
    const sb = getSupabase(); if (!sb) return;
    const { error } = await sb.from('events').upsert(fromEvent(e));
    if (error) console.warn('[Supabase] upsertEvent:', error.message);
}

export async function deleteEventDb(id: string) {
    const sb = getSupabase(); if (!sb) return;
    const { error } = await sb.from('events').delete().eq('id', id);
    if (error) console.warn('[Supabase] deleteEvent:', error.message);
}

// ── Product CRUD ─────────────────────────────────────────────────────────────

export async function upsertProduct(p: Product) {
    const sb = getSupabase(); if (!sb) return;
    const { error } = await sb.from('products').upsert(fromProduct(p));
    if (error) console.warn('[Supabase] upsertProduct:', error.message);
}

export async function softDeleteProductDb(id: string) {
    const sb = getSupabase(); if (!sb) return;
    const { error } = await sb.from('products').update({ is_deleted: true }).eq('id', id);
    if (error) console.warn('[Supabase] softDeleteProduct:', error.message);
}
