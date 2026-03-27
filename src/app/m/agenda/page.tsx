"use client";

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { CalendarDays, Clock, Plus, X, CheckCircle2, MapPin, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

const TYPE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
    meeting:  { bg: 'bg-sky-100',     text: 'text-sky-700',     label: 'Reunión'      },
    call:     { bg: 'bg-violet-100',  text: 'text-violet-700',  label: 'Llamada'      },
    task:     { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Tarea'        },
    reminder: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Recordatorio' },
    other:    { bg: 'bg-muted',       text: 'text-foreground',  label: 'Otro'         },
};

function sameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
}

function dateLabel(date: Date) {
    const today    = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    const d = new Date(date); d.setHours(0,0,0,0);
    if (sameDay(d, today))    return 'Hoy';
    if (sameDay(d, tomorrow)) return 'Mañana';
    return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' });
}

export default function MobileAgenda() {
    const { events, addEvent, currentUser } = useApp();
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const [form, setForm] = useState({
        title: '',
        date: new Date().toISOString().slice(0, 10),
        time: '',
        type: 'meeting',
        location: '',
        notes: '',
    });

    // Group events: today + next 7 days
    const grouped = useMemo(() => {
        const today = new Date(); today.setHours(0,0,0,0);
        const limit = new Date(today); limit.setDate(limit.getDate() + 8);

        const relevant = events
            .map(ev => {
                const raw = (ev as any).start ?? (ev as any).date ?? '';
                return { ev, date: raw ? new Date(raw) : null };
            })
            .filter(({ date }) => date && date >= today && date < limit)
            .sort((a, b) => a.date!.getTime() - b.date!.getTime());

        const groups: { label: string; date: Date; events: typeof events }[] = [];
        relevant.forEach(({ ev, date }) => {
            const label = dateLabel(date!);
            const existing = groups.find(g => g.label === label);
            if (existing) existing.events.push(ev);
            else groups.push({ label, date: date!, events: [ev] });
        });
        return groups;
    }, [events]);

    const handleSave = async () => {
        if (!form.title.trim()) return;
        setSaving(true);
        const start = form.time
            ? new Date(`${form.date}T${form.time}:00`)
            : new Date(`${form.date}T09:00:00`);
        addEvent({
            title: form.title.trim(),
            start: start.toISOString(),
            end: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
            type: form.type as any,
            location: form.location.trim() || undefined,
            notes: form.notes.trim() || undefined,
            createdBy: currentUser?.id,
        } as any);
        setSaving(false);
        setSaved(true);
        setTimeout(() => {
            setSaved(false);
            setShowForm(false);
            setForm({ title: '', date: new Date().toISOString().slice(0,10), time: '', type: 'meeting', location: '', notes: '' });
        }, 1200);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 pb-2 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black text-foreground">Agenda</h1>
                    <p className="text-xs text-muted-foreground">Próximos 7 días</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-1.5 bg-primary text-black font-bold text-xs px-3 py-2.5 rounded-xl active:scale-95 transition-transform">
                    <Plus className="w-4 h-4" />
                    Evento
                </button>
            </div>

            {/* Events */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2 space-y-5">
                {grouped.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <CalendarDays className="w-12 h-12 text-muted-foreground/30 mb-3" />
                        <p className="text-sm font-bold text-muted-foreground">Sin eventos próximos</p>
                        <p className="text-xs text-muted-foreground mt-1">Toca + para agregar uno</p>
                    </div>
                ) : grouped.map(group => (
                    <div key={group.label}>
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2.5">
                            {group.label}
                        </p>
                        <div className="space-y-2.5">
                            {group.events.map(ev => {
                                const t = TYPE_STYLE[(ev as any).type ?? 'other'] ?? TYPE_STYLE.other;
                                const start = (ev as any).start ?? (ev as any).date;
                                const time = start
                                    ? new Date(start).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                                    : null;
                                return (
                                    <div key={ev.id} className="bg-white border border-border rounded-2xl p-4">
                                        <div className="flex items-start gap-3">
                                            <div className={clsx('w-2.5 h-2.5 rounded-full mt-1.5 shrink-0', t.bg.replace('bg-', 'bg-').replace('100', '500'))} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-sm font-bold text-foreground truncate">{ev.title}</p>
                                                    <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0', t.bg, t.text)}>
                                                        {t.label}
                                                    </span>
                                                </div>
                                                {time && (
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                        <Clock className="w-3 h-3" />{time}
                                                    </p>
                                                )}
                                                {(ev as any).location && (
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                        <MapPin className="w-3 h-3" />{(ev as any).location}
                                                    </p>
                                                )}
                                                {(ev as any).notes && (
                                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{(ev as any).notes}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* New Event Sheet */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end"
                    style={{ background: 'rgba(0,0,0,0.5)' }}
                    onClick={() => setShowForm(false)}>
                    <div
                        className="bg-white rounded-t-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h2 className="font-black text-foreground">Nuevo Evento</h2>
                            <button onClick={() => setShowForm(false)}>
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        </div>

                        <input
                            type="text"
                            placeholder="Título del evento *"
                            value={form.title}
                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary"
                        />

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">Fecha</label>
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                    className="w-full bg-muted border border-border rounded-xl px-3 py-3 text-sm outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">Hora</label>
                                <input
                                    type="time"
                                    value={form.time}
                                    onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                                    className="w-full bg-muted border border-border rounded-xl px-3 py-3 text-sm outline-none focus:border-primary"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">Tipo</label>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(TYPE_STYLE).filter(([k]) => k !== 'other').map(([key, val]) => (
                                    <button
                                        key={key}
                                        onClick={() => setForm(f => ({ ...f, type: key }))}
                                        className={clsx(
                                            'py-2.5 rounded-xl text-xs font-bold transition-all',
                                            form.type === key ? `${val.bg} ${val.text} ring-2 ring-offset-1 ring-current` : 'bg-muted text-muted-foreground'
                                        )}>
                                        {val.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <input
                            type="text"
                            placeholder="Lugar (opcional)"
                            value={form.location}
                            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                            className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary"
                        />

                        <textarea
                            placeholder="Notas (opcional)"
                            value={form.notes}
                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                            rows={2}
                            className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary resize-none"
                        />

                        <button
                            onClick={handleSave}
                            disabled={!form.title.trim() || saving || saved}
                            className={clsx(
                                'w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm transition-all active:scale-95',
                                saved ? 'bg-emerald-500 text-white'
                                : form.title.trim() ? 'bg-primary text-black'
                                : 'bg-muted text-muted-foreground cursor-not-allowed'
                            )}>
                            {saved ? <><CheckCircle2 className="w-4 h-4" /> Guardado</>
                             : saving ? <Loader2 className="w-4 h-4 animate-spin" />
                             : 'Guardar Evento'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
