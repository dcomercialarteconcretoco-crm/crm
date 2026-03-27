"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
    Plus, Minus, Trash2, Search,
    CheckCircle, UserPlus, Box, RefreshCw, ShoppingCart,
    Building2, Package, Eye, X, FileText, Send
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
    editQuoteId?: string;
}

export default function QuoteEngine({ defaultClientId = '', editQuoteId }: QuoteEngineProps) {
    const { products, clients, addClient, refreshProducts, addQuote, updateQuote, quotes, currentUser, settings, addNotification, addAuditLog } = useApp();
    const isEditMode = !!editQuoteId;
    const genId = () => `${Date.now().toString(36)}-${Math.round(Math.random() * 1e4)}`;
    const genQuoteNumber = () => `AC-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;

    const [selectedClientId, setSelectedClientId] = useState(defaultClientId);
    const [items, setItems] = useState<QuoteItem[]>([]);
    const [taxRate] = useState(0.19);
    const [isSaving, setIsSaving] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [sentConfirm, setSentConfirm] = useState<{ quoteNumber: string; email: string; pending?: boolean; pendingAction?: 'send_email' | 'send_whatsapp' | 'generate_pdf' } | null>(null);
    const [showNewClientForm, setShowNewClientForm] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [newClient, setNewClient] = useState({ name: '', company: '', email: '', phone: '', city: '' });
    const [clientSearch, setClientSearch] = useState('');
    const [showClientDropdown, setShowClientDropdown] = useState(false);

    // Campos comerciales (formato Word oficial)
    const [referencia, setReferencia] = useState('');
    const [validUntil, setValidUntil] = useState('');
    const [deliveryTime, setDeliveryTime] = useState('A convenir con el cliente.');
    const [paymentTerms, setPaymentTerms] = useState('- Anticipo del 50% del total de la orden.\n- El saldo deberá cancelarse en su totalidad antes de la entrega de los productos. El producto que no sea cancelado en su totalidad, no podrá ser entregado.');

    // Preview modal
    const [showPreview, setShowPreview] = useState(false);
    const [pendingAction, setPendingAction] = useState<'pdf' | 'email' | 'whatsapp' | null>(null);

    useEffect(() => {
        const doSync = async () => {
            setIsSyncing(true);
            try { await refreshProducts(); } finally { setIsSyncing(false); }
        };
        doSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!editQuoteId) return;
        const existing = quotes.find(q => q.id === editQuoteId);
        if (!existing) return;
        if (existing.clientId) setSelectedClientId(existing.clientId);
        if (existing.items && existing.items.length > 0) {
            setItems(existing.items.map(i => ({
                id: i.id || `${Date.now().toString(36)}-${Math.round(Math.random() * 1e4)}`,
                name: i.name || '',
                price: i.price || (i as any).unitPrice || 0,
                quantity: i.quantity || 1,
                unit: (i as any).unit || 'un',
                productId: (i as any).productId,
                image: (i as any).image,
            })));
        }
        // Load commercial fields
        if (existing.referencia) setReferencia(existing.referencia);
        if (existing.validUntil) setValidUntil(existing.validUntil);
        if (existing.deliveryTime) setDeliveryTime(existing.deliveryTime);
        if (existing.paymentTerms) setPaymentTerms(existing.paymentTerms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editQuoteId]);

    const filteredProducts = useMemo(() => {
        const q = productSearch.toLowerCase().trim();
        if (!q) return products.filter(p => !p.isDeleted && p.isActive !== false);
        return products.filter(p =>
            !p.isDeleted &&
            p.isActive !== false &&
            (p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))
        );
    }, [products, productSearch]);

    const filteredClients = useMemo(() => {
        const q = clientSearch.toLowerCase().trim();
        if (!q) return clients.slice(0, 20);
        return clients.filter(c =>
            c.name.toLowerCase().includes(q) ||
            (c.company || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q)
        ).slice(0, 15);
    }, [clients, clientSearch]);

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

    const getCommonQuoteFields = (client: typeof clients[0], quoteNumber: string, mappedItems: typeof items) => ({
        number: quoteNumber, client: client.name, clientId: client.id,
        clientEmail: client.email || '', clientCompany: client.company || '',
        date: new Date().toLocaleDateString('es-CO'),
        total: formatCurrency(total), numericTotal: total, subtotal, tax,
        items: mappedItems.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, unit: i.unit, total: i.price * i.quantity })),
        notes: '', sellerId: currentUser?.id || '', sellerName: currentUser?.name || '',
        referencia, validUntil, deliveryTime, paymentTerms,
        sellerPhone: currentUser?.phone || '',
    });

    const executeGeneratePDF = async () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client) return;
        const isAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';

        if (!isAdmin) {
            const quoteNumber = genQuoteNumber();
            addQuote({ ...getCommonQuoteFields(client, quoteNumber, items), status: 'PENDING_APPROVAL' as const, pendingAction: 'generate_pdf', requestedBy: currentUser?.id || '', requestedByName: currentUser?.name || '', requestedAt: new Date().toISOString() });
            addNotification({ title: 'Solicitud enviada', description: 'Enviada al administrador para aprobación.', type: 'alert' });
            addNotification({ title: '⏳ Aprobación requerida', description: `${currentUser?.name} solicita generar PDF — ${quoteNumber} para ${client.name} · ${formatCurrency(total)}`, type: 'alert', forAdmin: true });
            setSentConfirm({ quoteNumber, email: '', pending: true, pendingAction: 'generate_pdf' });
            setShowPreview(false);
            return;
        }

        setIsSaving(true);
        try {
            const mappedItems = items.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, unit: i.unit, total: i.price * i.quantity }));
            let quoteNumber: string;
            if (isEditMode && editQuoteId) {
                const existing = quotes.find(q => q.id === editQuoteId);
                quoteNumber = existing?.number || genQuoteNumber();
                updateQuote(editQuoteId, { ...getCommonQuoteFields(client, quoteNumber, items), status: existing?.status || 'Draft' as const });
            } else {
                quoteNumber = genQuoteNumber();
                addQuote({ ...getCommonQuoteFields(client, quoteNumber, items), status: 'Draft' as const });
            }
            await generateProposalPDF({
                quoteNumber, date: new Date().toLocaleDateString('es-CO'),
                leadName: client.name, leadCompany: client.company, leadEmail: client.email, leadCity: client.city,
                referencia, validUntil, deliveryTime, paymentTerms,
                sellerName: currentUser?.name || 'ArteConcreto',
                sellerPhone: currentUser?.phone || '',
                items: items.map(i => ({ ...i, total: i.price * i.quantity })),
                subtotal, tax, total,
            });
            addAuditLog({ userId: currentUser?.id || '', userName: currentUser?.name || 'Sistema', userRole: currentUser?.role || 'Vendedor', action: 'QUOTE_SENT', targetId: client.id, targetName: client.company || client.name, details: `Cotización ${quoteNumber} ${isEditMode ? 'editada' : 'generada'} · Total: ${formatCurrency(total)}`, verified: true });
            addNotification({ title: `Cotización ${quoteNumber} lista`, description: 'PDF descargado.', type: 'success' });
        } finally {
            setIsSaving(false);
            setShowPreview(false);
        }
    };

    const handleSaveAndGenerate = async () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client) { addNotification({ title: 'Cliente requerido', description: 'Selecciona un cliente.', type: 'alert' }); return; }
        if (items.length === 0) { addNotification({ title: 'Sin productos', description: 'Agrega al menos un producto.', type: 'alert' }); return; }
        setPendingAction('pdf');
        setShowPreview(true);
    };

    const executeWhatsApp = () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client?.phone) return;
        const isAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';
        if (!isAdmin) {
            const quoteNumber = genQuoteNumber();
            addQuote({ ...getCommonQuoteFields(client, quoteNumber, items), status: 'PENDING_APPROVAL' as const, pendingAction: 'send_whatsapp', requestedBy: currentUser?.id || '', requestedByName: currentUser?.name || '', requestedAt: new Date().toISOString() });
            addNotification({ title: 'Solicitud enviada', description: 'Enviada al administrador para aprobación.', type: 'alert' });
            addNotification({ title: '⏳ Aprobación requerida', description: `${currentUser?.name} solicita enviar WhatsApp — ${genQuoteNumber()} para ${client.name} · ${formatCurrency(total)}`, type: 'alert', forAdmin: true });
            setSentConfirm({ quoteNumber, email: client.phone || '', pending: true, pendingAction: 'send_whatsapp' });
            setShowPreview(false);
            return;
        }
        const quoteNumber = genQuoteNumber();
        addQuote({ ...getCommonQuoteFields(client, quoteNumber, items), status: 'Sent' as const });
        const phone = client.phone.replace(/\D/g, '');
        const intlPhone = phone.startsWith('57') ? phone : `57${phone}`;
        const itemsList = items.map(i => `  • ${i.name} x${i.quantity} → ${formatCurrency(i.price * i.quantity)}`).join('\n');
        const vigencia = validUntil ? `Vigencia hasta: ${validUntil}` : 'Vigencia: 15 días calendario';
        const msg = [
            `Hola ${client.name.split(' ')[0]} 👋`,
            ``,
            `Adjunto encontrará la cotización *${quoteNumber}* de *Arte Concreto S.A.S*:`,
            referencia ? `📋 ${referencia}` : '',
            ``,
            itemsList,
            ``,
            `Subtotal: ${formatCurrency(subtotal)}`,
            `IVA (19%): ${formatCurrency(tax)}`,
            `*TOTAL: ${formatCurrency(total)}*`,
            ``,
            vigencia,
            `📍 Km 1+800, Anillo Vial, Floridablanca, Santander`,
            currentUser?.phone ? `📞 ${currentUser.phone}` : '',
        ].filter(l => l !== '').join('\n');
        window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
        addAuditLog({ userId: currentUser?.id || '', userName: currentUser?.name || 'Sistema', userRole: currentUser?.role || 'Vendedor', action: 'WHATSAPP_SENT', targetId: client.id, targetName: client.company || client.name, details: `WhatsApp enviado con cotización ${quoteNumber} · Total: ${formatCurrency(total)} → ${client.phone}`, verified: true });
        setShowPreview(false);
    };

    const handleSendWhatsApp = () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client?.phone) { addNotification({ title: 'Teléfono requerido', description: 'El cliente no tiene número registrado.', type: 'alert' }); return; }
        if (items.length === 0) { addNotification({ title: 'Sin productos', description: 'Agrega al menos un producto.', type: 'alert' }); return; }
        setPendingAction('whatsapp');
        setShowPreview(true);
    };

    const executeEmail = async () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client?.email) return;
        const isAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';

        if (!isAdmin) {
            const quoteNumber = genQuoteNumber();
            addQuote({ ...getCommonQuoteFields(client, quoteNumber, items), status: 'PENDING_APPROVAL' as const, pendingAction: 'send_email', requestedBy: currentUser?.id || '', requestedByName: currentUser?.name || '', requestedAt: new Date().toISOString() });
            addNotification({ title: 'Solicitud enviada', description: 'Enviada al administrador para aprobación.', type: 'alert' });
            addNotification({ title: '⏳ Aprobación requerida', description: `${currentUser?.name} solicita enviar email — para ${client.name} · ${formatCurrency(total)}`, type: 'alert', forAdmin: true });
            setSentConfirm({ quoteNumber, email: client.email, pending: true, pendingAction: 'send_email' });
            setShowPreview(false);
            return;
        }

        setIsSendingEmail(true);
        try {
            const sentAt = new Date().toISOString();
            const quoteNumber = genQuoteNumber();
            const quoteId = addQuote({ ...getCommonQuoteFields(client, quoteNumber, items), status: 'Draft' as const, sentAt, sentByName: currentUser?.name || '', sentById: currentUser?.id || '' });
            const res = await fetch('/api/quotes/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quoteNumber, clientName: client.name, clientEmail: client.email,
                    clientCompany: client.company || '', sellerName: currentUser?.name || 'ArteConcreto',
                    sellerId: currentUser?.id || '', sentAt, sentByName: currentUser?.name || '', sentById: currentUser?.id || '',
                    items: items.map(i => ({ name: i.name, price: i.price, quantity: i.quantity, unit: i.unit })),
                    subtotal, tax, total,
                    referencia, validUntil, deliveryTime, paymentTerms,
                    sellerPhone: currentUser?.phone || '',
                }),
            });
            const data = await res.json();
            if (res.ok) {
                updateQuote(quoteId, { status: 'Sent', sentAt: data.sentAt || sentAt, sentByName: data.sentByName || currentUser?.name || '', sentById: data.sentById || currentUser?.id || '' });
                addAuditLog({ userId: currentUser?.id || '', userName: currentUser?.name || 'Sistema', userRole: currentUser?.role || 'Vendedor', action: 'QUOTE_SENT', targetId: client.id, targetName: client.company || client.name, details: `Email enviado con cotización ${quoteNumber} → ${client.email}`, verified: true });
                addNotification({ title: `Cotización ${quoteNumber} enviada`, description: `Enviada a ${client.email}`, type: 'success' });
                setSentConfirm({ quoteNumber, email: client.email });
            } else {
                addNotification({ title: 'Error al enviar', description: data.error || 'Verifica la clave Resend.', type: 'alert' });
            }
        } catch {
            addNotification({ title: 'Error de conexión', description: 'No se pudo enviar.', type: 'alert' });
        } finally {
            setIsSendingEmail(false);
            setShowPreview(false);
        }
    };

    const handleSendEmail = async () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client?.email) { addNotification({ title: 'Email requerido', description: 'El cliente no tiene email.', type: 'alert' }); return; }
        if (items.length === 0) { addNotification({ title: 'Sin productos', description: 'Agrega al menos un producto.', type: 'alert' }); return; }
        setPendingAction('email');
        setShowPreview(true);
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
        <>
        {isEditMode && editQuoteId && (() => {
            const editingQuote = quotes.find(q => q.id === editQuoteId);
            return editingQuote ? (
                <div className="mb-4 flex items-center gap-3 px-5 py-3 rounded-2xl bg-amber-500/10 border border-amber-400/30">
                    <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    <p className="text-sm font-black text-amber-700">
                        Editando cotización <span className="text-amber-900">{editingQuote.number}</span>
                        {editingQuote.client && <span className="font-medium text-amber-600"> — {editingQuote.client}</span>}
                    </p>
                </div>
            ) : null;
        })()}
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
                        <div className="relative">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Buscar cliente por nombre, empresa o email..."
                                    value={selectedClientId
                                        ? (() => { const c = clients.find(x => x.id === selectedClientId); return c ? `${c.name}${c.company ? ` — ${c.company}` : ''}` : clientSearch; })()
                                        : clientSearch}
                                    onChange={e => {
                                        setClientSearch(e.target.value);
                                        setSelectedClientId('');
                                        setShowClientDropdown(true);
                                    }}
                                    onFocus={() => setShowClientDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                                    className="w-full bg-white/75 border border-border/70 rounded-2xl pl-11 pr-10 py-4 text-sm focus:border-primary focus:bg-white outline-none transition-all font-black text-foreground italic"
                                />
                                {selectedClientId && (
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedClientId(''); setClientSearch(''); }}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-rose-500 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                )}
                            </div>
                            {showClientDropdown && filteredClients.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border/60 rounded-2xl shadow-xl z-50 overflow-hidden max-h-[220px] overflow-y-auto">
                                    {filteredClients.map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onMouseDown={() => {
                                                setSelectedClientId(c.id);
                                                setClientSearch('');
                                                setShowClientDropdown(false);
                                            }}
                                            className="w-full text-left px-5 py-3 hover:bg-primary/5 transition-colors flex items-center gap-3 border-b border-border/20 last:border-0"
                                        >
                                            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary shrink-0">
                                                {c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-foreground truncate">{c.name}</p>
                                                {c.company && <p className="text-[10px] text-muted-foreground truncate">{c.company}</p>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {showClientDropdown && clientSearch && filteredClients.length === 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border/60 rounded-2xl shadow-xl z-50 px-5 py-4">
                                    <p className="text-sm text-muted-foreground font-bold">No se encontraron clientes</p>
                                </div>
                            )}
                        </div>

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

            {/* ── RIGHT: Commercial Conditions + Cart + Totals ── */}
            <div className="space-y-4">

                {/* Condiciones Comerciales */}
                <div className="surface-panel rounded-[2rem] overflow-hidden">
                    <div className="px-5 py-4 border-b border-border/40 bg-white/30 flex items-center gap-3">
                        <FileText className="w-4 h-4 text-primary" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest">Condiciones Comerciales</h3>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Referencia del Proyecto *</label>
                            <input
                                type="text"
                                value={referencia}
                                onChange={e => setReferencia(e.target.value)}
                                placeholder="SUMINISTRO DE MOBILIARIO EN CONCRETO PARA..."
                                className="w-full bg-white/80 border border-border/60 rounded-xl px-4 py-3 text-[11px] font-bold outline-none focus:border-primary transition-all text-foreground"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Vigencia de la Oferta</label>
                            <input
                                type="text"
                                value={validUntil}
                                onChange={e => setValidUntil(e.target.value)}
                                placeholder="15 de Abril de 2026"
                                className="w-full bg-white/80 border border-border/60 rounded-xl px-4 py-3 text-[11px] font-bold outline-none focus:border-primary transition-all text-foreground"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Plazo de Entrega</label>
                            <input
                                type="text"
                                value={deliveryTime}
                                onChange={e => setDeliveryTime(e.target.value)}
                                className="w-full bg-white/80 border border-border/60 rounded-xl px-4 py-3 text-[11px] font-bold outline-none focus:border-primary transition-all text-foreground"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Forma de Pago</label>
                            <textarea
                                value={paymentTerms}
                                onChange={e => setPaymentTerms(e.target.value)}
                                rows={4}
                                className="w-full bg-white/80 border border-border/60 rounded-xl px-4 py-3 text-[11px] font-bold outline-none focus:border-primary transition-all text-foreground resize-none"
                            />
                        </div>
                    </div>
                </div>
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
                        <button onClick={handleSaveAndGenerate} disabled={isSaving}
                            className="w-full bg-primary text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-all shadow-lg shadow-primary/20 text-[10px] uppercase tracking-widest disabled:opacity-60">
                            {isSaving
                                ? <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>}
                            {isSaving ? (isEditMode ? 'Guardando...' : 'Generando...') : (isEditMode ? 'Guardar Cambios' : 'Guardar y Generar PDF')}
                        </button>

                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={handleSendWhatsApp}
                                className="bg-[#25D366] text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-[#1fba58] transition-all shadow-lg shadow-green-500/20 text-[10px] uppercase tracking-widest">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                WhatsApp
                            </button>
                            <button onClick={handleSendEmail} disabled={isSendingEmail}
                                className="bg-white border border-border/70 text-foreground font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-accent/40 transition-all text-[10px] uppercase tracking-widest disabled:opacity-60">
                                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                {isSendingEmail ? 'Enviando...' : 'Email'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* ── PREVIEW MODAL ── */}
        {showPreview && (() => {
            const client = clients.find(c => c.id === selectedClientId);
            const qNum = `AC-${new Date().getFullYear()}-PREVIEW`;
            const today = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
            return (
                <div className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 bg-[#1a1a1d] shrink-0">
                            <div className="flex items-center gap-3">
                                <Eye className="w-5 h-5 text-[#fab510]" />
                                <span className="text-white font-black text-sm uppercase tracking-widest">Vista Previa de la Propuesta</span>
                            </div>
                            <button onClick={() => { setShowPreview(false); setPendingAction(null); }} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Quote Preview Content */}
                        <div className="overflow-y-auto flex-1 p-6 space-y-5 text-sm text-gray-800 bg-[#faf9f6]">
                            {/* Letterhead */}
                            <div className="flex justify-between items-start border-b-2 border-[#fab510] pb-4">
                                <div>
                                    <p className="font-black text-base text-[#1a1a1d]">ARTE CONCRETO S.A.S</p>
                                    <p className="text-xs text-gray-500">Km 1+800, Anillo Vial · Floridablanca, Santander</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-400 uppercase tracking-widest">Cotización No.</p>
                                    <p className="font-black text-[#fab510] text-lg">{isEditMode && editQuoteId ? (quotes.find(q => q.id === editQuoteId)?.number || qNum) : qNum}</p>
                                </div>
                            </div>

                            {/* Date + Addressee */}
                            <div>
                                <p className="text-xs text-gray-600">Floridablanca, {today}</p>
                                <div className="mt-3">
                                    <p className="text-xs text-gray-500">Señores.</p>
                                    <p className="font-black text-sm text-[#1a1a1d] mt-1">{client?.name?.toUpperCase() || 'CLIENTE'}</p>
                                    {client?.company && <p className="font-bold text-xs text-gray-700">{client.company.toUpperCase()}</p>}
                                </div>
                            </div>

                            {/* Referencia */}
                            <div className="bg-[#fab510]/10 border border-[#fab510]/30 rounded-xl px-4 py-3">
                                <span className="font-black text-xs text-[#1a1a1d] uppercase tracking-wide">REFERENCIA: </span>
                                <span className="font-bold text-xs text-gray-700 uppercase">{referencia || '(sin referencia)'}</span>
                            </div>

                            {/* Sections */}
                            <div className="space-y-4">
                                <div>
                                    <p className="font-black text-xs text-[#1a1a1d] uppercase mb-1">1. Alcance de la Propuesta:</p>
                                    <p className="text-xs text-gray-600 leading-relaxed">La presente oferta se entrega en la planta de producción, Anillo Vial Km 1 + 800 Floridablanca – Girón. <span className="font-bold">No incluye</span> transporte, descargue ni instalación.</p>
                                </div>
                                <div>
                                    <p className="font-black text-xs text-[#1a1a1d] uppercase mb-1">2. Vigencia de la Oferta:</p>
                                    <p className="text-xs text-gray-600">La cotización tiene vigencia hasta el <strong>{validUntil || '(definir fecha)'}</strong>.</p>
                                </div>
                                <div>
                                    <p className="font-black text-xs text-[#1a1a1d] uppercase mb-1">3. Plazo de Entrega:</p>
                                    <p className="text-xs text-gray-600">{deliveryTime}</p>
                                </div>
                                <div>
                                    <p className="font-black text-xs text-[#1a1a1d] uppercase mb-1">4. Forma de Pago:</p>
                                    <p className="text-xs text-gray-600 whitespace-pre-line">{paymentTerms}</p>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div>
                                <p className="font-black text-xs text-[#1a1a1d] uppercase mb-2">5. Cantidades y Precios del Proyecto:</p>
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-[#1a1a1d] text-white">
                                            <th className="text-left px-3 py-2 font-black uppercase tracking-wide">Descripción</th>
                                            <th className="text-center px-2 py-2 font-black uppercase tracking-wide">Unidad</th>
                                            <th className="text-center px-2 py-2 font-black uppercase tracking-wide">Cant.</th>
                                            <th className="text-right px-3 py-2 font-black uppercase tracking-wide">P. Unit.</th>
                                            <th className="text-right px-3 py-2 font-black uppercase tracking-wide">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, idx) => (
                                            <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#faf7f0]'}>
                                                <td className="px-3 py-2 font-semibold">{item.name}</td>
                                                <td className="px-2 py-2 text-center text-gray-500">{item.unit}</td>
                                                <td className="px-2 py-2 text-center font-bold text-[#fab510]">{item.quantity}</td>
                                                <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(item.price)}</td>
                                                <td className="px-3 py-2 text-right font-bold">{formatCurrency(item.price * item.quantity)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="flex justify-end mt-2 gap-4 text-xs pr-3">
                                    <div className="text-right space-y-1">
                                        <div className="text-gray-500">Subtotal: <strong className="text-gray-800">{formatCurrency(subtotal)}</strong></div>
                                        <div className="text-gray-500">IVA (19%): <strong className="text-gray-800">{formatCurrency(tax)}</strong></div>
                                        <div className="bg-[#fab510] text-black font-black px-4 py-2 rounded-lg text-sm mt-1">TOTAL: {formatCurrency(total)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Closing */}
                            <div className="border-t border-gray-200 pt-4 space-y-1">
                                <p className="text-xs text-gray-600">Esperamos que esta oferta sea de su agrado.</p>
                                <p className="text-xs text-gray-600">Quedamos atentos a sus comentarios o inquietudes.</p>
                                <p className="text-xs text-gray-600 mt-2">Cordialmente,</p>
                                <p className="font-black text-xs text-[#1a1a1d] mt-3">{(currentUser?.name || 'Asesor Comercial').toUpperCase()}</p>
                                <p className="text-xs text-gray-600">Asesor Comercial.</p>
                                {currentUser?.phone && <p className="text-xs text-gray-600">{currentUser.phone}</p>}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-6 py-4 bg-white border-t border-gray-100 flex gap-3 shrink-0">
                            <button
                                onClick={() => { setShowPreview(false); setPendingAction(null); }}
                                className="flex-1 py-3 rounded-2xl border border-border text-sm font-black text-muted-foreground hover:bg-accent/30 transition-all uppercase tracking-widest"
                            >
                                ← Editar
                            </button>
                            <button
                                onClick={() => {
                                    if (pendingAction === 'pdf') executeGeneratePDF();
                                    else if (pendingAction === 'email') executeEmail();
                                    else if (pendingAction === 'whatsapp') executeWhatsApp();
                                }}
                                disabled={isSaving || isSendingEmail}
                                className="flex-1 py-3 rounded-2xl bg-primary text-black font-black text-sm flex items-center justify-center gap-2 hover:scale-[1.02] transition-all shadow-lg shadow-primary/20 uppercase tracking-widest disabled:opacity-60"
                            >
                                {isSaving || isSendingEmail
                                    ? <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                    : <Send className="w-4 h-4" />
                                }
                                {pendingAction === 'pdf' ? 'Confirmar y Descargar PDF'
                                    : pendingAction === 'email' ? 'Confirmar y Enviar Email'
                                    : 'Confirmar y Enviar WhatsApp'}
                            </button>
                        </div>
                    </div>
                </div>
            );
        })()}

        {sentConfirm && (
          <div className="fixed inset-0 z-[300] flex items-end justify-center p-6 pointer-events-none">
            {sentConfirm.pending ? (
              <div className="pointer-events-auto bg-card border border-amber-400/40 rounded-[2rem] shadow-2xl shadow-amber-500/10 p-6 max-w-sm w-full animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-foreground text-sm">Solicitud enviada al administrador</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      <strong>{sentConfirm.quoteNumber}</strong> — en espera de aprobación
                    </p>
                    <p className="text-[10px] text-amber-600 mt-1.5 font-bold">
                      ⏳ {sentConfirm.pendingAction === 'send_email' ? 'El admin aprobará el envío por email' : sentConfirm.pendingAction === 'send_whatsapp' ? 'El admin aprobará el envío por WhatsApp' : 'El admin aprobará la generación del PDF'}
                    </p>
                  </div>
                  <button onClick={() => setSentConfirm(null)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="pointer-events-auto bg-card border border-emerald-500/30 rounded-[2rem] shadow-2xl shadow-emerald-500/10 p-6 max-w-sm w-full animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-foreground text-sm">¡Cotización enviada!</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      <strong>{sentConfirm.quoteNumber}</strong> enviada a <strong>{sentConfirm.email}</strong>
                    </p>
                    <p className="text-[10px] text-emerald-600 mt-1.5 font-bold">📧 Recibirás notificación cuando el cliente la abra</p>
                  </div>
                  <button onClick={() => setSentConfirm(null)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        </>
    );
}
