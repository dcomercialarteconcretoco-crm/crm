"use client";

import React, { useState, useMemo } from 'react';
import {
    FileText, Plus, Search, Download, Mail, ChevronRight,
    Clock, CheckCircle2, Send, MessageCircle, Trophy, TrendingUp,
    Filter, ArrowDownToLine, Eye, Pencil, Trash2
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { useApp, Quote } from '@/context/AppContext';
import { generateProposalPDF } from '@/lib/pdf-generator';
import { PermissionGate, PermissionHide } from '@/components/PermissionGate';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    'Draft':    { label: 'Borrador',  className: 'bg-muted/40 text-muted-foreground' },
    'Sent':     { label: 'Visto',     className: 'bg-sky-500/10 text-sky-600' },
    'Approved': { label: 'Ganado',    className: 'bg-emerald-500/10 text-emerald-600' },
    'Rejected': { label: 'Perdido',   className: 'bg-rose-500/10 text-rose-500' },
};

function ScoreBar({ score }: { score: number }) {
    const color = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-rose-500';
    return (
        <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={clsx('h-full rounded-full', color)} style={{ width: `${Math.min(score, 100)}%` }} />
            </div>
            <span className={clsx('text-[10px] font-black tabular-nums', score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-500' : 'text-rose-500')}>{score}</span>
        </div>
    );
}

function fmt(n: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

export default function QuotesPage() {
    const { quotes, sellers, clients, tasks, currentUser, addNotification, deleteQuote, updateQuote } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [isGenerating, setIsGenerating] = useState<string | null>(null);

    const validQuotes = useMemo(() =>
        quotes.filter(q => q.number || q.client || q.total),
        [quotes]
    );

    const filtered = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        return validQuotes.filter(quote => {
            const matchSearch = !q ||
                (quote.number || '').toLowerCase().includes(q) ||
                (quote.client || '').toLowerCase().includes(q) ||
                (quote.clientEmail || '').toLowerCase().includes(q);
            const matchStatus = filterStatus === 'all' || quote.status === filterStatus;
            return matchSearch && matchStatus;
        });
    }, [validQuotes, searchTerm, filterStatus]);

    const stats = useMemo(() => {
        const total = validQuotes.reduce((s, q) => s + (q.numericTotal || 0), 0);
        const ganado = validQuotes.filter(q => q.status === 'Approved').reduce((s, q) => s + (q.numericTotal || 0), 0);
        const sent = validQuotes.filter(q => q.status === 'Sent').length;
        const apertura = validQuotes.length > 0
            ? Math.round((validQuotes.filter(q => q.status === 'Approved' || q.status === 'Sent').length / validQuotes.length) * 100)
            : 0;
        return { total, ganado, sent, apertura };
    }, [validQuotes]);

    const handleDownloadPDF = async (quote: Quote) => {
        setIsGenerating(quote.id);
        try {
            const client = clients.find(c => c.id === quote.clientId);
            await generateProposalPDF({
                quoteNumber: quote.number || 'AC-XXX',
                date: quote.date || new Date().toLocaleDateString('es-CO'),
                leadName: quote.client || 'Cliente',
                leadCompany: quote.clientCompany || client?.company || '',
                leadEmail: quote.clientEmail || client?.email || '',
                leadCity: client?.city || '',
                items: (quote.items || []).map(i => ({
                    name: i.name,
                    price: i.price,
                    quantity: i.quantity,
                    unit: i.unit || 'un',
                    total: (i.price || 0) * (i.quantity || 1),
                })),
                subtotal: quote.subtotal || quote.numericTotal || 0,
                tax: quote.tax || (quote.numericTotal || 0) * 0.19 / 1.19,
                total: quote.numericTotal || 0,
            });
            addNotification({ title: 'PDF generado', description: `Propuesta ${quote.number} descargada.`, type: 'success' });
        } catch (e: any) {
            addNotification({ title: 'Error al generar PDF', description: e.message || 'Revisa la consola.', type: 'alert' });
        } finally {
            setIsGenerating(null);
        }
    };

    const handleSendWhatsApp = (quote: Quote) => {
        const client = clients.find(c => c.id === quote.clientId);
        const phone = client?.phone?.replace(/\D/g, '') || '';
        const msg = encodeURIComponent(`Hola ${quote.client}, te enviamos la cotización ${quote.number} por valor de ${quote.total}. Quedamos atentos. ArteConcreto.`);
        if (phone) {
            window.open(`https://wa.me/57${phone}?text=${msg}`, '_blank');
        } else {
            addNotification({ title: 'Sin WhatsApp', description: 'El cliente no tiene teléfono registrado.', type: 'alert' });
        }
    };

    const handleSendEmail = async (quote: Quote) => {
        if (!quote.clientEmail) {
            addNotification({ title: 'Sin email', description: 'El cliente no tiene email registrado.', type: 'alert' });
            return;
        }
        try {
            const res = await fetch('/api/quotes/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quoteNumber: quote.number,
                    clientName: quote.client,
                    clientEmail: quote.clientEmail,
                    clientCompany: quote.clientCompany || '',
                    sellerName: currentUser?.name || 'ArteConcreto',
                    items: quote.items || [],
                    subtotal: quote.subtotal || 0,
                    tax: quote.tax || 0,
                    total: quote.numericTotal || 0,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                updateQuote(quote.id, { status: 'Sent', sentAt: new Date().toISOString() });
                addNotification({ title: 'Cotización enviada', description: `Enviada a ${quote.clientEmail}`, type: 'success' });
            } else {
                addNotification({ title: 'Error', description: data.error || 'No se pudo enviar.', type: 'alert' });
            }
        } catch {
            addNotification({ title: 'Error', description: 'Sin conexión.', type: 'alert' });
        }
    };

    const handleAssignSeller = (quoteId: string, sellerName: string) => {
        updateQuote(quoteId, { sellerName });
        addNotification({ title: 'Vendedor asignado', description: `Cotización asignada a ${sellerName || 'Sin asignar'}.`, type: 'success' });
    };

    const exportCSV = () => {
        const rows = [
            ['Cotización', 'Cliente', 'Email', 'Monto', 'Estado', 'Vendedor', 'Fecha'],
            ...filtered.map(q => [q.number || '', q.client || '', q.clientEmail || '', q.total || '', q.status || '', q.sellerName || '', q.date || '']),
        ];
        const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        const a = document.createElement('a');
        a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        a.download = `Cotizaciones_ArteConcreto_${Date.now()}.csv`;
        a.click();
    };

    return (
        <PermissionGate require="quotes.view">
        <div className="space-y-6 animate-in fade-in duration-500 pb-24 lg:pb-10">

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="page-title">Historial de Cotizaciones</h1>
                    <p className="page-subtitle">
                        {validQuotes.length} cotizaciones · {quotes.filter(q => q.status === 'Draft').length} solicitudes pendientes
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={exportCSV}
                        className="bg-white border border-border text-foreground font-medium rounded-xl px-4 py-2 hover:bg-muted transition-colors flex items-center gap-2 text-sm"
                    >
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                        Exportar CSV ({filtered.length})
                    </button>
                    <Link
                        href="/quotes/new"
                        className="bg-primary text-black font-bold rounded-xl px-4 py-2 hover:brightness-105 transition-all shadow-[0_2px_8px_rgba(250,181,16,0.3)] flex items-center gap-2 text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Cotización
                    </Link>
                </div>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-4">
                <div className="surface-card rounded-xl p-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Total Cotizado</p>
                    <p className="text-xl lg:text-2xl font-black text-foreground tracking-tight">{fmt(stats.total)}</p>
                </div>
                <div className="surface-card rounded-xl p-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-2 flex items-center gap-1">
                        <Trophy className="w-3 h-3" /> Ganado
                    </p>
                    <p className="text-xl lg:text-2xl font-black text-emerald-600 tracking-tight">{fmt(stats.ganado)}</p>
                </div>
                <div className="surface-card rounded-xl p-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Tasa Apertura
                    </p>
                    <p className="text-xl lg:text-2xl font-black text-primary tracking-tight">{stats.apertura}%</p>
                </div>
            </div>

            {/* Filters + Table */}
            <div className="surface-card rounded-2xl overflow-hidden">

                {/* Filter bar */}
                <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Buscar cliente, cotización o email..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-muted border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all placeholder:text-muted-foreground/60"
                        />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {[
                            { value: 'all', label: 'Todas' },
                            { value: 'Draft', label: 'Borrador' },
                            { value: 'Sent', label: 'Visto' },
                            { value: 'Approved', label: 'Ganado' },
                            { value: 'Rejected', label: 'Perdido' },
                        ].map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setFilterStatus(opt.value)}
                                className={clsx(
                                    'px-3 py-1.5 rounded-xl text-xs font-bold transition-all border',
                                    filterStatus === opt.value
                                        ? 'bg-primary text-black border-primary'
                                        : 'bg-white border-border text-muted-foreground hover:bg-muted'
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <span className="text-xs font-bold text-muted-foreground ml-auto shrink-0">{filtered.length} resultados</span>
                </div>

                {/* Table header — desktop */}
                <div className="hidden md:grid grid-cols-[1fr_1.4fr_0.8fr_0.7fr_0.6fr_0.9fr_auto] border-b border-border bg-muted/30 px-5 py-3 gap-4">
                    {['Cotización', 'Cliente', 'Monto', 'Etapa', 'Score', 'Vendedor', ''].map(h => (
                        <span key={h} className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{h}</span>
                    ))}
                </div>

                {/* Rows */}
                <div className="divide-y divide-border">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <FileText className="w-10 h-10 text-muted-foreground/20" />
                            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground/40">Sin cotizaciones</p>
                        </div>
                    ) : filtered.map(quote => {
                        const statusCfg = STATUS_CONFIG[quote.status] || STATUS_CONFIG['Draft'];
                        const score = quote.opens ? Math.min(20 + quote.opens * 10, 100) : (quote.status === 'Approved' ? 85 : quote.status === 'Sent' ? 65 : 20);
                        const isGen = isGenerating === quote.id;

                        return (
                            <div
                                key={quote.id}
                                className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr_0.8fr_0.7fr_0.6fr_0.9fr_auto] gap-4 items-center px-5 py-3.5 hover:bg-muted/20 transition-all group"
                            >
                                {/* Quote number + date */}
                                <div className="flex items-center gap-2.5 py-1 md:py-0">
                                    {(quote.status === 'Sent' || quote.status === 'Approved') && (
                                        <Eye className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-foreground">{quote.number || '—'}</p>
                                        <p className="text-xs text-muted-foreground">{quote.date || '—'}</p>
                                    </div>
                                </div>

                                {/* Client */}
                                <div className="min-w-0 py-1 md:py-0">
                                    <p className="text-sm font-bold text-foreground truncate">{quote.client || '—'}</p>
                                    {quote.clientEmail && (
                                        <p className="text-xs text-muted-foreground truncate">{quote.clientEmail}</p>
                                    )}
                                </div>

                                {/* Amount */}
                                <p className="text-sm font-bold text-foreground tabular-nums py-1 md:py-0">{quote.total || '—'}</p>

                                {/* Status badge */}
                                <div className="py-1 md:py-0">
                                    <span className={clsx(
                                        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold',
                                        statusCfg.className
                                    )}>
                                        {statusCfg.label}
                                    </span>
                                </div>

                                {/* Score */}
                                <div className="py-1 md:py-0">
                                    <ScoreBar score={score} />
                                </div>

                                {/* Seller dropdown */}
                                <div className="py-1 md:py-0">
                                    <select
                                        value={quote.sellerName || ''}
                                        onChange={e => handleAssignSeller(quote.id, e.target.value)}
                                        className="w-full max-w-[140px] bg-muted border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary focus:bg-white transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Sin asignar</option>
                                        {sellers.map(s => (
                                            <option key={s.id} value={s.name}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center gap-1.5 py-1 md:py-0 md:opacity-40 md:group-hover:opacity-100 transition-all justify-end">
                                    <Link
                                        href={`/quotes/${quote.id}/edit`}
                                        title="Editar cotización"
                                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-border text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-all"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </Link>
                                    <Link
                                        href={`/quotes`}
                                        title="Ver detalle"
                                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                                    >
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </Link>
                                    <button
                                        onClick={() => handleSendEmail(quote)}
                                        title="Enviar por email"
                                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-border text-muted-foreground hover:text-sky-500 hover:bg-sky-500/10 transition-all"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleSendWhatsApp(quote)}
                                        title="Enviar por WhatsApp"
                                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-border text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-all"
                                    >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleDownloadPDF(quote)}
                                        disabled={isGen}
                                        title="Descargar PDF"
                                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-border text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-40"
                                    >
                                        {isGen
                                            ? <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                            : <Download className="w-3.5 h-3.5" />
                                        }
                                    </button>
                                    <PermissionHide require="quotes.delete">
                                        <button
                                            onClick={() => { if (confirm('¿Eliminar esta cotización?')) deleteQuote(quote.id); }}
                                            title="Eliminar cotización"
                                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-border text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </PermissionHide>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
        </PermissionGate>
    );
}
