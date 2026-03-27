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
                Iniciando Motor ArteConcreto...
            </motion.div>
        </div>
    );

    return (
        <div className="bg-[#050505] min-h-screen p-4 relative overflow-hidden font-sans">
            {/* Background glows */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/15 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-white/3 rounded-full blur-[100px]" />
                <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px]" />
            </div>

            <div className="relative z-10 w-full max-w-lg mx-auto">
                <AnimatePresence mode="wait">
                    {status === 'success' ? (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-[#0a0a0b]/80 backdrop-blur-3xl border border-white/10 rounded-3xl p-10 text-center shadow-2xl mt-6"
                        >
                            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-500 mx-auto mb-6">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-4 leading-none">Vínculo <span className="text-primary">Confirmado</span></h1>
                            <p className="text-xs text-white/40 font-bold uppercase tracking-[0.15em] leading-relaxed italic">
                                Tu solicitud ha sido procesada.<br />
                                Un asesor te contactará en breve.
                            </p>
                            <div className="mt-6 flex items-center justify-center gap-3 opacity-30">
                                <div className="h-px w-8 bg-white/20" />
                                <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white">Ref: {params.id}</span>
                                <div className="h-px w-8 bg-white/20" />
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                            {/* Header */}
                            <div className="text-center mb-5">
                                <img
                                    src="https://arteconcreto.co/wp-content/uploads/2026/03/cropped-Logo-Web-72ppi-237x96-1.png"
                                    alt="Arte Concreto"
                                    className="h-10 object-contain mx-auto mb-3 brightness-0 invert"
                                />
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full mb-2">
                                    <Lock className="w-3 h-3 text-primary" />
                                    <span className="text-[9px] font-black uppercase tracking-[0.25em] text-primary">Acceso Corporativo Exclusivo</span>
                                </div>
                                <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none mb-1">
                                    {form.title}
                                </h1>
                                <p className="text-[10px] text-white/30 font-bold tracking-[0.2em] max-w-sm mx-auto uppercase italic leading-relaxed">
                                    {form.description}
                                </p>
                            </div>

                            {/* Form card */}
                            <div className={clsx(
                                "rounded-3xl p-6 shadow-2xl relative overflow-hidden",
                                form.theme === 'glass' ? "bg-white/[0.03] border border-white/10 backdrop-blur-2xl" :
                                    form.theme === 'bold' ? "bg-black border border-white/20" :
                                        "bg-[#0a0a0b] border border-white/5"
                            )}>
                                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {form.fields.map((field) => (
                                        <div key={field} className="space-y-1.5">
                                            <label className={clsx(
                                                "text-[9px] font-black uppercase tracking-[0.35em] transition-colors px-1",
                                                focusedField === field ? "text-primary" : "text-white/25"
                                            )}>
                                                {field === 'name' ? 'Nombre Completo' :
                                                    field === 'email' ? 'Correo Electrónico' :
                                                        field === 'phone' ? 'Teléfono' :
                                                            field === 'company' ? 'Firma / Organización' :
                                                                field === 'city' ? 'Ciudad' : field}
                                            </label>
                                            <div className="relative">
                                                <div className={clsx(
                                                    "absolute left-4 top-1/2 -translate-y-1/2 transition-colors",
                                                    focusedField === field ? "text-primary" : "text-white/15"
                                                )}>
                                                    {field === 'name' ? <User size={15} /> :
                                                        field === 'email' ? <Mail size={15} /> :
                                                            field === 'phone' ? <Phone size={15} /> :
                                                                field === 'company' ? <Building2 size={15} /> :
                                                                    field === 'city' ? <MapPin size={15} /> : <Layers size={15} />}
                                                </div>
                                                <input
                                                    required
                                                    autoComplete="off"
                                                    onFocus={() => setFocusedField(field)}
                                                    onBlur={() => setFocusedField(null)}
                                                    type={field === 'email' ? 'email' : 'text'}
                                                    onChange={e => setFormData({ ...formData, [field]: e.target.value })}
                                                    className={clsx(
                                                        "w-full bg-white/[0.02] border rounded-2xl pl-10 pr-4 py-3 text-white font-bold outline-none transition-all text-sm placeholder:text-white/10",
                                                        focusedField === field
                                                            ? "border-primary/50 bg-white/[0.05]"
                                                            : "border-white/8 hover:border-white/15"
                                                    )}
                                                    placeholder={field === 'email' ? 'correo@empresa.com' : `Ingresar ${field}...`}
                                                />
                                            </div>
                                        </div>
                                    ))}

                                    {/* Interested Products */}
                                    {form.fields.includes('interested_products') && (
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase text-white/25 tracking-[0.35em] px-1 flex justify-between">
                                                <span>Mobiliario de Interés</span>
                                                <span className="text-primary/40">Opcional</span>
                                            </label>
                                            <div className="relative">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 w-4 h-4" />
                                                <input
                                                    type="text"
                                                    value={productSearch}
                                                    onChange={e => setProductSearch(e.target.value)}
                                                    className="w-full bg-white/[0.02] border border-white/8 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-white outline-none focus:border-white/20 transition-all"
                                                    placeholder="Buscar bancas, macetas, mobiliario..."
                                                />
                                            </div>
                                            {selectedProducts.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {selectedProducts.map(p => (
                                                        <div key={p.id} onClick={() => setSelectedProducts(prev => prev.filter(x => x.id !== p.id))}
                                                            className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-rose-500/10 hover:border-rose-500/20 transition-all">
                                                            <span className="text-[9px] font-black text-primary uppercase italic">{p.name}</span>
                                                            <X className="w-2.5 h-2.5 text-primary" />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {productSearch.length > 1 && (
                                                <div className="bg-[#121214] border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-44 overflow-y-auto">
                                                    {allProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 6).map(p => (
                                                        <button key={p.id} type="button" onClick={() => {
                                                            if (!selectedProducts.find(x => x.id === p.id)) setSelectedProducts([...selectedProducts, p]);
                                                            setProductSearch("");
                                                        }} className="w-full p-3 hover:bg-white/5 text-left border-b border-white/5 last:border-0 flex items-center gap-3 transition-colors">
                                                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                                                {p.image ? <img src={p.image} className="w-full h-full object-cover rounded-lg" /> : <Layers className="w-3 h-3 text-white/10" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[10px] font-black text-white uppercase truncate italic">{p.name}</p>
                                                                <p className="text-[8px] text-white/20 uppercase">{p.sku}</p>
                                                            </div>
                                                            <Plus className="w-3 h-3 text-primary shrink-0" />
                                                        </button>
                                                    ))}
                                                    {allProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                                                        <div className="p-4 text-center text-white/20 text-[10px] uppercase italic">Sin resultados</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <button type="submit" disabled={status === 'loading'}
                                        style={{ backgroundColor: form.primaryColor, boxShadow: `0 8px 30px ${form.primaryColor}25` }}
                                        className="w-full mt-2 py-4 rounded-2xl text-black font-black uppercase text-xs tracking-[0.3em] transition-all flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group/btn">
                                        {status === 'loading' ? (
                                            <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /><span className="italic">Procesando...</span></>
                                        ) : (
                                            <><span className="italic">{form.buttonText}</span><ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" /></>
                                        )}
                                        <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover/btn:left-full transition-all duration-700" />
                                    </button>
                                </form>

                                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-center gap-2 opacity-25">
                                    <Shield className="w-3 h-3 text-emerald-500" />
                                    <p className="text-[8px] font-black uppercase tracking-[0.3em] text-white italic">Datos protegidos · ArteConcreto Intelligence</p>
                                </div>
                            </div>

                            <p className="mt-3 text-center text-[8px] font-black text-white/10 uppercase tracking-[0.4em]">© 2026 Arte Concreto · MiWibiCRM</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
