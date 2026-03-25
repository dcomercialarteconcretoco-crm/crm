"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
    Plus,
    Trash2,
    FileText,
    Mail,
    Printer,
    ChevronRight,
    Calculator,
    User,
    Building2,
    Search,
    Save,
    CheckCircle,
    UserPlus,
    Filter,
    Box,
    RefreshCw
} from 'lucide-react';
import { clsx } from 'clsx';
import { generateProposalPDF } from '@/lib/pdf-generator';
import { useApp, Product, Client } from '@/context/AppContext';

interface QuoteItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    unit: string;
    productId?: string;
}

interface QuoteEngineProps {
    defaultClientId?: string;
}

export default function QuoteEngine({ defaultClientId = '' }: QuoteEngineProps) {
    const { products, clients, addClient, refreshProducts, addQuote, updateQuote, currentUser, settings, addNotification } = useApp();
    const genId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const genQuoteNumber = () => `AC-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
    const [selectedClientId, setSelectedClientId] = useState(defaultClientId);
    const [items, setItems] = useState<QuoteItem[]>([
        { id: genId(), name: '', price: 0, quantity: 1, unit: 'un' }
    ]);

    const [taxRate, setTaxRate] = useState(0.19); // IVA 19%
    const [isSaving, setIsSaving] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [showNewClientForm, setShowNewClientForm] = useState(false);

    // New client state
    const [newClient, setNewClient] = useState({ name: '', company: '', email: '', phone: '' });

    const addItem = () => {
        setItems([...items, { id: genId(), name: '', price: 0, quantity: 1, unit: 'un' }]);
    };

    const removeItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
    };

    const updateItem = (id: string, field: keyof QuoteItem, value: string | number) => {
        setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const selectFromInventory = (id: string, product: Product) => {
        setItems(items.map(i => i.id === id ? {
            ...i,
            name: product.name,
            price: product.price || 0,
            unit: 'un', // Defaulting to unit for products
            productId: product.id
        } : i));
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await refreshProducts();
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        handleSync();
    }, []);

    const subtotal = items.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    const handleGeneratePDF = async () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client) {
            addNotification({ title: 'Cliente requerido', description: 'Selecciona un cliente para generar el PDF.', type: 'alert' });
            return;
        }

        await generateProposalPDF({
            quoteNumber: genQuoteNumber(),
            date: new Date().toLocaleDateString(),
            leadName: client.name,
            leadCompany: client.company,
            items: items.map(i => ({ ...i, total: i.price * i.quantity })),
            subtotal,
            tax,
            total
        });
    };

    const handleSave = () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client) {
            addNotification({ title: 'Cliente requerido', description: 'Selecciona un cliente para vincular la cotización.', type: 'alert' });
            return;
        }
        if (items.length === 0 || items.every(i => !i.name)) {
            addNotification({ title: 'Ítems requeridos', description: 'Agrega al menos un ítem a la cotización.', type: 'alert' });
            return;
        }
        setIsSaving(true);
        const quoteNumber = genQuoteNumber();
        addQuote({
            number: quoteNumber,
            client: client.name,
            clientId: client.id,
            clientEmail: client.email || '',
            clientCompany: client.company || '',
            date: new Date().toLocaleDateString('es-CO'),
            total: formatCurrency(total),
            numericTotal: total,
            subtotal,
            tax,
            items: items.map(i => ({
                id: i.id,
                name: i.name,
                price: i.price,
                quantity: i.quantity,
                unit: i.unit,
                total: i.price * i.quantity,
            })),
            notes: '',
            sellerId: currentUser?.id || '',
            sellerName: currentUser?.name || '',
            status: 'Draft' as const,
        });
        setIsSaving(false);
        addNotification({ title: `Cotización ${quoteNumber} guardada`, description: 'La cotización quedó en estado Borrador.', type: 'success' });
    };

    const handleSendEmail = async () => {
        const client = clients.find(c => c.id === selectedClientId);
        if (!client || !client.email) {
            addNotification({ title: 'Email requerido', description: 'El cliente no tiene email registrado. Agrégalo primero.', type: 'alert' });
            return;
        }
        if (items.length === 0 || items.every(i => !i.name)) {
            addNotification({ title: 'Ítems requeridos', description: 'Agrega al menos un ítem a la cotización.', type: 'alert' });
            return;
        }
        setIsSendingEmail(true);
        try {
            const sentAt = new Date().toISOString();
            const quoteNumber = genQuoteNumber();

            // 1️⃣ Guardar la cotización en el sistema primero
            const quoteId = addQuote({
                number: quoteNumber,
                client: client.name,
                clientId: client.id,
                clientEmail: client.email || '',
                clientCompany: client.company || '',
                date: new Date().toLocaleDateString('es-CO'),
                total: formatCurrency(total),
                numericTotal: total,
                subtotal,
                tax,
                items: items.map(i => ({
                    id: i.id,
                    name: i.name,
                    price: i.price,
                    quantity: i.quantity,
                    unit: i.unit,
                    total: i.price * i.quantity,
                })),
                notes: '',
                sellerId: currentUser?.id || '',
                sellerName: currentUser?.name || '',
                status: 'Draft' as const,
                sentAt,
                sentByName: currentUser?.name || '',
                sentById: currentUser?.id || '',
            });

            // 2️⃣ Enviar por email con copia a marketing
            const res = await fetch('/api/quotes/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quoteNumber,
                    clientName: client.name,
                    clientEmail: client.email,
                    clientCompany: client.company || '',
                    sellerName: currentUser?.name || 'Arte Concreto',
                    sellerId: currentUser?.id || '',
                    sentAt,
                    sentByName: currentUser?.name || '',
                    sentById: currentUser?.id || '',
                    items: items.map(i => ({ name: i.name, price: i.price, quantity: i.quantity, unit: i.unit })),
                    subtotal,
                    tax,
                    total,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                // 3️⃣ Actualizar estado a "Sent" con fecha y usuario
                updateQuote(quoteId, {
                    status: 'Sent',
                    sentAt: data.sentAt || sentAt,
                    sentByName: data.sentByName || currentUser?.name || '',
                    sentById: data.sentById || currentUser?.id || '',
                });
                addNotification({ title: `Cotización ${quoteNumber} enviada`, description: `Enviada a ${client.email} · Copia a marketing@arteconcreto.co`, type: 'success' });
            } else {
                addNotification({ title: 'Error al enviar', description: data.error || 'Verifica la clave Resend en Configuración.', type: 'alert' });
            }
        } catch {
            addNotification({ title: 'Error de conexión', description: 'No se pudo enviar la cotización. Revisa tu conexión.', type: 'alert' });
        } finally {
            setIsSendingEmail(false);
        }
    };

    const handleCreateClient = (e: React.FormEvent) => {
        e.preventDefault();
        const id = addClient({
            ...newClient,
            status: 'Active',
            value: '$0',
            ltv: 0,
            lastContact: 'Ahora',
            city: 'Medellín',
            score: 10,
            category: 'Construcción',
            registrationDate: new Date().toISOString()
        });
        setSelectedClientId(id);
        setShowNewClientForm(false);
        setNewClient({ name: '', company: '', email: '', phone: '' });
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 0
        }).format(val);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                {/* Client Selector */}
                <div className="surface-panel rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity text-primary/20">
                        <User size={120} />
                    </div>
                    <div className="w-20 h-20 rounded-[2rem] bg-accent/70 flex items-center justify-center text-primary shrink-0 border border-primary/15 shadow-[0_16px_40px_rgba(250,181,16,0.08)] group-hover:scale-110 transition-transform duration-500">
                        <Building2 className="w-10 h-10" />
                    </div>
                    <div className="flex-1 w-full space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(250,181,16,0.6)]"></span>
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] pl-1">CLIENTE VINCULADO A LA OFERTA</label>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowNewClientForm((prev) => !prev)}
                                className="text-[9px] font-black uppercase text-primary hover:text-foreground transition-colors flex items-center gap-2"
                            >
                                <UserPlus className="w-3 h-3" />
                                {showNewClientForm ? "Cerrar formulario" : "Crear nuevo cliente"}
                            </button>
                        </div>
                        <select
                            value={selectedClientId}
                            onChange={(e) => setSelectedClientId(e.target.value)}
                            className="w-full bg-white/75 border border-border/70 rounded-2xl px-6 py-4 text-sm focus:border-primary focus:bg-white outline-none transition-all font-black appearance-none cursor-pointer text-foreground italic"
                        >
                            <option value="">Selecciona el prospecto o cliente...</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name} - {c.company}</option>
                            ))}
                        </select>

                        {showNewClientForm && (
                            <div className="rounded-[2rem] border border-primary/20 bg-white/72 p-6 shadow-[0_18px_50px_rgba(23,23,23,0.06)] backdrop-blur-xl">
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="p-2 bg-accent/70 rounded-xl border border-primary/15">
                                        <UserPlus className="w-4 h-4 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-foreground">Nuevo Cliente</h3>
                                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">Creación rápida dentro de la cotización</p>
                                    </div>
                                </div>

                                <form onSubmit={handleCreateClient} className="space-y-4">
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest pl-1">Nombre Completo</label>
                                            <input
                                                required
                                                className="w-full bg-white border border-border/70 rounded-2xl px-5 py-4 text-sm font-black text-foreground outline-none focus:border-primary transition-all italic"
                                                placeholder="Ej: Juan Perez"
                                                value={newClient.name}
                                                onChange={e => setNewClient({ ...newClient, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest pl-1">Empresa</label>
                                            <input
                                                className="w-full bg-white border border-border/70 rounded-2xl px-5 py-4 text-sm font-black text-foreground outline-none focus:border-primary transition-all italic"
                                                placeholder="Ej: Arte Concreto SAS"
                                                value={newClient.company}
                                                onChange={e => setNewClient({ ...newClient, company: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest pl-1">Email</label>
                                            <input
                                                type="email"
                                                required
                                                className="w-full bg-white border border-border/70 rounded-2xl px-5 py-4 text-sm font-black text-foreground outline-none focus:border-primary transition-all italic"
                                                placeholder="juan@ejemplo.com"
                                                value={newClient.email}
                                                onChange={e => setNewClient({ ...newClient, email: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest pl-1">TelEfono</label>
                                            <input
                                                required
                                                className="w-full bg-white border border-border/70 rounded-2xl px-5 py-4 text-sm font-black text-foreground outline-none focus:border-primary transition-all italic"
                                                placeholder="+57 321..."
                                                value={newClient.phone}
                                                onChange={e => setNewClient({ ...newClient, phone: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3 pt-2 md:flex-row">
                                        <button type="submit" className="flex-1 bg-primary text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-95 transition-all shadow-xl shadow-primary/15">
                                            <CheckCircle className="w-4 h-4" />
                                            <span className="uppercase text-[10px] tracking-[0.2em]">Guardar y Vincular</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowNewClientForm(false)}
                                            className="md:w-auto bg-white border border-border/70 text-foreground font-black py-4 px-5 rounded-2xl uppercase text-[10px] tracking-[0.18em] transition-all hover:bg-accent/35"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </div>

                {/* Generator */}
                <div className="surface-panel rounded-[2.5rem] p-10 shadow-sm relative overflow-hidden group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-accent/70 rounded-lg border border-primary/15">
                                    <Calculator className="w-6 h-6 text-primary" />
                                </div>
                                <h2 className="text-xl font-black text-foreground italic tracking-tighter uppercase">Generador de Cotización</h2>
                            </div>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-11">Sincronizado con inventario real de Arte Concreto</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleSync}
                                disabled={isSyncing}
                                className="bg-white/70 text-muted-foreground border border-border/70 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:text-primary hover:border-primary/20 transition-all flex items-center gap-3 disabled:opacity-50"
                                title="Sincronizar precios con la web original"
                            >
                                <RefreshCw className={clsx("w-4 h-4", isSyncing && "animate-spin")} />
                                {isSyncing ? "Sincronizando..." : "Sincronizar Precios"}
                            </button>
                            <button
                                onClick={addItem}
                                className="bg-primary/10 text-primary border border-primary/20 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary hover:text-black transition-all hover:scale-105 active:scale-95 flex items-center gap-3 shadow-lg shadow-primary/5"
                            >
                                <Plus className="w-4 h-4" />
                                Agregar Producto
                            </button>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {items.map((item, index) => (
                            <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end p-6 rounded-3xl bg-white/70 border border-border/70 group/row hover:border-primary/20 transition-all">
                                <div className="md:col-span-6 space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Buscador de Productos</label>
                                        {item.productId && (
                                            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                                                <CheckCircle className="w-2.5 h-2.5" /> Vinculado
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                                            <Search className="w-4 h-4" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Busca por nombre o SKU..."
                                            className="w-full bg-white border border-border/70 rounded-xl pl-12 pr-4 py-4 text-sm font-black text-foreground outline-none focus:border-primary transition-all placeholder:text-muted-foreground italic"
                                            value={item.name}
                                            onChange={(e) => {
                                                updateItem(item.id, 'name', e.target.value);
                                                // Clear product link if manually editing
                                                if (item.productId) updateItem(item.id, 'productId', '');
                                            }}
                                        />

                                        {/* Dropdown for search results */}
                                        {item.name.length > 2 && !item.productId && (
                                            <div className="absolute top-full left-0 w-full mt-2 bg-white border border-border/80 rounded-2xl shadow-[0_20px_50px_rgba(23,23,23,0.12)] z-50 max-h-60 overflow-y-auto overflow-x-hidden custom-scrollbar">
                                                {products.filter(p => p.name.toLowerCase().includes(item.name.toLowerCase())).map(p => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => selectFromInventory(item.id, p)}
                                                        className="w-full p-4 hover:bg-accent/35 text-left border-b border-border/50 last:border-0 flex items-center gap-4 transition-colors"
                                                    >
                                                        <div className="w-10 h-10 rounded-xl bg-accent/35 border border-border/60 flex items-center justify-center overflow-hidden shrink-0">
                                                            {p.image ? (
                                                                <img src={p.image} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <Box className="w-4 h-4 text-muted-foreground" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[11px] font-black text-foreground uppercase truncate">{p.name}</p>
                                                            <p className="text-[9px] font-bold text-primary italic tracking-tight">{formatCurrency(p.price)}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                                {products.filter(p => p.name.toLowerCase().includes(item.name.toLowerCase())).length === 0 && (
                                                    <div className="p-4 text-[9px] font-bold text-muted-foreground uppercase text-center tracking-widest italic">No se encontraron productos</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="md:col-span-2 space-y-3">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block text-center">Cant.</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-white border border-border/70 rounded-xl px-4 py-4 text-sm focus:border-primary outline-none transition-all font-black text-center text-foreground italic"
                                        />
                                        <span className="absolute bottom-[-15px] left-0 w-full text-[8px] font-black text-primary/60 uppercase tracking-tighter text-center">{item.unit || 'un'}</span>
                                    </div>
                                </div>
                                <div className="md:col-span-3 space-y-3">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block">Precio Unit.</label>
                                    <input
                                        type="number"
                                        value={item.price}
                                        onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                                        className="w-full bg-white border border-border/70 rounded-xl px-6 py-4 text-sm focus:border-primary outline-none transition-all font-black text-primary italic"
                                    />
                                </div>
                                <div className="md:col-span-1 pb-1 flex justify-center">
                                    <button
                                        onClick={() => removeItem(item.id)}
                                        className="p-4 text-muted-foreground hover:text-rose-500 bg-white border border-border/70 hover:bg-rose-500/10 rounded-2xl transition-all"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="surface-panel rounded-[2.5rem] p-10 flex flex-col h-full shadow-2xl relative overflow-hidden sticky top-8 group">
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity"></div>

                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] mb-12 flex items-center gap-4 text-muted-foreground italic">
                        Resumen de Facturación
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-border/90 to-transparent"></div>
                    </h3>

                    <div className="space-y-8 flex-1">
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">Subtotal Bruto</span>
                            <span className="text-lg font-black text-foreground italic tracking-tighter">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">Impuestos (IVA 19%)</span>
                            <span className="text-lg font-black text-foreground italic tracking-tighter">{formatCurrency(tax)}</span>
                        </div>

                        <div className="pt-10 mt-10 border-t border-border/60 flex flex-col gap-3 relative">
                            <div className="absolute top-0 left-0 w-1/4 h-1 bg-primary rounded-full -translate-y-1/2"></div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary italic">Inversión Total Estimada</span>
                            <div className="flex justify-between items-baseline">
                                <span className="text-5xl font-black text-foreground italic tracking-tighter leading-none">{formatCurrency(total)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 mt-20">
                        <button
                            onClick={handleGeneratePDF}
                            className="w-full bg-primary text-black font-black py-5 rounded-2xl flex items-center justify-center gap-4 hover:bg-white hover:scale-[1.02] transition-all active:scale-95 shadow-[0_8px_40px_rgba(250,181,16,0.15)] group"
                        >
                            <Printer className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                            <span className="uppercase text-[11px] tracking-[0.2em]">Generar Propuesta PDF</span>
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full bg-[#10b981] text-white font-black py-5 rounded-2xl flex items-center justify-center gap-4 hover:bg-emerald-400 hover:text-black transition-all active:scale-95 shadow-xl shadow-emerald-500/10 group"
                        >
                            {isSaving ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <Save className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                            )}
                            <span className="uppercase text-[11px] tracking-[0.2em]">Guardar Cotización</span>
                        </button>

                        <button onClick={handleSendEmail} disabled={isSendingEmail} className="w-full bg-white border border-border/70 hover:bg-accent/35 text-foreground font-black py-5 rounded-2xl flex items-center justify-center gap-4 transition-all overflow-hidden relative group disabled:opacity-60">
                            <Mail className="w-5 h-5 text-primary relative z-10" />
                            <span className="relative z-10 uppercase text-[11px] tracking-[0.2em]">{isSendingEmail ? 'Enviando...' : 'Enviar por Correo'}</span>
                        </button>

                        <div className="pt-10 flex flex-col items-center gap-4 group">
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground group-hover:text-primary transition-colors">Powered by</span>
                                <img
                                    src="https://cuantium.com/wp-content/uploads/2025/12/wibicrmblanco@4x.png"
                                    alt="MiWibi"
                                    className="h-4 object-contain opacity-60 group-hover:opacity-100 transition-all duration-700 brightness-0"
                                />
                            </div>
                            <div className="w-32 h-1 bg-accent/60 rounded-full overflow-hidden">
                                <div className="h-full bg-primary w-1/3 group-hover:w-full transition-all duration-1000"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
