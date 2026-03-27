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

    // Also find quotes linked to duplicate clients (same email)
    const sameEmailClients = lead ? clients.filter(c =>
        c.id !== leadId &&
        c.email && lead.email &&
        c.email.toLowerCase().trim() === lead.email.toLowerCase().trim()
    ) : [];
    const sameEmailIds = new Set([leadId, ...sameEmailClients.map(c => c.id)]);
    const leadQuotesAll = quotes.filter(q => sameEmailIds.has(q.clientId) || q.clientEmail?.toLowerCase().trim() === lead?.email?.toLowerCase().trim());

    const normalize = (s?: string) => (s || '').toLowerCase().trim();
    const leadTasks = tasks.filter((t: any) =>
        sameEmailIds.has(t.clientId) ||
        leadQuotesAll.some(q => q.id === t.quoteId) ||
        (lead?.email && t.email && normalize(t.email) === normalize(lead.email)) ||
        (lead && t.client && (
            normalize(t.client) === normalize(lead.company) ||
            normalize(t.client) === normalize(lead.name)
        ))
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
        <div className="space-y-6">
            {/* Breadcrumbs & Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/pipeline" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        <span>Volver al Pipeline</span>
                    </Link>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            const info = `${lead.name} | ${lead.email} | ${lead.phone}`;
                            navigator.clipboard?.writeText(info).catch(() => {});
                        }}
                        className="bg-white border border-border text-foreground font-medium rounded-xl px-4 py-2 hover:bg-muted transition-colors flex items-center gap-2 text-sm"
                    >
                        <Share2 className="w-4 h-4" />
                        <span>Exportar</span>
                    </button>
                    <button
                        onClick={() => { setEditForm({ name: lead.name, company: lead.company || '', email: lead.email, phone: lead.phone || '', city: lead.city || '', status: lead.status }); setIsEditOpen(true); }}
                        className="bg-primary text-black font-bold rounded-xl px-4 py-2 hover:brightness-105 shadow-[0_2px_8px_rgba(250,181,16,0.3)] transition-all flex items-center gap-2 text-sm"
                    >
                        <Edit2 className="w-4 h-4" />
                        <span>Editar</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Info Cards */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Profile Card */}
                    <div className="surface-card p-6 space-y-6">
                        {/* Score badge */}
                        <div className="flex flex-col items-center justify-center space-y-4 pt-2">
                            <div className="relative">
                                <div className="w-24 h-24 rounded-2xl border-4 border-primary/20 flex items-center justify-center bg-primary/5 relative overflow-hidden">
                                    <span className="text-4xl font-black text-primary relative z-10">{lead.score || 85}</span>
                                </div>
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-primary text-black text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border-2 border-white whitespace-nowrap">
                                    Lead Score
                                </div>
                            </div>
                            <div className="text-center pt-2">
                                <h2 className="text-xl font-black tracking-tight text-foreground">{lead.company || lead.name}</h2>
                                <p className="text-xs text-primary font-bold uppercase tracking-widest mt-1">{lead.company ? 'Socio Corporativo' : 'Cliente Individual'}</p>
                            </div>
                        </div>

                        {/* Contact info rows */}
                        <div className="border-t border-border pt-4 space-y-0">
                            {[
                                { icon: User, label: 'Contacto Principal', value: lead.name },
                                { icon: Mail, label: 'Correo', value: lead.email },
                                { icon: Phone, label: 'Teléfono', value: lead.phone },
                                { icon: MapPin, label: 'Ubicación', value: lead.city || 'No registrada' }
                            ].map((info) => (
                                <div key={info.label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <info.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                                        <span className="text-xs text-muted-foreground">{info.label}</span>
                                    </div>
                                    <span className="text-sm font-semibold text-foreground truncate ml-2 max-w-[55%] text-right">{info.value}</span>
                                </div>
                            ))}

                            {/* Assigned Seller — SuperAdmin only */}
                            {isSuperAdmin && (
                                <div className="pt-4 border-t border-border mt-2">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-bold uppercase tracking-wide text-foreground">Vendedor Asignado</p>
                                        <button
                                            onClick={() => { setAssignSellerId(lead.assignedTo || ''); setShowAssignModal(true); }}
                                            className="text-xs font-medium text-primary hover:text-foreground transition-colors flex items-center gap-1"
                                        >
                                            <Edit2 className="w-3 h-3" />
                                            Asignar
                                        </button>
                                    </div>
                                    {lead.assignedToName ? (
                                        <div className="flex items-center gap-2 p-2 bg-muted rounded-xl border border-border">
                                            <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center text-xs font-black text-primary">
                                                {lead.assignedToName[0]}
                                            </div>
                                            <span className="text-sm font-semibold text-foreground">{lead.assignedToName}</span>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic">Sin asignar</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Quick action buttons */}
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                            <button
                                onClick={() => {
                                    handleLogContact('QUOTE_SENT', 'Contacto por correo electrónico');
                                    window.location.href = `mailto:${lead.email}`;
                                }}
                                className="flex flex-col items-center justify-center gap-2 bg-muted hover:bg-primary/10 p-4 rounded-xl border border-border hover:border-primary/40 transition-all group"
                            >
                                <Mail className="w-4 h-4 text-primary" />
                                <span className="font-bold text-[10px] uppercase tracking-wide text-foreground">Email</span>
                            </button>
                            <button
                                onClick={() => {
                                    handleLogContact('CALL_MADE', 'Llamada telefónica (Seguimiento)');
                                    window.location.href = `tel:${lead.phone}`;
                                }}
                                className="flex flex-col items-center justify-center gap-2 bg-muted hover:bg-primary/10 p-4 rounded-xl border border-border hover:border-primary/40 transition-all group"
                            >
                                <Phone className="w-4 h-4 text-primary" />
                                <span className="font-bold text-[10px] uppercase tracking-wide text-foreground">Llamar</span>
                            </button>
                            <button
                                onClick={() => {
                                    handleLogContact('WHATSAPP_SENT', 'Contacto vía WhatsApp');
                                    window.open(`https://wa.me/${lead.phone.replace(/\D/g, '')}`, '_blank');
                                }}
                                className="flex flex-col items-center justify-center gap-2 bg-muted hover:bg-emerald-50 p-4 rounded-xl border border-border hover:border-emerald-300 transition-all group"
                            >
                                <MessageSquare className="w-4 h-4 text-emerald-500" />
                                <span className="font-bold text-[10px] uppercase tracking-wide text-foreground">WhatsApp</span>
                            </button>
                        </div>
                    </div>

                    {/* Metrics Card */}
                    <div className="surface-card p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Métricas Clave</h3>
                            <Edit2 className="w-3 h-3 cursor-pointer text-muted-foreground hover:text-primary transition-colors" />
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Potencial de Cierre</p>
                                    <span className="text-sm font-bold text-primary">{lead.score || 85}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary" style={{ width: `${lead.score || 85}%` }}></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-muted rounded-xl border border-border">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Inversión (Est.)</p>
                                    <p className="text-sm font-black text-foreground">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(leadTasks.reduce((sum, t) => sum + (t.numericValue || 0), 0))}</p>
                                </div>
                                <div className="p-3 bg-muted rounded-xl border border-border">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Etapa</p>
                                    <p className="text-sm font-black text-primary capitalize">{STATUS_LABEL[lead.status] || lead.status}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Activity Feed & AI Tabs */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="surface-card overflow-hidden flex flex-col">
                        {/* Tab Nav */}
                        <div className="border-b border-border px-4 pt-4">
                            <div className="flex bg-muted p-1 rounded-xl gap-1 overflow-x-auto scrollbar-hide">
                                {['Actividad', 'Razonamiento IA', 'Cotizaciones', 'Correos', 'Notas'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={clsx(
                                            "whitespace-nowrap transition-all",
                                            activeTab === tab
                                                ? "bg-white shadow-sm rounded-lg text-foreground font-semibold px-4 py-2 text-sm"
                                                : "text-muted-foreground hover:text-foreground px-4 py-2 text-sm"
                                        )}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 flex-1">
                            {activeTab === 'Razonamiento IA' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Log de Razonamiento (Engine Insights)</h3>
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">Score {lead.score || 0}%</span>
                                    </div>

                                    <div className="space-y-3">
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
                                            <div key={i} className="flex gap-4 p-4 bg-white border border-border rounded-xl">
                                                <div className={clsx(
                                                    "w-1 rounded-full shrink-0 self-stretch",
                                                    log.status === 'Success' ? "bg-emerald-500" : log.status === 'Warning' ? "bg-amber-500" : "bg-sky-500"
                                                )}></div>
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{log.step}</span>
                                                        <Clock className="w-3 h-3 text-muted-foreground/40" />
                                                    </div>
                                                    <p className="text-sm font-medium text-foreground leading-relaxed">{log.content}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-5 bg-muted border border-border rounded-xl mt-4">
                                        <div className="flex items-center gap-3 mb-3">
                                            <ExternalLink className="w-4 h-4 text-primary" />
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Metadata del Cliente</h4>
                                        </div>
                                        <pre className="text-[10px] font-mono text-muted-foreground overflow-x-auto">
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
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    {/* AI Insight Card */}
                                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 relative overflow-hidden">
                                        <div className="flex flex-col lg:flex-row gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                                <Sparkles className="w-5 h-5 text-primary" />
                                            </div>
                                            <div className="space-y-3">
                                                <p className="text-sm leading-relaxed text-foreground font-medium">
                                                    Cliente <span className="text-primary font-bold">{lead.company || lead.name}</span> con score <span className="text-primary font-bold">{lead.score || 85}/100</span>. {sentQuotes.length > 0 ? `${sentQuotes.length} cotización(es) enviada(s). Hacer seguimiento para cierre.` : 'Sin cotizaciones activas. Considera generar una propuesta.'}
                                                </p>
                                                <div className="flex flex-col lg:flex-row gap-2">
                                                    <button
                                                        onClick={() => router.push(`/quotes/new?clientId=${lead.id}`)}
                                                        className="bg-primary text-black font-bold rounded-xl px-4 py-2 hover:brightness-105 shadow-[0_2px_8px_rgba(250,181,16,0.3)] transition-all text-xs"
                                                    >
                                                        Generar Cotización
                                                    </button>
                                                    <button
                                                        onClick={() => updateClient(lead.id, { status: 'Inactive' })}
                                                        className="bg-white border border-border text-foreground font-medium rounded-xl px-4 py-2 hover:bg-muted transition-colors text-xs"
                                                    >Ignorar</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Timeline Items */}
                                    <div className="relative pl-10 space-y-4 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
                                        {unifiedTimeline.length > 0 ? unifiedTimeline.map((event) => (
                                            <div key={event.id} className="relative">
                                                <div className={`absolute -left-[35px] top-1.5 w-8 h-8 rounded-xl border-2 flex items-center justify-center z-10 bg-white ${
                                                    event.color === 'emerald' ? 'border-emerald-400' :
                                                    event.color === 'blue' ? 'border-blue-400' :
                                                    event.color === 'amber' ? 'border-amber-400' :
                                                    'border-primary'
                                                }`}>
                                                    <span className="text-xs leading-none">{
                                                        event.type === 'WHATSAPP_SENT' ? '💬' :
                                                        event.type === 'CALL_MADE' ? '📞' :
                                                        event.type === 'SALE_REGISTERED' ? '✅' :
                                                        event.type === 'NOTE' ? '📝' :
                                                        event.type === 'QUOTE_CREATED' ? '📋' : '📄'
                                                    }</span>
                                                </div>
                                                <div className="flex gap-3 p-4 bg-white border border-border rounded-xl">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="text-sm font-bold text-foreground">{event.title}</h4>
                                                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{event.detail}</p>
                                                                {event.author && <p className="text-[10px] text-muted-foreground mt-1">por {event.author}</p>}
                                                            </div>
                                                            <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-1 rounded-lg whitespace-nowrap shrink-0">
                                                                {(() => { try { return new Date(event.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return String(event.date); } })()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center py-10">
                                                <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Sin actividad registrada aún</p>
                                                <p className="text-[10px] text-muted-foreground mt-1">Las acciones aparecerán aquí automáticamente</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'Cotizaciones' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Propuestas Enviadas</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                            <span className="text-xs font-bold text-emerald-600">{leadQuotes.length} cotización(es)</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {leadQuotes.length > 0 ? leadQuotes.map((quote) => (
                                            <Link key={quote.id} href={`/quotes/${quote.id}/edit`}
                                                className="flex items-center justify-between p-4 bg-white border border-border rounded-xl hover:border-primary/40 transition-colors group block">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all border border-border">
                                                        <FileText className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{quote.number}</p>
                                                        <p className="text-xs text-muted-foreground">{quote.date}</p>
                                                        {quote.sentByName && (
                                                            <p className="text-[10px] text-muted-foreground mt-0.5">Enviado por {quote.sentByName}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right flex flex-col items-end gap-1.5">
                                                    <p className="text-sm font-black text-foreground">{quote.total}</p>
                                                    <span className={clsx(
                                                        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold",
                                                        quote.status === 'Approved' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                                        quote.status === 'Sent' ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                                        "bg-muted text-muted-foreground border border-border"
                                                    )}>
                                                        {quote.status === 'Sent' ? 'Enviado' : quote.status === 'Approved' ? 'Aprobado' : quote.status === 'Draft' ? 'Borrador' : quote.status}
                                                    </span>
                                                </div>
                                            </Link>
                                        )) : (
                                            <div className="text-center py-16 bg-muted rounded-xl border border-border">
                                                <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest">No hay cotizaciones activas</p>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => router.push(`/quotes/new?clientId=${lead.id}`)}
                                        className="w-full py-4 border-2 border-dashed border-border rounded-xl text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Generar Nueva Propuesta
                                    </button>
                                </div>
                            )}

                            {activeTab === 'Correos' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Historial de Correspondencia</h3>
                                        <button
                                            onClick={handleRedactarCorreo}
                                            className="bg-primary text-black font-bold rounded-xl px-4 py-2 hover:brightness-105 shadow-[0_2px_8px_rgba(250,181,16,0.3)] transition-all flex items-center gap-2 text-xs"
                                        >
                                            <Send className="w-3 h-3" />
                                            Redactar Correo
                                        </button>
                                    </div>

                                    {sentQuotes.length > 0 ? sentQuotes.map((quote) => (
                                        <div key={quote.id} className="flex gap-3 p-4 bg-white border border-border rounded-xl hover:border-primary/20 transition-colors cursor-pointer group">
                                            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all border border-border shrink-0">
                                                <Mail className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold truncate">Cotización {quote.number} — {quote.clientCompany || 'Propuesta Comercial'}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {quote.sentAt ? new Date(quote.sentAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : quote.date}
                                                    {quote.sentByName ? ` · ${quote.sentByName}` : ''}
                                                </p>
                                            </div>
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">Enviado</span>
                                        </div>
                                    )) : (
                                        <div className="text-center py-16 bg-muted rounded-xl border border-border">
                                            <Mail className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                                            <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Sin correos enviados aún</p>
                                            <p className="text-[10px] text-muted-foreground mt-2">Los correos de cotizaciones aparecerán aquí</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'Notas' && (
                                <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300 flex flex-col">
                                    <div className="relative">
                                        <textarea
                                            value={noteText}
                                            onChange={(e) => setNoteText(e.target.value)}
                                            placeholder="Añadir una nota interna sobre el proyecto o el lead..."
                                            className="bg-muted border border-border rounded-xl py-2.5 px-3 text-sm outline-none focus:border-primary focus:bg-white w-full transition-colors resize-none min-h-[130px] font-medium"
                                        />
                                        {noteText.trim() && (
                                            <button
                                                onClick={handleSaveNote}
                                                className="absolute bottom-3 right-3 bg-primary text-black font-bold rounded-xl px-4 py-2 hover:brightness-105 shadow-[0_2px_8px_rgba(250,181,16,0.3)] transition-all text-xs"
                                            >
                                                Guardar Nota
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-3">
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
                                                    <StickyNote className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                                                    <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Sin notas aún</p>
                                                </div>
                                            );

                                            return (
                                                <div className="space-y-3">
                                                    {allNotes.map((note, i) => (
                                                        <div key={i} className="p-4 bg-white border border-border rounded-xl border-l-4 border-l-primary space-y-2">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${note.source === 'Cliente' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                                                    {note.source}
                                                                </span>
                                                                <span className="text-xs text-muted-foreground">{note.date}</span>
                                                            </div>
                                                            <p className="text-sm font-medium leading-relaxed text-foreground">{note.text}</p>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{(note.author || 'S')[0]}</div>
                                                                <span className="text-xs font-bold uppercase text-muted-foreground tracking-wide">{note.author || 'Sistema'}</span>
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
            <div className="fixed inset-0 flex items-center justify-center p-4 z-[200]" style={{ background: 'rgba(10,12,20,0.55)', backdropFilter: 'blur(6px)' }}>
                <div className="bg-white border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between p-6 border-b border-border">
                        <h2 className="text-base font-bold text-foreground">Editar Cliente</h2>
                        <button onClick={() => setIsEditOpen(false)} className="bg-white border border-border text-foreground font-medium rounded-xl px-3 py-1.5 hover:bg-muted transition-colors text-sm">✕</button>
                    </div>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                        <div className="grid grid-cols-2 gap-4">
                            {([
                                { label: 'Nombre', key: 'name', type: 'text' },
                                { label: 'Empresa', key: 'company', type: 'text' },
                                { label: 'Email', key: 'email', type: 'email' },
                                { label: 'Teléfono', key: 'phone', type: 'tel' },
                                { label: 'Ciudad', key: 'city', type: 'text' },
                            ] as { label: string; key: keyof typeof editForm; type: string }[]).map(f => (
                                <div key={f.key}>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">{f.label}</label>
                                    <input
                                        type={f.type}
                                        value={editForm[f.key]}
                                        onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                        className="bg-muted border border-border rounded-xl py-2.5 px-3 text-sm outline-none focus:border-primary focus:bg-white w-full transition-colors"
                                    />
                                </div>
                            ))}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Estado</label>
                                <select
                                    value={editForm.status}
                                    onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                                    className="bg-muted border border-border rounded-xl py-2.5 px-3 text-sm outline-none focus:border-primary focus:bg-white w-full transition-colors"
                                >
                                    <option value="Active">Activo</option>
                                    <option value="Lead">Lead</option>
                                    <option value="Inactive">Inactivo</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
                        <button onClick={() => setIsEditOpen(false)} className="bg-white border border-border text-foreground font-medium rounded-xl px-4 py-2 hover:bg-muted transition-colors">Cancelar</button>
                        <button
                            onClick={() => { updateClient(lead.id, { ...editForm, status: editForm.status as 'Active' | 'Lead' | 'Inactive' }); setIsEditOpen(false); }}
                            className="bg-primary text-black font-bold rounded-xl px-4 py-2 hover:brightness-105 shadow-[0_2px_8px_rgba(250,181,16,0.3)] transition-all"
                        >
                            Guardar Cambios
                        </button>
                    </div>
                </div>
            </div>
        )}

        {showAssignModal && (
            <div className="fixed inset-0 flex items-center justify-center p-4 z-[300]" style={{ background: 'rgba(10,12,20,0.55)', backdropFilter: 'blur(6px)' }}>
                <div className="bg-white border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between p-6 border-b border-border">
                        <div>
                            <h3 className="text-base font-bold text-foreground">Asignar Vendedor</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">Cliente: <strong>{lead.company || lead.name}</strong></p>
                        </div>
                    </div>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                        <div className="space-y-2">
                            {sellers.filter(s => s.status === 'Activo' || !s.status).map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setAssignSellerId(s.id)}
                                    className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all ${assignSellerId === s.id ? 'bg-primary/10 border-primary text-foreground' : 'bg-white border-border hover:bg-muted text-foreground'}`}
                                >
                                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                        {s.name[0]}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold">{s.name}</p>
                                        <p className="text-xs text-muted-foreground">{s.role}</p>
                                    </div>
                                    {assignSellerId === s.id && <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0"><svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg></div>}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
                        <button onClick={() => setShowAssignModal(false)} className="bg-white border border-border text-foreground font-medium rounded-xl px-4 py-2 hover:bg-muted transition-colors">Cancelar</button>
                        <button onClick={handleAssignSeller} disabled={!assignSellerId} className="bg-primary text-black font-bold rounded-xl px-4 py-2 hover:brightness-105 shadow-[0_2px_8px_rgba(250,181,16,0.3)] transition-all disabled:opacity-50">Confirmar</button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
