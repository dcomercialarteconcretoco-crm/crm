"use client";

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Kanban, DollarSign, X, Phone, Mail, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

const STAGES = [
    { id: 'lead',       label: 'Lead',          color: 'bg-slate-100 text-slate-700',    dot: 'bg-slate-500'   },
    { id: 'qualified',  label: 'Calificado',    color: 'bg-sky-100 text-sky-700',        dot: 'bg-sky-500'     },
    { id: 'proposal',   label: 'Propuesta',     color: 'bg-violet-100 text-violet-700',  dot: 'bg-violet-500'  },
    { id: 'negotiation',label: 'Negociación',   color: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-500'   },
    { id: 'closed_won', label: '✅ Ganado',     color: 'bg-emerald-100 text-emerald-700',dot: 'bg-emerald-500' },
    { id: 'closed_lost',label: '❌ Perdido',    color: 'bg-rose-100 text-rose-700',      dot: 'bg-rose-500'    },
];

function formatCOP(value: number) {
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value}`;
}

export default function MobilePipeline() {
    const { tasks, updateTask, clients } = useApp();
    const [selectedTask, setSelectedTask] = useState<typeof tasks[0] | null>(null);
    const [activeStage, setActiveStage] = useState('lead');

    const stageMap = useMemo(() => {
        const map: Record<string, typeof tasks> = {};
        STAGES.forEach(s => { map[s.id] = []; });
        tasks.forEach(t => {
            const sid = t.stageId && map[t.stageId] ? t.stageId : 'lead';
            map[sid].push(t);
        });
        return map;
    }, [tasks]);

    const totalPipeline = useMemo(() =>
        tasks
            .filter(t => t.stageId !== 'closed_won' && t.stageId !== 'closed_lost')
            .reduce((s, t) => s + (t.numericValue || 0), 0),
        [tasks]
    );

    const moveTask = (taskId: string, stageId: string) => {
        updateTask(taskId, { stageId });
        if (selectedTask?.id === taskId) {
            setSelectedTask(prev => prev ? { ...prev, stageId } : prev);
        }
    };

    const currentStage = STAGES.find(s => s.id === activeStage)!;
    const stageTasks = stageMap[activeStage] ?? [];

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-black text-foreground">Pipeline</h1>
                        <p className="text-xs text-muted-foreground">
                            {tasks.filter(t => t.stageId !== 'closed_won' && t.stageId !== 'closed_lost').length} negocios activos · {formatCOP(totalPipeline)}
                        </p>
                    </div>
                    <div className="bg-primary/10 border border-primary/20 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-black text-primary">{formatCOP(totalPipeline)}</span>
                    </div>
                </div>
            </div>

            {/* Stage Tabs — horizontal scroll */}
            <div className="px-4 overflow-x-auto pb-1">
                <div className="flex gap-2 min-w-max">
                    {STAGES.map(stage => {
                        const count = stageMap[stage.id]?.length ?? 0;
                        const isActive = stage.id === activeStage;
                        return (
                            <button
                                key={stage.id}
                                onClick={() => setActiveStage(stage.id)}
                                className={clsx(
                                    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all',
                                    isActive ? 'bg-primary text-black shadow-sm' : 'bg-white border border-border text-muted-foreground'
                                )}>
                                {stage.label}
                                <span className={clsx(
                                    'text-[10px] font-black px-1.5 py-0.5 rounded-full',
                                    isActive ? 'bg-black/10 text-black' : 'bg-muted text-foreground'
                                )}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Task List for selected stage */}
            <div className="flex-1 overflow-y-auto p-4 pt-3 space-y-2.5">
                {stageTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Kanban className="w-12 h-12 text-muted-foreground/30 mb-3" />
                        <p className="text-sm font-bold text-muted-foreground">Sin negocios en {currentStage.label}</p>
                    </div>
                ) : stageTasks.map(task => (
                    <button
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="w-full text-left bg-white border border-border rounded-2xl p-4 active:bg-muted transition-colors">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-foreground truncate">{task.title}</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{task.client}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm font-black text-primary">{task.value}</p>
                                <span className={clsx(
                                    'text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block',
                                    task.priority === 'High' ? 'bg-rose-100 text-rose-600'
                                    : task.priority === 'Medium' ? 'bg-amber-100 text-amber-600'
                                    : 'bg-muted text-muted-foreground'
                                )}>
                                    {task.priority === 'High' ? 'Alta' : task.priority === 'Medium' ? 'Media' : 'Baja'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2">
                            <ChevronRight className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">Toca para mover de etapa</span>
                        </div>
                    </button>
                ))}
            </div>

            {/* Task Detail / Move Sheet */}
            {selectedTask && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end"
                    style={{ background: 'rgba(0,0,0,0.4)' }}
                    onClick={() => setSelectedTask(null)}>
                    <div
                        className="bg-white rounded-t-3xl p-5 space-y-4"
                        onClick={e => e.stopPropagation()}>
                        <div className="w-10 h-1 bg-muted rounded-full mx-auto" />

                        {/* Task info */}
                        <div>
                            <h2 className="text-base font-black text-foreground">{selectedTask.title}</h2>
                            <p className="text-sm text-muted-foreground">{selectedTask.client}</p>
                            <p className="text-xl font-black text-primary mt-1">{selectedTask.value}</p>
                        </div>

                        {/* Contact */}
                        {selectedTask.email && (
                            <a href={`mailto:${selectedTask.email}`}
                                className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                                <Mail className="w-4 h-4 text-primary" />
                                <span className="text-sm">{selectedTask.email}</span>
                            </a>
                        )}
                        {selectedTask.phone && (
                            <a href={`tel:${selectedTask.phone}`}
                                className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                                <Phone className="w-4 h-4 text-primary" />
                                <span className="text-sm">{selectedTask.phone}</span>
                            </a>
                        )}

                        {/* Move to stage */}
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">
                                Mover a etapa
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {STAGES.filter(s => s.id !== selectedTask.stageId).map(stage => (
                                    <button
                                        key={stage.id}
                                        onClick={() => { moveTask(selectedTask.id, stage.id); setSelectedTask(null); }}
                                        className={clsx(
                                            'py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all',
                                            stage.color
                                        )}>
                                        {stage.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => setSelectedTask(null)}
                            className="w-full py-3.5 bg-muted text-muted-foreground font-bold rounded-xl text-sm">
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
