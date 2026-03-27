"use client";

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import {
    TrendingUp, Users, FileText, Clock, ArrowRight,
    CheckCircle2, AlertCircle, Plus, Kanban,
} from 'lucide-react';
import { clsx } from 'clsx';

function formatCOP(value: number) {
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value}`;
}

const STATUS_PILL: Record<string, string> = {
    Draft:            'bg-muted text-muted-foreground',
    Sent:             'bg-sky-100 text-sky-700',
    Approved:         'bg-emerald-100 text-emerald-700',
    Rejected:         'bg-rose-100 text-rose-700',
    PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
};
const STATUS_LABEL: Record<string, string> = {
    Draft: 'Borrador', Sent: 'Enviada', Approved: 'Aprobada',
    Rejected: 'Rechazada', PENDING_APPROVAL: 'Por aprobar',
};

export default function MobileDashboard() {
    const { currentUser, tasks, quotes, clients, events } = useApp();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = useMemo(() => {
        const activeLeads  = tasks.filter(t => t.stageId !== 'closed_won' && t.stageId !== 'closed_lost').length;
        const pipelineVal  = tasks.reduce((s, t) => s + (t.numericValue || 0), 0);
        const pendingQ     = quotes.filter(q => q.status === 'PENDING_APPROVAL').length;
        const todayEvents  = events.filter(ev => {
            const d = new Date(ev.date ?? '');
            d.setHours(0, 0, 0, 0);
            return d.getTime() === today.getTime();
        }).length;
        return { activeLeads, pipelineVal, pendingQ, todayEvents };
    }, [tasks, quotes, events, today]);

    const recentQuotes = useMemo(() =>
        [...quotes].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 4),
        [quotes]
    );

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Buenos días';
        if (h < 18) return 'Buenas tardes';
        return 'Buenas noches';
    };

    return (
        <div className="p-4 space-y-5">

            {/* Greeting */}
            <div className="pt-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{greeting()}</p>
                <h1 className="text-xl font-black text-foreground mt-0.5">
                    {currentUser?.name?.split(' ')[0] ?? 'Bienvenido'} 👋
                </h1>
                <p className="text-xs text-muted-foreground">
                    {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-3">
                {[
                    { label: 'Leads activos',    value: stats.activeLeads,          icon: Users,    color: 'text-sky-600',     bg: 'bg-sky-50'     },
                    { label: 'Pipeline',          value: formatCOP(stats.pipelineVal), icon: TrendingUp, color: 'text-primary',  bg: 'bg-primary/10' },
                    { label: 'Por aprobar',       value: stats.pendingQ,             icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50'   },
                    { label: 'Eventos hoy',       value: stats.todayEvents,          icon: Clock,    color: 'text-violet-600',  bg: 'bg-violet-50'  },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className="bg-white border border-border rounded-2xl p-4">
                        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center mb-2', bg)}>
                            <Icon className={clsx('w-4.5 h-4.5', color)} style={{ width: 18, height: 18 }} />
                        </div>
                        <p className="text-xl font-black text-foreground">{value}</p>
                        <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
                <Link href="/m/cotizar"
                    className="flex items-center gap-2.5 bg-primary text-black font-bold rounded-2xl px-4 py-3.5 active:scale-95 transition-transform">
                    <Plus className="w-5 h-5 shrink-0" />
                    <span className="text-sm">Nueva Cotización</span>
                </Link>
                <Link href="/m/pipeline"
                    className="flex items-center gap-2.5 bg-white border border-border text-foreground font-bold rounded-2xl px-4 py-3.5 active:scale-95 transition-transform">
                    <Kanban className="w-5 h-5 shrink-0 text-primary" />
                    <span className="text-sm">Pipeline</span>
                </Link>
            </div>

            {/* Recent Quotes */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cotizaciones recientes</p>
                    <Link href="/m/cotizar" className="text-xs font-bold text-primary flex items-center gap-1">
                        Ver todas <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
                <div className="space-y-2.5">
                    {recentQuotes.length === 0 ? (
                        <div className="bg-white border border-border rounded-2xl p-5 text-center">
                            <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Sin cotizaciones aún</p>
                        </div>
                    ) : recentQuotes.map(q => (
                        <div key={q.id} className="bg-white border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground truncate">{q.client}</p>
                                <p className="text-xs text-muted-foreground">{q.number} · {q.total}</p>
                            </div>
                            <span className={clsx(
                                'shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full',
                                STATUS_PILL[q.status] ?? 'bg-muted text-muted-foreground'
                            )}>
                                {STATUS_LABEL[q.status] ?? q.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Clients */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Clientes recientes</p>
                    <Link href="/m/clientes" className="text-xs font-bold text-primary flex items-center gap-1">
                        Ver todos <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
                <div className="space-y-2.5">
                    {clients.slice(0, 3).map(c => (
                        <div key={c.id} className="bg-white border border-border rounded-2xl p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-black text-primary text-sm shrink-0">
                                {c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground truncate">{c.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{c.company} · {c.city}</p>
                            </div>
                            <span className={clsx(
                                'shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full',
                                c.status === 'Active' ? 'bg-emerald-100 text-emerald-700'
                                : c.status === 'Lead'  ? 'bg-sky-100 text-sky-700'
                                : 'bg-muted text-muted-foreground'
                            )}>
                                {c.status === 'Active' ? 'Activo' : c.status === 'Lead' ? 'Lead' : 'Inactivo'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
