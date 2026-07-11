"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Upload, Loader2, Sparkles, AlertTriangle, Plus, Trash2, FileText } from 'lucide-react';
import { useApp, type Client, type QuoteItem } from '@/context/AppContext';

/**
 * Modal para sistematizar una cotización VIEJA (pre-CRM) desde su PDF:
 *   Paso 1 — elegir el PDF → la IA (Gemini) lo lee y pre-llena el formulario.
 *   Paso 2 — revisar/corregir lado a lado con el PDF y guardar.
 *
 * Al guardar: el PDF se sube a los archivos del cliente (kind 'historical-quote')
 * y se crea la cotización con `isHistorical: true` vía addHistoricalQuote — que
 * NO crea negocio en el pipeline, NO consume el contador ART y NO notifica al
 * equipo. Las históricas son solo consulta (hoja de vida, archivo, empresa).
 */

const MAX_SIZE = 10 * 1024 * 1024;

type ItemRow = { name: string; quantity: string; unit: string; unitPrice: string };

type FormState = {
    quoteNumber: string;
    date: string;          // YYYY-MM-DD (input type=date)
    referencia: string;
    subtotal: string;
    tax: string;
    total: string;
    historicalNote: string;
};

const EMPTY_FORM: FormState = {
    quoteNumber: '', date: '', referencia: '',
    subtotal: '', tax: '', total: '', historicalNote: '',
};

const fmtCOP = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const toNumber = (s: string): number => {
    const n = Number(String(s).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
};

export function HistoricalQuoteUploader({
    lead,
    open,
    onClose,
}: {
    lead: Client;
    open: boolean;
    onClose: () => void;
}) {
    const { currentUser, quotes, addHistoricalQuote, addNotification } = useApp();

    const [step, setStep] = useState<'pick' | 'extracting' | 'review'>('pick');
    const [file, setFile] = useState<File | null>(null);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [banner, setBanner] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [items, setItems] = useState<ItemRow[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Blob URL del PDF para el preview — se revoca al cambiar/cerrar.
    useEffect(() => {
        if (!file) { setFileUrl(null); return; }
        const url = URL.createObjectURL(file);
        setFileUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const reset = () => {
        setStep('pick'); setFile(null); setBanner(null); setError(null);
        setForm(EMPTY_FORM); setItems([]); setSaving(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClose = () => { if (!saving) { reset(); onClose(); } };

    const liveNumbers = useMemo(() =>
        new Set(
            quotes
                .filter(q => !q.isHistorical)
                .map(q => (q.quoteNumber || q.number || '').trim().toLowerCase())
                .filter(Boolean)
        ), [quotes]);

    const historicalNumbers = useMemo(() =>
        new Set(
            quotes
                .filter(q => q.isHistorical)
                .map(q => (q.quoteNumber || q.number || '').trim().toLowerCase())
                .filter(Boolean)
        ), [quotes]);

    const handleFile = async (picked: File) => {
        setError(null);
        if (picked.type !== 'application/pdf') { setError('Solo se aceptan archivos PDF.'); return; }
        if (picked.size > MAX_SIZE) { setError('El archivo excede 10 MB.'); return; }
        setFile(picked);
        setStep('extracting');
        try {
            const fd = new FormData();
            fd.append('file', picked);
            const res = await fetch('/api/quotes/extract-pdf', { method: 'POST', body: fd });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.ok && data.extracted) {
                const ex = data.extracted;
                setForm({
                    quoteNumber: ex.quoteNumber || '',
                    date: /^\d{4}-\d{2}-\d{2}$/.test(ex.date || '') ? ex.date : '',
                    referencia: ex.referencia || '',
                    subtotal: ex.subtotal != null ? String(ex.subtotal) : '',
                    tax: ex.tax != null ? String(ex.tax) : '',
                    total: ex.total != null ? String(ex.total) : '',
                    historicalNote: '',
                });
                setItems((Array.isArray(ex.items) ? ex.items : []).map((it: any) => ({
                    name: it?.name || '',
                    quantity: String(it?.quantity ?? 1),
                    unit: it?.unit || 'Und',
                    unitPrice: String(it?.unitPrice ?? 0),
                })));
                setBanner(null);
            } else {
                setBanner('No pude leer el PDF automáticamente — diligencia los datos manualmente.');
            }
        } catch {
            setBanner('No pude leer el PDF automáticamente — diligencia los datos manualmente.');
        } finally {
            setStep('review');
        }
    };

    const recalc = () => {
        const subtotal = items.reduce((s, it) => s + toNumber(it.quantity) * toNumber(it.unitPrice), 0);
        const tax = toNumber(form.tax);
        setForm(f => ({ ...f, subtotal: String(subtotal), total: String(subtotal + tax) }));
    };

    const setItem = (idx: number, patch: Partial<ItemRow>) =>
        setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));

    const handleSave = async () => {
        setError(null);
        const quoteNumber = form.quoteNumber.trim();
        if (!quoteNumber) { setError('El número de la cotización es obligatorio.'); return; }
        if (!form.date) { setError('La fecha original es obligatoria.'); return; }
        if (!file) { setError('Falta el PDF.'); return; }

        const key = quoteNumber.toLowerCase();
        if (liveNumbers.has(key)) {
            setError('Ya existe una cotización ACTIVA con este número. Ajústalo (p.ej. agrega -HIST).');
            return;
        }
        if (historicalNumbers.has(key) &&
            !window.confirm('Ya hay una cotización histórica con este número. ¿Guardar de todas formas?')) {
            return;
        }

        setSaving(true);
        try {
            // 1) El PDF primero: si falla, no se crea la cotización.
            const fd = new FormData();
            fd.append('file', file);
            fd.append('name', `Cotización ${quoteNumber} (histórica)`);
            fd.append('kind', 'historical-quote');
            if (currentUser?.id) fd.append('uploaded_by_id', currentUser.id);
            if (currentUser?.name) fd.append('uploaded_by_name', currentUser.name);
            const res = await fetch(`/api/clients/${lead.id}/attachments`, { method: 'POST', body: fd });
            const att = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(att.error || 'No se pudo guardar el PDF. Intenta de nuevo.');
                setSaving(false);
                return;
            }

            // 2) La cotización histórica (setState local + persist compartido).
            const numericTotal = toNumber(form.total);
            const quoteItems: QuoteItem[] = items
                .filter(it => it.name.trim())
                .map((it, i) => {
                    const quantity = toNumber(it.quantity) || 1;
                    const price = toNumber(it.unitPrice);
                    return {
                        id: `qi-hist-${Date.now()}-${i}`,
                        name: it.name.trim(),
                        price,
                        quantity,
                        unit: it.unit.trim() || 'Und',
                        total: price * quantity,
                        isCustom: true,
                    };
                });

            addHistoricalQuote({
                client: lead.name,
                clientId: lead.id,
                clientEmail: lead.email || undefined,
                clientCompany: lead.company || undefined,
                companyId: lead.companyId,
                quoteNumber,
                date: form.date,
                sentAt: `${form.date}T12:00:00`,
                total: fmtCOP(numericTotal),
                numericTotal,
                subtotal: toNumber(form.subtotal) || undefined,
                tax: toNumber(form.tax) || undefined,
                items: quoteItems,
                referencia: form.referencia.trim() || undefined,
                historicalNote: form.historicalNote.trim() || undefined,
                historicalAttachmentId: att.id,
                historicalUploadedById: currentUser?.id,
                historicalUploadedByName: currentUser?.name,
                sellerId: currentUser?.id || '',
                sellerName: currentUser?.name || '',
                status: 'Sent',
            });

            addNotification({
                title: 'Cotización histórica guardada',
                description: `${quoteNumber} · ${lead.company || lead.name} · ${fmtCOP(numericTotal)}`,
                type: 'success',
            });
            reset();
            onClose();
        } catch {
            setError('Error de red al guardar. Intenta de nuevo.');
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={handleClose}>
            <div
                className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-white rounded-t-2xl z-10">
                    <div>
                        <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-primary" />
                            Sistematizar cotización vieja
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {lead.company || lead.name} · el PDF queda en los archivos del cliente y la cotización marcada como histórica (solo consulta).
                        </p>
                    </div>
                    <button onClick={handleClose} className="p-2 rounded-lg hover:bg-muted transition-colors" title="Cerrar">
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                </div>

                <div className="p-5">
                    {error && (
                        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">{error}</div>
                    )}

                    {step === 'pick' && (
                        <div className="text-center py-14 bg-muted/30 border-2 border-dashed border-border rounded-xl">
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                accept="application/pdf"
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                            />
                            <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                            <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest mb-1">Sube el PDF de la cotización vieja</p>
                            <p className="text-xs text-muted-foreground mb-4">De a una · solo PDF · máx 10 MB. La IA leerá el documento y pre-llenará los datos.</p>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-primary text-black font-bold rounded-xl px-5 py-2.5 hover:brightness-105 transition-all shadow-[0_2px_8px_rgba(250,181,16,0.3)] inline-flex items-center gap-2 text-xs"
                            >
                                <Upload className="w-3.5 h-3.5" />
                                Elegir PDF
                            </button>
                        </div>
                    )}

                    {step === 'extracting' && (
                        <div className="text-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                            <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Leyendo el PDF con IA…</p>
                            <p className="text-xs text-muted-foreground mt-1">Extrayendo número, fecha, ítems y totales.</p>
                        </div>
                    )}

                    {step === 'review' && (
                        <div className="space-y-4">
                            {banner && (
                                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    {banner}
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                {/* PDF preview */}
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">PDF original</p>
                                    {fileUrl ? (
                                        <iframe src={fileUrl} title="PDF" className="w-full h-[55vh] rounded-xl border border-border bg-muted" />
                                    ) : (
                                        <div className="w-full h-[55vh] rounded-xl border border-dashed border-border bg-muted/30" />
                                    )}
                                </div>

                                {/* Form */}
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Número *</label>
                                            <input
                                                value={form.quoteNumber}
                                                onChange={e => setForm(f => ({ ...f, quoteNumber: e.target.value }))}
                                                placeholder="ART-142-2023"
                                                className="mt-1 w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fecha original *</label>
                                            <input
                                                type="date"
                                                value={form.date}
                                                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                                className="mt-1 w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Referencia / proyecto</label>
                                        <input
                                            value={form.referencia}
                                            onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
                                            className="mt-1 w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-primary"
                                        />
                                    </div>

                                    {/* Ítems */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ítems</label>
                                            <button
                                                onClick={() => setItems(prev => [...prev, { name: '', quantity: '1', unit: 'Und', unitPrice: '0' }])}
                                                className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                                            >
                                                <Plus className="w-3 h-3" /> Agregar ítem
                                            </button>
                                        </div>
                                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                            {items.length === 0 && (
                                                <p className="text-[11px] text-muted-foreground py-2">Sin ítems — puedes guardar solo con los totales.</p>
                                            )}
                                            {items.map((it, i) => (
                                                <div key={i} className="grid grid-cols-[1fr_52px_56px_90px_28px] gap-1.5 items-center">
                                                    <input value={it.name} onChange={e => setItem(i, { name: e.target.value })} placeholder="Descripción"
                                                        className="text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary" />
                                                    <input value={it.quantity} onChange={e => setItem(i, { quantity: e.target.value })} placeholder="Cant" inputMode="numeric"
                                                        className="text-xs border border-border rounded-lg px-2 py-1.5 text-center focus:outline-none focus:border-primary" />
                                                    <input value={it.unit} onChange={e => setItem(i, { unit: e.target.value })} placeholder="Und"
                                                        className="text-xs border border-border rounded-lg px-2 py-1.5 text-center focus:outline-none focus:border-primary" />
                                                    <input value={it.unitPrice} onChange={e => setItem(i, { unitPrice: e.target.value })} placeholder="Precio" inputMode="numeric"
                                                        className="text-xs border border-border rounded-lg px-2 py-1.5 text-right focus:outline-none focus:border-primary" />
                                                    <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} title="Quitar"
                                                        className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-400">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Totales */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Subtotal</label>
                                            <input value={form.subtotal} onChange={e => setForm(f => ({ ...f, subtotal: e.target.value }))} inputMode="numeric"
                                                className="mt-1 w-full text-sm border border-border rounded-xl px-3 py-2 text-right focus:outline-none focus:border-primary" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">IVA ($)</label>
                                            <input value={form.tax} onChange={e => setForm(f => ({ ...f, tax: e.target.value }))} inputMode="numeric"
                                                className="mt-1 w-full text-sm border border-border rounded-xl px-3 py-2 text-right focus:outline-none focus:border-primary" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total *</label>
                                            <input value={form.total} onChange={e => setForm(f => ({ ...f, total: e.target.value }))} inputMode="numeric"
                                                className="mt-1 w-full text-sm border border-border rounded-xl px-3 py-2 text-right font-bold focus:outline-none focus:border-primary" />
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <button onClick={recalc} className="text-[10px] font-bold text-primary hover:underline">
                                            Recalcular desde ítems
                                        </button>
                                        <span className="text-xs font-black text-foreground">{fmtCOP(toNumber(form.total))}</span>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nota de contexto</label>
                                        <textarea
                                            value={form.historicalNote}
                                            onChange={e => setForm(f => ({ ...f, historicalNote: e.target.value }))}
                                            placeholder="¿Se ganó? ¿Contexto? (opcional)"
                                            rows={2}
                                            className="mt-1 w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-primary resize-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-3 border-t border-border">
                                <button
                                    onClick={() => { reset(); }}
                                    disabled={saving}
                                    className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                                >
                                    ← Elegir otro PDF
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="bg-primary text-black font-bold rounded-xl px-5 py-2.5 hover:brightness-105 transition-all shadow-[0_2px_8px_rgba(250,181,16,0.3)] flex items-center gap-2 text-xs disabled:opacity-60"
                                >
                                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                    {saving ? 'Guardando…' : 'Guardar histórica'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
