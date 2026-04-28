"use client";

/**
 * PipelineStagesEditor — vive en /settings ?tab=pipeline.
 *
 * Permite al equipo configurar las etapas del kanban sin tocar código:
 * agregar/eliminar etapas, renombrarlas, cambiar color, marcar cuál es la
 * etapa "ganadora" (al mover acá la cotización pasa a Approved y se dispara
 * Orden de Producción) y cuál es la "caliente" (al abrirse el correo de la
 * cotización el sistema mueve la task automáticamente acá).
 *
 * Reglas:
 *   - Sólo una etapa puede tener `isWinStage: true` a la vez.
 *   - Sólo una etapa puede tener `autoOnQuoteOpen: true` a la vez.
 *   - El orden visual del array es el orden del kanban (izquierda → derecha).
 *
 * Persiste en `settings.pipelineStages` vía updateSettings (que lo manda al
 * crm_state JSONB).
 */

import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Flame, GripVertical, Plus, RefreshCw, Save, Trash2, Trophy, X, Workflow } from 'lucide-react';
import { clsx } from 'clsx';
import { useApp, type PipelineStage, DEFAULT_PIPELINE_STAGES } from '@/context/AppContext';

const COLOR_OPTIONS: Array<{ id: string; label: string; bg: string; ring: string }> = [
    { id: 'blue',    label: 'Azul',     bg: 'bg-blue-500',    ring: 'ring-blue-500' },
    { id: 'amber',   label: 'Ámbar',    bg: 'bg-amber-500',   ring: 'ring-amber-500' },
    { id: 'emerald', label: 'Esmeralda',bg: 'bg-emerald-500', ring: 'ring-emerald-500' },
    { id: 'violet',  label: 'Violeta',  bg: 'bg-violet-500',  ring: 'ring-violet-500' },
    { id: 'rose',    label: 'Rosa',     bg: 'bg-rose-500',    ring: 'ring-rose-500' },
    { id: 'sky',     label: 'Cielo',    bg: 'bg-sky-500',     ring: 'ring-sky-500' },
    { id: 'gray',    label: 'Gris',     bg: 'bg-gray-500',    ring: 'ring-gray-500' },
    { id: 'slate',   label: 'Pizarra',  bg: 'bg-slate-500',   ring: 'ring-slate-500' },
];

function slugify(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')   // quita tildes
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 32) || `stage-${Date.now()}`;
}

export function PipelineStagesEditor() {
    const { settings, updateSettings, addNotification } = useApp();
    const initial = settings.pipelineStages && settings.pipelineStages.length > 0
        ? settings.pipelineStages
        : DEFAULT_PIPELINE_STAGES;
    const [draft, setDraft] = useState<PipelineStage[]>(JSON.parse(JSON.stringify(initial)));
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<number | null>(null);

    // Helpers para mantener invariantes de "una sola flag activa"
    const setStage = (idx: number, patch: Partial<PipelineStage>) => {
        setDraft(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
    };
    const setExclusiveFlag = (idx: number, key: 'isWinStage' | 'autoOnQuoteOpen', on: boolean) => {
        setDraft(prev => prev.map((s, i) => ({
            ...s,
            [key]: i === idx ? on : false,
        })));
    };
    const move = (idx: number, dir: -1 | 1) => {
        setDraft(prev => {
            const j = idx + dir;
            if (j < 0 || j >= prev.length) return prev;
            const next = [...prev];
            [next[idx], next[j]] = [next[j], next[idx]];
            return next;
        });
    };
    const remove = (idx: number) => {
        if (draft.length <= 1) {
            addNotification({ title: 'Etapa mínima', description: 'El pipeline debe tener al menos una etapa.', type: 'alert' });
            return;
        }
        setDraft(prev => prev.filter((_, i) => i !== idx));
    };
    const addStage = () => {
        const id = slugify(`etapa-${draft.length + 1}`);
        setDraft(prev => [...prev, { id, label: 'Nueva etapa', color: 'slate' }]);
    };
    const restoreDefault = () => {
        if (!confirm('¿Restaurar las etapas por defecto (Cotizado / En caliente / Facturado)? Las personalizaciones se pierden.')) return;
        setDraft(JSON.parse(JSON.stringify(DEFAULT_PIPELINE_STAGES)));
    };
    const save = async () => {
        // Validaciones mínimas antes de persistir
        const trimmed = draft.map(s => ({ ...s, label: s.label.trim(), id: (s.id || '').trim() }));
        if (trimmed.some(s => !s.label)) {
            addNotification({ title: 'Etapas sin nombre', description: 'Todas las etapas necesitan un nombre.', type: 'alert' });
            return;
        }
        // Re-slug si el id quedó vacío o duplicado
        const seen = new Set<string>();
        const final = trimmed.map(s => {
            let id = s.id || slugify(s.label);
            while (seen.has(id)) id = `${id}-${Math.random().toString(36).slice(2, 5)}`;
            seen.add(id);
            return { ...s, id };
        });
        setSaving(true);
        try {
            updateSettings({ pipelineStages: final });
            setDraft(final);
            setSavedAt(Date.now());
            addNotification({ title: 'Pipeline guardado', description: 'Las etapas se actualizaron en todo el equipo.', type: 'success' });
        } finally {
            setSaving(false);
        }
    };

    const winIdx = draft.findIndex(s => s.isWinStage);
    const hotIdx = draft.findIndex(s => s.autoOnQuoteOpen);

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Workflow className="w-5 h-5 text-primary" />
                        Etapas del Pipeline
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                        Configurá cómo avanzan las cotizaciones por el kanban. El orden de la lista es el orden de
                        izquierda a derecha. Marcá <strong>una etapa como "caliente"</strong> (mueve la tarjeta
                        automáticamente cuando el cliente abre el correo) y <strong>una como "ganada"</strong> (al
                        soltar la tarjeta acá la cotización pasa a Aprobada y se dispara la Orden de Producción).
                    </p>
                </div>
                <button
                    onClick={restoreDefault}
                    className="bg-white border border-border text-foreground font-medium rounded-xl px-3 py-2 hover:bg-muted transition-colors flex items-center gap-2 text-xs shrink-0"
                >
                    <RefreshCw className="w-3.5 h-3.5" /> Default
                </button>
            </div>

            {/* Lista */}
            <div className="space-y-2">
                {draft.map((stage, idx) => {
                    const colorOpt = COLOR_OPTIONS.find(c => c.id === stage.color) || COLOR_OPTIONS[7];
                    return (
                        <div key={idx} className="bg-white border border-border rounded-xl p-4 grid grid-cols-12 gap-3 items-center">
                            {/* Posición + reorder */}
                            <div className="col-span-1 flex items-center gap-1 text-muted-foreground">
                                <GripVertical className="w-4 h-4" />
                                <span className="text-xs font-bold">{idx + 1}</span>
                            </div>
                            {/* Nombre */}
                            <div className="col-span-12 md:col-span-3">
                                <label className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Nombre</label>
                                <input
                                    type="text"
                                    value={stage.label}
                                    onChange={e => setStage(idx, { label: e.target.value, id: stage.id || slugify(e.target.value) })}
                                    placeholder="Ej: Cotizado"
                                    className="w-full bg-muted border border-border rounded-xl py-2 px-3 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                />
                            </div>
                            {/* Color */}
                            <div className="col-span-12 md:col-span-3">
                                <label className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Color</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {COLOR_OPTIONS.map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            title={c.label}
                                            onClick={() => setStage(idx, { color: c.id })}
                                            className={clsx(
                                                'w-6 h-6 rounded-lg transition-all',
                                                c.bg,
                                                stage.color === c.id ? `ring-2 ring-offset-2 ${c.ring}` : 'opacity-70 hover:opacity-100'
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>
                            {/* Flags */}
                            <div className="col-span-12 md:col-span-4 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setExclusiveFlag(idx, 'autoOnQuoteOpen', !stage.autoOnQuoteOpen)}
                                    title="Cuando el cliente abre el correo, la tarjeta cae acá"
                                    className={clsx(
                                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wide border transition-all',
                                        stage.autoOnQuoteOpen
                                            ? 'bg-amber-500 text-white border-amber-500'
                                            : 'bg-white text-muted-foreground border-border hover:border-amber-300'
                                    )}
                                >
                                    <Flame className="w-3 h-3" /> Caliente {stage.autoOnQuoteOpen && <Check className="w-3 h-3" />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setExclusiveFlag(idx, 'isWinStage', !stage.isWinStage)}
                                    title="Soltar la tarjeta acá marca la cotización como Aprobada"
                                    className={clsx(
                                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wide border transition-all',
                                        stage.isWinStage
                                            ? 'bg-emerald-500 text-white border-emerald-500'
                                            : 'bg-white text-muted-foreground border-border hover:border-emerald-300'
                                    )}
                                >
                                    <Trophy className="w-3 h-3" /> Ganada {stage.isWinStage && <Check className="w-3 h-3" />}
                                </button>
                            </div>
                            {/* Acciones */}
                            <div className="col-span-12 md:col-span-1 flex items-center justify-end gap-1">
                                <button onClick={() => move(idx, -1)} disabled={idx === 0} title="Subir" className="p-2 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                    <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => move(idx, 1)} disabled={idx === draft.length - 1} title="Bajar" className="p-2 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                    <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => remove(idx)} title="Eliminar" className="p-2 rounded-lg bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-100 transition-all">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add */}
            <button
                onClick={addStage}
                className="w-full bg-white border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary font-bold rounded-xl py-3 transition-all flex items-center justify-center gap-2"
            >
                <Plus className="w-4 h-4" /> Agregar etapa
            </button>

            {/* Warnings + save */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    {hotIdx === -1 && <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-amber-500" /> Sin etapa "caliente" — el auto-move al abrir el correo no aplicará.</span>}
                    {winIdx === -1 && <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-emerald-500" /> Sin etapa "ganada" — los cierres se moverán manualmente.</span>}
                </div>
                <div className="flex items-center gap-2">
                    {savedAt && Date.now() - savedAt < 4000 && (
                        <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Guardado
                        </span>
                    )}
                    <button
                        onClick={save}
                        disabled={saving}
                        className="bg-primary text-black font-bold rounded-xl px-4 py-2 hover:brightness-105 shadow-[0_2px_8px_rgba(250,181,16,0.3)] transition-all disabled:opacity-40 flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar etapas'}
                    </button>
                </div>
            </div>
        </div>
    );
}
