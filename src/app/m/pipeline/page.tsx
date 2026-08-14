"use client";

import React, { useState, useMemo } from 'react';
import { useApp, Task, Activity, PipelineStage, DEFAULT_PIPELINE_STAGES } from '@/context/AppContext';
import { resolveStageId } from '@/lib/pipeline-stages';
import { hasPermission } from '@/lib/permissions';
import { Kanban, DollarSign, Phone, Mail, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

// Clases por color de etapa (Tailwind necesita los literales completos para
// compilarlas). Mismos nombres de color que COLOR_TOKENS del kanban de
// escritorio — la etapa se configura en /settings con uno de estos tokens.
const STAGE_COLOR_CHIPS: Record<string, string> = {
    blue:    'bg-blue-100 text-blue-700',
    amber:   'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    violet:  'bg-violet-100 text-violet-700',
    rose:    'bg-rose-100 text-rose-700',
    gray:    'bg-gray-100 text-gray-700',
    sky:     'bg-sky-100 text-sky-700',
    slate:   'bg-slate-100 text-slate-700',
};
const stageChip = (color: string) => STAGE_COLOR_CHIPS[color] || STAGE_COLOR_CHIPS.slate;

function formatCOP(value: number) {
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value}`;
}

export default function MobilePipeline() {
    const { tasks, quotes, updateTask, updateQuote, addNotification, addAuditLog, settings, currentUser } = useApp();
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    // Etapas dinámicas — misma fuente de verdad que el kanban de escritorio:
    // settings.pipelineStages, con fallback al default de Arte Concreto
    // (Cotizado → En caliente → Facturado).
    const stages: PipelineStage[] = settings.pipelineStages && settings.pipelineStages.length > 0
        ? settings.pipelineStages
        : DEFAULT_PIPELINE_STAGES;
    const winStageId = stages.find(s => s.isWinStage)?.id;

    const [activeStageId, setActiveStageId] = useState(stages[0]?.id ?? '');
    // Si settings hidrata con etapas distintas, el tab activo puede dejar de
    // existir — se cae a la primera etapa en vez de mostrar una lista vacía.
    const activeStage = stages.find(s => s.id === activeStageId) || stages[0];

    const stageMap = useMemo(() => {
        const map: Record<string, Task[]> = {};
        stages.forEach(s => { map[s.id] = []; });
        tasks.forEach(t => {
            const sid = resolveStageId(t.stageId);
            // Sin etapa visible ('', '__lost__', ids desconocidos) → fuera del
            // tablero, igual que el filtro del kanban de escritorio.
            if (map[sid]) map[sid].push(t);
        });
        return map;
    }, [tasks, stages]);

    const activeTasks = useMemo(
        () => tasks.filter(t => {
            const sid = resolveStageId(t.stageId);
            return sid !== winStageId && stages.some(s => s.id === sid);
        }),
        [tasks, stages, winStageId]
    );
    const totalPipeline = useMemo(
        () => activeTasks.reduce((s, t) => s + (t.numericValue || 0), 0),
        [activeTasks]
    );

    // Mismo contrato que onDragEnd en el kanban de escritorio: actividad de
    // sistema + audit log, motivo de pérdida en etapas de descarte, y el
    // cierre/des-cierre de la cotización vinculada al entrar o salir de la
    // etapa ganadora (isWinStage).
    const moveTask = (taskRef: Task, destStageId: string) => {
        const task = tasks.find(t => t.id === taskRef.id) || taskRef;
        const fromStageId = resolveStageId(task.stageId);
        if (destStageId === fromStageId) return;

        const destStage = stages.find(s => s.id === destStageId);
        const sourceStage = stages.find(s => s.id === fromStageId);
        const fromLabel = sourceStage?.label || task.stageId || '—';
        const toLabel = destStage?.label || destStageId;
        const linkedQuote = quotes.find(q => q.id === task.quoteId);

        // Mover a una etapa de descarte pide motivo de pérdida — misma regla
        // que el drag y el botón "Perdido" del escritorio.
        let lossReason: string | undefined;
        if (/descart|perdid/i.test(toLabel)) {
            const motivo = window.prompt('Motivo de pérdida (precio, tiempo de respuesta, producto, competencia, etc.):', task.lossReason || '');
            if (motivo === null) return; // canceló — la tarjeta no se mueve
            lossReason = motivo.trim() || 'Sin motivo especificado';
        }

        // Sacar la tarjeta de la etapa ganadora deshace el cierre: la
        // cotización vinculada vuelve a 'Enviada'. Este updateQuote va ANTES
        // del updateTask de abajo: su sync interno mueve la task a 'proposal',
        // y el updateTask posterior (último en la cola de React y de
        // persistencia) la deja en la etapa elegida acá.
        if (sourceStage?.isWinStage && destStage && !destStage.isWinStage && linkedQuote?.status === 'Approved') {
            updateQuote(linkedQuote.id, { status: 'Sent' });
            addNotification({
                title: 'Cierre revertido',
                description: `${task.client} salió de ${sourceStage.label}. La cotización ${linkedQuote.quoteNumber || linkedQuote.number || ''} vuelve a "Enviada".`,
                type: 'alert',
            });
        }

        const stageActivity: Activity = {
            id: `sys-${Date.now()}`,
            type: 'system',
            content: lossReason
                ? `📌 Etapa cambiada: ${fromLabel} → ${toLabel} — Motivo: ${lossReason}`
                : `📌 Etapa cambiada: ${fromLabel} → ${toLabel}`,
            timestamp: new Date(),
        };
        updateTask(task.id, {
            stageId: destStageId,
            activities: [stageActivity, ...(task.activities || [])],
            ...(lossReason ? { lossReason } : {}),
        });
        addAuditLog({
            userId: currentUser?.id || '',
            userName: currentUser?.name || '—',
            userRole: hasPermission(currentUser, 'pipeline.reassign') ? 'SuperAdmin' : 'Vendedor',
            action: 'LEAD_STATUS_CHANGE',
            targetId: task.id,
            targetName: task.client,
            details: `Cambio de etapa: ${fromLabel} → ${toLabel}`,
            verified: true,
        });

        if (destStage?.isWinStage) {
            // Mover a la ganadora también cierra la cotización vinculada —
            // misma regla que el drag del escritorio. Las que están en flujo
            // de aprobación interna no se tocan: ese cierre lo decide el
            // SuperAdmin en /autorizaciones.
            if (linkedQuote
                && linkedQuote.status !== 'Approved'
                && linkedQuote.status !== 'PendingApproval'
                && linkedQuote.status !== 'PENDING_APPROVAL'
                && linkedQuote.status !== 'ChangesRequested') {
                updateQuote(linkedQuote.id, { status: 'Approved' });
            }
            addNotification({ title: 'Venta Cerrada', description: `${task.client} — $${(task.numericValue || 0).toLocaleString()} COP.`, type: 'success' });
        }
    };

    const stageTasks = activeStage ? (stageMap[activeStage.id] ?? []) : [];

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-black text-foreground">Pipeline</h1>
                        <p className="text-xs text-muted-foreground">
                            {activeTasks.length} negocios activos · {formatCOP(totalPipeline)}
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
                    {stages.map(stage => {
                        const count = stageMap[stage.id]?.length ?? 0;
                        const isActive = stage.id === activeStage?.id;
                        return (
                            <button
                                key={stage.id}
                                onClick={() => setActiveStageId(stage.id)}
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
                        <p className="text-sm font-bold text-muted-foreground">Sin negocios en {activeStage?.label ?? 'esta etapa'}</p>
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
                                {stages.filter(s => s.id !== resolveStageId(selectedTask.stageId)).map(stage => (
                                    <button
                                        key={stage.id}
                                        onClick={() => { moveTask(selectedTask, stage.id); setSelectedTask(null); }}
                                        className={clsx(
                                            'py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all',
                                            stageChip(stage.color)
                                        )}>
                                        {stage.isWinStage ? '✅ ' : ''}{stage.label}
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
