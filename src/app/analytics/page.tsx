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
    AlertCircle
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
    Cell
} from 'recharts';

import { useApp } from '@/context/AppContext';
import { generatePDFReport } from '@/lib/pdf-generator';
import { PermissionGate } from '@/components/PermissionGate';

export default function AnalyticsPage() {
    const { clients, tasks, quotes, auditLogs, addNotification } = useApp();

    const revenueData = React.useMemo(() => {
        const days = Array.from({ length: 5 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (4 - i));
            return {
                month: d.toLocaleDateString('es-CO', { weekday: 'short' }),
                fullDate: d.toDateString(),
                sales: 0,
                quotes: 0
            };
        });

        auditLogs.forEach(log => {
            const logDateStr = new Date(log.timestamp).toDateString();
            const day = days.find(d => d.fullDate === logDateStr);
            if (day) {
                if (log.action === 'SALE_REGISTERED') day.sales += 10;
                if (log.action === 'QUOTE_SENT') day.quotes += 15;
            }
        });

        return days.map(d => ({ month: d.month, sales: d.sales || 0, quotes: d.quotes || 0 }));
    }, [auditLogs]);

    const conversionData = React.useMemo(() => {
        return [
            { name: 'Leads', value: clients.length, color: '#fab510' },
            { name: 'Negocios', value: tasks.length, color: '#fab510dd' },
            { name: 'Cotizados', value: quotes.length, color: '#fab510aa' },
            { name: 'Ganados', value: quotes.filter(q => q.status === 'Approved').length, color: '#fab51077' },
        ];
    }, [clients, tasks, quotes]);

    const activeClients = clients.filter(c => c.status === 'Active').length;
    const statsTop = [
        { label: 'Leads Totales', value: clients.length.toString(), icon: Activity, color: 'text-sky-500' },
        { label: 'Negocios Activos', value: tasks.length.toString(), icon: Zap, color: 'text-orange-500' },
        { label: 'Tasa Ganada', value: quotes.length ? ((quotes.filter(q => q.status === 'Approved').length / quotes.length) * 100).toFixed(0) + '%' : '0%', icon: Target, color: 'text-primary' },
        { label: 'Cierres Exitosos', value: auditLogs.filter(a => a.action === 'SALE_REGISTERED').length.toString(), icon: TrendingUp, color: 'text-emerald-500' },
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
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => addNotification({ title: 'Filtros de fecha', description: 'Selecciona un rango de fechas para filtrar las analíticas.', type: 'ai' })}
                        className="bg-white border border-border text-foreground font-medium rounded-xl px-4 py-2 hover:bg-muted flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                    >
                        <Calendar className="w-4 h-4" />
                        Últimos 6 Meses
                    </button>
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
