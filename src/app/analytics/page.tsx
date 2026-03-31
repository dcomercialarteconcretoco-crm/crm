"use client";

import React from 'react';
import Link from 'next/link';
import {
    BarChart3,
    TrendingUp,
    ArrowUpRight,
    PieChart,
    Calendar,
    Filter,
    Download,
    Activity,
    Zap,
    Target,
    ExternalLink,
    CheckCircle2,
    Clock,
    AlertCircle,
    Globe,
    ShoppingCart,
    Users,
    MousePointerClick,
    RefreshCw,
    Settings
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    Cell,
    PieChart as RePieChart,
    Pie
} from 'recharts';

import { useApp } from '@/context/AppContext';
import { generatePDFReport } from '@/lib/pdf-generator';
import { PermissionGate } from '@/components/PermissionGate';

// ── Tipos GA4 ─────────────────────────────────────────────────────────────────
interface GA4Data {
    period:   string;
    globals:  {
        sessions: number; users: number; pageviews: number;
        conversions: number; revenue: number; purchases: number;
        addToCarts: number; checkouts: number;
        bounceRate: number; avgSessionDuration: number;
    } | null;
    sources:  { channel: string; sessions: number; conversions: number }[];
    trend:    { date: string; sessions: number; users: number; purchases: number }[];
    topPages: { path: string; views: number; avgTime: number }[];
    devices:  { device: string; sessions: number }[];
    fetchedAt: string;
    error?:   string;
}

const DEVICE_COLORS: Record<string, string> = {
    mobile:  '#fab510',
    desktop: '#3b82f6',
    tablet:  '#8b5cf6',
};

const CHANNEL_COLORS = ['#fab510','#3b82f6','#10b981','#f97316','#8b5cf6','#ec4899','#14b8a6','#64748b'];

function fmtDuration(secs: number) {
    const m = Math.floor(secs / 60), s = Math.round(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtCurrency(v: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
}

function fmtDate(raw: string) {
    // raw = "20240115" → "15 ene"
    if (raw.length !== 8) return raw;
    const d = new Date(
        parseInt(raw.slice(0, 4)),
        parseInt(raw.slice(4, 6)) - 1,
        parseInt(raw.slice(6, 8))
    );
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

type Period = 'week' | 'month' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
    week:  'Esta Semana',
    month: 'Este Mes',
    Q1:    'T1 Ene–Mar',
    Q2:    'T2 Abr–Jun',
    Q3:    'T3 Jul–Sep',
    Q4:    'T4 Oct–Dic',
    all:   'Todo',
};

function getPeriodRange(period: Period): { start: Date; end: Date } {
    const now = new Date();
    const y = now.getFullYear();
    switch (period) {
        case 'week': {
            const d = new Date(now);
            d.setDate(d.getDate() - d.getDay());
            d.setHours(0,0,0,0);
            const e = new Date(d); e.setDate(e.getDate() + 6); e.setHours(23,59,59,999);
            return { start: d, end: e };
        }
        case 'month': return { start: new Date(y, now.getMonth(), 1), end: new Date(y, now.getMonth() + 1, 0, 23,59,59) };
        case 'Q1':   return { start: new Date(y, 0, 1), end: new Date(y, 2, 31, 23,59,59) };
        case 'Q2':   return { start: new Date(y, 3, 1), end: new Date(y, 5, 30, 23,59,59) };
        case 'Q3':   return { start: new Date(y, 6, 1), end: new Date(y, 8, 30, 23,59,59) };
        case 'Q4':   return { start: new Date(y, 9, 1), end: new Date(y, 11, 31, 23,59,59) };
        default:     return { start: new Date(2000, 0, 1), end: new Date(2099, 11, 31) };
    }
}

export default function AnalyticsPage() {
    const { clients, tasks, quotes, auditLogs, addNotification, settings } = useApp();

    const [period, setPeriod] = React.useState<Period>('month');

    // ── Estado GA4 ────────────────────────────────────────────────────────────
    const [ga4, setGa4]           = React.useState<GA4Data | null>(null);
    const [ga4Loading, setGa4Loading] = React.useState(false);
    const [ga4Error, setGa4Error] = React.useState('');

    const hasGa4Config = !!settings.ga4PropertyId;

    const loadGa4 = React.useCallback(async () => {
        if (!hasGa4Config) return;
        setGa4Loading(true);
        setGa4Error('');
        try {
            const params = settings.ga4PropertyId ? `?propertyId=${settings.ga4PropertyId}` : '';
            const res = await fetch(`/api/metrics/ga4${params}`);
            const data: GA4Data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Error al cargar GA4');
            setGa4(data);
        } catch (e) {
            setGa4Error(e instanceof Error ? e.message : 'Error desconocido');
        } finally {
            setGa4Loading(false);
        }
    }, [hasGa4Config, settings.ga4PropertyId]);

    React.useEffect(() => { loadGa4(); }, [loadGa4]);

    const periodRange = React.useMemo(() => getPeriodRange(period), [period]);

    // Filter quotes and logs to the selected period
    const filteredQuotes = React.useMemo(() =>
        quotes.filter(q => {
            const d = new Date(q.date || q.sentAt || '');
            return !isNaN(d.getTime()) && d >= periodRange.start && d <= periodRange.end;
        }),
    [quotes, periodRange]);

    const filteredLogs = React.useMemo(() =>
        auditLogs.filter(l => {
            const d = new Date(l.timestamp);
            return !isNaN(d.getTime()) && d >= periodRange.start && d <= periodRange.end;
        }),
    [auditLogs, periodRange]);

    const filteredClients = React.useMemo(() =>
        clients.filter(c => {
            const d = new Date(c.registrationDate || '');
            return !isNaN(d.getTime()) ? (d >= periodRange.start && d <= periodRange.end) : true;
        }),
    [clients, periodRange]);

    const revenueData = React.useMemo(() => {
        // Build daily buckets within the period (max 30 points)
        const { start, end } = periodRange;
        const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
        const bucketCount = Math.min(diffDays + 1, 30);
        const step = Math.max(1, Math.ceil(diffDays / bucketCount));

        const buckets: { label: string; startDate: Date; endDate: Date; sales: number; quotes: number }[] = [];
        let cur = new Date(start);
        while (cur <= end) {
            const bucketEnd = new Date(cur);
            bucketEnd.setDate(bucketEnd.getDate() + step - 1);
            if (bucketEnd > end) bucketEnd.setTime(end.getTime());
            const label = bucketCount <= 7
                ? cur.toLocaleDateString('es-CO', { weekday: 'short' })
                : bucketCount <= 31
                    ? cur.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
                    : cur.toLocaleDateString('es-CO', { month: 'short' });
            buckets.push({ label, startDate: new Date(cur), endDate: new Date(bucketEnd), sales: 0, quotes: 0 });
            cur.setDate(cur.getDate() + step);
        }

        filteredLogs.forEach(log => {
            const d = new Date(log.timestamp);
            const bucket = buckets.find(b => d >= b.startDate && d <= b.endDate);
            if (bucket) {
                if (log.action === 'SALE_REGISTERED') bucket.sales += 1;
                if (log.action === 'QUOTE_SENT') bucket.quotes += 1;
            }
        });

        // Also count quotes by date
        filteredQuotes.forEach(q => {
            const d = new Date(q.date || q.sentAt || '');
            if (!isNaN(d.getTime())) {
                const bucket = buckets.find(b => d >= b.startDate && d <= b.endDate);
                if (bucket) bucket.quotes = Math.max(bucket.quotes, bucket.quotes); // already counted from logs
            }
        });

        return buckets.map(b => ({ month: b.label, sales: b.sales, quotes: b.quotes }));
    }, [filteredLogs, filteredQuotes, periodRange]);

    const conversionData = React.useMemo(() => {
        const fq = filteredQuotes;
        return [
            { name: 'Leads', value: filteredClients.length || clients.length, color: '#fab510' },
            { name: 'Negocios', value: tasks.length, color: '#fab510dd' },
            { name: 'Cotizados', value: fq.length, color: '#fab510aa' },
            { name: 'Ganados', value: fq.filter(q => q.status === 'Approved').length, color: '#fab51077' },
        ];
    }, [filteredClients, clients, tasks, filteredQuotes]);

    const activeClients = clients.filter(c => c.status === 'Active').length;
    const statsTop = [
        { label: 'Leads del Período', value: (filteredClients.length || clients.length).toString(), icon: Activity, color: 'text-sky-500' },
        { label: 'Negocios Activos', value: tasks.length.toString(), icon: Zap, color: 'text-orange-500' },
        { label: 'Tasa Ganada', value: filteredQuotes.length ? ((filteredQuotes.filter(q => q.status === 'Approved').length / filteredQuotes.length) * 100).toFixed(0) + '%' : '0%', icon: Target, color: 'text-primary' },
        { label: 'Cierres Exitosos', value: filteredLogs.filter(a => a.action === 'SALE_REGISTERED').length.toString(), icon: TrendingUp, color: 'text-emerald-500' },
    ];

    return (
        <PermissionGate require="analytics.view">
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="page-title">Inteligencia de Negocio</h1>
                    <p className="page-subtitle">Análisis avanzado de rendimiento, conversión y proyecciones.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Period filter buttons */}
                    <div className="flex items-center gap-1 bg-muted/60 border border-border/60 rounded-xl p-1">
                        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                    period === p
                                        ? 'bg-primary text-black shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-white/60'
                                }`}
                            >
                                {p.startsWith('Q') ? p : PERIOD_LABELS[p].split(' ')[0]}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => {
                            const totalCotizado = quotes.reduce((s, q) => s + (q.numericTotal || 0), 0);
                            const totalGanado = quotes.filter(q => q.status === 'Approved').reduce((s, q) => s + (q.numericTotal || 0), 0);
                            const pipelineValue = tasks.reduce((s, t) => s + (t.numericValue || 0), 0);
                            generatePDFReport({
                                title: 'Reporte de Inteligencia Comercial',
                                stats: [
                                    { label: 'Leads / Clientes', value: clients.length.toString(), change: `${clients.filter(c=>c.status==='Active').length} activos` },
                                    { label: 'Negocios en Pipeline', value: tasks.length.toString(), change: `$${pipelineValue.toLocaleString('es-CO')} en pipeline` },
                                    { label: 'Cotizaciones Generadas', value: quotes.length.toString(), change: `$${totalCotizado.toLocaleString('es-CO')} cotizado` },
                                    { label: 'Tasa de Conversión', value: quotes.length ? ((quotes.filter(q=>q.status==='Approved').length/quotes.length)*100).toFixed(1)+'%' : '0%', change: `${quotes.filter(q=>q.status==='Approved').length} aprobadas` },
                                    { label: 'Ventas Cerradas', value: quotes.filter(q=>q.status==='Approved').length.toString(), change: `$${totalGanado.toLocaleString('es-CO')} ganado` },
                                    { label: 'Cierres Exitosos (Audit)', value: auditLogs.filter(a=>a.action==='SALE_REGISTERED').length.toString(), change: 'Registrados en auditoría' },
                                ],
                                topLeads: clients.slice(0,8).map(c => ({
                                    name: c.name,
                                    company: c.company || '—',
                                    score: c.score || 0,
                                })),
                            });
                            addNotification({ title: 'PDF Generado', description: 'Reporte descargado correctamente.', type: 'success' });
                        }}
                        className="bg-primary text-black font-bold rounded-xl px-4 py-2 hover:brightness-105 flex items-center gap-2 text-xs uppercase tracking-widest"
                    >
                        <Download className="w-4 h-4" />
                        PDF Report
                    </button>
                </div>
            </div>

            {/* ── SECCIÓN: Sitio Web (GA4) ─────────────────────────────────── */}
            <div className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
                            <Globe className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <h3 className="font-black text-base text-foreground tracking-tight">Sitio Web · arteconcreto.co</h3>
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide">Google Analytics 4 · últimos 30 días</p>
                        </div>
                    </div>
                    {hasGa4Config ? (
                        <button
                            onClick={loadGa4}
                            disabled={ga4Loading}
                            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${ga4Loading ? 'animate-spin' : ''}`} />
                            {ga4Loading ? 'Cargando...' : 'Actualizar'}
                        </button>
                    ) : (
                        <Link href="/settings" className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
                            <Settings className="w-3.5 h-3.5" />
                            Configurar GA4
                        </Link>
                    )}
                </div>

                {!hasGa4Config && (
                    <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                        <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                            <Globe className="w-10 h-10 text-blue-300 mx-auto mb-3" />
                            <p className="text-sm font-bold text-foreground mb-1">Conecta Google Analytics 4</p>
                            <p className="text-xs text-muted-foreground max-w-sm">Agrega tu GA4 Property ID en <strong>Configuración → Integraciones → Google Marketing</strong> y el archivo de cuenta de servicio en <code className="bg-muted px-1 rounded">.env.local</code> para ver métricas del sitio web aquí.</p>
                        </div>
                        <Link href="/settings" className="bg-primary text-black font-bold text-xs uppercase tracking-widest px-4 py-2 rounded-xl hover:brightness-105 transition-all">
                            Ir a Configuración
                        </Link>
                    </div>
                )}

                {hasGa4Config && ga4Error && (
                    <div className="flex items-start gap-3 p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-rose-600">Error al conectar con GA4</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{ga4Error}</p>
                            <p className="text-xs text-muted-foreground mt-1">Verifica que <code className="bg-muted px-1 rounded">GA4_SERVICE_ACCOUNT_JSON</code> esté en <code className="bg-muted px-1 rounded">.env.local</code> y que la cuenta de servicio tenga rol Viewer en la propiedad GA4.</p>
                        </div>
                    </div>
                )}

                {hasGa4Config && ga4Loading && !ga4 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
                        ))}
                    </div>
                )}

                {ga4 && ga4.globals && (
                    <>
                        {/* KPIs web */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Usuarios',         value: ga4.globals.users.toLocaleString('es-CO'),       icon: Users,            color: 'text-blue-500',    bg: 'bg-blue-500/10' },
                                { label: 'Sesiones',         value: ga4.globals.sessions.toLocaleString('es-CO'),    icon: Activity,         color: 'text-sky-500',     bg: 'bg-sky-500/10' },
                                { label: 'Compras',          value: ga4.globals.purchases.toLocaleString('es-CO'),   icon: ShoppingCart,     color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                                { label: 'Ingresos',         value: fmtCurrency(ga4.globals.revenue),                icon: TrendingUp,       color: 'text-primary',     bg: 'bg-primary/10' },
                                { label: 'Añadir al carrito',value: ga4.globals.addToCarts.toLocaleString('es-CO'),  icon: ShoppingCart,     color: 'text-amber-500',   bg: 'bg-amber-500/10' },
                                { label: 'Checkouts',        value: ga4.globals.checkouts.toLocaleString('es-CO'),   icon: MousePointerClick,color: 'text-purple-500',  bg: 'bg-purple-500/10' },
                                { label: 'Tasa de Rebote',   value: (ga4.globals.bounceRate * 100).toFixed(1) + '%', icon: ArrowUpRight,     color: 'text-rose-500',    bg: 'bg-rose-500/10' },
                                { label: 'Duración media',   value: fmtDuration(ga4.globals.avgSessionDuration),     icon: Clock,            color: 'text-indigo-500',  bg: 'bg-indigo-500/10' },
                            ].map(s => (
                                <div key={s.label} className="p-4 bg-muted/50 border border-border rounded-xl">
                                    <div className={`p-1.5 rounded-lg ${s.bg} w-fit mb-2`}>
                                        <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                                    </div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">{s.label}</p>
                                    <p className="text-xl font-black text-foreground">{s.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Embudo de conversión web */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div>
                                <h4 className="text-sm font-black uppercase tracking-tighter mb-4">Embudo del Sitio Web</h4>
                                <div className="space-y-3">
                                    {[
                                        { label: 'Usuarios únicos',     value: ga4.globals.users,     color: 'bg-blue-500' },
                                        { label: 'Añadir al carrito',   value: ga4.globals.addToCarts, color: 'bg-amber-500' },
                                        { label: 'Inicio de compra',    value: ga4.globals.checkouts,  color: 'bg-purple-500' },
                                        { label: 'Compras completadas', value: ga4.globals.purchases,  color: 'bg-emerald-500' },
                                    ].map((step, idx, arr) => {
                                        const pct = arr[0].value > 0 ? Math.min(100, (step.value / arr[0].value) * 100) : 0;
                                        return (
                                            <div key={step.label}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-xs font-bold text-foreground">{step.label}</span>
                                                    <span className="text-xs font-black text-primary">{step.value.toLocaleString('es-CO')}</span>
                                                </div>
                                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${step.color}`} style={{ width: `${pct}%` }} />
                                                </div>
                                                {idx > 0 && arr[idx - 1].value > 0 && (
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                                        {((step.value / arr[idx - 1].value) * 100).toFixed(1)}% del paso anterior
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Fuentes de tráfico */}
                            <div>
                                <h4 className="text-sm font-black uppercase tracking-tighter mb-4">Canales de Tráfico</h4>
                                <div className="space-y-2">
                                    {ga4.sources.slice(0, 6).map((s, i) => {
                                        const max = ga4.sources[0]?.sessions || 1;
                                        return (
                                            <div key={s.channel} className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHANNEL_COLORS[i] }} />
                                                <span className="text-xs font-bold text-foreground w-36 truncate">{s.channel}</span>
                                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full" style={{ width: `${(s.sessions / max) * 100}%`, backgroundColor: CHANNEL_COLORS[i] }} />
                                                </div>
                                                <span className="text-xs font-black text-muted-foreground w-10 text-right">{s.sessions.toLocaleString('es-CO')}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Tendencia 14 días */}
                        {ga4.trend.length > 0 && (
                            <div>
                                <h4 className="text-sm font-black uppercase tracking-tighter mb-4">Tendencia · últimos 14 días</h4>
                                <div className="h-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={ga4.trend.map(t => ({ ...t, dateLabel: fmtDate(t.date) }))}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                            <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} interval="preserveStartEnd" />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} />
                                            <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e5e7eb', borderRadius: '12px', fontSize: '11px' }} />
                                            <Line type="monotone" dataKey="sessions"  stroke="#3b82f6" strokeWidth={2} dot={false} name="Sesiones" />
                                            <Line type="monotone" dataKey="users"     stroke="#fab510" strokeWidth={2} dot={false} name="Usuarios" />
                                            <Line type="monotone" dataKey="purchases" stroke="#10b981" strokeWidth={2} dot={false} name="Compras" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* Top páginas */}
                        {ga4.topPages.length > 0 && (
                            <div>
                                <h4 className="text-sm font-black uppercase tracking-tighter mb-3">Top Páginas</h4>
                                <div className="overflow-x-auto">
                                    <table className="table-clean text-xs">
                                        <thead>
                                            <tr>
                                                <th>Página</th>
                                                <th className="text-right">Vistas</th>
                                                <th className="text-right">T. medio</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ga4.topPages.slice(0, 8).map(p => (
                                                <tr key={p.path}>
                                                    <td className="font-mono text-[10px] text-muted-foreground truncate max-w-[240px]">{p.path}</td>
                                                    <td className="text-right font-black">{p.views.toLocaleString('es-CO')}</td>
                                                    <td className="text-right text-muted-foreground">{fmtDuration(p.avgTime)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {ga4.fetchedAt && (
                            <p className="text-[10px] text-muted-foreground text-right">
                                Actualizado: {new Date(ga4.fetchedAt).toLocaleString('es-CO')} · Cache 1h
                            </p>
                        )}
                    </>
                )}
            </div>

            {/* ── KPI Stats CRM ───────────────────────────────────────────── */}
            {/* KPI Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statsTop.map((stat) => (
                    <div key={stat.label} className="surface-card p-5">
                        <div className={`p-2 rounded-lg bg-muted w-fit mb-4 ${stat.color}`}>
                            <stat.icon className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">{stat.label}</p>
                        <div className="flex items-end justify-between">
                            <p className="text-2xl font-black text-foreground">{stat.value}</p>
                            <ArrowUpRight className="w-4 h-4 text-emerald-500 mb-1" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 surface-card p-8">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-black uppercase tracking-tighter">Proyección de Ingresos vs Cotizado</h3>
                        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-primary"></div> Cotizado</div>
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-muted-foreground opacity-40"></div> Cerrado</div>
                        </div>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={revenueData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                <Tooltip
                                    cursor={{ fill: '#f9fafb' }}
                                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb', color: '#111827', borderRadius: '12px' }}
                                />
                                <Bar dataKey="quotes" fill="#fab510" radius={[4, 4, 0, 0]} barSize={30} />
                                <Bar dataKey="sales" fill="#e5e7eb" radius={[4, 4, 0, 0]} barSize={10} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="lg:col-span-4 surface-card p-8 flex flex-col">
                    <h3 className="text-lg font-black uppercase tracking-tighter mb-8">Embudo de Conversión</h3>
                    <div className="flex-1 space-y-8">
                        {conversionData.map((item, idx) => (
                            <div key={item.name} className="relative">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-bold text-foreground">{item.name}</span>
                                    <span className={`text-xs font-black ${item.value > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                                        {item.value > 0 ? `${item.value} registros` : 'Sin datos'}
                                    </span>
                                </div>
                                <div className="progress-track">
                                    <div
                                        className="progress-fill"
                                        style={{ width: conversionData[0].value === 0 ? '0%' : `${Math.min(100, (item.value / conversionData[0].value) * 100)}%`, opacity: 1 - (idx * 0.2) }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-8 pt-6 border-t border-border text-center">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase italic leading-relaxed">
                            Analítica dinámica de conversión generada a partir de los datos actuales.
                        </p>
                    </div>
                </div>
            </div>

            {/* Cotizaciones Recientes */}
            <div className="surface-card p-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black uppercase tracking-tighter">Cotizaciones Recientes</h3>
                    <Link href="/quotes" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
                        Ver todas <ExternalLink className="w-3 h-3" />
                    </Link>
                </div>
                {quotes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center gap-3 text-muted-foreground">
                        <BarChart3 className="w-10 h-10 opacity-20" />
                        <p className="text-xs font-bold uppercase tracking-widest opacity-40">Sin cotizaciones aún</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table-clean">
                            <thead>
                                <tr>
                                    {['#', 'Cliente', 'Fecha', 'Total', 'Estado'].map(h => (
                                        <th key={h}>{h}</th>
                                    ))}
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {quotes.slice(0, 10).map(q => {
                                    const statusMap: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
                                        'Sent':     { label: 'Enviada',   icon: Clock,         cls: 'text-sky-500 bg-sky-50 border-sky-200' },
                                        'Approved': { label: 'Aprobada', icon: CheckCircle2,   cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                                        'Draft':    { label: 'Borrador', icon: AlertCircle,    cls: 'text-amber-600 bg-amber-50 border-amber-200' },
                                        'Rejected': { label: 'Rechazada',icon: AlertCircle,    cls: 'text-rose-600 bg-rose-50 border-rose-200' },
                                    };
                                    const st = statusMap[q.status] || statusMap['Draft'];
                                    const StIcon = st.icon;
                                    return (
                                        <tr
                                            key={q.id}
                                            onClick={() => window.location.href = `/quotes/${q.id}/edit`}
                                            className="cursor-pointer group"
                                        >
                                            <td className="text-[10px] font-black text-primary uppercase">{q.number || q.id.slice(0,8)}</td>
                                            <td>
                                                <p className="font-bold text-xs text-foreground truncate max-w-[140px]">{q.client || q.clientEmail || '—'}</p>
                                                {q.clientCompany && q.clientCompany !== q.client && <p className="text-[9px] text-muted-foreground truncate max-w-[140px]">{q.clientCompany}</p>}
                                            </td>
                                            <td className="text-[10px] text-muted-foreground whitespace-nowrap">{q.date || '—'}</td>
                                            <td className="text-sm font-black text-foreground whitespace-nowrap">{q.total || '—'}</td>
                                            <td>
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase border ${st.cls}`}>
                                                    <StIcon className="w-2.5 h-2.5" />
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className="text-right">
                                                <ExternalLink className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
        </PermissionGate>
    );
}
