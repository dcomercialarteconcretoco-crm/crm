"use client";

import React, { useMemo, useState } from 'react';
import {
    Archive,
    CalendarDays,
    Download,
    FileText,
    Filter,
    Loader2,
    Search,
    ShieldCheck,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useApp, Quote } from '@/context/AppContext';
import { downloadQuotePdf, quoteDisplayNumber } from '@/lib/quote-pdf';

const STATUS_LABEL: Record<string, string> = {
    Draft: 'Borrador / Interna',
    PendingApproval: 'Por aprobar',
    PENDING_APPROVAL: 'Por aprobar',
    ChangesRequested: 'Cambios pedidos',
    Approved: 'Ganada',
    Sent: 'Enviada',
    Rejected: 'Perdida',
    Expired: 'Vencida',
};

const MONTHS: Record<string, number> = {
    ene: 0, enero: 0,
    feb: 1, febrero: 1,
    mar: 2, marzo: 2,
    abr: 3, abril: 3,
    may: 4, mayo: 4,
    jun: 5, junio: 5,
    jul: 6, julio: 6,
    ago: 7, agosto: 7,
    sep: 8, sept: 8, septiembre: 8,
    oct: 9, octubre: 9,
    nov: 10, noviembre: 10,
    dic: 11, diciembre: 11,
};

function formatCurrency(n: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
}

function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function yearFromQuote(quote: Quote) {
    const number = quoteDisplayNumber(quote);
    const match = number.match(/20\d{2}/);
    return match ? Number(match[0]) : new Date().getFullYear();
}

function quoteDate(quote: Quote) {
    const fromId = quote.id.match(/(\d{13})/);
    if (fromId) {
        const d = new Date(Number(fromId[1]));
        if (!Number.isNaN(d.getTime())) return d;
    }

    const raw = (quote.date || '').trim().toLowerCase().replace(/\./g, '');
    const iso = new Date(raw);
    if (!Number.isNaN(iso.getTime())) return iso;

    const dayMatch = raw.match(/\d{1,2}/);
    const monthKey = Object.keys(MONTHS).find(m => raw.includes(m));
    if (dayMatch && monthKey) {
        return new Date(yearFromQuote(quote), MONTHS[monthKey], Number(dayMatch[0]));
    }

    return null;
}

function quoteMonthKey(quote: Quote) {
    const d = quoteDate(quote);
    if (!d) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function quoteDateLabel(quote: Quote) {
    const d = quoteDate(quote);
    if (!d) return quote.date || 'Sin fecha';
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function downloadCsv(quotes: Quote[]) {
    const rows = [
        ['Cotizacion', 'Cliente', 'Empresa', 'Email', 'Vendedor', 'Estado', 'Fecha', 'Valor', 'Items'],
        ...quotes.map(q => [
            quoteDisplayNumber(q),
            q.client || '',
            q.clientCompany || '',
            q.clientEmail || '',
            q.sellerName || '',
            STATUS_LABEL[q.status] || q.status || '',
            quoteDateLabel(q),
            String(q.numericTotal || 0),
            String(q.items?.length || 0),
        ]),
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    a.download = `Archivo_Cotizaciones_ArteConcreto_${Date.now()}.csv`;
    a.click();
}

export default function QuoteArchivePage() {
    const { quotes, clients, sellers, currentUser, addNotification } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [status, setStatus] = useState('all');
    const [sellerId, setSellerId] = useState('all');
    const [month, setMonth] = useState(currentMonthKey());
    const [showAllMonths, setShowAllMonths] = useState(false);
    const [bulkRunning, setBulkRunning] = useState(false);
    const [bulkProgress, setBulkProgress] = useState(0);
    const [singleRunning, setSingleRunning] = useState<string | null>(null);

    const canUseArchive = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';

    const archiveQuotes = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        return quotes
            .filter(quote => quote.quoteNumber || quote.number || quote.client || quote.total)
            .filter(quote => {
                if (!showAllMonths && quoteMonthKey(quote) !== month) return false;
                if (status !== 'all' && quote.status !== status) return false;
                if (sellerId !== 'all' && quote.sellerId !== sellerId) return false;
                if (!q) return true;
                return [
                    quoteDisplayNumber(quote),
                    quote.baseNumber,
                    quote.client,
                    quote.clientCompany,
                    quote.clientEmail,
                    quote.sellerName,
                    quote.referencia,
                ].some(value => String(value || '').toLowerCase().includes(q));
            })
            .sort((a, b) => (quoteDate(b)?.getTime() || 0) - (quoteDate(a)?.getTime() || 0));
    }, [month, quotes, searchTerm, sellerId, showAllMonths, status]);

    const stats = useMemo(() => {
        return {
            count: archiveQuotes.length,
            total: archiveQuotes.reduce((sum, q) => sum + (q.numericTotal || 0), 0),
            internal: archiveQuotes.filter(q => q.status === 'Draft').length,
            sent: archiveQuotes.filter(q => q.status === 'Sent').length,
        };
    }, [archiveQuotes]);

    const handleSingleDownload = async (quote: Quote) => {
        setSingleRunning(quote.id);
        try {
            await downloadQuotePdf(quote, { clients, sellers, currentUser });
            addNotification({ title: 'PDF descargado', description: `${quoteDisplayNumber(quote)} quedó como soporte local.`, type: 'success' });
        } catch (error) {
            addNotification({ title: 'No se pudo descargar', description: error instanceof Error ? error.message : 'Intenta de nuevo.', type: 'alert' });
        } finally {
            setSingleRunning(null);
        }
    };

    const handleBulkDownload = async () => {
        if (!archiveQuotes.length) {
            addNotification({ title: 'Sin cotizaciones', description: 'No hay documentos en el filtro actual.', type: 'alert' });
            return;
        }
        if (archiveQuotes.length > 30 && !window.confirm(`Vas a descargar ${archiveQuotes.length} PDFs. El navegador puede pedir permiso para descargas multiples. ¿Continuar?`)) {
            return;
        }

        setBulkRunning(true);
        setBulkProgress(0);
        try {
            for (let i = 0; i < archiveQuotes.length; i += 1) {
                await downloadQuotePdf(archiveQuotes[i], { clients, sellers, currentUser });
                setBulkProgress(i + 1);
                await new Promise(resolve => setTimeout(resolve, 350));
            }
            addNotification({ title: 'Lote descargado', description: `${archiveQuotes.length} cotizaciones descargadas para soporte de auditoria.`, type: 'success' });
        } catch (error) {
            addNotification({ title: 'Descarga interrumpida', description: error instanceof Error ? error.message : 'Una cotización no pudo generarse.', type: 'alert' });
        } finally {
            setBulkRunning(false);
        }
    };

    if (!canUseArchive) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="surface-card rounded-2xl p-8 max-w-md text-center">
                    <ShieldCheck className="w-10 h-10 text-primary mx-auto mb-4" />
                    <h1 className="text-xl font-black text-foreground">Archivo restringido</h1>
                    <p className="text-sm text-muted-foreground mt-2">Este soporte de cotizaciones es solo para administrador principal.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-24 lg:pb-10">
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-[0.18em] mb-3">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Soporte de calidad
                    </div>
                    <h1 className="page-title">Archivo de Cotizaciones</h1>
                    <p className="page-subtitle">Todas las cotizaciones generadas en el CRM, listas para control interno y auditoria.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => downloadCsv(archiveQuotes)}
                        className="bg-white border border-border text-foreground font-bold rounded-xl px-4 py-2 hover:bg-muted transition-colors flex items-center gap-2 text-sm"
                    >
                        <FileText className="w-4 h-4" />
                        CSV
                    </button>
                    <button
                        onClick={handleBulkDownload}
                        disabled={bulkRunning || archiveQuotes.length === 0}
                        className="bg-primary text-black font-black rounded-xl px-4 py-2 hover:brightness-105 transition-all shadow-[0_2px_8px_rgba(250,181,16,0.3)] flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                        {bulkRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {bulkRunning ? `Descargando ${bulkProgress}/${archiveQuotes.length}` : `Descargar lote (${archiveQuotes.length})`}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="surface-card rounded-xl p-5">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Cotizaciones</p>
                    <p className="text-2xl font-black text-foreground">{stats.count}</p>
                </div>
                <div className="surface-card rounded-xl p-5">
                    <p className="text-xs font-black uppercase tracking-widest text-primary mb-2">Valor soportado</p>
                    <p className="text-xl font-black text-foreground">{formatCurrency(stats.total)}</p>
                </div>
                <div className="surface-card rounded-xl p-5">
                    <p className="text-xs font-black uppercase tracking-widest text-amber-600 mb-2">Internas</p>
                    <p className="text-2xl font-black text-foreground">{stats.internal}</p>
                </div>
                <div className="surface-card rounded-xl p-5">
                    <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-2">Enviadas</p>
                    <p className="text-2xl font-black text-foreground">{stats.sent}</p>
                </div>
            </div>

            <div className="surface-card rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-border grid grid-cols-1 xl:grid-cols-[1.2fr_auto_auto_auto_auto] gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            value={searchTerm}
                            onChange={event => setSearchTerm(event.target.value)}
                            placeholder="Buscar por cotización, cliente, empresa, email o vendedor..."
                            className="w-full bg-muted border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                        />
                    </div>
                    <label className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-2.5 text-sm">
                        <CalendarDays className="w-4 h-4 text-muted-foreground" />
                        <input
                            type="month"
                            value={month}
                            onChange={event => {
                                setMonth(event.target.value);
                                setShowAllMonths(false);
                            }}
                            className="bg-transparent outline-none font-bold text-foreground"
                        />
                    </label>
                    <select
                        value={status}
                        onChange={event => setStatus(event.target.value)}
                        className="bg-white border border-border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-primary"
                    >
                        <option value="all">Todos los estados</option>
                        {Object.entries(STATUS_LABEL).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <select
                        value={sellerId}
                        onChange={event => setSellerId(event.target.value)}
                        className="bg-white border border-border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-primary"
                    >
                        <option value="all">Todos los vendedores</option>
                        {sellers.map(seller => (
                            <option key={seller.id} value={seller.id}>{seller.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => setShowAllMonths(value => !value)}
                        className={clsx(
                            'rounded-xl px-4 py-2.5 text-sm font-black flex items-center justify-center gap-2 border transition-all',
                            showAllMonths
                                ? 'bg-foreground text-background border-foreground'
                                : 'bg-white text-foreground border-border hover:bg-muted'
                        )}
                    >
                        <Filter className="w-4 h-4" />
                        {showAllMonths ? 'Todo el archivo' : 'Solo el mes'}
                    </button>
                </div>

                <div className="hidden lg:grid grid-cols-[1fr_1.4fr_0.8fr_0.8fr_0.7fr_0.6fr_auto] gap-4 px-5 py-3 border-b border-border bg-muted/30">
                    {['Cotización', 'Cliente', 'Fecha', 'Vendedor', 'Estado', 'Valor', ''].map(label => (
                        <span key={label} className="text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</span>
                    ))}
                </div>

                <div className="divide-y divide-border">
                    {archiveQuotes.length === 0 ? (
                        <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
                            <Archive className="w-10 h-10 text-muted-foreground/30" />
                            <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/50">No hay cotizaciones en este filtro</p>
                        </div>
                    ) : archiveQuotes.map(quote => (
                        <div key={quote.id} className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_0.8fr_0.8fr_0.7fr_0.6fr_auto] gap-4 px-5 py-4 items-center hover:bg-muted/20 transition-colors">
                            <div>
                                <p className="text-sm font-black text-foreground">{quoteDisplayNumber(quote) || 'Sin número'}</p>
                                <p className="text-xs text-muted-foreground">{quote.items?.length || 0} productos</p>
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground truncate">{quote.client || quote.clientCompany || 'Cliente'}</p>
                                <p className="text-xs text-muted-foreground truncate">{quote.clientEmail || quote.clientCompany || 'Sin email'}</p>
                            </div>
                            <p className="text-sm font-bold text-muted-foreground">{quoteDateLabel(quote)}</p>
                            <p className="text-sm font-bold text-foreground">{quote.sellerName || 'Sin asignar'}</p>
                            <span className="inline-flex w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-black text-muted-foreground">
                                {STATUS_LABEL[quote.status] || quote.status}
                            </span>
                            <p className="text-sm font-black text-foreground tabular-nums">{formatCurrency(quote.numericTotal || 0)}</p>
                            <button
                                onClick={() => handleSingleDownload(quote)}
                                disabled={singleRunning === quote.id || bulkRunning}
                                className="h-9 px-3 rounded-xl bg-white border border-border text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all flex items-center justify-center gap-2 text-xs font-black disabled:opacity-40"
                            >
                                {singleRunning === quote.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                PDF
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
