"use client";

import React, { useMemo, useState } from 'react';
import {
    Trophy,
    Award,
    Clock,
    LogIn,
    LogOut,
    Users as UsersIcon,
    Phone,
    MessageCircle,
    FileText,
    Calendar,
    TrendingUp,
    Send,
    Activity,
    Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import {
    aggregateSellerActivity,
    computeTotals,
    getPresetRange,
    formatTimeBogota,
    formatCOP,
    type PeriodPreset,
    type SellerActivity,
} from '@/lib/seller-activity';

const PRESET_LABELS: Record<Exclude<PeriodPreset, 'custom'>, string> = {
    today: 'Hoy',
    week: 'Últimos 7 días',
    month: 'Últimos 30 días',
};

export default function PerformancePage() {
    const { sellers, clients, quotes, auditLogs, events, currentUser, addNotification } = useApp();
    const router = useRouter();
    // ⚠️ GUARD: Rendimiento del equipo es SOLO para SuperAdmin/Admin — nunca Manager ni Vendedor.
    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';

    // Hard redirect si alguien más entra por URL directa
    React.useEffect(() => {
        if (currentUser && !isSuperAdmin) router.replace('/');
    }, [currentUser, isSuperAdmin, router]);

    const canSee = isSuperAdmin;

    const [preset, setPreset] = useState<PeriodPreset>('today');
    const [customFrom, setCustomFrom] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [customTo, setCustomTo] = useState(() => new Date().toISOString().split('T')[0]);
    const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
    const [sendingEmail, setSendingEmail] = useState(false);

    const { from, to } = useMemo(() => {
        if (preset === 'custom') {
            const f = new Date(customFrom + 'T00:00:00-05:00');
            const t = new Date(customTo + 'T23:59:59-05:00');
            return { from: f, to: t };
        }
        return getPresetRange(preset);
    }, [preset, customFrom, customTo]);

    const activities = useMemo(
        () =>
            aggregateSellerActivity({
                sellers,
                clients,
                quotes,
                auditLogs,
                events,
                from,
                to,
            }),
        [sellers, clients, quotes, auditLogs, events, from, to]
    );

    const totals = useMemo(() => computeTotals(activities), [activities]);

    const ranking = useMemo(
        () => [...activities].sort((a, b) => b.score - a.score),
        [activities]
    );

    const topThree = ranking.slice(0, 3);
    const selected = selectedSellerId
        ? activities.find((a) => a.seller.id === selectedSellerId)
        : null;

    if (!canSee) {
        return (
            <div className="p-12 text-center">
                <p className="text-sm font-bold text-rose-600">Acceso restringido — solo disponible para administradores.</p>
            </div>
        );
    }

    const handleSendReport = async () => {
        setSendingEmail(true);
        try {
            // Reuse the daily-report endpoint — sends real report for today to current user
            const res = await fetch('/api/daily-report/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    demo: false,
                    extraEmails: [currentUser?.email].filter(Boolean),
                }),
            });
            const data = await res.json();
            if (res.ok) {
                addNotification({
                    title: '📧 Informe enviado',
                    description: `Correo enviado a ${data.sentTo?.join(', ') || 'tu email'}`,
                    type: 'success',
                });
            } else {
                addNotification({
                    title: 'Error enviando informe',
                    description: data.error || 'Revisa configuración',
                    type: 'alert',
                });
            }
        } finally {
            setSendingEmail(false);
        }
    };

    const fmtRange = () => {
        if (preset === 'custom') return `${customFrom} → ${customTo}`;
        return PRESET_LABELS[preset as Exclude<PeriodPreset, 'custom'>];
    };

    return (
        <div className="p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
                        <Trophy className="w-7 h-7 text-primary" />
                        Rendimiento del Equipo
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Actividad, ranking y KPIs por vendedor · <strong>{fmtRange()}</strong>
                    </p>
                </div>
                <button
                    onClick={handleSendReport}
                    disabled={sendingEmail}
                    className="bg-primary text-black font-black rounded-xl px-5 py-3 hover:opacity-90 transition-opacity text-sm flex items-center gap-2 disabled:opacity-50 shrink-0"
                >
                    {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Enviarme el informe por email
                </button>
            </div>

            {/* ── Selector de periodo ────────────────────────────────────── */}
            <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    {(['today', 'week', 'month'] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPreset(p)}
                            className={clsx(
                                'px-4 py-2 rounded-xl text-sm font-black transition-all',
                                preset === p
                                    ? 'bg-primary text-black'
                                    : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-foreground'
                            )}
                        >
                            {PRESET_LABELS[p]}
                        </button>
                    ))}
                    <button
                        onClick={() => setPreset('custom')}
                        className={clsx(
                            'px-4 py-2 rounded-xl text-sm font-black transition-all',
                            preset === 'custom'
                                ? 'bg-primary text-black'
                                : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-foreground'
                        )}
                    >
                        Personalizado
                    </button>
                    {preset === 'custom' && (
                        <div className="flex items-center gap-2 ml-2 flex-wrap">
                            <input
                                type="date"
                                value={customFrom}
                                onChange={(e) => setCustomFrom(e.target.value)}
                                className="bg-muted border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary"
                            />
                            <span className="text-muted-foreground text-xs">→</span>
                            <input
                                type="date"
                                value={customTo}
                                onChange={(e) => setCustomTo(e.target.value)}
                                className="bg-muted border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* ── KPIs globales ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <KpiCard icon={LogIn}     value={totals.activeSellers}   label="Activos"       color="emerald" />
                <KpiCard icon={LogOut}    value={totals.silentSellers}   label="Sin login"     color="rose" />
                <KpiCard icon={UsersIcon} value={totals.clientsAdded + totals.leadsCreated} label="Nuevos"    color="amber" />
                <KpiCard icon={Phone}     value={totals.callsMade}       label="Llamadas"      color="emerald" />
                <KpiCard icon={MessageCircle} value={totals.whatsapps}   label="WhatsApp"      color="green" />
                <KpiCard icon={FileText}  value={totals.quotesSent}      label="Cotizaciones"  color="slate" />
            </div>

            {totals.revenue > 0 && (
                <div className="bg-gradient-to-br from-[#1a1a1d] to-[#2a2a2d] rounded-2xl p-5 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-black text-primary uppercase tracking-widest">Valor total cotizado</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Suma de todas las cotizaciones enviadas en el periodo</div>
                    </div>
                    <div className="text-3xl font-black text-primary tracking-tight">{formatCOP(totals.revenue)}</div>
                </div>
            )}

            {/* ── Podio Top 3 ─────────────────────────────────────────────── */}
            {topThree.length > 0 && (
                <div>
                    <h2 className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-primary" />
                        Top vendedores del periodo
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {topThree.map((act, idx) => (
                            <PodiumCard
                                key={act.seller.id}
                                activity={act}
                                rank={idx + 1}
                                onClick={() => setSelectedSellerId(act.seller.id)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* ── Ranking completo ───────────────────────────────────────── */}
            <div>
                <h2 className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    Ranking completo ({ranking.length})
                </h2>
                <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-muted border-b border-border">
                                <th className="p-3 text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest">#</th>
                                <th className="p-3 text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest">Vendedor</th>
                                <th className="p-3 text-center text-[10px] font-black text-muted-foreground uppercase tracking-widest hidden md:table-cell">Entrada</th>
                                <th className="p-3 text-center text-[10px] font-black text-muted-foreground uppercase tracking-widest hidden md:table-cell">Salida</th>
                                <th className="p-3 text-center text-[10px] font-black text-muted-foreground uppercase tracking-widest">Clientes</th>
                                <th className="p-3 text-center text-[10px] font-black text-muted-foreground uppercase tracking-widest">Llam.</th>
                                <th className="p-3 text-center text-[10px] font-black text-muted-foreground uppercase tracking-widest">WA</th>
                                <th className="p-3 text-center text-[10px] font-black text-muted-foreground uppercase tracking-widest">Cotiz.</th>
                                <th className="p-3 text-right text-[10px] font-black text-muted-foreground uppercase tracking-widest hidden lg:table-cell">$ Cotizado</th>
                                <th className="p-3 text-right text-[10px] font-black text-muted-foreground uppercase tracking-widest">Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ranking.map((act, idx) => (
                                <tr
                                    key={act.seller.id}
                                    onClick={() => setSelectedSellerId(act.seller.id)}
                                    className={clsx(
                                        'border-b border-border last:border-0 cursor-pointer hover:bg-primary/5 transition-colors',
                                        idx === 0 && 'bg-amber-50/50'
                                    )}
                                >
                                    <td className="p-3 font-black text-foreground">
                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                                    </td>
                                    <td className="p-3">
                                        <div className="text-sm font-bold text-foreground">{act.seller.name}</div>
                                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{act.seller.role}</div>
                                    </td>
                                    <td className="p-3 text-center text-sm text-foreground hidden md:table-cell">{formatTimeBogota(act.firstLogin)}</td>
                                    <td className="p-3 text-center text-sm text-foreground hidden md:table-cell">{formatTimeBogota(act.lastLogout)}</td>
                                    <td className="p-3 text-center">
                                        <span className="inline-flex items-center justify-center min-w-[24px] bg-amber-500/10 text-amber-700 rounded-lg px-2 py-0.5 text-xs font-black">
                                            {act.clientsAdded.length + act.leadsCreated.length}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className="inline-flex items-center justify-center min-w-[24px] bg-emerald-500/10 text-emerald-700 rounded-lg px-2 py-0.5 text-xs font-black">
                                            {act.callsMade.length}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className="inline-flex items-center justify-center min-w-[24px] bg-green-500/10 text-green-700 rounded-lg px-2 py-0.5 text-xs font-black">
                                            {act.whatsappsSent.length}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className="inline-flex items-center justify-center min-w-[24px] bg-slate-500/10 text-slate-700 rounded-lg px-2 py-0.5 text-xs font-black">
                                            {act.quotesSent.length}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right text-sm font-black text-foreground hidden lg:table-cell">
                                        {act.totalRevenue > 0 ? formatCOP(act.totalRevenue) : '—'}
                                    </td>
                                    <td className="p-3 text-right">
                                        <span className="text-sm font-black text-primary">{act.score}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Modal de detalle ──────────────────────────────────────── */}
            {selected && (
                <div
                    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in"
                    onClick={() => setSelectedSellerId(null)}
                >
                    <div
                        className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <SellerDetail activity={selected} onClose={() => setSelectedSellerId(null)} />
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
    icon: Icon,
    value,
    label,
    color,
}: {
    icon: React.ComponentType<{ className?: string }>;
    value: number;
    label: string;
    color: 'emerald' | 'rose' | 'amber' | 'green' | 'slate';
}) {
    const colorMap = {
        emerald: 'text-emerald-600 bg-emerald-500/10',
        rose: 'text-rose-600 bg-rose-500/10',
        amber: 'text-amber-600 bg-amber-500/10',
        green: 'text-green-600 bg-green-500/10',
        slate: 'text-slate-700 bg-slate-500/10',
    }[color];
    return (
        <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
            <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center mb-2', colorMap)}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-foreground tracking-tight">{value}</div>
            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">{label}</div>
        </div>
    );
}

function PodiumCard({
    activity,
    rank,
    onClick,
}: {
    activity: SellerActivity;
    rank: number;
    onClick: () => void;
}) {
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
    const border =
        rank === 1
            ? 'border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-50'
            : rank === 2
            ? 'border-slate-300 bg-gradient-to-br from-slate-50 to-gray-50'
            : 'border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50';
    return (
        <button
            onClick={onClick}
            className={clsx(
                'text-left border-2 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all',
                border
            )}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="text-3xl">{medal}</div>
                <div className="bg-black/5 rounded-lg px-2 py-1">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Score</span>
                    <div className="text-lg font-black text-foreground text-right leading-none">{activity.score}</div>
                </div>
            </div>
            <div className="text-base font-black text-foreground tracking-tight truncate">{activity.seller.name}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">{activity.seller.role}</div>
            <div className="grid grid-cols-3 gap-1 text-center">
                <MiniStat value={activity.clientsAdded.length + activity.leadsCreated.length} label="Nuevos" />
                <MiniStat value={activity.callsMade.length + activity.whatsappsSent.length} label="Contactos" />
                <MiniStat value={activity.quotesSent.length} label="Cotiz." />
            </div>
            {activity.totalRevenue > 0 && (
                <div className="mt-3 pt-3 border-t border-black/5 text-center">
                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Valor cotizado</div>
                    <div className="text-base font-black text-foreground">{formatCOP(activity.totalRevenue)}</div>
                </div>
            )}
        </button>
    );
}

function MiniStat({ value, label }: { value: number; label: string }) {
    return (
        <div>
            <div className="text-xl font-black text-foreground leading-none">{value}</div>
            <div className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mt-1">{label}</div>
        </div>
    );
}

function SellerDetail({ activity, onClose }: { activity: SellerActivity; onClose: () => void }) {
    const a = activity;
    return (
        <>
            <div className="bg-gradient-to-br from-[#1a1a1d] to-[#2a2a2d] p-6 rounded-t-3xl">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <div className="text-xl font-black text-white">{a.seller.name}</div>
                        <div className="text-[10px] font-black text-primary uppercase tracking-widest mt-1">{a.seller.role}</div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-white transition-colors text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10"
                    >
                        ×
                    </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/5 rounded-xl p-3 text-center">
                        <Clock className="w-4 h-4 text-primary mx-auto mb-1" />
                        <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Entrada</div>
                        <div className="text-base font-black text-white mt-1">{formatTimeBogota(a.firstLogin)}</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-center">
                        <Clock className="w-4 h-4 text-primary mx-auto mb-1" />
                        <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Salida</div>
                        <div className="text-base font-black text-white mt-1">{formatTimeBogota(a.lastLogout)}</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-center">
                        <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
                        <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Sesiones</div>
                        <div className="text-base font-black text-white mt-1">{a.loginCount}</div>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-5">
                {/* KPIs */}
                <div className="grid grid-cols-5 gap-2">
                    <DetailKpi value={a.clientsAdded.length} label="Clientes" color="text-amber-600" />
                    <DetailKpi value={a.leadsCreated.length} label="Leads" color="text-orange-600" />
                    <DetailKpi value={a.callsMade.length} label="Llamadas" color="text-emerald-600" />
                    <DetailKpi value={a.whatsappsSent.length} label="WhatsApp" color="text-green-600" />
                    <DetailKpi value={a.quotesSent.length} label="Cotiz." color="text-slate-700" />
                </div>

                {a.totalRevenue > 0 && (
                    <div className="bg-primary/5 border-l-4 border-primary rounded-r-xl p-4">
                        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Valor total cotizado</div>
                        <div className="text-2xl font-black text-primary mt-1">{formatCOP(a.totalRevenue)}</div>
                    </div>
                )}

                {/* Listas */}
                {[...a.clientsAdded, ...a.leadsCreated].length > 0 && (
                    <DetailSection title="Clientes / Leads registrados" icon={UsersIcon}>
                        <ul className="divide-y divide-border">
                            {[...a.clientsAdded, ...a.leadsCreated].map((c) => (
                                <li key={c.id} className="py-2 text-sm flex items-center justify-between">
                                    <div>
                                        <span className="font-bold text-foreground">{c.name}</span>
                                        {c.company && <span className="text-muted-foreground"> · {c.company}</span>}
                                        {c.city && <span className="text-[10px] text-muted-foreground ml-1">· {c.city}</span>}
                                    </div>
                                    <span className={clsx(
                                        'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full',
                                        c.status === 'Lead' ? 'bg-orange-500/10 text-orange-700' : 'bg-emerald-500/10 text-emerald-700'
                                    )}>
                                        {c.status}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </DetailSection>
                )}

                {a.quotesSent.length > 0 && (
                    <DetailSection title="Cotizaciones enviadas" icon={FileText}>
                        <ul className="divide-y divide-border">
                            {a.quotesSent.map((q) => (
                                <li key={q.id} className="py-2 text-sm flex items-center justify-between">
                                    <div>
                                        <span className="font-black text-primary">{q.quoteNumber || q.number}</span>
                                        <span className="text-muted-foreground"> · {q.client}</span>
                                    </div>
                                    <span className="font-black text-foreground">{q.total}</span>
                                </li>
                            ))}
                        </ul>
                    </DetailSection>
                )}

                {[...a.callsMade, ...a.whatsappsSent].length > 0 && (
                    <DetailSection title="Contactos realizados" icon={Phone}>
                        <ul className="divide-y divide-border">
                            {[...a.callsMade, ...a.whatsappsSent]
                                .sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime())
                                .map((l) => (
                                    <li key={l.id} className="py-2 text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-muted-foreground font-black">
                                                {new Date(l.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })}
                                            </span>
                                            <span>{l.action === 'CALL_MADE' ? '📞' : '💬'}</span>
                                            <span className="font-bold">{l.targetName || 'contacto'}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground ml-12 mt-0.5">{l.details}</div>
                                    </li>
                                ))}
                        </ul>
                    </DetailSection>
                )}

                {a.eventsInRange.length > 0 && (
                    <DetailSection title="Agenda" icon={Calendar}>
                        <ul className="divide-y divide-border">
                            {a.eventsInRange.map((e) => (
                                <li key={e.id} className="py-2 text-sm flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] text-muted-foreground font-black">{e.date} {e.time}</span>
                                        <span className="ml-2 font-bold">{e.title}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">{e.client}</span>
                                </li>
                            ))}
                        </ul>
                    </DetailSection>
                )}

                {!a.firstLogin &&
                    a.clientsAdded.length === 0 &&
                    a.leadsCreated.length === 0 &&
                    a.callsMade.length === 0 &&
                    a.whatsappsSent.length === 0 &&
                    a.quotesSent.length === 0 && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center">
                            <p className="text-sm font-bold text-rose-700">Este vendedor no registró actividad en el periodo seleccionado.</p>
                        </div>
                    )}
            </div>
        </>
    );
}

function DetailKpi({ value, label, color }: { value: number; label: string; color: string }) {
    return (
        <div className="bg-muted rounded-xl p-3 text-center">
            <div className={clsx('text-xl font-black leading-none', color)}>{value}</div>
            <div className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mt-1">{label}</div>
        </div>
    );
}

function DetailSection({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                <Icon className="w-3.5 h-3.5" />
                {title}
            </h3>
            <div className="bg-muted/50 border border-border rounded-xl px-4">
                {children}
            </div>
        </div>
    );
}
