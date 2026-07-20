"use client";

/**
 * Página Autorizaciones — SuperAdmin (+ Admin) únicamente
 *
 * Muestra la cola de cotizaciones que los vendedores enviaron a revisión.
 * El admin puede:
 *   • Aprobar y enviar → status Approved + dispara /api/quotes/send (Resend)
 *     → al confirmar Resend pasa a Sent con `sentAt`, `sentByName`, `sentById`.
 *   • Pedir cambios    → status ChangesRequested + agrega comentario a reviewNotes.
 *                        El vendedor lo ve en su QuoteEngine y puede re-enviar.
 *
 * Todas las mutaciones se hacen vía AppContext.updateQuote (que sincroniza a Postgres),
 * así la lógica de persistencia queda en el mismo lugar que el resto del CRM.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
    ShieldCheck, Clock, User, Building2, Mail, Phone, MapPin, FileText,
    CheckCircle2, MessageSquareWarning, X, Loader2, AlertTriangle,
    ArrowRight, History, Send, Eye, ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useApp, Quote } from '@/context/AppContext';
import { getQuotePdfPreviewUrl } from '@/lib/quote-pdf';

function fmt(n: number) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', maximumFractionDigits: 0,
    }).format(n);
}

function humanizeElapsed(isoDate: string | undefined): string {
    if (!isoDate) return '—';
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'hace instantes';
    if (mins < 60) return `hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs} h`;
    const days = Math.floor(hrs / 24);
    return `hace ${days} d`;
}

export default function AutorizacionesPage() {
    const {
        quotes, clients, currentUser,
        updateQuote, addNotification, addAuditLog,
    } = useApp();

    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';

    const [selected, setSelected]   = useState<Quote | null>(null);
    const [comment, setComment]     = useState('');
    const [busy, setBusy]           = useState<'approve' | 'changes' | null>(null);
    const [error, setError]         = useState<string | null>(null);

    // Cola: pendientes (flujo nuevo) + legacy PENDING_APPROVAL + los que ya tuvieron
    // ciclo de cambios pero el vendedor aún no re-envió (ChangesRequested).
    const pendingList = useMemo(() => {
        return quotes
            .filter(q => q.status === 'PendingApproval' || q.status === 'PENDING_APPROVAL')
            .sort((a, b) => {
                const ta = new Date(a.requestedAt || 0).getTime();
                const tb = new Date(b.requestedAt || 0).getTime();
                return tb - ta;
            });
    }, [quotes]);

    const changesList = useMemo(() => {
        return quotes
            .filter(q => q.status === 'ChangesRequested')
            .sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime());
    }, [quotes]);

    if (!isSuperAdmin) {
        return (
            <div className="p-6 max-w-3xl mx-auto">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <h2 className="font-black text-amber-900">Sección restringida</h2>
                        <p className="text-sm text-amber-800 mt-1">
                            Solo los SuperAdmin pueden aprobar cotizaciones. Si necesitas acceso,
                            contacta al administrador principal.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ── Resolver cliente asociado (para mostrar email/phone/etc en el detalle) ──
    const resolveClient = (q: Quote) => {
        if (q.clientId) {
            return clients.find(c => c.id === q.clientId) || null;
        }
        // Fallback por nombre solo para cotizaciones viejas sin clientId. El
        // `.trim()` no-vacío es obligatorio: los contactos independientes tienen
        // `company: ''`, y comparar '' contra un q.client vacío devolvía el
        // primer independiente de la lista — el detalle mostraba el email de
        // otra persona y :133 le enviaba la cotización aprobada a ese correo.
        const needle = (q.client || '').trim();
        if (!needle) return null;
        return clients.find(c => c.name?.trim() === needle || (!!c.company?.trim() && c.company.trim() === needle)) || null;
    };

    // ── Aprobar: dispara envío por Resend y actualiza status ──────────────────
    const handleApprove = async (q: Quote) => {
        if (!q) return;
        const client = resolveClient(q);
        const clientEmail = q.clientEmail || client?.email;

        if (!clientEmail) {
            setError('La cotización no tiene email del cliente — no se puede enviar. Pide al vendedor que lo agregue antes de aprobar.');
            return;
        }

        setBusy('approve');
        setError(null);

        const approvedAt = new Date().toISOString();
        const reviewEntry = {
            id: `rv-${Date.now()}`,
            by: currentUser?.id || '',
            byName: currentUser?.name || 'Admin',
            at: approvedAt,
            action: 'approved' as const,
        };

        try {
            const res = await fetch('/api/quotes/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    quoteNumber:   q.quoteNumber || q.number,
                    clientName:    client?.name || q.client,
                    clientEmail,
                    clientCompany: q.clientCompany || client?.company || '',
                    sellerName:    q.sellerName || q.requestedByName || 'ArteConcreto',
                    sellerPhone:   q.sellerPhone || '',
                    sellerId:      q.sellerId || q.requestedBy || '',
                    items:         q.items || [],
                    subtotal:      q.subtotal ?? q.numericTotal,
                    tax:           q.tax ?? 0,
                    total:         q.numericTotal,
                    shipping:      q.shipping,
                    shippingCity:  q.shippingCity,
                    sentAt:        approvedAt,
                    sentByName:    currentUser?.name || 'Admin',
                    sentById:      currentUser?.id || '',
                    referencia:    q.referencia,
                    validUntil:    q.validUntil,
                    deliveryTime:  q.deliveryTime,
                    paymentTerms:  q.paymentTerms,
                }),
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                // Éxito — la cotización queda en Sent (aprobada + enviada)
                updateQuote(q.id, {
                    status: 'Sent',
                    approvedBy: currentUser?.id || '',
                    approvedByName: currentUser?.name || 'Admin',
                    approvedAt,
                    sentAt: approvedAt,
                    sentByName: currentUser?.name || 'Admin',
                    sentById: currentUser?.id || '',
                    reviewNotes: [...(q.reviewNotes || []), reviewEntry],
                    deliveryFailed: false,
                    deliveryError: undefined,
                    // Limpiar flags legacy del flujo anterior
                    pendingAction: undefined,
                });
                addAuditLog({
                    userId: currentUser?.id || '',
                    userName: currentUser?.name || 'Admin',
                    userRole: currentUser?.role || 'Admin',
                    action: 'QUOTE_APPROVED',
                    targetId: q.id,
                    targetName: q.client,
                    details: `${currentUser?.name} aprobó y envió cotización ${q.quoteNumber || q.number} a ${clientEmail}`,
                    verified: true,
                });
                addNotification({
                    title: `✅ Cotización ${q.quoteNumber || q.number} aprobada`,
                    description: `Enviada al cliente por email. Ya puedes descargar el PDF y reenviar por WhatsApp.`,
                    type: 'success',
                    targetUserId: q.requestedBy,
                });
            } else {
                // Resend rechazó — marcamos Approved con deliveryFailed para que el
                // vendedor pueda reintentar sin pedir nueva aprobación.
                updateQuote(q.id, {
                    status: 'Approved',
                    approvedBy: currentUser?.id || '',
                    approvedByName: currentUser?.name || 'Admin',
                    approvedAt,
                    reviewNotes: [...(q.reviewNotes || []), reviewEntry],
                    deliveryFailed: true,
                    deliveryError: data.error || `HTTP ${res.status}`,
                });
                setError(`La cotización quedó aprobada pero el email falló: ${data.error || 'Error desconocido'}. El vendedor puede reintentar desde la cotización.`);
            }
        } catch (err: any) {
            updateQuote(q.id, {
                status: 'Approved',
                approvedBy: currentUser?.id || '',
                approvedByName: currentUser?.name || 'Admin',
                approvedAt,
                reviewNotes: [...(q.reviewNotes || []), reviewEntry],
                deliveryFailed: true,
                deliveryError: String(err?.message || err),
            });
            setError(`Aprobada pero el envío falló (error de red). El vendedor puede reintentar.`);
        } finally {
            setBusy(null);
            setSelected(null);
            setComment('');
        }
    };

    // ── Pedir cambios: agrega comentario y devuelve la bola al vendedor ───────
    const handleRequestChanges = (q: Quote) => {
        if (!q || !comment.trim()) {
            setError('Escribe un comentario explicando qué cambios necesitas.');
            return;
        }
        setBusy('changes');
        setError(null);

        const at = new Date().toISOString();
        const reviewEntry = {
            id: `rv-${Date.now()}`,
            by: currentUser?.id || '',
            byName: currentUser?.name || 'Admin',
            at,
            action: 'changes_requested' as const,
            comment: comment.trim(),
        };

        updateQuote(q.id, {
            status: 'ChangesRequested',
            reviewNotes: [...(q.reviewNotes || []), reviewEntry],
            pendingAction: undefined,
        });
        addAuditLog({
            userId: currentUser?.id || '',
            userName: currentUser?.name || 'Admin',
            userRole: currentUser?.role || 'Admin',
            action: 'QUOTE_CHANGES_REQUESTED',
            targetId: q.id,
            targetName: q.client,
            details: `${currentUser?.name} pidió cambios en ${q.quoteNumber || q.number}: "${comment.trim().slice(0, 120)}"`,
            verified: true,
        });
        addNotification({
            title: `📝 Cambios pedidos en ${q.quoteNumber || q.number}`,
            description: `${currentUser?.name}: ${comment.trim().slice(0, 100)}${comment.trim().length > 100 ? '…' : ''}`,
            type: 'alert',
            targetUserId: q.requestedBy,
        });

        setBusy(null);
        setSelected(null);
        setComment('');
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {/* ── Header ───────────────────────────────────────────────── */}
            <div className="flex items-start gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">Autorizaciones</h1>
                    <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                        Cotizaciones que los vendedores enviaron para tu revisión. Al aprobar,
                        el sistema manda automáticamente el correo al cliente por Resend y desbloquea
                        el PDF y el envío por WhatsApp para el vendedor.
                    </p>
                </div>
            </div>

            {/* ── Stats ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                <div className="bg-white border border-border rounded-2xl p-4">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Por aprobar</p>
                    <p className="text-3xl font-black text-rose-600 mt-1">{pendingList.length}</p>
                </div>
                <div className="bg-white border border-border rounded-2xl p-4">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Cambios pedidos</p>
                    <p className="text-3xl font-black text-amber-600 mt-1">{changesList.length}</p>
                </div>
                <div className="bg-white border border-border rounded-2xl p-4 col-span-2 md:col-span-1">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Monto en revisión</p>
                    <p className="text-xl font-black text-foreground mt-1">{fmt(pendingList.reduce((s, q) => s + (q.numericTotal || 0), 0))}</p>
                </div>
            </div>

            {/* ── Cola principal ───────────────────────────────────────── */}
            {pendingList.length === 0 && changesList.length === 0 ? (
                <div className="bg-white border border-border rounded-2xl p-12 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                    <h3 className="font-black text-lg text-foreground">No hay cotizaciones pendientes</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Los vendedores no tienen nada esperando aprobación. 🎉
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {pendingList.length > 0 && (
                        <section>
                            <h2 className="text-[11px] font-black text-rose-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5" /> Por aprobar ({pendingList.length})
                            </h2>
                            <div className="grid gap-3 md:grid-cols-2">
                                {pendingList.map(q => (
                                    <QuoteCard key={q.id} quote={q} onSelect={() => { setSelected(q); setComment(''); setError(null); }} kind="pending" />
                                ))}
                            </div>
                        </section>
                    )}

                    {changesList.length > 0 && (
                        <section>
                            <h2 className="text-[11px] font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <MessageSquareWarning className="w-3.5 h-3.5" /> Esperando que el vendedor corrija ({changesList.length})
                            </h2>
                            <div className="grid gap-3 md:grid-cols-2">
                                {changesList.map(q => (
                                    <QuoteCard key={q.id} quote={q} onSelect={() => { setSelected(q); setComment(''); setError(null); }} kind="changes" />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}

            {/* ── Drawer de revisión ────────────────────────────────────── */}
            {selected && (
                <ReviewDrawer
                    quote={selected}
                    client={resolveClient(selected)}
                    comment={comment}
                    onCommentChange={setComment}
                    busy={busy}
                    error={error}
                    onApprove={() => handleApprove(selected)}
                    onRequestChanges={() => handleRequestChanges(selected)}
                    onClose={() => { if (!busy) { setSelected(null); setComment(''); setError(null); } }}
                />
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tarjeta compacta de la cola
// ══════════════════════════════════════════════════════════════════════════════
function QuoteCard({ quote, onSelect, kind }: {
    quote: Quote;
    onSelect: () => void;
    kind: 'pending' | 'changes';
}) {
    const lastNote = quote.reviewNotes && quote.reviewNotes.length > 0
        ? quote.reviewNotes[quote.reviewNotes.length - 1]
        : null;

    const accent = kind === 'pending'
        ? 'border-rose-200 hover:border-rose-400 hover:shadow-rose-500/10'
        : 'border-amber-200 hover:border-amber-400 hover:shadow-amber-500/10';

    return (
        <button
            type="button"
            onClick={onSelect}
            className={clsx(
                'group text-left bg-white rounded-2xl p-4 border-2 transition-all hover:shadow-lg',
                accent
            )}
        >
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cotización</p>
                    <p className="font-black text-foreground text-sm truncate">{quote.quoteNumber || quote.number || '—'}</p>
                </div>
                <span className="text-xs font-black text-foreground tabular-nums">{fmt(quote.numericTotal || 0)}</span>
            </div>
            <div className="space-y-1">
                <p className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    {quote.client || '—'}
                </p>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                    <User className="w-3 h-3 shrink-0" />
                    Vendedor: {quote.requestedByName || quote.sellerName || '—'}
                </p>
            </div>
            {lastNote && lastNote.action === 'changes_requested' && lastNote.comment && (
                <div className="mt-3 p-2 bg-amber-50 border border-amber-100 rounded-lg text-[11px] text-amber-900 line-clamp-2">
                    <span className="font-bold">Tu comentario: </span>{lastNote.comment}
                </div>
            )}
            <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {humanizeElapsed(quote.requestedAt)}
                </span>
                <span className="text-primary font-bold flex items-center gap-1 group-hover:gap-1.5 transition-all">
                    Revisar <ArrowRight className="w-3 h-3" />
                </span>
            </div>
        </button>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Drawer lateral con el detalle y los botones de acción
// ══════════════════════════════════════════════════════════════════════════════
function ReviewDrawer({
    quote, client, comment, onCommentChange, busy, error,
    onApprove, onRequestChanges, onClose,
}: {
    quote: Quote;
    client: any;
    comment: string;
    onCommentChange: (v: string) => void;
    busy: 'approve' | 'changes' | null;
    error: string | null;
    onApprove: () => void;
    onRequestChanges: () => void;
    onClose: () => void;
}) {
    const clientEmail = quote.clientEmail || client?.email;
    const clientPhone = client?.phone;
    const clientCity  = client?.city;

    // ── Previsualización del PDF ──
    // El PDF se genera client-side con jsPDF (igual al que descarga el vendedor
    // y al que se aprueba), así que la previsualización es una blob URL local.
    const { clients, sellers, currentUser } = useApp();
    const [pdfUrl, setPdfUrl]         = useState<string | null>(null);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfError, setPdfError]     = useState<string | null>(null);

    // Al cambiar de cotización o desmontar, soltar la blob URL anterior.
    useEffect(() => {
        setPdfError(null);
        setPdfUrl(null);
    }, [quote.id]);
    useEffect(() => {
        return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
    }, [pdfUrl]);

    const handleTogglePdf = async () => {
        if (pdfUrl) { setPdfUrl(null); return; }
        setPdfLoading(true);
        setPdfError(null);
        try {
            const url = await getQuotePdfPreviewUrl(quote, { clients, sellers, currentUser });
            setPdfUrl(url);
        } catch (err) {
            console.error('preview pdf error:', err);
            setPdfError('No se pudo generar la previsualización. Intenta de nuevo o descarga el PDF desde Cotizaciones.');
        } finally {
            setPdfLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className={clsx(
                'w-full bg-white shadow-2xl overflow-y-auto transition-all',
                pdfUrl ? 'max-w-3xl' : 'max-w-xl'
            )}>
                <div className="sticky top-0 bg-white border-b border-border px-5 py-4 flex items-center justify-between z-10">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Revisar cotización</p>
                        <h3 className="font-black text-foreground">{quote.quoteNumber || quote.number}</h3>
                    </div>
                    <button onClick={onClose} disabled={!!busy} className="w-9 h-9 rounded-full bg-muted hover:bg-muted-foreground/10 flex items-center justify-center disabled:opacity-40">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Cliente */}
                    <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente</p>
                        <p className="font-black text-foreground">{quote.client}</p>
                        {quote.clientCompany && quote.clientCompany !== quote.client && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> {quote.clientCompany}</p>
                        )}
                        {clientEmail && (
                            <p className="text-sm text-foreground flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-muted-foreground" /> {clientEmail}</p>
                        )}
                        {clientPhone && (
                            <p className="text-sm text-foreground flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-muted-foreground" /> {clientPhone}</p>
                        )}
                        {clientCity && (
                            <p className="text-sm text-foreground flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-muted-foreground" /> {clientCity}</p>
                        )}
                    </div>

                    {/* Vendedor */}
                    <div className="flex items-center justify-between bg-primary/5 border border-primary/10 rounded-xl p-3">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Solicitado por</p>
                            <p className="font-bold text-foreground text-sm">{quote.requestedByName || quote.sellerName || '—'}</p>
                        </div>
                        <span className="text-[11px] text-muted-foreground">{humanizeElapsed(quote.requestedAt)}</span>
                    </div>

                    {/* Previsualización del PDF — el documento exacto que recibirá el cliente */}
                    <div>
                        <button
                            onClick={handleTogglePdf}
                            disabled={pdfLoading || !!busy}
                            className="w-full bg-foreground hover:bg-foreground/90 text-white font-black py-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors text-sm"
                        >
                            {pdfLoading ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Generando PDF...</>
                            ) : pdfUrl ? (
                                <><X className="w-4 h-4" /> Ocultar PDF</>
                            ) : (
                                <><Eye className="w-4 h-4" /> Ver PDF completo</>
                            )}
                        </button>
                        {pdfError && (
                            <p className="mt-2 text-[11px] text-rose-600">{pdfError}</p>
                        )}
                        {pdfUrl && (
                            <div className="mt-3 border border-border rounded-xl overflow-hidden">
                                <iframe
                                    src={pdfUrl}
                                    title={`PDF ${quote.quoteNumber || quote.number || ''}`}
                                    className="w-full h-[65vh] bg-muted"
                                />
                                <a
                                    href={pdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-primary hover:bg-muted/40 border-t border-border transition-colors"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" /> Abrir en pestaña nueva
                                </a>
                            </div>
                        )}
                    </div>

                    {/* Items */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5" /> Productos ({quote.items?.length || 0})
                        </p>
                        <div className="border border-border rounded-xl overflow-hidden">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-muted/40 text-left">
                                        <th className="px-3 py-2 font-black">Producto</th>
                                        <th className="px-3 py-2 font-black text-center">Cant.</th>
                                        <th className="px-3 py-2 font-black text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(quote.items || []).map((it, i) => (
                                        <tr key={i} className="border-t border-border">
                                            <td className="px-3 py-2 text-foreground">{it.name}</td>
                                            <td className="px-3 py-2 text-center text-muted-foreground">{it.quantity} {it.unit || 'un'}</td>
                                            <td className="px-3 py-2 text-right font-bold tabular-nums">{fmt(it.price * it.quantity)}</td>
                                        </tr>
                                    ))}
                                    {(!quote.items || quote.items.length === 0) && (
                                        <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">Sin items</td></tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-muted/30 border-t border-border">
                                        <td colSpan={2} className="px-3 py-2 text-right font-black text-muted-foreground">Subtotal</td>
                                        <td className="px-3 py-2 text-right font-bold">{fmt(quote.subtotal || 0)}</td>
                                    </tr>
                                    {quote.shipping && quote.shipping > 0 ? (
                                        <tr className="bg-muted/30">
                                            <td colSpan={2} className="px-3 py-2 text-right font-black text-muted-foreground">Envío {quote.shippingCity ? `(${quote.shippingCity})` : ''}</td>
                                            <td className="px-3 py-2 text-right font-bold">{fmt(quote.shipping)}</td>
                                        </tr>
                                    ) : null}
                                    <tr className="bg-muted/30">
                                        <td colSpan={2} className="px-3 py-2 text-right font-black text-muted-foreground">IVA (19%)</td>
                                        <td className="px-3 py-2 text-right font-bold">{fmt(quote.tax || 0)}</td>
                                    </tr>
                                    <tr className="bg-primary/10 border-t-2 border-primary/30">
                                        <td colSpan={2} className="px-3 py-3 text-right font-black text-foreground">TOTAL</td>
                                        <td className="px-3 py-3 text-right font-black text-primary text-base tabular-nums">{fmt(quote.numericTotal || 0)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Histórico de notas */}
                    {quote.reviewNotes && quote.reviewNotes.length > 0 && (
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                                <History className="w-3.5 h-3.5" /> Historial de revisión
                            </p>
                            <ul className="space-y-2">
                                {quote.reviewNotes.map(n => (
                                    <li key={n.id} className={clsx(
                                        'rounded-xl p-3 text-xs border',
                                        n.action === 'approved'
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                            : 'bg-amber-50 border-amber-200 text-amber-900'
                                    )}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-black">{n.action === 'approved' ? '✅ Aprobó' : '📝 Pidió cambios'} · {n.byName}</span>
                                            <span className="text-[10px] opacity-60">{new Date(n.at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                        </div>
                                        {n.comment && <p className="opacity-90 leading-relaxed">{n.comment}</p>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Comentario (solo para "Pedir cambios") */}
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                            Comentario para el vendedor <span className="text-muted-foreground/60 font-normal normal-case tracking-normal">(obligatorio si pides cambios)</span>
                        </label>
                        <textarea
                            value={comment}
                            onChange={e => onCommentChange(e.target.value)}
                            disabled={!!busy}
                            rows={4}
                            placeholder="Ej: El IVA está mal calculado, revisar el item 3. O: Descuento de 5% pactado por teléfono..."
                            className="w-full bg-white border border-border rounded-xl px-3 py-2 text-sm resize-y disabled:opacity-50 focus:outline-none focus:border-primary"
                        />
                    </div>

                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-rose-900 leading-relaxed">{error}</p>
                        </div>
                    )}

                    {/* Acciones */}
                    <div className="flex flex-col gap-2 pt-2">
                        <button
                            onClick={onApprove}
                            disabled={!!busy || !clientEmail}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                        >
                            {busy === 'approve' ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Enviando al cliente...</>
                            ) : (
                                <><Send className="w-4 h-4" /> Aprobar y enviar al cliente</>
                            )}
                        </button>
                        <button
                            onClick={onRequestChanges}
                            disabled={!!busy}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                        >
                            {busy === 'changes' ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                            ) : (
                                <><MessageSquareWarning className="w-4 h-4" /> Pedir cambios</>
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            disabled={!!busy}
                            className="w-full text-muted-foreground hover:text-foreground font-bold py-2 text-sm disabled:opacity-40"
                        >
                            Cancelar
                        </button>
                        {!clientEmail && (
                            <p className="text-[11px] text-rose-600 text-center">
                                ⚠️ Falta email del cliente — no se puede aprobar. Pide al vendedor que lo agregue.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
