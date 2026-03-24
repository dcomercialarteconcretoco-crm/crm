"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
    Shield,
    CheckCircle2,
    ArrowRight,
    User,
    Mail,
    Phone,
    Building2,
    MapPin,
    Layers,
    TrendingUp,
    Sparkles,
    Lock,
    Search,
    Plus,
    X,
    Filter
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

// Minimal AppContext interfaces for type safety
interface FormDefinition {
    id: string;
    title: string;
    description: string;
    fields: string[];
    primaryColor: string;
    theme: string;
    buttonText: string;
}

export interface Product {
    id: string;
    name: string;
    category: string;
    sku: string;
    price: number;
    image?: string;
}

export default function PublicFormPage() {
    const params = useParams();
    const [form, setForm] = useState<FormDefinition | null>(null);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
    const [productSearch, setProductSearch] = useState("");
    const [focusedField, setFocusedField] = useState<string | null>(null);

    useEffect(() => {
        const loadPublicForm = async () => {
            try {
                const stateRes = await fetch('/api/state?keys=forms,products', { cache: 'no-store' });
                if (stateRes.ok) {
                    const state = await stateRes.json();
                    const savedForms = Array.isArray(state.forms) ? state.forms : [];
                    const found = savedForms.find((f: any) => f.id === params.id);
                    setAllProducts(Array.isArray(state.products) ? state.products : []);

                    if (found) {
                        setForm(found);
                        return;
                    }
                }
            } catch (error) {
                console.warn('Failed to load public form state:', error);
            }

            setForm({
                id: params.id as string,
                title: 'Registro de Interés Arquitectónico',
                description: 'Únete a nuestra red exclusiva de colaboradores y clientes premium para recibir asesoría técnica en mobiliario de concreto.',
                fields: ['name', 'email', 'phone', 'company', 'city', 'interested_products'],
                primaryColor: '#FAB510',
                theme: 'glass',
                buttonText: 'Solicitar Asesoría'
            });
        };

        loadPublicForm();
    }, [params.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');

        await new Promise(r => setTimeout(r, 2000));

        const newClient = {
            id: `c-${Date.now()}`,
            name: formData.name || 'Anónimo',
            company: formData.company || 'N/A',
            email: formData.email || '',
            phone: formData.phone || '',
            status: 'Lead',
            value: '$0',
            ltv: 0,
            lastContact: 'Registro QR Premium',
            city: formData.city || 'Desconocida',
            score: 75,
            category: 'QR Lead',
            registrationDate: new Date().toISOString().split('T')[0],
            interestedProducts: selectedProducts.map(p => ({ id: p.id, name: p.name, sku: p.sku }))
        };

        await fetch('/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newClient),
        });

        const auditEntry = {
            id: `log-${Date.now()}`,
            userId: 'SYSTEM',
            userName: 'Formulario Publico',
            userRole: 'IA',
            action: 'LEAD_CREATED',
            targetId: newClient.id,
            targetName: newClient.name,
            timestamp: new Date(),
            details: `Nuevo lead interesado en: ${selectedProducts.map(p => p.name).join(', ') || 'Consultoria General'}`,
            verified: true
        };

        const stateRes = await fetch('/api/state?keys=forms,auditLogs', { cache: 'no-store' });
        if (stateRes.ok) {
            const state = await stateRes.json();
            const auditLogs = Array.isArray(state.auditLogs) ? state.auditLogs : [];
            const forms = Array.isArray(state.forms) ? state.forms : [];
            const updatedForms = forms.map((f: any) =>
                f.id === params.id ? { ...f, submissions: (f.submissions || 0) + 1 } : f
            );

            await fetch('/api/state', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    auditLogs: [auditEntry, ...auditLogs],
                    forms: updatedForms,
                }),
            });
        }

        setStatus('success');
    };

    if (!form) return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-primary font-black uppercase tracking-[0.4em] italic text-xs flex items-center gap-3"
            >
                <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                Iniciando Motor Arte Concreto...
            </motion.div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Ultra Premium Background */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Abstract Concrete Texture Overlay */}
                <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/concrete-wall.png')] mix-blend-overlay" />

                {/* Dynamic Glows */}
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.1, 0.15, 0.1],
                        x: [0, 50, 0],
                        y: [0, -30, 0]
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] bg-primary/20 rounded-full blur-[120px]"
                />
                <motion.div
                    animate={{
                        scale: [1.2, 1, 1.2],
                        opacity: [0.05, 0.1, 0.05],
                        x: [0, -50, 0],
                        y: [0, 30, 0]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-white/5 rounded-full blur-[120px]"
                />

                {/* Grid Pattern */}
                <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-40" />
            </div>

            <AnimatePresence mode="wait">
                {status === 'success' ? (
                    <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        className="max-w-md w-full bg-[#0a0a0b]/80 backdrop-blur-3xl border border-white/10 rounded-[4rem] p-16 text-center shadow-2xl relative z-10"
                    >
                        <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/20 rounded-[2.5rem] flex items-center justify-center text-emerald-500 mx-auto mb-10 shadow-[0_20px_50px_rgba(16,185,129,0.2)]">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 200, damping: 10 }}
                            >
                                <CheckCircle2 className="w-12 h-12" />
                            </motion.div>
                        </div>
                        <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-6 leading-none">Vínculo <br /><span className="text-primary NOT-italic">Confirmado</span></h1>
                        <p className="text-xs text-white/40 font-bold uppercase tracking-[0.2em] leading-relaxed italic">
                            Tu solicitud ha sido procesada por la IA de <br />
                            <span className="text-white">Arte Concreto Intelligence</span>.
                            <br /><br />
                            Un asesor de proyectos especializados te contactará en breve para discutir tu propuesta.
                        </p>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="mt-12 flex items-center justify-center gap-3 opacity-30"
                        >
                            <div className="h-px w-8 bg-white/20" />
                            <span className="text-[8px] font-black uppercase tracking-[0.4em] text-white">Referencia: {params.id}</span>
                            <div className="h-px w-8 bg-white/20" />
                        </motion.div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="form"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full max-w-xl relative z-10"
                    >
                        <div className="text-center mb-16 space-y-6">
                            <motion.img
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 1 }}
                                src="https://cuantium.com/wp-content/uploads/2026/02/logo.png"
                                alt="Logo"
                                className="w-28 h-28 object-contain mx-auto mb-8 cursor-pointer hover:scale-110 transition-transform duration-700 brightness-0 invert"
                            />
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full mb-4 shadow-lg shadow-primary/5"
                            >
                                <Lock className="w-3 h-3 text-primary" />
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Acceso Corporativo Exclusivo</span>
                            </motion.div>
                            <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none px-4">
                                {form.title}
                            </h1>
                            <p className="text-[10px] text-white/30 font-bold tracking-[0.3em] leading-relaxed max-w-sm mx-auto uppercase italic">
                                {form.description}
                            </p>
                        </div>

                        <div className={clsx(
                            "rounded-[4rem] p-10 lg:p-14 shadow-2xl relative overflow-hidden transition-all duration-700",
                            form.theme === 'glass' ? "bg-white/[0.03] border border-white/10 backdrop-blur-2xl" :
                                form.theme === 'bold' ? "bg-black border border-white/20 shadow-primary/5 shadow-2xl" :
                                    "bg-[#0a0a0b] border border-white/5"
                        )}>
                            {/* Inner Form Glow */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-50" />

                            <form onSubmit={handleSubmit} className="space-y-8">
                                <div className="grid grid-cols-1 gap-8">
                                    {form.fields.map((field, idx) => (
                                        <motion.div
                                            key={field}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.4 + (idx * 0.1) }}
                                            className="space-y-3"
                                        >
                                            <div className="flex justify-between items-center px-1">
                                                <label className={clsx(
                                                    "text-[10px] font-black uppercase tracking-[0.4em] transition-colors",
                                                    focusedField === field ? "text-primary" : "text-white/20"
                                                )}>
                                                    {field === 'name' ? 'Nombre Completo' :
                                                        field === 'email' ? 'Identidad Digital' :
                                                            field === 'phone' ? 'Enlace Directo' :
                                                                field === 'company' ? 'Firma / Organización' :
                                                                    field === 'city' ? 'Ubicación Geográfica' : field}
                                                </label>
                                                {focusedField === field && (
                                                    <motion.div layoutId="spark" className="text-primary">
                                                        <Sparkles className="w-3 h-3 animate-pulse" />
                                                    </motion.div>
                                                )}
                                            </div>
                                            <div className="relative group">
                                                <div className={clsx(
                                                    "absolute left-6 top-1/2 -translate-y-1/2 transition-all duration-500",
                                                    focusedField === field ? "text-primary scale-110" : "text-white/10"
                                                )}>
                                                    {field === 'name' ? <User size={20} /> :
                                                        field === 'email' ? <Mail size={20} /> :
                                                            field === 'phone' ? <Phone size={20} /> :
                                                                field === 'company' ? <Building2 size={20} /> :
                                                                    field === 'city' ? <MapPin size={20} /> : <Layers size={20} />}
                                                </div>
                                                <input
                                                    required
                                                    autoComplete="off"
                                                    onFocus={() => setFocusedField(field)}
                                                    onBlur={() => setFocusedField(null)}
                                                    type={field === 'email' ? 'email' : 'text'}
                                                    onChange={e => setFormData({ ...formData, [field]: e.target.value })}
                                                    className={clsx(
                                                        "w-full bg-white/[0.02] border rounded-[2rem] pl-16 pr-8 py-6 text-white font-bold outline-none transition-all duration-500 text-sm placeholder:text-white/[0.05]",
                                                        focusedField === field
                                                            ? "border-primary/50 bg-white/[0.05] shadow-inner shadow-primary/5"
                                                            : "border-white/5 hover:border-white/10"
                                                    )}
                                                    placeholder={`Ingresar ${field === 'email' ? 'correo@empresa.com' : field}...`}
                                                />
                                            </div>
                                        </motion.div>
                                    ))}

                                    {/* Interested Products Field */}
                                    {form.fields.includes('interested_products') && (
                                        <motion.div
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="space-y-4"
                                        >
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em]">
                                                    Mobiliario de Interés
                                                </label>
                                                <span className="text-[8px] font-black text-primary/40 uppercase">Opcional</span>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="relative">
                                                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 w-4 h-4" />
                                                    <input
                                                        type="text"
                                                        value={productSearch}
                                                        onChange={e => setProductSearch(e.target.value)}
                                                        className="w-full bg-white/[0.02] border border-white/5 rounded-[1.5rem] pl-14 pr-6 py-4 text-xs font-bold text-white outline-none focus:border-white/20 transition-all italic"
                                                        placeholder="Busca banchas, macetas, mobiliario..."
                                                    />
                                                </div>

                                                {/* Selected Products Badges */}
                                                {selectedProducts.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 pt-2">
                                                        {selectedProducts.map(p => (
                                                            <motion.div
                                                                layout
                                                                initial={{ scale: 0.8 }}
                                                                animate={{ scale: 1 }}
                                                                key={p.id}
                                                                className="px-4 py-2 bg-primary/10 border border-primary/20 rounded-full flex items-center gap-2 group cursor-pointer hover:bg-rose-500/10 hover:border-rose-500/20 transition-all"
                                                                onClick={() => setSelectedProducts(prev => prev.filter(x => x.id !== p.id))}
                                                            >
                                                                <span className="text-[9px] font-black text-primary uppercase tracking-tighter italic">{p.name}</span>
                                                                <X className="w-3 h-3 text-primary group-hover:text-rose-500" />
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Search Results */}
                                                {productSearch.length > 1 && (
                                                    <div className="bg-[#121214] border border-white/10 rounded-3xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2 duration-300">
                                                        {allProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                                                            <button
                                                                key={p.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    if (!selectedProducts.find(x => x.id === p.id)) {
                                                                        setSelectedProducts([...selectedProducts, p]);
                                                                    }
                                                                    setProductSearch("");
                                                                }}
                                                                className="w-full p-4 hover:bg-white/5 text-left border-b border-white/5 last:border-0 flex items-center gap-4 group transition-colors"
                                                            >
                                                                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                                                    {p.image ? (
                                                                        <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                                    ) : (
                                                                        <Layers className="w-4 h-4 text-white/10" />
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[10px] font-black text-white uppercase truncate italic">{p.name}</p>
                                                                    <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest">{p.sku}</p>
                                                                </div>
                                                                <Plus className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </button>
                                                        ))}
                                                        {allProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                                                            <div className="p-8 text-center text-white/20 text-[10px] font-black uppercase tracking-widest italic">No se encontraron productos</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </div>

                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.8 }}
                                    className="pt-10"
                                >
                                    <button
                                        type="submit"
                                        disabled={status === 'loading'}
                                        style={{
                                            backgroundColor: form.primaryColor,
                                            boxShadow: `0 20px 60px ${form.primaryColor}30`
                                        }}
                                        className="w-full py-7 rounded-[2.5rem] text-black font-black uppercase text-xs tracking-[0.4em] transition-all flex items-center justify-center gap-4 hover:scale-[1.03] active:scale-[0.98] relative overflow-hidden group/btn"
                                    >
                                        <AnimatePresence mode="wait">
                                            {status === 'loading' ? (
                                                <motion.div
                                                    key="loader"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="flex items-center gap-3"
                                                >
                                                    <div className="w-5 h-5 border-3 border-black/10 border-t-black rounded-full animate-spin" />
                                                    <span className="italic">Procesando Vínculo...</span>
                                                </motion.div>
                                            ) : (
                                                <motion.div
                                                    key="label"
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className="flex items-center gap-4"
                                                >
                                                    <span className="italic">{form.buttonText}</span>
                                                    <ArrowRight className="w-6 h-6 group-hover/btn:translate-x-2 transition-transform duration-500" />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        {/* Luxury Button Shine */}
                                        <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover/btn:left-full transition-all duration-1000" />
                                    </button>
                                </motion.div>
                            </form>

                            <div className="mt-12 pt-8 border-t border-white/5 flex flex-col items-center gap-4">
                                <div className="flex items-center gap-3 opacity-20">
                                    <Shield className="w-4 h-4 text-emerald-500" />
                                    <p className="text-[8px] font-black uppercase tracking-[0.4em] text-white italic">
                                        Data Architecture by Cuantium AI
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-16 flex flex-col items-center gap-6 opacity-40 group">
                            <div className="flex items-center gap-4">
                                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white/40 italic">In Partnership with</span>
                                <img
                                    src="https://cuantium.com/wp-content/uploads/2025/12/wibicrmblanco@4x.png"
                                    alt="MiWibi"
                                    className="h-4 object-contain grayscale hover:grayscale-0 transition-all duration-700"
                                />
                            </div>
                            <p className="text-[8px] font-black text-white/10 uppercase tracking-[0.6em]">© 2026 ARTE CONCRETO • DESIGN DISTRICT</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
