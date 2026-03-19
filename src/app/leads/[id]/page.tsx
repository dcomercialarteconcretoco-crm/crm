"use client";

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import {
    ArrowLeft,
    Edit2,
    Share2,
    MoreHorizontal,
    User,
    Mail,
    Phone,
    MapPin,
    Clock,
    FileText,
    StickyNote,
    MessageSquare,
    Sparkles,
    ExternalLink,
    Plus
} from 'lucide-react';

import Link from 'next/link';
import { clsx } from 'clsx';
import { useApp } from '@/context/AppContext';

export default function Lead360Page() {
    const params = useParams();
    const { clients, addAuditLog, sellers, tasks, quotes, auditLogs, currentUser } = useApp();
    const [activeTab, setActiveTab] = useState('Actividad');

    const leadId = params.id as string;
    const lead = clients.find(c => c.id === leadId);

    const leadTasks = tasks.filter(t => t.clientId === leadId);
    const leadQuotes = quotes.filter(q => q.clientId === leadId);
    const leadActivity = auditLogs.filter(log => log.targetId === leadId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const handleLogContact = (type: 'WHATSAPP_SENT' | 'CALL_MADE' | 'QUOTE_SENT', details: string) => {
        if (!lead || !currentUser) return;
        addAuditLog({
            userId: currentUser.id,
            userName: currentUser.name,
            userRole: currentUser.role,
            action: type,
            targetId: lead.id,
            targetName: lead.company || lead.name,
            details,
            verified: true
        });
    };

    if (!lead) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-white/40 font-black uppercase tracking-[0.3em]">Cliente no encontrado</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* Breadcrumbs & Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/pipeline" className="p-2 hover:bg-muted rounded-full transition-colors font-bold flex items-center gap-2">
                        <ArrowLeft className="w-5 h-5 text-primary" />
                        <span className="text-[10px] lg:text-xs uppercase tracking-widest text-muted-foreground">Volver</span>
                    </Link>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border border-border/40 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-widest hover:bg-muted/50 transition-colors">
                        <Share2 className="w-4 h-4" />
                        <span>Exportar</span>
                    </button>
                    <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-black rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                        <Edit2 className="w-4 h-4" />
                        <span>Editar</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Info Cards */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-card border border-border/40 rounded-[2.5rem] p-6 lg:p-8 space-y-8 relative overflow-hidden shadow-sm">
                        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                            <Sparkles className="w-32 h-32" />
                        </div>

                        <div className="flex flex-col items-center justify-center space-y-4 pt-4">
                            <div className="relative">
                                <div className="w-28 h-28 lg:w-36 lg:h-36 rounded-[2.5rem] border-4 border-primary/20 flex items-center justify-center bg-primary/5 shadow-[0_0_30px_rgba(250,181,16,0.1)] relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent"></div>
                                    <span className="text-4xl lg:text-6xl font-black text-primary relative z-10">85</span>
                                </div>
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-primary text-black text-[8px] lg:text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-xl border-4 border-background whitespace-nowrap">
                                    Lead Score
                                </div>
                            </div>
                            <div className="text-center pt-2">
                                <h2 className="text-xl lg:text-2xl font-black tracking-tight text-foreground">{lead.company || lead.name}</h2>
                                <p className="text-[9px] lg:text-[10px] text-primary font-black uppercase tracking-[0.3em] mt-1.5">{lead.company ? 'Socio Corporativo' : 'Cliente Individual'}</p>
                            </div>
                        </div>

                        <div className="space-y-5 pt-8 border-t border-border/20">
                            {[
                                { icon: User, label: 'Contacto Principal', value: lead.name },
                                { icon: Mail, label: 'Correo', value: lead.email },
                                { icon: Phone, label: 'Teléfono', value: lead.phone },
                                { icon: MapPin, label: 'Ubicación', value: lead.city || 'No registrada' }
                            ].map((info) => (
                                <div key={info.label} className="flex items-center gap-4 group">
                                    <div className="p-2.5 bg-muted/30 rounded-2xl text-muted-foreground group-hover:text-primary transition-colors border border-border/10 shrink-0">
                                        <info.icon className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.15em]">{info.label}</p>
                                        <p className="text-xs lg:text-sm font-bold text-foreground/90 truncate">{info.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/20">
                            <button
                                onClick={() => {
                                    handleLogContact('QUOTE_SENT', 'Envío manual de propuesta técnica revisada');
                                    window.location.href = `mailto:${lead.email}`;
                                }}
                                className="flex flex-col items-center justify-center gap-2 bg-muted/20 hover:bg-primary/10 p-4 lg:p-5 rounded-[2rem] border border-border/10 hover:border-primary/40 transition-all group"
                            >
                                <Mail className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                                <span className="font-black text-[8px] uppercase tracking-widest">Email</span>
                            </button>
                            <button
                                onClick={() => {
                                    handleLogContact('CALL_MADE', 'Llamada telefónica (Seguimiento)');
                                    window.location.href = `tel:${lead.phone}`;
                                }}
                                className="flex flex-col items-center justify-center gap-2 bg-muted/20 hover:bg-primary/10 p-4 lg:p-5 rounded-[2rem] border border-border/10 hover:border-primary/40 transition-all group"
                            >
                                <Phone className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                                <span className="font-black text-[8px] uppercase tracking-widest">Llamar</span>
                            </button>
                            <button
                                onClick={() => {
                                    handleLogContact('WHATSAPP_SENT', 'Contacto vía WhatsApp');
                                    window.open(`https://wa.me/${lead.phone.replace(/\D/g, '')}`, '_blank');
                                }}
                                className="flex flex-col items-center justify-center gap-2 bg-muted/20 hover:bg-emerald-500/10 p-4 lg:p-5 rounded-[2rem] border border-border/10 hover:border-emerald-500/40 transition-all group"
                            >
                                <MessageSquare className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                                <span className="font-black text-[8px] uppercase tracking-widest">Zap</span>
                            </button>
                        </div>
                    </div>

                    <div className="bg-card border border-border/40 rounded-[2rem] p-6 space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center justify-between">
                            Métricas Clave
                            <Edit2 className="w-3 h-3 cursor-pointer hover:text-primary transition-colors" />
                        </h3>
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground">Potencial de Cierre</p>
                                    <span className="text-xs font-black text-primary">85%</span>
                                </div>
                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary shadow-[0_0_8px_rgba(250,181,16,0.6)]" style={{ width: '85%' }}></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-muted/20 rounded-2xl border border-border/10">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Inversión (Estimada)</p>
                                    <p className="text-lg font-black text-foreground">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(leadTasks.reduce((sum, t) => sum + (t.numericValue || 0), 0))}</p>
                                </div>
                                <div className="p-4 bg-muted/20 rounded-2xl border border-border/10">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Etapa</p>
                                    <p className="text-lg font-black text-primary capitalize">{lead.status}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Activity Feed & AI Tabs */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-card border border-border/40 rounded-[2.5rem] overflow-hidden shadow-lg flex flex-col h-full">
                        <div className="border-b border-border/40 bg-muted/10 px-6 lg:px-8">
                            <div className="flex gap-6 lg:gap-10 overflow-x-auto scrollbar-hide">
                                {['Actividad', 'Razonamiento IA', 'Cotizaciones', 'Correos', 'Notas'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={clsx(
                                            "py-6 text-[10px] lg:text-xs font-black uppercase tracking-[0.2em] border-b-2 transition-all relative whitespace-nowrap",
                                            activeTab === tab
                                                ? "border-primary text-primary"
                                                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/40"
                                        )}
                                    >
                                        {tab}
                                        {activeTab === tab && (
                                            <span className="absolute bottom-0 left-0 right-0 h-1 bg-primary blur-[4px] opacity-30"></span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-8 flex-1">
                            {activeTab === 'Razonamiento IA' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-white">Log de Razonamiento (Engine Insights)</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded">Certeza 94%</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {[
                                            {
                                                step: 'Análisis de Intención',
                                                status: 'Success',
                                                content: 'El cliente menciona "prioridad" y "tercer trimestre", lo que indica una urgencia alta para el proyecto de urbanismo.'
                                            },
                                            {
                                                step: 'Evaluación de Capacidad',
                                                status: 'Success',
                                                content: 'Revisión de inventario: Disponemos de moldes H-20 para entrega inmediata. Capacidad de producción libre en planta principal.'
                                            },
                                            {
                                                step: 'Cálculo de Score',
                                                status: 'Info',
                                                content: 'Asignación de +25 pts por volumen (>50 unidades) y +15 pts por recurrencia histórica con Arte Concreto.'
                                            },
                                            {
                                                step: 'Predicción de Riesgo',
                                                status: 'Warning',
                                                content: 'Posible cuello de botella en logística pesada si el pedido se retrasa más de 10 días.'
                                            }
                                        ].map((log, i) => (
                                            <div key={i} className="flex gap-5 p-6 bg-white/[0.02] border border-white/5 rounded-3xl hover:border-white/10 transition-all">
                                                <div className={clsx(
                                                    "w-1 h-full rounded-full shrink-0",
                                                    log.status === 'Success' ? "bg-emerald-500" : log.status === 'Warning' ? "bg-amber-500" : "bg-sky-500"
                                                )}></div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{log.step}</span>
                                                        <Clock className="w-3 h-3 text-white/20" />
                                                    </div>
                                                    <p className="text-sm font-medium text-white/90 leading-relaxed">{log.content}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-8 bg-muted/20 border border-dashed border-border/40 rounded-[2.5rem] mt-10">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <ExternalLink className="w-4 h-4 text-primary" />
                                            </div>
                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-primary">Metadata Cruda del Motor</h4>
                                        </div>
                                        <pre className="text-[10px] font-mono text-muted-foreground/60 overflow-x-auto">
                                            {JSON.stringify({
                                                model: "gpt-4o-2024-05-13",
                                                processing_time: "842ms",
                                                tokens_used: 124,
                                                intent_classification: "commercial_high_value",
                                                recommended_action_id: "suministro_prioritario_01"
                                            }, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'Actividad' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                                    {/* AI Insight Card */}
                                    <div className="bg-primary/5 border border-primary/20 rounded-3xl p-5 lg:p-6 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform hidden lg:block">
                                            <Sparkles className="w-10 h-10 text-primary" />
                                        </div>
                                        <div className="flex flex-col lg:flex-row gap-5">
                                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 shadow-lg shadow-primary/5">
                                                <Sparkles className="w-6 h-6 text-primary" />
                                            </div>
                                            <div className="space-y-4">
                                                <p className="text-[13px] lg:text-[15px] leading-relaxed text-foreground/90 font-medium">
                                                    He analizado la interacción reciente con <span className="text-primary font-black">Robert Sterling</span>. Sugiero ofrecer el <span className="underline decoration-primary/40 underline-offset-8 font-bold">Plan de Suministro Prioritario</span> para asegurar la plaza este trimestre.
                                                </p>
                                                <div className="flex flex-col lg:flex-row gap-3">
                                                    <button className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest bg-primary text-black px-6 py-2.5 rounded-xl hover:bg-primary/80 transition-all active:scale-95 shadow-lg shadow-primary/20">Aplicar Estrategia</button>
                                                    <button className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest bg-muted/40 text-muted-foreground px-6 py-2.5 rounded-xl hover:bg-muted/60 transition-all border border-border/40">Ignorar</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Timeline Items */}
                                    <div className="relative pl-10 space-y-12 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-primary/40 before:via-border/40 before:to-transparent">
                                        {leadActivity.length > 0 ? leadActivity.map((log) => (
                                            <div key={log.id} className="relative">
                                                <div className="absolute -left-[35px] top-1.5 w-9 h-9 rounded-xl bg-card border-2 border-primary flex items-center justify-center shadow-lg shadow-primary/10 z-10">
                                                    <Clock className="w-4 h-4 text-primary" />
                                                </div>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="text-sm font-black uppercase tracking-tight">{log.action.replace('_', ' ')}</h4>
                                                        <p className="text-xs text-muted-foreground mt-1.5 font-medium leading-relaxed">{log.details}</p>
                                                    </div>
                                                    <span className="text-[10px] font-black text-muted-foreground uppercase bg-muted/30 px-2 py-1 rounded">{new Date(log.timestamp).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center py-10">
                                                <p className="text-xs font-black uppercase text-white/20 tracking-widest">Sin actividad registrada</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'Cotizaciones' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-white">Propuestas Enviadas (Smart Tracking)</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                            <span className="text-[9px] font-black uppercase text-emerald-500">Motor de Rastreo Activo</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {leadQuotes.length > 0 ? leadQuotes.map((quote) => (
                                            <div key={quote.id} className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl hover:border-primary/20 transition-all group relative overflow-hidden">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-12 h-12 rounded-[1.25rem] bg-muted/20 flex items-center justify-center text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-all">
                                                            <FileText className="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <p className="text-base font-black text-white">{quote.number}</p>
                                                            <p className="text-[10px] font-black uppercase text-white/30 tracking-widest">{quote.date}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-lg font-black text-white">{quote.total}</p>
                                                        <span className={clsx(
                                                            "text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest",
                                                            quote.status === 'Approved' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-white/5 text-white/40 border-white/10"
                                                        )}>
                                                            {quote.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center py-20 bg-white/[0.01] rounded-[2rem] border border-dashed border-white/5">
                                                <p className="text-xs font-black uppercase text-white/20 tracking-widest italic">No hay cotizaciones activas</p>
                                            </div>
                                        )}
                                    </div>

                                    <button className="w-full py-5 border-2 border-dashed border-white/5 rounded-3xl text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-primary hover:border-primary/20 hover:bg-primary/5 transition-all flex items-center justify-center gap-3">
                                        <Plus className="w-4 h-4" />
                                        Generar Nueva Propuesta Inteligente
                                    </button>
                                </div>
                            )}

                            {activeTab === 'Correos' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-black uppercase tracking-widest">Historial de Corresponencia</h3>
                                        <button className="bg-primary/10 text-primary text-[10px] font-black px-4 py-2 rounded-xl border border-primary/20 hover:bg-primary hover:text-black transition-all">+ Redactar Correo</button>
                                    </div>
                                    {[
                                        { subject: 'Seguimiento: Propuesta Mobiliario Parque Central', date: 'Hace 2 horas', status: 'Leído' },
                                        { subject: 'Confirmación de especificaciones técnicas v2', date: 'Ayer', status: 'Leído' },
                                        { subject: 'Re: Catálogo Industrial Concrete Arte', date: 'Oct 15', status: 'Leído' }
                                    ].map((email, i) => (
                                        <div key={i} className="flex items-center gap-4 p-5 bg-muted/5 border border-border/40 rounded-2xl hover:bg-muted/10 transition-colors cursor-pointer group">
                                            <div className="w-10 h-10 rounded-xl bg-muted/20 flex items-center justify-center text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-all">
                                                <Mail className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold truncate">{email.subject}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase font-black mt-1 tracking-tighter">{email.date}</p>
                                            </div>
                                            <span className="text-[9px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">{email.status}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'Notas' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300 h-full flex flex-col">
                                    <div className="relative group">
                                        <textarea
                                            placeholder="Añadir una nota interna sobre el proyecto o el lead..."
                                            className="w-full bg-muted/20 border-2 border-dashed border-border/40 rounded-3xl p-6 text-sm focus:border-primary focus:bg-muted/30 outline-none transition-all resize-none min-h-[150px] font-medium"
                                        />
                                        <button className="absolute bottom-6 right-6 bg-primary text-black font-black px-6 py-2.5 rounded-xl text-[10px] uppercase tracking-widest opacity-0 group-focus-within:opacity-100 transition-all shadow-xl shadow-primary/20">Guardar Nota</button>
                                    </div>

                                    <div className="space-y-4 pt-4">
                                        {[
                                            { text: 'El cliente prefiere el acabado en concreto pulido color gris ceniza para las 50 bancas del proyecto.', date: 'Oct 12', author: 'Juan Sierra' },
                                            { text: 'Pendiente confirmar si requieren transporte industrial pesado o si ellos retiran en planta.', date: 'Oct 10', author: 'Admin Core' }
                                        ].map((note, i) => (
                                            <div key={i} className="p-5 bg-primary/5 border-l-4 border-primary rounded-r-2xl space-y-3">
                                                <p className="text-sm font-medium leading-relaxed">{note.text}</p>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary">{note.author[0]}</div>
                                                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{note.author} • {note.date}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div >
        </div >
    );
}
