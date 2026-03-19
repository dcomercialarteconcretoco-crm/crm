"use client";

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ChevronLeft,
    ShoppingCart,
    ShieldCheck,
    Truck,
    Clock,
    Share2,
    Heart,
    Star,
    Check,
    Mail,
    Bell,
    MessageSquare,
    History
} from 'lucide-react';
import { clsx } from 'clsx';

import { useApp } from '@/context/AppContext';

export default function ProductLandingPage() {
    const { products } = useApp();
    const params = useParams();
    const router = useRouter();
    const product = products.find(p => p.slug === params.slug || p.id === params.slug);
    const [activeImg, setActiveImg] = useState(product?.image || '');
    const [isOrdered, setIsOrdered] = useState(false);
    const [orderStep, setOrderStep] = useState(0);

    const handleOrder = () => {
        setIsOrdered(true);
        // Simulate Platform actions
        setTimeout(() => setOrderStep(1), 1000); // Notification sent
        setTimeout(() => setOrderStep(2), 2000); // Note & Message added
        setTimeout(() => setOrderStep(3), 3000); // Email notification
    };

    if (!product) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <p className="text-white/40 font-black uppercase tracking-[0.5em]">Producto no encontrado</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0b] text-white">
            {/* Navigation Header */}
            <nav className="h-20 border-b border-white/5 px-8 flex items-center justify-between sticky top-0 bg-[#0a0a0b]/80 backdrop-blur-xl z-50">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-white/40 hover:text-primary transition-all group"
                >
                    <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Volver</span>
                </button>
                <div className="flex items-center gap-4">
                    <div className="h-10">
                        <img
                            src="https://cuantium.com/wp-content/uploads/2026/02/logo.png"
                            alt="Arte Concreto"
                            className="h-full object-contain filter invert opacity-90"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button className="p-3 bg-white/5 rounded-xl border border-white/10 hover:text-primary transition-all">
                        <Share2 className="w-4 h-4" />
                    </button>
                    <button className="p-3 bg-white/5 rounded-xl border border-white/10 hover:text-rose-500 transition-all">
                        <Heart className="w-4 h-4" />
                    </button>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-8 py-16 grid grid-cols-1 lg:grid-cols-2 gap-20">
                {/* Left: Gallery Section */}
                <div className="space-y-8 animate-in slide-in-from-left duration-1000">
                    <div className="aspect-square rounded-[3rem] overflow-hidden border border-white/10 bg-white/[0.02] shadow-2xl relative group">
                        <img
                            src={activeImg}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                        />
                        <div className="absolute top-8 left-8">
                            <div className="px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Disponible</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        {product.gallery?.map((img: string, idx: number) => (
                            <button
                                key={idx}
                                onClick={() => setActiveImg(img)}
                                className={clsx(
                                    "w-24 h-24 rounded-2xl overflow-hidden border-2 transition-all",
                                    activeImg === img ? "border-primary scale-105" : "border-white/5 opacity-50 hover:opacity-100"
                                )}
                            >
                                <img src={img} alt={`${product.name} ${idx}`} className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>

                    <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[2.5rem] grid grid-cols-3 gap-8">
                        <div className="text-center space-y-2">
                            <Truck className="w-6 h-6 text-primary mx-auto" />
                            <p className="text-[9px] font-black uppercase text-white/40">Despacho</p>
                            <p className="text-[10px] font-bold">Nacional</p>
                        </div>
                        <div className="text-center space-y-2 border-x border-white/5">
                            <Clock className="w-6 h-6 text-primary mx-auto" />
                            <p className="text-[9px] font-black uppercase text-white/40">Tiempo</p>
                            <p className="text-[10px] font-bold">12 Días</p>
                        </div>
                        <div className="text-center space-y-2">
                            <ShieldCheck className="w-6 h-6 text-primary mx-auto" />
                            <p className="text-[9px] font-black uppercase text-white/40">Garantía</p>
                            <p className="text-[10px] font-bold">5 Años</p>
                        </div>
                    </div>
                </div>

                {/* Right: Info Section */}
                <div className="space-y-12 animate-in slide-in-from-right duration-1000">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="px-4 py-1.5 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-primary/20">
                                {product.category}
                            </span>
                            <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className="w-3 h-3 fill-primary text-primary" />
                                ))}
                                <span className="text-[9px] font-black text-white/20 ml-2">(48 Reseñas)</span>
                            </div>
                        </div>
                        <h1 className="text-6xl font-black tracking-tighter text-white uppercase italic">
                            {product.name}
                        </h1>
                        <p className="text-lg text-white/60 font-medium leading-relaxed max-w-xl">
                            {product.shortDescription}
                        </p>
                    </div>

                    <div className="space-y-8">
                        <div className="flex items-end gap-4">
                            <span className="text-5xl font-black text-primary">${product.price.toLocaleString()}</span>
                            {product.salePrice && product.salePrice > 0 && (
                                <span className="text-sm font-bold text-white/20 line-through mb-2">COP ${product.salePrice.toLocaleString()}</span>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { label: 'SKU', value: product.sku },
                                { label: 'Dimensiones', value: product.dimensions || 'Ver descripción' },
                                { label: 'Stock', value: product.isStockTracked ? `${product.stock} Un.` : 'Producción Fábrica' },
                                { label: 'Categoría', value: product.category }
                            ].map((spec: any) => (
                                <div key={spec.label} className="p-6 bg-white/5 rounded-3xl border border-white/10 group hover:border-primary/50 transition-all">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">{spec.label}</p>
                                    <p className="text-sm font-bold">{spec.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <button
                            onClick={handleOrder}
                            className={clsx(
                                "flex items-center justify-center gap-4 py-6 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] transition-all relative overflow-hidden group shadow-2xl",
                                isOrdered ? "bg-emerald-500 text-white" : "bg-primary text-black hover:scale-[1.02] active:scale-[0.98]"
                            )}
                        >
                            {isOrdered ? (
                                <React.Fragment>
                                    <Check className="w-6 h-6 animate-in zoom-in duration-300" />
                                    <span>Solicitud Enviada</span>
                                </React.Fragment>
                            ) : (
                                <React.Fragment>
                                    <ShoppingCart className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                    <span>Ordenar Ahora</span>
                                    <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 skew-x-12" />
                                </React.Fragment>
                            )}
                        </button>

                        {/* CRM Status Updates (Internal Simulation) */}
                        {isOrdered && (
                            <div className="p-8 bg-white/[0.03] border border-white/5 rounded-[2.5rem] mt-4 space-y-4 animate-in fade-in duration-500">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Estado de Sincronización CRM:</p>
                                <div className="space-y-3">
                                    <div className={clsx("flex items-center gap-3 text-[11px] font-bold transition-all", orderStep >= 1 ? "text-emerald-500" : "text-white/20")}>
                                        <Bell className="w-4 h-4" />
                                        <span>Notificación enviada a la plataforma</span>
                                        {orderStep >= 1 && <Check className="w-3 h-3" />}
                                    </div>
                                    <div className={clsx("flex items-center gap-3 text-[11px] font-bold transition-all", orderStep >= 2 ? "text-emerald-500" : "text-white/20")}>
                                        <History className="w-4 h-4" />
                                        <span>Nota y Mensaje añadidos al historial del cliente</span>
                                        {orderStep >= 2 && <Check className="w-3 h-3" />}
                                    </div>
                                    <div className={clsx("flex items-center gap-3 text-[11px] font-bold transition-all", orderStep >= 3 ? "text-emerald-500" : "text-white/20")}>
                                        <Mail className="w-4 h-4" />
                                        <span>Email de alerta enviado al equipo comercial</span>
                                        {orderStep >= 3 && <Check className="w-3 h-3" />}
                                    </div>
                                </div>
                            </div>
                        )}
                        <p className="text-center text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">
                            Pago seguro por MiWibi Pay & Transferencia bancaria
                        </p>
                    </div>

                    <div className="pt-10 border-t border-white/5">
                        <div className="flex items-start gap-4 p-8 bg-white/[0.02] rounded-[2rem] border border-white/5">
                            <div className="shrink-0 p-3 bg-white/5 rounded-xl">
                                <ShieldCheck className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black mb-1">Calidad Certificada</h4>
                                <p className="text-xs text-white/40 leading-relaxed">
                                    Nuestros productos de concreto cumplen con la norma NTC de alta resistencia y durabilidad garantizada para exteriores.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="py-20 text-center border-t border-white/5 bg-white/[0.01]">
                <p className="text-[9px] font-black uppercase tracking-[0.6em] text-white/20">Arte Concreto Master Series © 2026</p>
            </footer>
        </div>
    );
}
