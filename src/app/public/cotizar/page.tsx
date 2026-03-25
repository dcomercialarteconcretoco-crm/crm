"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Send, CheckCircle2, Minus, Plus, X, ShieldCheck, Package } from 'lucide-react';

const LOGO_URL = 'https://cuantium.com/wp-content/uploads/2026/02/logo.png';
const CRM_URL = 'https://crm-intelligence-six.vercel.app';

function formatCOP(value: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

function CotizadorContent() {
    const searchParams = useSearchParams();

    const productName = decodeURIComponent(searchParams.get('productName') || '');
    const productPrice = Number(searchParams.get('productPrice') || 0);
    const productSku = decodeURIComponent(searchParams.get('productSku') || '');
    const productImage = decodeURIComponent(searchParams.get('productImage') || '');
    const initialQty = Number(searchParams.get('quantity') || 1);
    const embedMode = searchParams.get('embed') === '1'; // when inside iframe

    const [quantity, setQuantity] = useState(initialQty);
    const [form, setForm] = useState({ name: '', email: '', phone: '', city: '' });
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [quoteNumber, setQuoteNumber] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const subtotal = productPrice * quantity;
    const tax = Math.round(subtotal * 0.19);
    const total = subtotal + tax;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.email) return;

        setStatus('loading');
        setErrorMsg('');

        try {
            const res = await fetch(`${CRM_URL}/api/public/quote-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    productName,
                    productSku,
                    productPrice,
                    productImage,
                    quantity,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.ok) {
                throw new Error(data.error || 'Error al enviar la solicitud');
            }

            setQuoteNumber(data.quoteNumber);
            setStatus('success');

            // Tell parent iframe we're done
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
                    <div className="rounded-2xl bg-white border border-gray-100 p-5 text-left shadow-sm">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Resumen de tu solicitud</p>
                        <p className="font-bold text-gray-900 text-sm">{productName}</p>
                        <p className="text-xs text-gray-400 mt-1">{quantity} unid. · {formatCOP(productPrice)} c/u</p>
                        <p className="text-xl font-black text-[#fab510] mt-3">{formatCOP(total)} <span className="text-xs text-gray-400 font-normal">+ IVA incl.</span></p>
                    </div>
                    {embedMode && (
                        <button
                            onClick={() => window.parent.postMessage({ type: 'cotizar-close' }, '*')}
                            className="mt-6 text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
                        >
                            Cerrar ventana
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#faf7f0] p-3 flex items-start justify-center">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="mb-4 flex items-center justify-between">
                    <img src={LOGO_URL} alt="ArteConcreto" className="h-10 object-contain" />
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Solicitar</p>
                        <p className="text-sm font-black text-gray-900">Cotización</p>
                    </div>
                    {embedMode && (
                        <button
                            onClick={() => window.parent.postMessage({ type: 'cotizar-close' }, '*')}
                            className="ml-3 p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="rounded-[1.5rem] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden border border-gray-100">
                    {/* Product section */}
                    <div className="border-b border-gray-100 p-5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Producto a Cotizar</p>
                        <div className="flex items-center gap-4">
                            {productImage ? (
                                <img src={productImage} alt={productName} className="h-16 w-16 rounded-xl object-cover bg-gray-50 border border-gray-100 flex-shrink-0" />
                            ) : (
                                <div className="h-16 w-16 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                                    <Package className="h-6 w-6 text-gray-300" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-gray-900 text-sm leading-tight truncate">{productName || 'Producto'}</p>
                                {productSku && <p className="text-[10px] text-gray-400 mt-0.5">SKU: {productSku}</p>}
                                <p className="text-[#fab510] font-black text-base mt-1">{formatCOP(productPrice)}<span className="text-xs text-gray-400 font-normal"> c/u</span></p>
                            </div>
                        </div>

                        {/* Quantity selector */}
                        <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                    className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                                >
                                    <Minus className="h-4 w-4 text-gray-600" />
                                </button>
                                <span className="w-8 text-center font-black text-gray-900 text-sm">{quantity}</span>
                                <button
                                    type="button"
                                    onClick={() => setQuantity(q => q + 1)}
                                    className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                                >
                                    <Plus className="h-4 w-4 text-gray-600" />
                                </button>
                                <span className="text-sm text-gray-400 ml-1">unidades</span>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-400">Total estimado</p>
                                <p className="font-black text-gray-900 text-base">{formatCOP(subtotal)}</p>
                                <p className="text-[10px] text-gray-400">+ IVA: {formatCOP(tax)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-5 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Tus datos</p>
                        <p className="text-xs text-gray-500 mb-3">Completa tus datos y recibirás la cotización en tu correo electrónico.</p>

                        <div>
                            <input
                                type="text"
                                placeholder="Nombre completo *"
                                required
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <input
                                type="email"
                                placeholder="Correo electrónico *"
                                required
                                value={form.email}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                className={inputCls}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <input
                                type="tel"
                                placeholder="+57 300 000 0000"
                                value={form.phone}
                                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                className={inputCls}
                            />
                            <input
                                type="text"
                                placeholder="Bogotá, Medellín..."
                                value={form.city}
                                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                                className={inputCls}
                            />
                        </div>

                        {status === 'error' && (
                            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                                {errorMsg}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'loading' || !form.name || !form.email}
                            className="w-full rounded-2xl bg-[#fab510] text-black font-black text-sm py-4 flex items-center justify-center gap-2 hover:bg-[#f0aa00] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-lg shadow-[#fab510]/20"
                        >
                            {status === 'loading' ? (
                                <><div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div> Enviando...</>
                            ) : (
                                <><Send className="h-4 w-4" /> ENVIAR SOLICITUD</>
                            )}
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
                <div className="h-8 w-8 border-2 border-[#fab510] border-t-transparent rounded-full animate-spin"></div>
            </div>
        }>
            <CotizadorContent />
        </Suspense>
    );
}
