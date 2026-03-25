"use client";

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Edit2,
    Share2,
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
    Plus,
    Send
} from 'lucide-react';

import Link from 'next/link';
import { clsx } from 'clsx';
import { useApp, Activity } from '@/context/AppContext';

const STATUS_LABEL: Record<string, string> = {
    'Active': 'Activo',
    'Lead': 'Lead',
    'Inactive': 'Inactivo'
};

export default function Lead360Page() {
    const params = useParams();
    const router = useRouter();
    const { clients, addAuditLog, sellers, tasks, quotes, auditLogs, currentUser, updateClient } = useApp();
    const [activeTab, setActiveTab] = useState('Actividad');
    const [noteText, setNoteText] = useState('');
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', company: '', email: '', phone: '', city: '', status: '' });
    const isSuperAdmin = currentUser?.role?.toLowerCase().includes('superadmin') || currentUser?.role?.toLowerCase() === 'admin';
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignSellerId, setAssignSellerId] = useState('');

    const leadId = params.id as string;
    const lead = clients.find(c => c.id === leadId);

    const leadQuotesAll = quotes.filter(q => q.clientId === leadId);
    const leadTasks = tasks.filter(t =>
        t.clientId === leadId ||
        leadQuotesAll.some(q => q.id === t.quoteId) ||
        (lead && t.client && (t.client === lead.company || t.client === lead.name))
    );
    const leadQuotes = leadQuotesAll;
    const leadActivity = auditLogs.filter(log => log.targetId === leadId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const sentQuotes = leadQuotes.filter(q => q.status === 'Sent' || q.status === 'Approved');

    // Unified timeline: merge audit logs + quotes + task notes + client notes
    const unifiedTimeline = [
        // Audit logs for this client
        ...auditLogs
            .filter(log => log.targetId === leadId || log.targetName === (lead?.company || lead?.name))
            .map(log => ({
                id: log.id,
                type: log.action as string,
                title: log.action === 'QUOTE_SENT' ? '📄 Cotización / Email enviado'
                     : log.action === 'WHATSAPP_SENT' ? '💬 WhatsApp enviado'
                     : log.action === 'CALL_MADE' ? '📞 Llamada registrada'
                     : log.action === 'SYSTEM_LOGIN' ? '🔐 Acceso al sistema'
                     : log.action === 'SALE_REGISTERED' ? '✅ Venta registrada'
                     : log.action.replace(/_/g, ' '),
                detail: log.details,
                date: log.timestamp,
                author: log.userName,
                color: log.action === 'WHATSAPP_SENT' ? 'emerald'
                     : log.action === 'CALL_MADE' ? 'blue'
                     : log.action === 'SALE_REGISTERED' ? 'emerald'
                     : 'primary',
            })),
        // Quotes created
        ...leadQuotes.map(q => ({
            id: `q-${q.id}`,
            type: 'QUOTE_CREATED',
            title: `📋 Cotización ${q.number} — ${q.status === 'Sent' ? 'Enviada' : q.status === 'Approved' ? 'Aprobada' : q.status === 'Draft' ? 'Borrador' : q.status}`,
            detail: `Total: ${q.total}${q.sentByName ? ` · Por: ${q.sentByName}` : ''}`,
            date: q.sentAt || q.date,
            author: q.sellerName || '',
            color: q.status === 'Approved' ? 'emerald' : q.status === 'Sent' ? 'blue' : 'muted',
        })),
        // Pipeline activities (calls, whatsapp, notes, system events)
        ...leadTasks.flatMap(t => (t.activities || []).map((a: Activity) => ({
            id: `ta-${t.id}-${a.id}`,
            type: a.type === 'call' ? 'CALL_MADE'
                : a.type === 'whatsapp' ? 'WHATSAPP_SENT'
                : a.type === 'email' ? 'QUOTE_SENT'
                : 'NOTE',
            title: a.type === 'call' ? '📞 Llamada registrada'
                 : a.type === 'whatsapp' ? '💬 WhatsApp enviado'
                 : a.type === 'email' ? '📧 Email de seguimiento'
                 : a.type === 'system' ? '⚙️ Evento del sistema'
                 : '📝 Nota del Pipeline',
            detail: a.content,
            date: new Date(a.timestamp).toISOString(),
            author: '',
            color: a.type === 'call' ? 'blue'
                 : a.type === 'whatsapp' ? 'emerald'
                 : a.type === 'system' ? 'muted'
                 : 'amber',
        }))),
        // Client notes
        ...(lead?.notes || []).map((n: {text: string; date: string; author: string}, i: number) => ({
            id: `cn-${i}`,
            type: 'NOTE',
            title: '📝 Nota del cliente',
            detail: n.text,
            date: n.date,
            author: n.author || '',
            color: 'amber',
        })),
    ].sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        return isNaN(db) || isNaN(da) ? 0 : db - da;
    });

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

    const handleSaveNote = () => {
        if (!lead || !currentUser || !noteText.trim()) return;
        const newNote = {
            text: noteText.trim(),
            date: new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }),
            author: currentUser.name
        };
        const existingNotes = lead.notes || [];
        updateClient(lead.id, { notes: [newNote, ...existingNotes] });
        setNoteText('');
    };

    const handleRedactarCorreo = () => {
        if (!lead) return;
        window.location.href = `mailto:${lead.email}`;
    };

    const handleAssignSeller = () => {
        if (!lead || !currentUser) return;
        const seller = sellers.find(s => s.id === assignSellerId);
        if (!seller) return;
        updateClient(lead.id, {
            assignedTo: seller.id,
            assignedToName: seller.name
        });
        addAuditLog({
            userId: currentUser.id,
            userName: currentUser.name,
            userRole: currentUser.role,
            action: 'LEAD_CREATED',
            targetId: lead.id,
            targetName: lead.company || lead.name,
            details: `Cliente asignado a vendedor: ${seller.name} (antes: ${lead.assignedToName || 'Sin asignar'})`,
            verified: true
        });
        setShowAssignModal(false);
    };

    if (!lead) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-muted-foreground/50 font-black uppercase tracking-[0.3em]">Cliente no encontrado</p>
            </div>
        );
    }

    return (
        <>
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
                    <button
                        onClick={() => {
                            const info = `${lead.name} | ${lead.email} | ${lead.phone}`;
                            navigator.clipboard?.writeText(info).catch(() => {});
                        }}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border border-border/40 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-widest hover:bg-muted/50 transition-colors"
                    >
                        <Share2 className="w-4 h-4" />
                        <span>Exportar</span>
                    </button>
                    <button
                        onClick={() => { setEditForm({ name: lead.name, company: lead.company || '', email: lead.email, phone: lead.phone || '', city: lead.city || '', status: lead.status }); setIsEditOpen(true); }}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-black rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                    >
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
                                    <span className="text-4xl lg:text-6xl font-black text-primary relative z-10">{lead.score || 85}</span>
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

                            {/* Assigned Seller — SuperAdmin only */}
                            {isSuperAdmin && (
                                <div className="pt-4 border-t border-border/20">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Vendedor Asignado</p>
                                        <button
                                            onClick={() => { setAssignSellerId(lead.assignedTo || ''); setShowAssignModal(true); }}
                                            className="text-[9px] font-black uppercase text-primary hover:text-foreground transition-colors flex items-center gap-1"
                                        >
                                            <Edit2 className="w-3 h-3" />
                                            Asignar
                                        </button>
                                    </div>
                                    {lead.assignedToName ? (
                                        <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-xl border border-primary/10">
                                            <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center text-[9px] font-black text-primary">
                                                {lead.assignedToName[0]}
                                            </div>
                                            <span className="text-xs font-black text-foreground">{lead.assignedToName}</span>
                                        </div>
                                    ) : (
                                        <p className="text-[10px] text-muted-foreground/50 italic">Sin asignar</p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/20">
                            <button
                                onClick={() => {
                                    handleLogContact('QUOTE_SENT', 'Contacto por correo electrónico');
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
                                <span className="font-black text-[8px] uppercase tracking-widest">WhatsApp</span>
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
                                    <span className="text-xs font-black text-primary">{lead.score || 85}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary shadow-[0_0_8px_rgba(250,181,16,0.6)]" style={{ width: `${lead.score || 85}%` }}></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-muted/20 rounded-2xl border border-border/10">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Inversión (Estimada)</p>
                                    <p className="text-lg font-black text-foreground">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(leadTasks.reduce((sum, t) => sum + (t.numericValue || 0), 0))}</p>
                                </div>
                                <div className="p-4 bg-muted/20 rounded-2xl border border-border/10">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Etapa</p>
                                    <p className="text-lg font-black text-primary capitalize">{STATUS_LABEL[lead.status] || lead.status}</p>
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
                                        <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Log de Razonamiento (Engine Insights)</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded">Score {lead.score || 0}%</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {[
                                            {
                                                step: 'Análisis de Intención',
                                                status: 'Success',
                                                content: `El cliente ${lead.company || lead.name} tiene ${leadQuotes.length} cotizacion(es) y ${leadTasks.length} tarea(s) activa(s). Perfil con ${lead.score || 85}% de score.`
                                            },
                                            {
                                                step: 'Evaluación de Capacidad',
                                                status: 'Success',
                                                content: `Categoría: ${lead.category}. Ubicación: ${lead.city}. Registro desde: ${lead.registrationDate}.`
                                            },
                                            {
                                                step: 'Cálculo de Score',
                                                status: 'Info',
                                                content: `Score asignado: ${lead.score || 85}/100. Estado actual: ${STATUS_LABEL[lead.status] || lead.status}. LTV acumulado: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(lead.ltv || 0)}.`
                                            },
                                            {
                                                step: 'Recomendación',
                                                status: sentQuotes.length > 0 ? 'Warning' : 'Info',
                                                content: sentQuotes.length > 0
                                                    ? `${sentQuotes.length} cotización(es) enviada(s). Hacer seguimiento para cierre.`
                                                    : 'Sin cotizaciones enviadas. Considerar enviar propuesta para activar el proceso de compra.'
                                            }
                                        ].map((log, i) => (
                                            <div key={i} className="flex gap-5 p-6 bg-muted/10 border border-border/20 rounded-3xl hover:border-border/30 transition-all">
                                                <div className={clsx(
                                                    "w-1 h-full rounded-full shrink-0",
                                                    log.status === 'Success' ? "bg-emerald-500" : log.status === 'Warning' ? "bg-amber-500" : "bg-sky-500"
                                                )}></div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{log.step}</span>
                                                        <Clock className="w-3 h-3 text-muted-foreground/30" />
                                                    </div>
                                                    <p className="text-sm font-medium text-foreground/90 leading-relaxed">{log.content}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-8 bg-muted/20 border border-dashed border-border/40 rounded-[2.5rem] mt-10">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <ExternalLink className="w-4 h-4 text-primary" />
                                            </div>
                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-primary">Metadata del Cliente</h4>
                                        </div>
                                        <pre className="text-[10px] font-mono text-muted-foreground/60 overflow-x-auto">
                                            {JSON.stringify({
                                                id: lead.id,
                                                status: lead.status,
                                                score: lead.score,
                                                category: lead.category,
                                                city: lead.city,
                                                ltv: lead.ltv,
                                                quotes_count: leadQuotes.length,
                                                tasks_count: leadTasks.length,
                                                activity_count: leadActivity.length
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
                                                    Cliente <span className="text-primary font-black">{lead.company || lead.name}</span> con score <span className="text-primary font-black">{lead.score || 85}/100</span>. {sentQuotes.length > 0 ? `${sentQuotes.length} cotización(es) enviada(s). Hacer seguimiento para cierre.` : 'Sin cotizaciones activas. Considera generar una propuesta.'}
                                                </p>
                                                <div className="flex flex-col lg:flex-row gap-3">
                                                    <button
                                                        onClick={() => router.push(`/quotes/new?clientId=${lead.id}`)}
                                                        className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest bg-primary text-black px-6 py-2.5 rounded-xl hover:bg-primary/80 transition-all active:scale-95 shadow-lg shadow-primary/20"
                                                    >
                                                        Generar Cotización
                                                    </button>
                                                    <button
                                                        onClick={() => updateClient(lead.id, { status: 'Inactive' })}
                                                        className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest bg-muted/40 text-muted-foreground px-6 py-2.5 rounded-xl hover:bg-muted/60 transition-all border border-border/40"
                                                    >Ignorar</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Timeline Items */}
                                    <div className="relative pl-10 space-y-6 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-primary/40 before:via-border/40 before:to-transparent">
                                        {unifiedTimeline.length > 0 ? unifiedTimeline.map((event) => (
                                            <div key={event.id} className="relative">
                                                <div className={`absolute -left-[35px] top-1.5 w-9 h-9 rounded-xl border-2 flex items-center justify-center shadow-lg z-10 bg-card ${
                                                    event.color === 'emerald' ? 'border-emerald-500 shadow-emerald-500/10' :
                                                    event.color === 'blue' ? 'border-blue-500 shadow-blue-500/10' :
                                                    event.color === 'amber' ? 'border-amber-500 shadow-amber-500/10' :
                                                    'border-primary shadow-primary/10'
                                                }`}>
                                                    <span className="text-sm leading-none">{
                                                        event.type === 'WHATSAPP_SENT' ? '💬' :
                                                        event.type === 'CALL_MADE' ? '📞' :
                                                        event.type === 'SALE_REGISTERED' ? '✅' :
                                                        event.type === 'NOTE' ? '📝' :
                                                        event.type === 'QUOTE_CREATED' ? '📋' : '📄'
                                                    }</span>
                                                </div>
                                                <div className="bg-card border border-border/40 rounded-2xl p-4 hover:border-primary/20 transition-colors">
                                                    <div className="flex justify-between items-start gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="text-sm font-black text-foreground">{event.title}</h4>
                                                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{event.detail}</p>
                                                            {event.author && <p className="text-[10px] text-muted-foreground/50 mt-1">por {event.author}</p>}
                                                        </div>
                                                        <span className="text-[10px] font-black text-muted-foreground bg-muted/30 px-2 py-1 rounded-lg whitespace-nowrap shrink-0">
                                                            {(() => { try { return new Date(event.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return String(event.date); } })()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center py-10">
                                                <p className="text-xs font-black uppercase text-muted-foreground/30 tracking-widest">Sin actividad registrada aún</p>
                                                <p className="text-[10px] text-muted-foreground/20 mt-1">Las acciones aparecerán aquí automáticamente</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'Cotizaciones' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Propuestas Enviadas</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                            <span className="text-[9px] font-black uppercase text-emerald-500">{leadQuotes.length} cotización(es)</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {leadQuotes.length > 0 ? leadQuotes.map((quote) => (
                                            <div key={quote.id} className="p-6 bg-muted/10 border border-border/20 rounded-3xl hover:border-primary/20 transition-all group relative overflow-hidden">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-12 h-12 rounded-[1.25rem] bg-muted/20 flex items-center justify-center text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-all">
                                                            <FileText className="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <p className="text-base font-black text-foreground">{quote.number}</p>
                                                            <p className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">{quote.date}</p>
                                                            {quote.sentByName && (
                                                                <p className="text-[10px] text-muted-foreground/50 mt-0.5">Enviado por {quote.sentByName}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-lg font-black text-foreground">{quote.total}</p>
                                                        <span className={clsx(
                                                            "text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest",
                                                            quote.status === 'Approved' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                            quote.status === 'Sent' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                                            "bg-muted/20 text-muted-foreground/50 border-border/30"
                                                        )}>
                                                            {quote.status === 'Sent' ? 'Enviado' : quote.status === 'Approved' ? 'Aprobado' : quote.status === 'Draft' ? 'Borrador' : quote.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center py-20 bg-muted/10 rounded-[2rem] border border-dashed border-border/20">
                                                <p className="text-xs font-black uppercase text-muted-foreground/30 tracking-widest italic">No hay cotizaciones activas</p>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => router.push(`/quotes/new?clientId=${lead.id}`)}
                                        className="w-full py-5 border-2 border-dashed border-border/20 rounded-3xl text-[10px] font-black uppercase tracking-widest text-muted-foreground/30 hover:text-primary hover:border-primary/20 hover:bg-primary/5 transition-all flex items-center justify-center gap-3"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Generar Nueva Propuesta
                                    </button>
                                </div>
                            )}

                            {activeTab === 'Correos' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-black uppercase tracking-widest">Historial de Correspondencia</h3>
                                        <button
                                            onClick={handleRedactarCorreo}
                                            className="bg-primary/10 text-primary text-[10px] font-black px-4 py-2 rounded-xl border border-primary/20 hover:bg-primary hover:text-black transition-all flex items-center gap-2"
                                        >
                                            <Send className="w-3 h-3" />
                                            Redactar Correo
                                        </button>
                                    </div>

                                    {sentQuotes.length > 0 ? sentQuotes.map((quote) => (
                                        <div key={quote.id} className="flex items-center gap-4 p-5 bg-muted/5 border border-border/40 rounded-2xl hover:bg-muted/10 transition-colors cursor-pointer group">
                                            <div className="w-10 h-10 rounded-xl bg-muted/20 flex items-center justify-center text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-all">
                                                <Mail className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold truncate">Cotización {quote.number} — {quote.clientCompany || 'Propuesta Comercial'}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase font-black mt-1 tracking-tighter">
                                                    {quote.sentAt ? new Date(quote.sentAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : quote.date}
                                                    {quote.sentByName ? ` · ${quote.sentByName}` : ''}
                                                </p>
                                            </div>
                                            <span className="text-[9px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">Enviado</span>
                                        </div>
                                    )) : (
                                        <div className="text-center py-16 bg-muted/5 border border-dashed border-border/40 rounded-[2rem]">
                                            <Mail className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                                            <p className="text-xs font-black uppercase text-muted-foreground/30 tracking-widest">Sin correos enviados aún</p>
                                            <p className="text-[10px] text-muted-foreground/40 mt-2">Los correos de cotizaciones aparecerán aquí</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'Notas' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300 h-full flex flex-col">
                                    <div className="relative group">
                                        <textarea
                                            value={noteText}
                                            onChange={(e) => setNoteText(e.target.value)}
                                            placeholder="Añadir una nota interna sobre el proyecto o el lead..."
                                            className="w-full bg-muted/20 border-2 border-dashed border-border/40 rounded-3xl p-6 text-sm focus:border-primary focus:bg-muted/30 outline-none transition-all resize-none min-h-[150px] font-medium"
                                        />
                                        {noteText.trim() && (
                                            <button
                                                onClick={handleSaveNote}
                                                className="absolute bottom-6 right-6 bg-primary text-black font-black px-6 py-2.5 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-primary/20 hover:bg-primary/90"
                                            >
                                                Guardar Nota
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-4 pt-4">
                                        {/* All notes: client notes + pipeline task notes */}
                                        {(() => {
                                            const allNotes = [
                                                ...(lead.notes || []).map((n: {text: string; date: string; author: string}) => ({ text: n.text, date: n.date, author: n.author, source: 'Cliente' })),
                                                ...leadTasks.flatMap(t => (t.activities || []).map((a: Activity) => ({
                                                    text: a.content,
                                                    date: new Date(a.timestamp).toISOString(),
                                                    author: '',
                                                    source: a.type === 'call' ? '📞 Llamada' : a.type === 'whatsapp' ? '💬 WhatsApp' : a.type === 'email' ? '📧 Email' : a.type === 'system' ? '⚙️ Sistema' : '📝 Pipeline',
                                                }))),
                                            ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                                            if (allNotes.length === 0) return (
                                                <div className="text-center py-8">
                                                    <StickyNote className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                                                    <p className="text-xs font-black uppercase text-muted-foreground/30 tracking-widest">Sin notas aún</p>
                                                </div>
                                            );

                                            return (
                                                <div className="space-y-3">
                                                    {allNotes.map((note, i) => (
                                                        <div key={i} className="p-5 bg-primary/5 border-l-4 border-primary rounded-r-2xl space-y-2">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className={`text-[9px] font-black tracking-widest px-2 py-0.5 rounded-full ${note.source === 'Cliente' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-600'}`}>
                                                                    {note.source}
                                                                </span>
                                                                <span className="text-[10px] text-muted-foreground/50">{note.date}</span>
                                                            </div>
                                                            <p className="text-sm font-medium leading-relaxed text-foreground">{note.text}</p>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary">{(note.author || 'S')[0]}</div>
                                                                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{note.author || 'Sistema'}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Edit Modal */}
        {isEditOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-card border border-border rounded-[2rem] w-full max-w-lg shadow-2xl p-8 space-y-6 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-black uppercase tracking-tight">Editar Cliente</h2>
                        <button onClick={() => setIsEditOpen(false)} className="p-2 hover:bg-muted rounded-xl transition-all">✕</button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {([
                            { label: 'Nombre', key: 'name', type: 'text' },
                            { label: 'Empresa', key: 'company', type: 'text' },
                            { label: 'Email', key: 'email', type: 'email' },
                            { label: 'Teléfono', key: 'phone', type: 'tel' },
                            { label: 'Ciudad', key: 'city', type: 'text' },
                        ] as { label: string; key: keyof typeof editForm; type: string }[]).map(f => (
                            <div key={f.key} className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{f.label}</label>
                                <input
                                    type={f.type}
                                    value={editForm[f.key]}
                                    onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                    className="w-full bg-muted/30 border border-border rounded-xl px-4 py-2.5 text-sm font-bold focus:border-primary/50 outline-none"
                                />
                            </div>
                        ))}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</label>
                            <select
                                value={editForm.status}
                                onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                                className="w-full bg-muted/30 border border-border rounded-xl px-4 py-2.5 text-sm font-bold focus:border-primary/50 outline-none"
                            >
                                <option value="Active">Activo</option>
                                <option value="Lead">Lead</option>
                                <option value="Inactive">Inactivo</option>
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={() => { updateClient(lead.id, { ...editForm, status: editForm.status as 'Active' | 'Lead' | 'Inactive' }); setIsEditOpen(false); }}
                        className="w-full bg-primary text-black font-black py-3 rounded-xl uppercase tracking-widest hover:bg-primary/90 transition-all"
                    >
                        Guardar Cambios
                    </button>
                </div>
            </div>
        )}

        {showAssignModal && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                <div className="bg-card border border-border rounded-[2rem] p-8 max-w-sm w-full shadow-2xl">
                    <h3 className="text-base font-black text-foreground mb-1">Asignar Vendedor</h3>
                    <p className="text-xs text-muted-foreground mb-6">Cliente: <strong>{lead.company || lead.name}</strong></p>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto mb-6">
                        {sellers.filter(s => s.status === 'Activo' || !s.status).map(s => (
                            <button
                                key={s.id}
                                onClick={() => setAssignSellerId(s.id)}
                                className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all ${assignSellerId === s.id ? 'bg-primary/10 border-primary/40 text-foreground' : 'border-border/40 hover:bg-muted/30 text-foreground'}`}
                            >
                                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary shrink-0">
                                    {s.name[0]}
                                </div>
                                <div>
                                    <p className="text-sm font-black">{s.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{s.role}</p>
                                </div>
                                {assignSellerId === s.id && <div className="ml-auto w-4 h-4 rounded-full bg-primary flex items-center justify-center"><svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg></div>}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setShowAssignModal(false)} className="flex-1 py-3 border border-border/40 rounded-xl text-sm font-black text-muted-foreground hover:bg-muted/20 transition-all">Cancelar</button>
                        <button onClick={handleAssignSeller} disabled={!assignSellerId} className="flex-1 py-3 bg-primary text-black rounded-xl text-sm font-black disabled:opacity-50 hover:bg-primary/90 transition-all">Confirmar</button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
