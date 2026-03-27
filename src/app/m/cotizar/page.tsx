"use client";

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Search, Plus, Minus, Send, CheckCircle2, FileText, X, Package } from 'lucide-react';
import { clsx } from 'clsx';

interface LineItem { id: string; name: string; price: number; qty: number; unit: string; }

function formatCOP(n: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

export default function MobileCotizar() {
    const { currentUser, products, addQuote, clients } = useApp();

    const [clientName, setClientName] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [prodSearch, setProdSearch] = useState('');
    const [items, setItems] = useState<LineItem[]>([]);
    const [sent, setSent] = useState(false);
    const [sending, setSending] = useState(false);
    const [showProdPicker, setShowProdPicker] = useState(false);
    const [notes, setNotes] = useState('');

    const filteredProds = useMemo(() =>
        products.filter(p =>
            p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
            p.sku?.toLowerCase().includes(prodSearch.toLowerCase())
        ).slice(0, 30),
        [products, prodSearch]
    );

    const total = useMemo(() =>
        items.reduce((s, i) => s + i.price * i.qty, 0),
        [items]
    );

    const addProduct = (p: typeof products[0]) => {
        setItems(prev => {
            const existing = prev.find(i => i.id === p.id);
            if (existing) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
            return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1, unit: 'unidad' }];
        });
        setProdSearch('');
        setShowProdPicker(false);
    };

    const updateQty = (id: string, delta: number) => {
        setItems(prev => prev
            .map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
            .filter(i => i.qty > 0)
        );
    };

    const handleSend = async () => {
        if (!clientName.trim() || items.length === 0) return;
        setSending(true);

        const now = new Date();
        const num = `COT-M-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getTime()).slice(-4)}`;

        addQuote({
            number: num,
            client: clientName.trim(),
            clientId: '',
            clientEmail: clientEmail.trim() || undefined,
            date: now.toLocaleDateString('es-CO'),
            total: formatCOP(total),
            numericTotal: total,
            items: items.map(i => ({
                id: i.id,
                name: i.name,
                price: i.price,
                quantity: i.qty,
                unit: i.unit,
                total: i.price * i.qty,
            })),
            notes: notes.trim() || undefined,
            sellerId: currentUser?.id,
            sellerName: currentUser?.name,
            status: 'Draft',
        });

        setSending(false);
        setSent(true);
    };

    if (sent) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <h2 className="text-xl font-black text-foreground">¡Cotización creada!</h2>
                <p className="text-sm text-muted-foreground mt-2 mb-6">
                    Puedes verla y enviarla desde el CRM web.
                </p>
                <button
                    onClick={() => { setSent(false); setClientName(''); setClientEmail(''); setItems([]); setNotes(''); }}
                    className="bg-primary text-black font-bold rounded-2xl px-6 py-3.5 text-sm active:scale-95 transition-transform">
                    Nueva Cotización
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            <div>
                <h1 className="text-xl font-black text-foreground">Nueva Cotización</h1>
                <p className="text-xs text-muted-foreground">Rápida y sencilla</p>
            </div>

            {/* Client Info */}
            <div className="bg-white border border-border rounded-2xl p-4 space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cliente</p>
                <input
                    type="text"
                    placeholder="Nombre del cliente *"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-all"
                />
                <input
                    type="email"
                    placeholder="Email (opcional)"
                    value={clientEmail}
                    onChange={e => setClientEmail(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-all"
                />
            </div>

            {/* Products */}
            <div className="bg-white border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos</p>
                    <button
                        onClick={() => setShowProdPicker(true)}
                        className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-xl active:bg-primary/20">
                        <Plus className="w-3.5 h-3.5" />
                        Agregar
                    </button>
                </div>

                {items.length === 0 ? (
                    <button
                        onClick={() => setShowProdPicker(true)}
                        className="w-full border-2 border-dashed border-border rounded-xl py-8 flex flex-col items-center gap-2 text-muted-foreground active:bg-muted">
                        <Package className="w-8 h-8 opacity-40" />
                        <span className="text-xs font-medium">Toca para agregar productos</span>
                    </button>
                ) : (
                    <div className="space-y-2">
                        {items.map(item => (
                            <div key={item.id} className="flex items-center gap-3 bg-muted rounded-xl p-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-foreground truncate">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{formatCOP(item.price)} / {item.unit}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button onClick={() => updateQty(item.id, -1)}
                                        className="w-7 h-7 bg-white border border-border rounded-lg flex items-center justify-center active:bg-muted">
                                        <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="text-sm font-black w-5 text-center">{item.qty}</span>
                                    <button onClick={() => updateQty(item.id, +1)}
                                        className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center active:brightness-90">
                                        <Plus className="w-3 h-3 text-black" />
                                    </button>
                                </div>
                                <p className="text-xs font-bold text-right w-16 shrink-0">
                                    {formatCOP(item.price * item.qty)}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Notes */}
            <div className="bg-white border border-border rounded-2xl p-4 space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Notas</p>
                <textarea
                    placeholder="Condiciones, observaciones, tiempos de entrega..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={3}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-all resize-none"
                />
            </div>

            {/* Total + Send */}
            <div className="bg-white border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-muted-foreground">Total estimado</p>
                    <p className="text-xl font-black text-primary">{formatCOP(total)}</p>
                </div>
                <button
                    onClick={handleSend}
                    disabled={!clientName.trim() || items.length === 0 || sending}
                    className={clsx(
                        'w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm transition-all active:scale-95',
                        clientName.trim() && items.length > 0
                            ? 'bg-primary text-black shadow-[0_4px_16px_rgba(250,181,16,0.4)]'
                            : 'bg-muted text-muted-foreground cursor-not-allowed'
                    )}>
                    {sending
                        ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        : <><Send className="w-4 h-4" /> Crear Cotización</>
                    }
                </button>
            </div>

            {/* Product Picker Sheet */}
            {showProdPicker && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end"
                    style={{ background: 'rgba(0,0,0,0.5)' }}
                    onClick={() => setShowProdPicker(false)}>
                    <div
                        className="bg-white rounded-t-3xl flex flex-col"
                        style={{ maxHeight: '75vh' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-border space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="font-black text-foreground">Agregar producto</p>
                                <button onClick={() => setShowProdPicker(false)}>
                                    <X className="w-5 h-5 text-muted-foreground" />
                                </button>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Buscar producto..."
                                    value={prodSearch}
                                    onChange={e => setProdSearch(e.target.value)}
                                    className="w-full bg-muted border border-border rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-primary"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {filteredProds.length === 0 ? (
                                <div className="py-10 text-center text-muted-foreground text-sm">
                                    Sin resultados. Sincroniza el catálogo desde el CRM web.
                                </div>
                            ) : filteredProds.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => addProduct(p)}
                                    className="w-full text-left flex items-center gap-3 p-3 bg-muted rounded-xl active:bg-primary/10 transition-colors">
                                    {p.image
                                        ? <img src={p.image} className="w-10 h-10 rounded-lg object-cover shrink-0" alt="" />
                                        : <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                                            <Package className="w-5 h-5 text-primary" />
                                          </div>
                                    }
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-foreground truncate">{p.name}</p>
                                        <p className="text-xs text-muted-foreground">{p.sku}</p>
                                    </div>
                                    <p className="text-sm font-black text-primary shrink-0">
                                        {formatCOP(p.price)}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
