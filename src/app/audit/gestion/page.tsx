"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    Shield,
    Rocket,
    Users,
    FileText,
    AlertTriangle,
    Loader2,
    Download,
    ArrowLeft,
    CheckSquare,
    Square,
    Trophy,
    PhoneOff,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PermissionGate } from '@/components/PermissionGate';
import { clsx } from 'clsx';

type SellerOption = { id: string; name: string; role: string; status: string; isUser: boolean };

type ClientRow = {
    id: string;
    name: string;
    company: string;
    lastContact: string;
    daysWaiting: number;
    quotes: number;
    quotesValue: number;
    notes: number;
    contacts: number;
};

type SellerRow = {
    sellerId: string;
    sellerName: string;
    totalClients: number;
    newClientsInRange: number;
    neverContacted: number;
    pctNeverContacted: number;
    oldestWaitingDays: number;
    touchedInRange: number;
    lastActivity: string | null;
    quotesInRange: number;
    quotesValueInRange: number;
    quotesNoFollowUp: number;
    avgDaysLeadToQuote: number | null;
    closedInRange: number;
    closedValueInRange: number;
    avgCycleDays: number | null;
    rawContactedInRange: number;
    rawPendingAssigned: number;
    avgFirstResponseDays: number | null;
    avgSecondContactDays: number | null;
    avgThirdContactDays: number | null;
    avgFirstResponseApproxDays: number | null;
    clientsWithTrackedContacts: number;
    contactedClients: ClientRow[];
    neverContactedClients: ClientRow[];
};

type AuditResult = {
    range: { from: string; to: string };
    generatedAt: string;
    totals: {
        clients: number;
        newClientsInRange: number;
        neverContacted: number;
        pctNeverContacted: number;
        touchedInRange: number;
        quotesInRange: number;
        quotesValueInRange: number;
        quotesNoFollowUp: number;
        closedInRange: number;
        closedValueInRange: number;
        rawContactedInRange: number;
    };
    funnel: { clients: number; contacted: number; quotedClients: number; closed: number };
    avgTicket: number;
    monthly: Array<{ month: string; quotes: number; value: number }>;
    perSeller: SellerRow[];
    abandonedQuotes: Array<{
        number: string; sellerName: string; clientName: string; value: number;
        sentAt: string; daysSinceSent: number; lastContact: string;
    }>;
    notes: string[];
};

const money = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

function isoDaysAgo(days: number): string {
    const d = new Date(Date.now() - days * 86400000);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

export default function ManagementAuditPage() {
    const { currentUser, isHydrating } = useApp();
    const isLeadership = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';

    const [sellerOptions, setSellerOptions] = useState<SellerOption[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [dateFrom, setDateFrom] = useState(isoDaysAgo(30));
    const [dateTo, setDateTo] = useState(isoDaysAgo(0));
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<AuditResult | null>(null);

    useEffect(() => {
        if (!isLeadership) return;
        fetch('/api/audit/management')
            .then((r) => r.json())
            .then((data) => {
                const sellers: SellerOption[] = data.sellers || [];
                setSellerOptions(sellers);
                setSelected(new Set(sellers.map((s) => s.id)));
            })
            .catch(() => setError('No se pudo cargar la lista de asesores.'));
    }, [isLeadership]);

    const allSelected = sellerOptions.length > 0 && selected.size === sellerOptions.length;

    const toggleSeller = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const runAudit = async () => {
        setRunning(true);
        setError(null);
        try {
            const res = await fetch('/api/audit/management', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: dateFrom,
                    to: dateTo,
                    // Todos seleccionados = sin filtro (incluye clientes sin asignar)
                    sellerIds: allSelected ? [] : Array.from(selected),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al ejecutar la auditoría.');
            setResult(data as AuditResult);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al ejecutar la auditoría.');
        } finally {
            setRunning(false);
        }
    };

    const exportCSV = () => {
        if (!result) return;
        const headers = [
            'Asesor', 'Clientes', 'Nuevos en rango', 'Nunca contactados', '% sin contacto',
            'Clientes tocados en rango', 'Cotizaciones', 'Valor cotizado', 'Cotiz. sin seguimiento',
            'Días prom. lead→cotización', 'Negocios cerrados', 'Valor cerrado', 'Días prom. cotiz→cierre',
            'Base fría contactados', 'Base fría pendientes',
        ];
        const rows = result.perSeller.map((s) => [
            s.sellerName, s.totalClients, s.newClientsInRange, s.neverContacted, s.pctNeverContacted + '%',
            s.touchedInRange, s.quotesInRange, s.quotesValueInRange, s.quotesNoFollowUp,
            s.avgDaysLeadToQuote ?? '', s.closedInRange, s.closedValueInRange, s.avgCycleDays ?? '',
            s.rawContactedInRange, s.rawPendingAssigned,
        ]);
        const csv = [headers, ...rows]
            .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `auditoria-gestion_${result.range.from}_${result.range.to}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const kpis = useMemo(() => {
        if (!result) return [];
        const t = result.totals;
        return [
            {
                label: 'Clientes sin contactar',
                value: `${t.neverContacted} (${t.pctNeverContacted}%)`,
                sub: `de ${t.clients} clientes en cartera`,
                icon: PhoneOff,
                alert: t.pctNeverContacted > 30,
            },
            {
                label: 'Cotizaciones en el periodo',
                value: String(t.quotesInRange),
                sub: money(t.quotesValueInRange),
                icon: FileText,
                alert: false,
            },
            {
                label: 'Cotizaciones sin seguimiento',
                value: String(t.quotesNoFollowUp),
                sub: t.quotesInRange ? `${Math.round((100 * t.quotesNoFollowUp) / t.quotesInRange)}% de las enviadas` : '—',
                icon: AlertTriangle,
                alert: t.quotesNoFollowUp > 0,
            },
            {
                label: 'Negocios cerrados',
                value: String(t.closedInRange),
                sub: money(t.closedValueInRange),
                icon: Trophy,
                alert: false,
            },
        ];
    }, [result]);

    if (isHydrating) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <PermissionGate require="audit.view">
            {!isLeadership ? (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                    <Shield className="w-12 h-12 text-rose-400 mb-4" />
                    <h2 className="text-xl font-black text-foreground mb-2">Solo administradores</h2>
                    <p className="text-sm text-muted-foreground max-w-sm">
                        La Auditoría de Gestión está reservada para SuperAdmin y Administradores.
                    </p>
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <Shield className="w-5 h-5 text-primary" />
                                </div>
                                <h1 className="text-2xl font-black text-foreground tracking-tight">Auditoría de Gestión</h1>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                Cartera, seguimiento, cotizaciones y cierres por asesor — directo de la base de datos
                            </p>
                        </div>
                        <Link
                            href="/audit"
                            className="flex items-center gap-2 bg-white border border-border text-foreground font-semibold rounded-xl px-4 py-2.5 hover:bg-muted transition-all text-sm w-fit"
                        >
                            <ArrowLeft className="w-4 h-4" /> Volver al log
                        </Link>
                    </div>

                    {/* Launcher */}
                    <div className="bg-white border border-border rounded-2xl shadow-sm p-5 space-y-4">
                        <div className="flex flex-wrap items-end gap-3">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Desde</label>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Hasta</label>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                />
                            </div>
                            <div className="flex gap-2">
                                {[{ l: '7 días', d: 7 }, { l: '30 días', d: 30 }, { l: '90 días', d: 90 }].map((p) => (
                                    <button
                                        key={p.d}
                                        onClick={() => { setDateFrom(isoDaysAgo(p.d)); setDateTo(isoDaysAgo(0)); }}
                                        className="px-3 py-2.5 bg-muted border border-border rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:border-primary transition-all"
                                    >
                                        {p.l}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={runAudit}
                                disabled={running || selected.size === 0}
                                className="ml-auto bg-primary text-black font-bold rounded-xl px-6 py-2.5 hover:brightness-105 transition-all flex items-center gap-2 text-sm disabled:opacity-50"
                            >
                                {running ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" /> Auditando...
                                    </>
                                ) : (
                                    <>
                                        <Rocket className="w-4 h-4" /> Lanzar Auditoría
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Seller picker */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5" /> Asesores ({selected.size}/{sellerOptions.length})
                                </label>
                                <button
                                    onClick={() => setSelected(allSelected ? new Set() : new Set(sellerOptions.map((s) => s.id)))}
                                    className="text-xs font-bold text-primary hover:underline"
                                >
                                    {allSelected ? 'Ninguno' : 'Todos'}
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {sellerOptions.map((s) => {
                                    const on = selected.has(s.id);
                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => toggleSeller(s.id)}
                                            className={clsx(
                                                'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all',
                                                on
                                                    ? 'bg-primary/10 border-primary text-foreground'
                                                    : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                                            )}
                                        >
                                            {on ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                                            {s.name}
                                        </button>
                                    );
                                })}
                                {sellerOptions.length === 0 && (
                                    <p className="text-sm text-muted-foreground">Cargando asesores…</p>
                                )}
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-600">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Results */}
                    {result && (
                        <>
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">
                                    Periodo <span className="font-bold text-foreground">{result.range.from}</span> a{' '}
                                    <span className="font-bold text-foreground">{result.range.to}</span>
                                </p>
                                <button
                                    onClick={exportCSV}
                                    className="flex items-center gap-2 bg-white border border-border text-foreground font-semibold rounded-xl px-4 py-2 hover:bg-muted transition-all text-sm"
                                >
                                    <Download className="w-4 h-4" /> CSV
                                </button>
                            </div>

                            {/* KPI cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {kpis.map((k) => (
                                    <div
                                        key={k.label}
                                        className={clsx(
                                            'rounded-2xl p-5 border shadow-sm',
                                            k.alert ? 'bg-red-50 border-red-200' : 'bg-white border-border'
                                        )}
                                    >
                                        <div className={clsx(
                                            'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                                            k.alert ? 'bg-red-100' : 'bg-primary/10'
                                        )}>
                                            <k.icon className={clsx('w-5 h-5', k.alert ? 'text-red-600' : 'text-primary')} />
                                        </div>
                                        <p className={clsx('text-2xl font-black mb-1', k.alert ? 'text-red-600' : 'text-foreground')}>{k.value}</p>
                                        <p className="text-sm font-semibold text-foreground">{k.label}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Per-seller table */}
                            <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-border">
                                    <h2 className="text-sm font-black text-foreground uppercase tracking-widest">Desempeño por asesor</h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-muted/50 border-b border-border">
                                                {['Asesor', 'Clientes', 'Nuevos', 'Sin contactar', '% sin contacto', '1ª resp. (días)', '2ª / 3ª (días)', 'Cotiz.', 'Valor cotizado', 'Sin seguim.', 'Lead→Cotiz (días)', 'Cerrados', 'Valor cerrado', 'Cotiz→Cierre (días)', 'Base fría'].map((h) => (
                                                    <th key={h} className="text-left px-3 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.perSeller.map((s) => (
                                                <tr key={s.sellerId} className="border-b border-border hover:bg-muted/30 transition-colors">
                                                    <td className="px-3 py-3 font-bold text-foreground whitespace-nowrap">{s.sellerName}</td>
                                                    <td className="px-3 py-3">{s.totalClients}</td>
                                                    <td className="px-3 py-3">{s.newClientsInRange}</td>
                                                    <td className="px-3 py-3">{s.neverContacted}</td>
                                                    <td className={clsx('px-3 py-3 font-bold', s.pctNeverContacted >= 50 ? 'text-red-600' : s.pctNeverContacted >= 25 ? 'text-amber-600' : 'text-emerald-600')}>
                                                        {s.pctNeverContacted}%
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap" title="Días desde la asignación hasta el primer contacto registrado (bitácora); 'aprox' usa el histórico de último contacto">
                                                        {s.avgFirstResponseDays !== null
                                                            ? s.avgFirstResponseDays
                                                            : s.avgFirstResponseApproxDays !== null
                                                                ? `${s.avgFirstResponseApproxDays} aprox.`
                                                                : '—'}
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap" title="Días hasta el 2º y 3º contacto registrado">
                                                        {s.avgSecondContactDays ?? '—'} / {s.avgThirdContactDays ?? '—'}
                                                    </td>
                                                    <td className="px-3 py-3">{s.quotesInRange}</td>
                                                    <td className="px-3 py-3 whitespace-nowrap">{money(s.quotesValueInRange)}</td>
                                                    <td className={clsx('px-3 py-3 font-bold', s.quotesNoFollowUp > 0 ? 'text-red-600' : 'text-foreground')}>{s.quotesNoFollowUp}</td>
                                                    <td className="px-3 py-3">{s.avgDaysLeadToQuote ?? '—'}</td>
                                                    <td className="px-3 py-3">{s.closedInRange}</td>
                                                    <td className="px-3 py-3 whitespace-nowrap">{money(s.closedValueInRange)}</td>
                                                    <td className="px-3 py-3">{s.avgCycleDays ?? '—'}</td>
                                                    <td className="px-3 py-3 whitespace-nowrap">
                                                        {s.rawContactedInRange} cont.
                                                        {s.rawPendingAssigned > 0 && (
                                                            <span className="text-amber-600 font-bold"> · {s.rawPendingAssigned} pend.</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Abandoned quotes */}
                            <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-600" />
                                    <h2 className="text-sm font-black text-foreground uppercase tracking-widest">
                                        Cotizaciones sin seguimiento ({result.abandonedQuotes.length})
                                    </h2>
                                </div>
                                {result.abandonedQuotes.length === 0 ? (
                                    <p className="px-5 py-10 text-center text-sm font-bold text-muted-foreground uppercase tracking-widest">
                                        Todas las cotizaciones del periodo tienen seguimiento 🎉
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-muted/50 border-b border-border">
                                                    {['Cotización', 'Asesor', 'Cliente', 'Valor', 'Enviada', 'Días sin seguimiento'].map((h) => (
                                                        <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {result.abandonedQuotes.map((q) => (
                                                    <tr key={q.number + q.sentAt} className="border-b border-border hover:bg-muted/30 transition-colors">
                                                        <td className="px-4 py-3 font-mono font-bold text-foreground whitespace-nowrap">{q.number}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap">{q.sellerName}</td>
                                                        <td className="px-4 py-3">{q.clientName}</td>
                                                        <td className="px-4 py-3 font-bold whitespace-nowrap">{money(q.value)}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap">{q.sentAt}</td>
                                                        <td className="px-4 py-3 font-bold text-red-600">{q.daysSinceSent}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Embudo comercial + tendencia mensual */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
                                    <div className="px-5 py-4 border-b border-border">
                                        <h2 className="text-sm font-black text-foreground uppercase tracking-widest">Embudo comercial</h2>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Ticket promedio cotizado: <span className="font-bold text-foreground">{money(result.avgTicket)}</span>
                                        </p>
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-muted/50 border-b border-border">
                                                {['Etapa', 'Clientes', 'vs. cartera', 'vs. etapa anterior'].map((h) => (
                                                    <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const f = result.funnel;
                                                const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—');
                                                const steps = [
                                                    { label: 'Cartera total', n: f.clients, prev: f.clients },
                                                    { label: 'Contactados', n: f.contacted, prev: f.clients },
                                                    { label: 'Con cotización (periodo)', n: f.quotedClients, prev: f.contacted },
                                                    { label: 'Negocio cerrado (periodo)', n: f.closed, prev: f.quotedClients },
                                                ];
                                                return steps.map((s, i) => (
                                                    <tr key={s.label} className="border-b border-border">
                                                        <td className="px-4 py-3 font-semibold text-foreground">{s.label}</td>
                                                        <td className="px-4 py-3 font-bold">{s.n}</td>
                                                        <td className="px-4 py-3">{pct(s.n, f.clients)}</td>
                                                        <td className="px-4 py-3">{i === 0 ? '—' : pct(s.n, s.prev)}</td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
                                    <div className="px-5 py-4 border-b border-border">
                                        <h2 className="text-sm font-black text-foreground uppercase tracking-widest">Cotización por mes</h2>
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-muted/50 border-b border-border">
                                                {['Mes', 'Cotizaciones', 'Valor'].map((h) => (
                                                    <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.monthly.length === 0 ? (
                                                <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">Sin cotizaciones en el periodo</td></tr>
                                            ) : result.monthly.map((m) => (
                                                <tr key={m.month} className="border-b border-border">
                                                    <td className="px-4 py-3 font-semibold text-foreground">{m.month}</td>
                                                    <td className="px-4 py-3">{m.quotes}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap">{money(m.value)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Anexos: detalle clickeable por asesor */}
                            {([
                                { key: 'contactedClients', title: 'Clientes contactados', icon: Users, empty: 'Sin clientes contactados' },
                                { key: 'neverContactedClients', title: 'Clientes NUNCA contactados', icon: PhoneOff, empty: 'Todos los clientes fueron contactados 🎉' },
                            ] as const).map((annex) => {
                                const grandTotal = result.perSeller.reduce((a, s) => a + s[annex.key].length, 0);
                                return (
                                    <div key={annex.key} className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
                                        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                                            <annex.icon className={clsx('w-4 h-4', annex.key === 'neverContactedClients' ? 'text-red-600' : 'text-primary')} />
                                            <h2 className="text-sm font-black text-foreground uppercase tracking-widest">
                                                {annex.title} ({grandTotal}) — click en el cliente abre su hoja de vida
                                            </h2>
                                        </div>
                                        {grandTotal === 0 ? (
                                            <p className="px-5 py-8 text-center text-sm font-bold text-muted-foreground uppercase tracking-widest">{annex.empty}</p>
                                        ) : (
                                            <div className="divide-y divide-border">
                                                {result.perSeller.filter((s) => s[annex.key].length > 0).map((s) => (
                                                    <details key={s.sellerId} className="group">
                                                        <summary className="px-5 py-3 cursor-pointer flex items-center justify-between hover:bg-muted/30 transition-colors list-none">
                                                            <span className="font-bold text-foreground text-sm">{s.sellerName}</span>
                                                            <span className={clsx(
                                                                'text-xs font-bold px-2.5 py-1 rounded-full',
                                                                annex.key === 'neverContactedClients' ? 'bg-red-50 text-red-600' : 'bg-primary/10 text-foreground'
                                                            )}>
                                                                {s[annex.key].length} clientes
                                                            </span>
                                                        </summary>
                                                        <div className="overflow-x-auto border-t border-border">
                                                            <table className="w-full text-sm">
                                                                <thead>
                                                                    <tr className="bg-muted/50 border-b border-border">
                                                                        {['Cliente', 'Empresa', annex.key === 'neverContactedClients' ? 'Días esperando' : 'Último contacto', 'Contactos', 'Notas', 'Cotiz.', 'Valor cotizado'].map((h) => (
                                                                            <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {s[annex.key].map((c) => (
                                                                        <tr key={c.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                                                                            <td className="px-4 py-2.5">
                                                                                <Link href={`/leads/${c.id}`} target="_blank" className="font-semibold text-sky-600 hover:underline">
                                                                                    {c.name}
                                                                                </Link>
                                                                            </td>
                                                                            <td className="px-4 py-2.5 text-muted-foreground">{c.company || '—'}</td>
                                                                            <td className={clsx('px-4 py-2.5', annex.key === 'neverContactedClients' && c.daysWaiting > 30 && 'text-red-600 font-bold')}>
                                                                                {annex.key === 'neverContactedClients' ? `${c.daysWaiting} días` : c.lastContact}
                                                                            </td>
                                                                            <td className="px-4 py-2.5" title="Contactos registrados en la bitácora (WhatsApp, llamada, correo, nota)">{c.contacts || '—'}</td>
                                                                            <td className="px-4 py-2.5" title="Anotaciones en la hoja de vida">{c.notes || '—'}</td>
                                                                            <td className="px-4 py-2.5">{c.quotes || '—'}</td>
                                                                            <td className="px-4 py-2.5 whitespace-nowrap">{c.quotesValue ? money(c.quotesValue) : '—'}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </details>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Methodology notes */}
                            <div className="bg-muted border border-border rounded-2xl p-4 space-y-1">
                                {result.notes.map((n, i) => (
                                    <p key={i} className="text-xs text-muted-foreground">• {n}</p>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </PermissionGate>
    );
}
