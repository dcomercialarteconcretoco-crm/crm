"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
    Plus, Minus, Trash2, Mail, Printer, Search, Save,
    CheckCircle, UserPlus, Box, RefreshCw, ShoppingCart,
    User, Building2, Package
} from 'lucide-react';
import { clsx } from 'clsx';
import { generateProposalPDF } from '@/lib/pdf-generator';
import { useApp, Product } from '@/context/AppContext';

interface QuoteItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    unit: string;
    productId?: string;
    image?: string;
}

interface QuoteEngineProps {
    defaultClientId?: string;
}

export default function QuoteEngine({ defaultClientId = '' }: QuoteEngineProps) {
    const { products, clients, addClient, refreshProducts, addQuote, updateQuote, currentUser, settings, addNotification } = useApp();
    const genId = () => `${Date.now().toString(36)}-${Math.round(Math.random() * 1e4)}`;
    const genQuoteNumber = () => `AC-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;

    const [selectedClientId, setSelectedClientId] = useState(defaultClientId);
    const [items, setItems] = useState<QuoteItem[]>([]);
    const [taxRate] = useState(0.19);
    const [isSaving, setIsSaving] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [showNewClientForm, setShowNewClientForm] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [newClient, setNewClient] = useState({ name: '', company: '', email: '', phone: '', city: '' });

    useEffect(() => {
        const doSync = async () => {
            setIsSyncing(true);
            try { await refreshProducts(); } finally { setIsSyncing(false); }
        };
        doSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredProducts = useMemo(() => {
        const q = productSearch.toLowerCase().trim();
        if (!q) return products.filter(p => !p.isDeleted && p.isActive !== false);
        return products.filter(p =>
            !p.isDeleted &&
            p.isActive !== false &&
            (p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))
        );
    }, [products, productSearch]);

    const addProductToQuote = (product: Product) => {
        setItems(prev => {
            const existing = prev.find(i => i.productId === product.id);
            if (existing) {
                return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, {
                id: genId(),
                name: product.name,
                price: product.price || 0,
                quantity: 1,
                unit: 'un',
                productId: product.id,
                image: product.image,
            }];
        });
    };

    const updateQty = (id: string, delta: number) => {
        setItems(prev => prev.map(i => {
            if (i.id !== id) return i;
            const next = i.quantity + delta;
            return next <= 0 ? i : { ...i, quantity: next };
        }));
    };

    const updatePrice = (id: string, val: number) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, price: val } : i));
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

    const handleSave = () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client) { addNotification({ title: 'Cliente requerido', description: 'Selecciona un cliente.', type: 'alert' }); return; }
        if (items.length === 0) { addNotification({ title: 'Sin productos', description: 'Agrega al menos un producto.', type: 'alert' }); return; }
        setIsSaving(true);
        const quoteNumber = genQuoteNumber();
        addQuote({
            number: quoteNumber, client: client.name, clientId: client.id,
            clientEmail: client.email || '', clientCompany: client.company || '',
            date: new Date().toLocaleDateString('es-CO'),
            total: formatCurrency(total), numericTotal: total, subtotal, tax,
            items: items.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, unit: i.unit, total: i.price * i.quantity })),
            notes: '', sellerId: currentUser?.id || '', sellerName: currentUser?.name || '',
            status: 'Draft' as const,
        });
        setIsSaving(false);
        addNotification({ title: `Cotización ${quoteNumber} guardada`, description: 'Guardada como Borrador.', type: 'success' });
    };

    const handleSendEmail = async () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client?.email) { addNotification({ title: 'Email requerido', description: 'El cliente no tiene email.', type: 'alert' }); return; }
        if (items.length === 0) { addNotification({ title: 'Sin productos', description: 'Agrega al menos un producto.', type: 'alert' }); return; }
        setIsSendingEmail(true);
        try {
            const sentAt = new Date().toISOString();
            const quoteNumber = genQuoteNumber();
            const quoteId = addQuote({
                number: quoteNumber, client: client.name, clientId: client.id,
                clientEmail: client.email || '', clientCompany: client.company || '',
                date: new Date().toLocaleDateString('es-CO'),
                total: formatCurrency(total), numericTotal: total, subtotal, tax,
                items: items.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, unit: i.unit, total: i.price * i.quantity })),
                notes: '', sellerId: currentUser?.id || '', sellerName: currentUser?.name || '',
                status: 'Draft' as const, sentAt, sentByName: currentUser?.name || '', sentById: currentUser?.id || '',
            });
            const res = await fetch('/api/quotes/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quoteNumber, clientName: client.name, clientEmail: client.email,
                    clientCompany: client.company || '', sellerName: currentUser?.name || 'Arte Concreto',
                    sellerId: currentUser?.id || '', sentAt, sentByName: currentUser?.name || '',
                    sentById: currentUser?.id || '',
                    items: items.map(i => ({ name: i.name, price: i.price, quantity: i.quantity, unit: i.unit })),
                    subtotal, tax, total,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                updateQuote(quoteId, { status: 'Sent', sentAt: data.sentAt || sentAt, sentByName: data.sentByName || currentUser?.name || '', sentById: data.sentById || currentUser?.id || '' });
                addNotification({ title: `Cotización ${quoteNumber} enviada`, description: `Enviada a ${client.email}`, type: 'success' });
            } else {
                addNotification({ title: 'Error al enviar', description: data.error || 'Verifica la clave Resend.', type: 'alert' });
            }
        } catch {
            addNotification({ title: 'Error de conexión', description: 'No se pudo enviar.', type: 'alert' });
        } finally {
            setIsSendingEmail(false);
        }
    };

    const handleGeneratePDF = async () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client) { addNotification({ title: 'Cliente requerido', description: 'Selecciona un cliente para el PDF.', type: 'alert' }); return; }
        await generateProposalPDF({
            quoteNumber: genQuoteNumber(), date: new Date().toLocaleDateString(),
            leadName: client.name, leadCompany: client.company,
            items: items.map(i => ({ ...i, total: i.price * i.quantity })),
            subtotal, tax, total,
        });
    };

    const handleCreateClient = (e: React.FormEvent) => {
        e.preventDefault();
        const id = addClient({ ...newClient, status: 'Active', value: '$0', ltv: 0, lastContact: 'Ahora', city: newClient.city || '', score: 10, category: 'Construcción', registrationDate: new Date().toISOString() });
        setSelectedClientId(id);
        setShowNewClientForm(false);
        setNewClient({ name: '', company: '', email: '', phone: '', city: '' });
        addNotification({ title: 'Cliente creado', description: `${newClient.name} vinculado a la cotización.`, type: 'success' });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── LEFT: Client + Catalog ── */}
            <div className="lg:col-span-2 space-y-6">

                {/* Client Selector */}
                <div className="surface-panel rounded-[2rem] p-6 flex flex-col md:flex-row items-start gap-6 relative group overflow-visible">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-accent/70 flex items-center justify-center text-primary shrink-0 border border-primary/15 group-hover:scale-110 transition-transform duration-500">
                        <Building2 className="w-8 h-8" />
                    </div>
                    <div className="flex-1 w-full space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em]">Cliente vinculado a la oferta</label>
                            <button type="button" onClick={() => setShowNewClientForm(p => !p)}
                                className="text-[9px] font-black uppercase text-primary hover:text-foreground transition-colors flex items-center gap-1.5">
                                <UserPlus className="w-3 h-3" />
                                {showNewClientForm ? 'Cerrar' : 'Crear nuevo cliente'}
                            </button>
                        </div>
                        <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}
                            className="w-full bg-white/75 border border-border/70 rounded-2xl px-5 py-4 text-sm focus:border-primary focus:bg-white outline-none transition-all font-black appearance-none cursor-pointer text-foreground italic">
                            <option value="">Selecciona el prospecto o cliente...</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
                        </select>

                        {showNewClientForm && (
                            <div className="rounded-2xl border border-primary/20 bg-white/80 p-5 space-y-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Nuevo cliente rápido</p>
                                <form onSubmit={handleCreateClient} className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <input required placeholder="Nombre completo" value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })}
                                            className="bg-white border border-border/70 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all" />
                                        <input placeholder="Empresa" value={newClient.company} onChange={e => setNewClient({ ...newClient, company: e.target.value })}
                                            className="bg-white border border-border/70 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all" />
                                        <input type="email" required placeholder="Email" value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })}
                                            className="bg-white border border-border/70 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all" />
                                        <input required placeholder="Teléfono / WhatsApp" value={newClient.phone} onChange={e => setNewClient({ ...newClient, phone: e.target.value })}
                                            className="bg-white border border-border/70 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all" />
                                        <input required placeholder="Ciudad" value={newClient.city} onChange={e => setNewClient({ ...newClient, city: e.target.value })}
                                            className="bg-white border border-border/70 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all col-span-2" />
                                    </div>
                                    <div className="flex gap-3">
                                        <button type="submit" className="flex-1 bg-primary text-black font-black py-3 rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                                            <CheckCircle className="w-4 h-4" /> Guardar y Vincular
                                        </button>
                                        <button type="button" onClick={() => setShowNewClientForm(false)}
                                            className="px-6 bg-white border border-border/70 text-muted-foreground font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-accent/50 transition-all">
                                            Cancelar
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </div>

                {/* Product Catalog */}
                <div className="surface-panel rounded-[2rem] overflow-hidden">
                    {/* Catalog header */}
                    <div className="px-6 py-4 border-b border-border/40 bg-white/30 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Package className="w-5 h-5 text-primary" />
                            <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Catálogo de Productos</h2>
                            {isSyncing ? (
                                <span className="text-[9px] font-black uppercase text-muted-foreground animate-pulse">Sincronizando...</span>
                            ) : (
                                <span className="text-[9px] font-black text-muted-foreground">{products.filter(p => !p.isDeleted && p.isActive !== false).length} productos</span>
                            )}
                        </div>
                        <button onClick={async () => { setIsSyncing(true); try { await refreshProducts(); } finally { setIsSyncing(false); } }}
                            disabled={isSyncing}
                            className="p-2 rounded-xl border border-border/60 hover:bg-accent/50 transition-all disabled:opacity-50">
                            <RefreshCw className={clsx("w-4 h-4 text-muted-foreground", isSyncing && "animate-spin")} />
                        </button>
                    </div>

                    {/* Search bar */}
                    <div className="px-6 py-3 border-b border-border/30 bg-white/20">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre, SKU o categoría..."
                                value={productSearch}
                                onChange={e => setProductSearch(e.target.value)}
                                className="w-full bg-white/80 border border-border/60 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all placeholder:text-muted-foreground"
                            />
                        </div>
                    </div>

                    {/* Product grid */}
                    <div className="p-4 max-h-[520px] overflow-y-auto custom-scrollbar">
                        {filteredProducts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <Box className="w-12 h-12 text-muted-foreground/30 mb-3" />
                                <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">
                                    {isSyncing ? 'Cargando catálogo...' : productSearch ? 'Sin resultados' : 'Sin productos — Sincroniza el catálogo web'}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {filteredProducts.map(product => {
                                    const inCart = items.find(i => i.productId === product.id);
                                    return (
                                        <button
                                            key={product.id}
                                            onClick={() => addProductToQuote(product)}
                                            className={clsx(
                                                "group/card relative text-left rounded-2xl border transition-all overflow-hidden hover:shadow-lg hover:-translate-y-0.5",
                                                inCart
                                                    ? "border-primary/40 bg-primary/5 shadow-md shadow-primary/10"
                                                    : "border-border/50 bg-white/60 hover:border-primary/30"
                                            )}
                                        >
                                            {/* Product image */}
                                            <div className="relative aspect-[4/3] bg-accent/30 overflow-hidden">
                                                {product.image ? (
                                                    <img src={product.image} alt={product.name}
                                                        className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Box className="w-8 h-8 text-muted-foreground/30" />
                                                    </div>
                                                )}
                                                {/* SKU badge */}
                                                <div className="absolute top-2 left-2 bg-black/60 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide backdrop-blur-sm">
                                                    {product.sku || `#${product.id?.slice(-4)}`}
                                                </div>
                                                {/* In cart badge */}
                                                {inCart && (
                                                    <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                                                        <span className="text-[9px] font-black text-black">{inCart.quantity}</span>
                                                    </div>
                                                )}
                                                {/* Add overlay */}
                                                <div className="absolute inset-0 bg-primary/0 group-hover/card:bg-primary/10 transition-colors flex items-center justify-center">
                                                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center opacity-0 group-hover/card:opacity-100 scale-75 group-hover/card:scale-100 transition-all shadow-xl">
                                                        <Plus className="w-5 h-5 text-black" />
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Product info */}
                                            <div className="p-3">
                                                <p className="text-[10px] font-black text-foreground uppercase leading-tight line-clamp-2 mb-1">{product.name}</p>
                                                <p className="text-sm font-black text-primary">{formatCurrency(product.price)}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── RIGHT: Cart + Totals ── */}
            <div className="space-y-4">
                <div className="surface-panel rounded-[2rem] overflow-hidden sticky top-6">

                    {/* Cart header */}
                    <div className="px-5 py-4 border-b border-border/40 bg-white/30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4 text-primary" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest">Productos Seleccionados</h3>
                        </div>
                        <span className={clsx(
                            "text-[9px] font-black px-2.5 py-1 rounded-full",
                            items.length > 0 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                            {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
                        </span>
                    </div>

                    {/* Items list */}
                    <div className="max-h-[320px] overflow-y-auto custom-scrollbar divide-y divide-border/30">
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                                <ShoppingCart className="w-8 h-8 text-muted-foreground/20 mb-2" />
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                                    Agrega productos del catálogo
                                </p>
                            </div>
                        ) : (
                            items.map(item => (
                                <div key={item.id} className="px-4 py-3 flex items-center gap-3 bg-white/20 hover:bg-white/40 transition-colors">
                                    {/* Thumbnail */}
                                    <div className="w-10 h-10 rounded-xl bg-accent/40 border border-border/40 overflow-hidden shrink-0">
                                        {item.image
                                            ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                            : <Box className="w-4 h-4 text-muted-foreground m-auto mt-3" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-foreground uppercase truncate leading-tight">{item.name}</p>
                                        {/* Editable price */}
                                        <input
                                            type="number"
                                            value={item.price}
                                            onChange={e => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                                            className="mt-0.5 w-full bg-transparent text-[11px] font-black text-primary outline-none border-b border-transparent focus:border-primary/40 transition-all"
                                        />
                                    </div>
                                    {/* Qty stepper */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => updateQty(item.id, -1)}
                                            className="w-6 h-6 rounded-lg bg-white border border-border/60 flex items-center justify-center hover:bg-rose-50 hover:border-rose-300 transition-all">
                                            <Minus className="w-3 h-3" />
                                        </button>
                                        <span className="w-6 text-center text-xs font-black">{item.quantity}</span>
                                        <button onClick={() => updateQty(item.id, 1)}
                                            className="w-6 h-6 rounded-lg bg-white border border-border/60 flex items-center justify-center hover:bg-primary/10 hover:border-primary/40 transition-all">
                                            <Plus className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <button onClick={() => removeItem(item.id)}
                                        className="p-1 text-muted-foreground hover:text-rose-500 transition-colors shrink-0">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Totals */}
                    <div className="px-5 py-4 border-t border-border/40 bg-white/20 space-y-2">
                        <div className="flex justify-between text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                            <span>Subtotal</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                            <span>IVA 19%</span>
                            <span>{formatCurrency(tax)}</span>
                        </div>
                        <div className="flex justify-between items-baseline pt-2 border-t border-border/40">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Total</span>
                            <span className="text-2xl font-black text-foreground tracking-tighter">{formatCurrency(total)}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="px-5 pb-5 space-y-2.5">
                        <button onClick={handleGeneratePDF}
                            className="w-full bg-primary text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-all shadow-lg shadow-primary/20 text-[10px] uppercase tracking-widest">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            Generar PDF
                        </button>

                        <button onClick={handleSave} disabled={isSaving}
                            className="w-full bg-emerald-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/15 text-[10px] uppercase tracking-widest disabled:opacity-60">
                            {isSaving
                                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Save className="w-4 h-4" />}
                            Guardar Cotización
                        </button>

                        <button onClick={handleSendEmail} disabled={isSendingEmail}
                            className="w-full bg-white border border-border/70 text-foreground font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-accent/40 transition-all text-[10px] uppercase tracking-widest disabled:opacity-60">
                            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            {isSendingEmail ? 'Enviando...' : 'Enviar por Email'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
