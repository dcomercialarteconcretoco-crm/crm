"use client";

import React, { useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Send, CheckCircle2, Minus, Plus, X, ShieldCheck, Package, Search, Loader2 } from 'lucide-react';

const LOGO_URL = 'https://arteconcreto.co/wp-content/uploads/2026/03/cropped-Logo-Web-72ppi-237x96-1.png';

function formatCOP(value: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

interface CartItem {
    id: string;
    name: string;
    sku: string;
    price: number;
    image: string;
    quantity: number;
}

function CotizadorContent() {
    const searchParams = useSearchParams();

    const productName  = decodeURIComponent(searchParams.get('productName')  || '');
    const productPrice = Number(searchParams.get('productPrice') || 0);
    const productSku   = decodeURIComponent(searchParams.get('productSku')   || '');
    const productImage = decodeURIComponent(searchParams.get('productImage') || '');
    const initialQty   = Number(searchParams.get('quantity') || 1);
    const embedMode    = searchParams.get('embed') === '1';

    // Cart — starts with the item from URL params (if any)
    const [items, setItems] = useState<CartItem[]>(() => {
        if (!productName) return [];
        return [{ id: 'init-0', name: productName, sku: productSku, price: productPrice, image: productImage, quantity: initialQty }];
    });

    // Search state
    const [showSearch, setShowSearch] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<CartItem[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    const [form, setForm]     = useState({ name: '', email: '', phone: '', city: '' });
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [quoteNumber, setQuoteNumber] = useState('');
    const [errorMsg, setErrorMsg]       = useState('');

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const tax   = Math.round(subtotal * 0.19);
    const total = subtotal + tax;

    const setQty = (id: string, qty: number) => {
        if (qty < 1) { removeItem(id); return; }
        setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
    };
    const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

    const searchProducts = useCallback(async (q: string) => {
        if (!q.trim()) { setSearchResults([]); return; }
        setSearchLoading(true);
        try {
            const res = await fetch(`/api/woocommerce?search=${encodeURIComponent(q)}&per_page=8`);
            if (!res.ok) throw new Error('fetch failed');
            const data = await res.json();
            const prods: CartItem[] = (Array.isArray(data) ? data : data.products || []).map((p: any) => ({
                id: String(p.id),
                name: p.name || '',
                sku: p.sku || '',
                price: Number(p.price) || 0,
                image: p.images?.[0]?.src || p.image || '',
                quantity: 1,
            }));
            setSearchResults(prods);
        } catch {
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    }, []);

    const addFromSearch = (prod: CartItem) => {
        setItems(prev => {
            const exists = prev.find(i => i.id === prod.id || (i.sku && i.sku === prod.sku));
            if (exists) return prev.map(i => (i.id === prod.id || i.sku === prod.sku) ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { ...prod, quantity: 1 }];
        });
        setShowSearch(false);
        setSearchTerm('');
        setSearchResults([]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.email || items.length === 0) return;
        setStatus('loading');
        setErrorMsg('');
        try {
            const res = await fetch('/api/public/quote-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    items: items.map(i => ({ name: i.name, sku: i.sku, price: i.price, image: i.image, quantity: i.quantity })),
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Error al enviar la solicitud');
            setQuoteNumber(data.quoteNumber);
            setStatus('success');
            window.parent.postMessage({ type: 'cotizar-success', quoteNumber: data.quoteNumber }, '*');
        } catch (err: any) {
            setErrorMsg(err.message || 'Error inesperado. Intenta de nuevo.');
            setStatus('error');
        }
    };

    const inputCls = "w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-sm font-medium text-gray-800 outline-none transition-all placeholder:text-gray-400 focus:border-[#fab510] focus:ring-2 focus:ring-[#fab510]/20";

    if (status === 'success') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#faf7f0] p-4">
                <div className="w-full max-w-md text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#fab510]/10">
                        <CheckCircle2 className="h-10 w-10 text-[#fab510]" />
                    </div>
                    <h2 className="mb-3 text-2xl font-black text-gray-900">¡Cotización enviada!</h2>
                    <p className="mb-2 text-gray-600">Revisa tu correo. Te enviamos la cotización <strong>{quoteNumber}</strong> con todos los detalles.</p>
                    <p className="mb-8 text-sm text-gray-400">Un asesor de ArteConcreto se pondrá en contacto contigo pronto.</p>
                    <div className="rounded-2xl bg-white border border-gray-100 p-5 text-left shadow-sm space-y-2">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Resumen de tu solicitud</p>
                        {items.map(i => (
                            <div key={i.id} className="flex justify-between text-sm">
                                <span className="text-gray-700 font-bold">{i.name} <span className="text-gray-400 font-normal">×{i.quantity}</span></span>
                                <span className="font-black text-gray-900">{formatCOP(i.price * i.quantity)}</span>
                            </div>
                        ))}
                        <div className="border-t border-gray-100 pt-2 flex justify-between">
                            <span className="text-xs text-gray-400">TOTAL (IVA incl.)</span>
                            <span className="text-xl font-black text-[#fab510]">{formatCOP(total)}</span>
                        </div>
                    </div>
                    {embedMode && (
                        <button onClick={() => window.parent.postMessage({ type: 'cotizar-close' }, '*')}
                            className="mt-6 text-sm text-gray-400 hover:text-gray-600 underline transition-colors">
                            Cerrar ventana
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={embedMode ? "bg-[#faf7f0] p-2 overflow-y-auto" : "min-h-screen bg-[#faf7f0] p-3 flex items-start justify-center"}>
            <div className="w-full max-w-md mx-auto">
                {/* Header */}
                <div className="mb-3 flex items-center justify-between">
                    <img src={LOGO_URL} alt="ArteConcreto" className="h-7 object-contain" />
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Solicitar</p>
                        <p className="text-sm font-black text-gray-900">Cotización</p>
                    </div>
                    {embedMode && (
                        <button onClick={() => window.parent.postMessage({ type: 'cotizar-close' }, '*')}
                            className="ml-3 p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="rounded-[1.5rem] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden border border-gray-100">

                    {/* Cart items */}
                    <div className="border-b border-gray-100 p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Productos a Cotizar</p>
                            {items.length > 0 && (
                                <span className="text-[9px] font-black text-[#fab510] bg-[#fab510]/10 border border-[#fab510]/20 px-2 py-0.5 rounded-full uppercase">
                                    {items.length} {items.length === 1 ? 'producto' : 'productos'}
                                </span>
                            )}
                        </div>

                        {items.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-8 text-center gap-2 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                <Package className="h-8 w-8 text-gray-300" />
                                <p className="text-xs text-gray-400 font-bold">No hay productos aún</p>
                                <p className="text-[10px] text-gray-400">Agrega productos con el botón de abajo</p>
                            </div>
                        )}

                        {items.map(item => (
                            <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
                                {item.image ? (
                                    <img src={item.image} alt={item.name} className="h-12 w-12 rounded-xl object-cover border border-gray-100 flex-shrink-0" />
                                ) : (
                                    <div className="h-12 w-12 rounded-xl bg-gray-100 border border-gray-100 flex items-center justify-center flex-shrink-0">
                                        <Package className="h-5 w-5 text-gray-300" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-gray-900 text-xs leading-tight line-clamp-1">{item.name}</p>
                                    {item.sku && <p className="text-[9px] text-gray-400">SKU: {item.sku}</p>}
                                    <p className="text-[#fab510] font-black text-xs mt-0.5">{formatCOP(item.price)}<span className="text-gray-400 font-normal text-[9px]"> c/u</span></p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button type="button" onClick={() => setQty(item.id, item.quantity - 1)}
                                        className="h-7 w-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:border-gray-300 transition-colors">
                                        <Minus className="h-3 w-3 text-gray-600" />
                                    </button>
                                    <span className="w-6 text-center font-black text-gray-900 text-xs">{item.quantity}</span>
                                    <button type="button" onClick={() => setQty(item.id, item.quantity + 1)}
                                        className="h-7 w-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:border-gray-300 transition-colors">
                                        <Plus className="h-3 w-3 text-gray-600" />
                                    </button>
                                    <button type="button" onClick={() => removeItem(item.id)}
                                        className="h-7 w-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:border-red-200 hover:text-red-500 text-gray-400 transition-colors ml-1">
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Totals */}
                        {items.length > 0 && (
                            <div className="flex justify-between items-center pt-1 px-1">
                                <div className="text-xs text-gray-400">
                                    Subtotal: {formatCOP(subtotal)}<br/>
                                    <span className="text-[10px]">IVA (19%): {formatCOP(tax)}</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] text-gray-400 uppercase tracking-widest">Total estimado</p>
                                    <p className="font-black text-gray-900 text-lg leading-none">{formatCOP(total)}</p>
                                </div>
                            </div>
                        )}

                        {/* Add product button */}
                        <button type="button" onClick={() => setShowSearch(s => !s)}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-gray-200 hover:border-[#fab510]/40 hover:bg-[#fab510]/5 text-gray-400 hover:text-[#fab510] transition-all text-xs font-black uppercase tracking-wider">
                            <Plus className="h-4 w-4" />
                            Agregar otro producto
                        </button>

                        {/* Product search dropdown */}
                        {showSearch && (
                            <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
                                <div className="relative p-2">
                                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="Buscar producto por nombre o SKU..."
                                        value={searchTerm}
                                        onChange={e => { setSearchTerm(e.target.value); searchProducts(e.target.value); }}
                                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-[#fab510] transition-all text-gray-800 placeholder:text-gray-400"
                                    />
                                </div>
                                <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
                                    {searchLoading && (
                                        <div className="flex items-center justify-center py-6 gap-2 text-gray-400">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span className="text-xs">Buscando...</span>
                                        </div>
                                    )}
                                    {!searchLoading && searchTerm && searchResults.length === 0 && (
                                        <p className="text-xs text-gray-400 text-center py-4">Sin resultados para "{searchTerm}"</p>
                                    )}
                                    {!searchLoading && searchResults.map(p => (
                                        <button key={p.id} type="button" onClick={() => addFromSearch(p)}
                                            className="w-full flex items-center gap-3 p-3 hover:bg-white transition-colors text-left">
                                            {p.image ? (
                                                <img src={p.image} alt={p.name} className="h-10 w-10 rounded-lg object-cover border border-gray-100 flex-shrink-0" />
                                            ) : (
                                                <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                    <Package className="h-4 w-4 text-gray-300" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-black text-gray-900 line-clamp-1">{p.name}</p>
                                                {p.sku && <p className="text-[9px] text-gray-400">SKU: {p.sku}</p>}
                                            </div>
                                            <p className="text-xs font-black text-[#fab510] shrink-0">{p.price > 0 ? formatCOP(p.price) : 'Consultar'}</p>
                                        </button>
                                    ))}
                                    {!searchLoading && !searchTerm && (
                                        <p className="text-xs text-gray-400 text-center py-4">Escribe para buscar productos</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Contact form */}
                    <form onSubmit={handleSubmit} className="p-5 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Tus datos</p>
                        <p className="text-xs text-gray-500 mb-3">Completa tus datos y recibirás la cotización en tu correo electrónico.</p>

                        <input type="text" placeholder="Nombre completo *" required value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />

                        <input type="email" placeholder="Correo electrónico *" required value={form.email}
                            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />

                        <div className="grid grid-cols-2 gap-3">
                            <input type="tel" placeholder="+57 300 000 0000" value={form.phone}
                                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
                            <input type="text" placeholder="Ciudad" value={form.city}
                                onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inputCls} />
                        </div>

                        {status === 'error' && (
                            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{errorMsg}</div>
                        )}

                        <button type="submit" disabled={status === 'loading' || !form.name || !form.email || items.length === 0}
                            className="w-full rounded-2xl bg-[#fab510] text-black font-black text-sm py-4 flex items-center justify-center gap-2 hover:bg-[#f0aa00] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-lg shadow-[#fab510]/20">
                            {status === 'loading'
                                ? <><div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> Enviando...</>
                                : <><Send className="h-4 w-4" /> ENVIAR SOLICITUD ({items.length} {items.length === 1 ? 'producto' : 'productos'})</>
                            }
                        </button>

                        <div className="flex items-center justify-center gap-2 pt-1">
                            <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />
                            <p className="text-[11px] text-gray-400">Tus datos son confidenciales y no serán compartidos.</p>
                        </div>
                    </form>
                </div>

                <p className="mt-4 text-center text-[10px] text-gray-400">
                    Powered by <a href="https://miwibi.com" target="_blank" rel="noopener noreferrer" className="text-[#fab510] font-bold">MiWibiCRM</a>
                </p>
            </div>
        </div>
    );
}

export default function CotizarPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#faf7f0] flex items-center justify-center">
                <div className="h-8 w-8 border-2 border-[#fab510] border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <CotizadorContent />
        </Suspense>
    );
}
