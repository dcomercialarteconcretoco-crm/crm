"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    Eye,
    EyeOff,
    Plus,
    ArrowLeft,
    AlertTriangle,
    Loader2,
    Timer,
    FileText,
    Trophy,
    X,
    Save,
    Bell,
    Link2,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PermissionGate } from '@/components/PermissionGate';
import { clsx } from 'clsx';

// ── Catálogo del plan de cliente oculto (URB, jul-2026) ─────────────────────
const PROFILES: Record<string, string> = {
    P1: 'P1 · Arquitecto / constructor privado',
    P2: 'P2 · Administrador de PH / conjunto',
    P3: 'P3 · Comprador corporativo',
    P4: 'P4 · Gestor espacio público / contratista',
    P5: 'P5 · Cliente final premium',
};
const CHANNELS: Record<string, string> = {
    web: 'Formulario web',
    whatsapp: 'WhatsApp',
    tel: 'Llamada telefónica',
    dm: 'DM Instagram/Facebook',
    email: 'Correo electrónico',
};

type RubricItem = { key: string; label: string; max: number };
type Touch = { date: string; channel: string; content: string };
type Mission = {
    id: string;
    code: string;
    profile: string;
    channel: string;
    alias_name: string;
    alias_company: string | null;
    alias_phone: string | null;
    alias_email: string | null;
    status: string;
    contact_at: string | null;
    first_response_at: string | null;
    quote_at: string | null;
    quote_format: string | null;
    attended_by: string | null;
    scores: Record<string, number>;
    touches: Touch[];
    notes: string | null;
    tprHours: number | null;
    quoteHours: number | null;
    touchesCount: number;
    totalScore: number | null;
    crm: {
        clientId: string;
        clientName: string;
        assignedTo: string | null;
        lastContact: string | null;
        contactEvents: number;
        quotes: number;
        quotesValue: number;
    } | null;
    alerts: Array<{ code: string; severity: 'high' | 'medium'; text: string }>;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    planned: { label: 'Planeada', cls: 'bg-muted text-muted-foreground' },
    active: { label: 'En curso', cls: 'bg-sky-500/10 text-sky-600' },
    waiting: { label: 'Ventana 7 días', cls: 'bg-amber-500/10 text-amber-600' },
    completed: { label: 'Completada', cls: 'bg-emerald-500/10 text-emerald-600' },
};

function classify(score: number): { label: string; cls: string } {
    if (score >= 85) return { label: 'Excelente', cls: 'text-emerald-600' };
    if (score >= 70) return { label: 'Bueno', cls: 'text-sky-600' };
    if (score >= 50) return { label: 'Regular', cls: 'text-amber-600' };
    return { label: 'Crítico', cls: 'text-red-600' };
}

const nowLocal = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
};

export default function MysteryShopperPage() {
    const { currentUser, isHydrating, addNotification } = useApp();
    const canSee = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin' || currentUser?.role === 'Auditor';

    const [missions, setMissions] = useState<Mission[]>([]);
    const [rubric, setRubric] = useState<RubricItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNew, setShowNew] = useState(false);
    const [selected, setSelected] = useState<Mission | null>(null);
    const [saving, setSaving] = useState(false);
    const [newForm, setNewForm] = useState({
        profile: 'P1', channel: 'whatsapp', aliasName: '', aliasCompany: '',
        aliasPhone: '', aliasEmail: '', contactAt: '', notes: '',
    });

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/mystery');
            const data = await res.json();
            if (res.ok) {
                setMissions(data.missions || []);
                setRubric(data.rubric || []);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (canSee) load(); }, [canSee, load]);

    const allAlerts = useMemo(
        () => missions.flatMap((m) => m.alerts.map((a) => ({ ...a, mission: m }))),
        [missions]
    );
    const scored = missions.filter((m) => m.totalScore !== null);
    const avgScore = scored.length ? Math.round(scored.reduce((a, m) => a + (m.totalScore || 0), 0) / scored.length) : null;
    const withTpr = missions.filter((m) => m.tprHours !== null);
    const avgTpr = withTpr.length ? Math.round((withTpr.reduce((a, m) => a + (m.tprHours || 0), 0) / withTpr.length) * 10) / 10 : null;

    const createMission = async () => {
        if (!newForm.aliasName.trim()) return;
        setSaving(true);
        try {
            const res = await fetch('/api/mystery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newForm,
                    contactAt: newForm.contactAt ? new Date(newForm.contactAt).toISOString() : undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            addNotification({ title: 'Misión creada', description: `Código ${data.code}`, type: 'success' });
            setShowNew(false);
            setNewForm({ profile: 'P1', channel: 'whatsapp', aliasName: '', aliasCompany: '', aliasPhone: '', aliasEmail: '', contactAt: '', notes: '' });
            load();
        } catch (e) {
            addNotification({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo crear.', type: 'alert' });
        } finally {
            setSaving(false);
        }
    };

    const patchMission = async (id: string, patch: Record<string, unknown>) => {
        setSaving(true);
        try {
            const res = await fetch('/api/mystery', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...patch }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            await load();
        } catch (e) {
            addNotification({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo guardar.', type: 'alert' });
        } finally {
            setSaving(false);
        }
    };

    if (isHydrating) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <PermissionGate require="audit.view">
            {!canSee ? (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                    <EyeOff className="w-12 h-12 text-rose-400 mb-4" />
                    <h2 className="text-xl font-black text-foreground mb-2">Acceso restringido</h2>
                    <p className="text-sm text-muted-foreground max-w-sm">Este módulo es exclusivo de auditores y administradores.</p>
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-violet-600/10 flex items-center justify-center">
                                    <Eye className="w-5 h-5 text-violet-600" />
                                </div>
                                <h1 className="text-2xl font-black text-foreground tracking-tight">Cliente Oculto</h1>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                Misiones de evaluación encubierta · cruce automático contra el CRM · confidencial — los vendedores no ven este módulo
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link href="/audit" className="flex items-center gap-2 bg-white border border-border text-foreground font-semibold rounded-xl px-4 py-2.5 hover:bg-muted transition-all text-sm">
                                <ArrowLeft className="w-4 h-4" /> Auditoría
                            </Link>
                            <button
                                onClick={() => setShowNew(true)}
                                className="bg-violet-600 text-white font-bold rounded-xl px-5 py-2.5 hover:brightness-110 transition-all flex items-center gap-2 text-sm"
                            >
                                <Plus className="w-4 h-4" /> Nueva Misión
                            </button>
                        </div>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Misiones', value: String(missions.length), sub: `${missions.filter((m) => m.status !== 'completed').length} activas`, icon: Eye, alert: false },
                            { label: 'Avisos de incógnito', value: String(allAlerts.length), sub: `${allAlerts.filter((a) => a.severity === 'high').length} críticos`, icon: Bell, alert: allAlerts.length > 0 },
                            { label: 'TPR promedio', value: avgTpr !== null ? `${avgTpr}h` : '—', sub: 'meta: <1h laboral', icon: Timer, alert: avgTpr !== null && avgTpr > 1 },
                            { label: 'Score promedio', value: avgScore !== null ? `${avgScore}/100` : '—', sub: avgScore !== null ? classify(avgScore).label : 'sin misiones puntuadas', icon: Trophy, alert: avgScore !== null && avgScore < 50 },
                        ].map((k) => (
                            <div key={k.label} className={clsx('rounded-2xl p-5 border shadow-sm', k.alert ? 'bg-red-50 border-red-200' : 'bg-white border-border')}>
                                <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center mb-3', k.alert ? 'bg-red-100' : 'bg-violet-600/10')}>
                                    <k.icon className={clsx('w-5 h-5', k.alert ? 'text-red-600' : 'text-violet-600')} />
                                </div>
                                <p className={clsx('text-2xl font-black mb-1', k.alert ? 'text-red-600' : 'text-foreground')}>{k.value}</p>
                                <p className="text-sm font-semibold text-foreground">{k.label}</p>
                                <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* Avisos de incógnito */}
                    {allAlerts.length > 0 && (
                        <div className="bg-white border border-red-200 rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-red-200 bg-red-50 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                                <h2 className="text-sm font-black text-red-700 uppercase tracking-widest">Avisos de incógnito — el sistema detectó esto solo</h2>
                            </div>
                            <div className="divide-y divide-border">
                                {allAlerts.map((a, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setSelected(a.mission)}
                                        className="w-full text-left px-5 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors"
                                    >
                                        <span className={clsx('mt-0.5 w-2 h-2 rounded-full shrink-0', a.severity === 'high' ? 'bg-red-600 animate-pulse' : 'bg-amber-500')} />
                                        <div>
                                            <p className="text-sm text-foreground">
                                                <span className="font-bold">{a.mission.code}</span> · {PROFILES[a.mission.profile]?.split('·')[1] || a.mission.profile} · {CHANNELS[a.mission.channel] || a.mission.channel}
                                            </p>
                                            <p className="text-sm text-muted-foreground">{a.text}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Misiones */}
                    <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-border">
                            <h2 className="text-sm font-black text-foreground uppercase tracking-widest">Misiones ({missions.length})</h2>
                        </div>
                        {loading ? (
                            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>
                        ) : missions.length === 0 ? (
                            <div className="py-16 text-center">
                                <Eye className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                                <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground/40">Crea la primera misión de cliente oculto</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-muted/50 border-b border-border">
                                            {['Código', 'Perfil', 'Canal', 'Alias', 'Contacto', 'TPR', 'Cotización', 'Toques', 'CRM', 'Score', 'Estado', 'Avisos'].map((h) => (
                                                <th key={h} className="text-left px-3 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {missions.map((m) => (
                                            <tr key={m.id} onClick={() => setSelected(m)} className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
                                                <td className="px-3 py-3 font-mono font-bold text-foreground whitespace-nowrap">{m.code}</td>
                                                <td className="px-3 py-3 whitespace-nowrap">{m.profile}</td>
                                                <td className="px-3 py-3 whitespace-nowrap">{CHANNELS[m.channel] || m.channel}</td>
                                                <td className="px-3 py-3 whitespace-nowrap font-semibold">{m.alias_name}</td>
                                                <td className="px-3 py-3 whitespace-nowrap">{m.contact_at ? new Date(m.contact_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                                <td className={clsx('px-3 py-3 font-bold whitespace-nowrap', m.tprHours === null ? '' : m.tprHours <= 1 ? 'text-emerald-600' : 'text-red-600')}>
                                                    {m.tprHours !== null ? `${m.tprHours}h` : '—'}
                                                </td>
                                                <td className={clsx('px-3 py-3 whitespace-nowrap', m.quoteHours !== null && m.quoteHours > 48 && 'text-red-600 font-bold')}>
                                                    {m.quoteHours !== null ? `${Math.round(m.quoteHours)}h` : m.quote_at ? 'sí' : '—'}
                                                </td>
                                                <td className="px-3 py-3">{m.touchesCount}</td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    {m.crm ? (
                                                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-xs">
                                                            <Link2 className="w-3 h-3" /> {m.crm.assignedTo?.split(' ')[0] || 'sin asignar'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">no aparece</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    {m.totalScore !== null ? (
                                                        <span className={clsx('font-black', classify(m.totalScore).cls)}>{m.totalScore}/100</span>
                                                    ) : '—'}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs font-bold', (STATUS_LABEL[m.status] || STATUS_LABEL.planned).cls)}>
                                                        {(STATUS_LABEL[m.status] || STATUS_LABEL.planned).label}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    {m.alerts.length > 0 && (
                                                        <span className="inline-flex items-center gap-1 text-red-600 font-bold text-xs">
                                                            <AlertTriangle className="w-3.5 h-3.5" /> {m.alerts.length}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Scorecard por dimensión */}
                    {scored.length > 0 && (
                        <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-border">
                                <h2 className="text-sm font-black text-foreground uppercase tracking-widest">Scorecard por dimensión ({scored.length} misiones puntuadas)</h2>
                            </div>
                            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-3">
                                {rubric.map((r) => {
                                    const avg = scored.reduce((a, m) => a + Math.min(Number(m.scores?.[r.key]) || 0, r.max), 0) / scored.length;
                                    const pctVal = (avg / r.max) * 100;
                                    return (
                                        <div key={r.key}>
                                            <div className="flex justify-between text-xs font-semibold mb-1">
                                                <span className="text-foreground">{r.label}</span>
                                                <span className="text-muted-foreground">{avg.toFixed(1)}/{r.max}</span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div className={clsx('h-full rounded-full', pctVal >= 70 ? 'bg-emerald-500' : pctVal >= 40 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${pctVal}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Modal: nueva misión */}
                    {showNew && (
                        <div className="fixed inset-0 flex items-center justify-center p-4 z-[100]" style={{ background: 'rgba(10,12,20,0.55)', backdropFilter: 'blur(6px)' }}>
                            <div className="bg-white border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                                    <h2 className="text-lg font-black text-foreground">Nueva misión de cliente oculto</h2>
                                    <button onClick={() => setShowNew(false)} className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground"><X className="w-5 h-5" /></button>
                                </div>
                                <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Perfil</label>
                                            <select value={newForm.profile} onChange={(e) => setNewForm(f => ({ ...f, profile: e.target.value }))} className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary">
                                                {Object.entries(PROFILES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Canal</label>
                                            <select value={newForm.channel} onChange={(e) => setNewForm(f => ({ ...f, channel: e.target.value }))} className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary">
                                                {Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    {[
                                        { k: 'aliasName', l: 'Nombre ficticio *', p: 'Ej: Andrés Meléndez' },
                                        { k: 'aliasCompany', l: 'Empresa / proyecto ficticio', p: 'Ej: Conjunto Torres del Parque' },
                                        { k: 'aliasPhone', l: 'Celular dedicado (para el cruce con el CRM)', p: '3xx xxx xxxx' },
                                        { k: 'aliasEmail', l: 'Correo dedicado (para el cruce con el CRM)', p: 'alias@correo.com' },
                                    ].map((f) => (
                                        <div key={f.k}>
                                            <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">{f.l}</label>
                                            <input
                                                value={(newForm as Record<string, string>)[f.k]}
                                                onChange={(e) => setNewForm(prev => ({ ...prev, [f.k]: e.target.value }))}
                                                placeholder={f.p}
                                                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                            />
                                        </div>
                                    ))}
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Fecha y hora del primer contacto (si ya se hizo)</label>
                                        <div className="flex gap-2">
                                            <input type="datetime-local" value={newForm.contactAt} onChange={(e) => setNewForm(f => ({ ...f, contactAt: e.target.value }))} className="flex-1 bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" />
                                            <button onClick={() => setNewForm(f => ({ ...f, contactAt: nowLocal() }))} className="px-3 py-2 bg-muted border border-border rounded-xl text-xs font-bold hover:border-primary">Ahora</button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground bg-violet-50 border border-violet-200 rounded-xl p-3">
                                        🕵️ Usa identidades ficticias con celular/correo reales dedicados al estudio. Nunca firmar contratos ni generar anticipos. El cruce con el CRM se hace automáticamente por el celular o correo del alias.
                                    </p>
                                </div>
                                <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
                                    <button onClick={() => setShowNew(false)} className="bg-white border border-border text-foreground font-semibold rounded-xl px-4 py-2.5 hover:bg-muted transition-all text-sm">Cancelar</button>
                                    <button onClick={createMission} disabled={saving || !newForm.aliasName.trim()} className="bg-violet-600 text-white font-bold rounded-xl px-5 py-2.5 hover:brightness-110 transition-all text-sm disabled:opacity-50 flex items-center gap-2">
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Crear misión
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Modal: detalle de misión */}
                    {selected && (
                        <MissionDetail
                            mission={selected}
                            rubric={rubric}
                            saving={saving}
                            onClose={() => setSelected(null)}
                            onPatch={async (patch) => {
                                await patchMission(selected.id, patch);
                                setSelected(null);
                            }}
                        />
                    )}
                </div>
            )}
        </PermissionGate>
    );
}

// ── Detalle / ficha de la misión ─────────────────────────────────────────────
function MissionDetail({ mission: m, rubric, saving, onClose, onPatch }: {
    mission: Mission;
    rubric: RubricItem[];
    saving: boolean;
    onClose: () => void;
    onPatch: (patch: Record<string, unknown>) => Promise<void>;
}) {
    const toLocal = (iso: string | null) => {
        if (!iso) return '';
        const d = new Date(iso);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    };
    const [form, setForm] = useState({
        status: m.status,
        contactAt: toLocal(m.contact_at),
        firstResponseAt: toLocal(m.first_response_at),
        quoteAt: toLocal(m.quote_at),
        quoteFormat: m.quote_format || '',
        attendedBy: m.attended_by || '',
        notes: m.notes || '',
        scores: { ...(m.scores || {}) } as Record<string, number>,
        touches: [...(m.touches || [])] as Touch[],
    });
    const [newTouch, setNewTouch] = useState({ channel: 'whatsapp', content: '' });

    const total = rubric.reduce((a, r) => a + Math.min(Number(form.scores[r.key]) || 0, r.max), 0);
    const toIso = (v: string) => (v ? new Date(v).toISOString() : null);

    return (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-[100]" style={{ background: 'rgba(10,12,20,0.55)', backdropFilter: 'blur(6px)' }}>
            <div className="bg-white border border-border rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <div>
                        <h2 className="text-lg font-black text-foreground">{m.code} · {m.alias_name}</h2>
                        <p className="text-xs text-muted-foreground">{PROFILES[m.profile]} · {CHANNELS[m.channel] || m.channel}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground"><X className="w-5 h-5" /></button>
                </div>

                <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
                    {/* Cruce CRM */}
                    <div className={clsx('rounded-xl border p-4', m.crm ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200')}>
                        <p className="text-xs font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                            <Link2 className="w-3.5 h-3.5" /> Cruce con el CRM (automático, por celular/correo del alias)
                        </p>
                        {m.crm ? (
                            <p className="text-sm text-foreground">
                                Lead encontrado: <Link href={`/leads/${m.crm.clientId}`} target="_blank" className="font-bold text-sky-600 underline">{m.crm.clientName}</Link>
                                {' '}· asignado a <b>{m.crm.assignedTo || 'nadie'}</b> · último contacto: {m.crm.lastContact || '—'} · contactos en bitácora: <b>{m.crm.contactEvents}</b> · cotizaciones: <b>{m.crm.quotes}</b>
                            </p>
                        ) : (
                            <p className="text-sm text-red-700 font-semibold">El alias aún no aparece como lead en el CRM.</p>
                        )}
                        {m.alerts.length > 0 && (
                            <ul className="mt-2 space-y-1">
                                {m.alerts.map((a, i) => (
                                    <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {a.text}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Tiempos */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                            { k: 'contactAt', l: 'Contacto inicial' },
                            { k: 'firstResponseAt', l: '1ª respuesta recibida' },
                            { k: 'quoteAt', l: 'Cotización recibida' },
                        ].map((f) => (
                            <div key={f.k}>
                                <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">{f.l}</label>
                                <div className="flex gap-1">
                                    <input
                                        type="datetime-local"
                                        value={(form as Record<string, unknown>)[f.k] as string}
                                        onChange={(e) => setForm(prev => ({ ...prev, [f.k]: e.target.value }))}
                                        className="flex-1 min-w-0 bg-muted border border-border rounded-xl px-2 py-2 text-xs outline-none focus:border-primary"
                                    />
                                    <button onClick={() => setForm(prev => ({ ...prev, [f.k]: nowLocal() }))} title="Ahora" className="px-2 bg-muted border border-border rounded-xl text-xs font-bold hover:border-primary">⏱</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">¿Quién atendió?</label>
                            <input value={form.attendedBy} onChange={(e) => setForm(f => ({ ...f, attendedBy: e.target.value }))} placeholder="Nombre del asesor que respondió" className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Formato de cotización</label>
                            <select value={form.quoteFormat} onChange={(e) => setForm(f => ({ ...f, quoteFormat: e.target.value }))} className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary">
                                <option value="">— sin cotización —</option>
                                <option value="pdf">PDF formal</option>
                                <option value="texto">Texto WhatsApp</option>
                                <option value="imagen">Imagen</option>
                                <option value="email">Correo</option>
                            </select>
                        </div>
                    </div>

                    {/* Seguimientos */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-foreground mb-2">Seguimientos del vendedor (ventana 7 días) — {form.touches.length} toques</label>
                        <div className="space-y-2">
                            {form.touches.map((t, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm bg-muted rounded-xl px-3 py-2">
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(t.date).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                    <span className="text-xs font-bold uppercase">{t.channel}</span>
                                    <span className="flex-1 truncate">{t.content}</span>
                                    <button onClick={() => setForm(f => ({ ...f, touches: f.touches.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                                </div>
                            ))}
                            <div className="flex gap-2">
                                <select value={newTouch.channel} onChange={(e) => setNewTouch(t => ({ ...t, channel: e.target.value }))} className="bg-muted border border-border rounded-xl px-2 py-2 text-xs outline-none">
                                    {Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                                <input value={newTouch.content} onChange={(e) => setNewTouch(t => ({ ...t, content: e.target.value }))} placeholder="Qué hizo el vendedor en este toque…" className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary" />
                                <button
                                    onClick={() => {
                                        if (!newTouch.content.trim()) return;
                                        setForm(f => ({ ...f, touches: [...f.touches, { date: new Date().toISOString(), channel: newTouch.channel, content: newTouch.content.trim() }] }));
                                        setNewTouch({ channel: 'whatsapp', content: '' });
                                    }}
                                    className="px-3 bg-violet-600 text-white rounded-xl text-xs font-bold hover:brightness-110"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Rúbrica */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-black uppercase tracking-widest text-foreground">Rúbrica de evaluación</label>
                            <span className={clsx('text-sm font-black', classify(total).cls)}>{total}/100 · {classify(total).label}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                            {rubric.map((r) => (
                                <div key={r.key} className="flex items-center gap-3">
                                    <span className="flex-1 text-sm text-foreground">{r.label}</span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={r.max}
                                        value={form.scores[r.key] ?? ''}
                                        onChange={(e) => setForm(f => ({ ...f, scores: { ...f.scores, [r.key]: Math.min(Math.max(Number(e.target.value) || 0, 0), r.max) } }))}
                                        className="w-16 bg-muted border border-border rounded-xl px-2 py-1.5 text-sm text-center outline-none focus:border-primary"
                                    />
                                    <span className="text-xs text-muted-foreground w-8">/{r.max}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Notas + estado */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Observaciones cualitativas / evidencia</label>
                        <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Qué preguntaron, cómo asesoraron, dónde está la evidencia (pantallazos, audios)…" className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary resize-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Estado de la misión</label>
                        <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))} className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary">
                            <option value="planned">Planeada</option>
                            <option value="active">En curso</option>
                            <option value="waiting">Ventana de 7 días (esperando seguimientos)</option>
                            <option value="completed">Completada</option>
                        </select>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
                    <button onClick={onClose} className="bg-white border border-border text-foreground font-semibold rounded-xl px-4 py-2.5 hover:bg-muted transition-all text-sm">Cerrar</button>
                    <button
                        onClick={() => onPatch({
                            status: form.status,
                            contactAt: toIso(form.contactAt),
                            firstResponseAt: toIso(form.firstResponseAt),
                            quoteAt: toIso(form.quoteAt),
                            quoteFormat: form.quoteFormat || null,
                            attendedBy: form.attendedBy || null,
                            scores: form.scores,
                            touches: form.touches,
                            notes: form.notes || null,
                        })}
                        disabled={saving}
                        className="bg-violet-600 text-white font-bold rounded-xl px-5 py-2.5 hover:brightness-110 transition-all text-sm disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar ficha
                    </button>
                </div>
            </div>
        </div>
    );
}
