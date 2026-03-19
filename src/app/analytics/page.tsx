"use client";

import React from 'react';
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
    Target
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

export default function AnalyticsPage() {
    const { clients, tasks, quotes, auditLogs } = useApp();

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

        return days.map(d => ({ month: d.month, sales: d.sales || 2, quotes: d.quotes || 5 })); // base values to prevent empty charts
    }, [auditLogs]);

    const conversionData = React.useMemo(() => {
        return [
            { name: 'Leads', value: clients.length || 1, color: '#fab510' },
            { name: 'Negocios', value: tasks.length || 1, color: '#fab510dd' },
            { name: 'Cotizados', value: quotes.length || 1, color: '#fab510aa' },
            { name: 'Ganados', value: quotes.filter(q => q.status === 'Approved').length || 1, color: '#fab51077' },
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
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Inteligencia de Negocio</h1>
                    <p className="text-sm text-muted-foreground">Análisis avanzado de rendimiento, conversión y proyecciones.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 border border-border/40 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-muted/50 transition-colors">
                        <Calendar className="w-4 h-4" />
                        Últimos 6 Meses
                    </button>
                    <button className="bg-primary text-black font-bold px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 text-xs uppercase tracking-widest">
                        <Download className="w-4 h-4" />
                        PDF Report
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statsTop.map((stat) => (
                    <div key={stat.label} className="bg-card border border-border/40 p-6 rounded-2xl group hover:border-primary/40 transition-colors">
                        <div className={`p-2 rounded-lg bg-muted/50 w-fit mb-4 ${stat.color}`}>
                            <stat.icon className="w-5 h-5" />
                        </div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                        <div className="flex items-end justify-between">
                            <p className="text-2xl font-black">{stat.value}</p>
                            <ArrowUpRight className="w-4 h-4 text-emerald-500 mb-1" />
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 bg-card border border-border/40 p-8 rounded-3xl">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-black uppercase tracking-tighter">Proyección de Ingresos vs Cotizado</h3>
                        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest opacity-60">
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-primary"></div> Cotizado</div>
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-white opacity-20"></div> Cerrado</div>
                        </div>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={revenueData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff08" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                <Tooltip
                                    cursor={{ fill: '#ffffff05' }}
                                    contentStyle={{ backgroundColor: '#141417', borderColor: '#fab51044', color: '#fff', borderRadius: '12px' }}
                                />
                                <Bar dataKey="quotes" fill="#fab510" radius={[4, 4, 0, 0]} barSize={30} />
                                <Bar dataKey="sales" fill="#ffffff20" radius={[4, 4, 0, 0]} barSize={10} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="lg:col-span-4 bg-card border border-border/40 p-8 rounded-3xl flex flex-col">
                    <h3 className="text-lg font-black uppercase tracking-tighter mb-8">Embudo de Conversión</h3>
                    <div className="flex-1 space-y-8">
                        {conversionData.map((item, idx) => (
                            <div key={item.name} className="relative">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-bold opacity-80">{item.name}</span>
                                    <span className="text-xs font-black text-primary">{item.value} registros</span>
                                </div>
                                <div className="h-3 w-full bg-muted rounded-full overflow-hidden p-0.5">
                                    <div
                                        className="h-full bg-primary rounded-full shadow-[0_0_12px_rgba(250,181,16,0.3)] transition-all duration-1000"
                                        style={{ width: `${Math.min(100, (item.value / Math.max(conversionData[0].value, 1)) * 100)}%`, opacity: 1 - (idx * 0.2) }}
                                    ></div>

                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-8 pt-6 border-t border-border/20 text-center">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase italic leading-relaxed">
                            Analítica dinámica de conversión generada a partir de los datos actuales.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
