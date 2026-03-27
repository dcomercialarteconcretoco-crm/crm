"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
    CreditCard, Plus, Edit2, Trash2, QrCode, ExternalLink, Copy,
    CheckCircle2, Settings, X, Save, Eye, Globe, Instagram, Facebook,
    Linkedin, MessageCircle, Phone, Mail, Youtube, MapPin, Loader2,
    AlertCircle, User, Image, Link, ToggleLeft, ToggleRight
} from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '@/context/AppContext';

interface Biolink {
    id: string; slug: string; photo?: string; name: string; title?: string;
    phone?: string; email?: string; instagram?: string; facebook?: string;
    linkedin?: string; whatsapp?: string; website?: string;
    youtube_url?: string; maps_url?: string; active: boolean;
    seller_id?: string;
}
interface BiolinkSettings {
    form_fields: Record<string, boolean>; theme: string;
    primary_color: string; show_youtube: boolean; show_map: boolean;
}

const DEFAULT_SETTINGS: BiolinkSettings = {
    form_fields: { name: true, email: true, phone: true, city: true },
    theme: 'dark', primary_color: '#fab510', show_youtube: false, show_map: false,
};
const EMPTY_FORM: Partial<Biolink> = {
    name: '', title: '', phone: '', email: '', instagram: '', facebook: '',
    linkedin: '', whatsapp: '', website: '', youtube_url: '', maps_url: '',
    slug: '', photo: '', active: true,
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-sand-three.vercel.app';

export default function BiolinksPage() {
    const { currentUser, sellers } = useApp();
    const [cards, setCards]         = useState<Biolink[]>([]);
    const [settings, setSettings]   = useState<BiolinkSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState('');

    // Editor state
    const [showEditor, setShowEditor]     = useState(false);
    const [editingCard, setEditingCard]   = useState<Biolink | null>(null);
    const [form, setForm]                 = useState<Partial<Biolink>>(EMPTY_FORM);
    const [saving, setSaving]             = useState(false);
    const [showPreview, setShowPreview]   = useState(false);

    // Settings panel
    const [showSettings, setShowSettings] = useState(false);
    const [settingsDraft, setSettingsDraft] = useState<BiolinkSettings>(DEFAULT_SETTINGS);
    const [savingSettings, setSavingSettings] = useState(false);

    // Photo upload
    const photoInputRef = useRef<HTMLInputElement>(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    // Copied slug
    const [copiedId, setCopiedId] = useState('');

    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';

    useEffect(() => {
        Promise.all([
            fetch('/api/biolinks').then(r => r.json()).catch(() => []),
            fetch('/api/biolinks/settings').then(r => r.json()).catch(() => DEFAULT_SETTINGS),
        ]).then(([bl, st]) => {
            setCards(Array.isArray(bl) ? bl : []);
            setSettings(st || DEFAULT_SETTINGS);
            setSettingsDraft(st || DEFAULT_SETTINGS);
        }).catch(e => setError(e.message))
          .finally(() => setLoading(false));
    }, []);

    const openCreate = () => {
        setEditingCard(null);
        setForm({ ...EMPTY_FORM });
        setShowEditor(true);
        setShowPreview(false);
    };

    const openEdit = (card: Biolink) => {
        setEditingCard(card);
        setForm({ ...card });
        setShowEditor(true);
        setShowPreview(false);
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        setUploadingPhoto(true);
        try {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setForm(f => ({ ...f, photo: ev.target?.result as string }));
                setUploadingPhoto(false);
            };
            reader.readAsDataURL(file);
        } catch { setUploadingPhoto(false); }
        e.target.value = '';
    };

    const handleSave = async () => {
        if (!form.name?.trim()) return;
        setSaving(true);
        try {
            const method = editingCard ? 'PUT' : 'POST';
            const url    = editingCard ? `/api/biolinks/${editingCard.id}` : '/api/biolinks';
            const res    = await fetch(url, {
                method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error(await res.text());
            const saved: Biolink = await res.json();
            setCards(prev => editingCard ? prev.map(c => c.id === saved.id ? saved : c) : [saved, ...prev]);
            setShowEditor(false);
        } catch (e: any) { setError(e.message); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta tarjeta digital?')) return;
        await fetch(`/api/biolinks/${id}`, { method: 'DELETE' });
        setCards(prev => prev.filter(c => c.id !== id));
    };

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            const res = await fetch('/api/biolinks/settings', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settingsDraft),
            });
            if (!res.ok) throw new Error('Error guardando configuración');
            const saved = await res.json();
            setSettings(saved);
            setShowSettings(false);
        } catch (e: any) { setError(e.message); }
        finally { setSavingSettings(false); }
    };

    const copyUrl = (card: Biolink) => {
        navigator.clipboard.writeText(`${APP_URL}/b/${card.slug}`).catch(() => {});
        setCopiedId(card.id);
        setTimeout(() => setCopiedId(''), 2000);
    };

    const downloadQR = (card: Biolink) => {
        const a = document.createElement('a');
        a.href = `/api/biolinks/qr/${card.id}`;
        a.download = `qr-${card.slug}.png`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    const f = (key: keyof Biolink, val: string | boolean) => setForm(prev => ({ ...prev, [key]: val }));

    const inputCls = "w-full bg-muted/30 border border-border/40 rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary/60 transition-all placeholder:text-muted-foreground/40 font-medium";
    const labelCls = "text-[10px] font-black uppercase tracking-widest text-muted-foreground/60";

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <CreditCard className="w-6 h-6 text-primary" />
                        Tarjetas Digitales
                    </h1>
                    <p className="text-sm text-muted-foreground">BioLinks profesionales por empleado con QR y vCard</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { setSettingsDraft(settings); setShowSettings(true); }}
                        className="flex items-center gap-2 px-4 py-2.5 border border-border/40 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-muted/40 transition-colors">
                        <Settings className="w-4 h-4" />
                        Plantilla global
                    </button>
                    {isSuperAdmin && (
                        <button onClick={openCreate}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-black rounded-xl text-xs font-black uppercase tracking-wider hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                            <Plus className="w-4 h-4" />
                            Nueva tarjeta
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <p className="text-xs text-rose-500 font-bold">{error}</p>
                    <button onClick={() => setError('')} className="ml-auto"><X className="w-3.5 h-3.5 text-rose-400" /></button>
                </div>
            )}

            {/* Cards grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-sm font-bold">Cargando tarjetas...</span>
                </div>
            ) : cards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
                    <div className="w-20 h-20 rounded-[2rem] bg-muted/40 border border-border/30 flex items-center justify-center">
                        <CreditCard className="w-9 h-9 text-muted-foreground/20" />
                    </div>
                    <div>
                        <p className="font-black text-lg text-foreground">Sin tarjetas digitales aún</p>
                        <p className="text-sm text-muted-foreground mt-1">Crea la primera tarjeta para un empleado</p>
                    </div>
                    {isSuperAdmin && (
                        <button onClick={openCreate} className="flex items-center gap-2 px-6 py-3 bg-primary text-black rounded-xl font-black text-sm hover:scale-105 transition-transform">
                            <Plus className="w-4 h-4" /> Crear primera tarjeta
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {cards.map(card => (
                        <div key={card.id} className={clsx("bg-card border rounded-3xl overflow-hidden group transition-all hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-0.5 flex flex-col", card.active ? "border-border/40" : "border-border/20 opacity-60")}>
                            {/* Card top — gradient + photo */}
                            <div className="relative h-24 flex items-end justify-center pb-0" style={{ background: `linear-gradient(135deg, #111 0%, #1e1e24 100%)` }}>
                                <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 70% 30%, ${settings.primary_color}18 0%, transparent 70%)` }} />
                                {card.photo ? (
                                    <img src={card.photo} alt={card.name}
                                        className="w-16 h-16 rounded-full object-cover border-4 border-card shadow-xl relative z-10 translate-y-8" />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-primary/20 border-4 border-card flex items-center justify-center font-black text-xl text-primary shadow-xl relative z-10 translate-y-8">
                                        {card.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="pt-10 px-5 pb-5 flex flex-col flex-1">
                                <div className="text-center mb-4">
                                    <p className="font-black text-base text-foreground leading-tight">{card.name}</p>
                                    {card.title && <p className="text-xs text-muted-foreground mt-0.5">{card.title}</p>}
                                    <div className="flex items-center justify-center gap-1.5 mt-2">
                                        <span className={clsx("px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                            card.active ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-muted text-muted-foreground border-border/30")}>
                                            {card.active ? 'Activa' : 'Inactiva'}
                                        </span>
                                    </div>
                                </div>

                                {/* Slug URL */}
                                <div className="flex items-center gap-1.5 bg-muted/30 border border-border/30 rounded-xl px-3 py-2 mb-4">
                                    <Link className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                                    <span className="text-[10px] text-muted-foreground truncate flex-1">/b/{card.slug}</span>
                                    <button onClick={() => copyUrl(card)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                                        {copiedId === card.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                </div>

                                {/* Social icons row */}
                                <div className="flex items-center gap-2 justify-center mb-4 flex-wrap">
                                    {card.instagram && <Instagram className="w-3.5 h-3.5 text-pink-500" />}
                                    {card.facebook  && <Facebook  className="w-3.5 h-3.5 text-blue-500" />}
                                    {card.linkedin  && <Linkedin  className="w-3.5 h-3.5 text-sky-600" />}
                                    {card.whatsapp  && <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />}
                                    {card.website   && <Globe     className="w-3.5 h-3.5 text-primary" />}
                                    {card.phone     && <Phone     className="w-3.5 h-3.5 text-muted-foreground" />}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 mt-auto">
                                    <a href={`/b/${card.slug}`} target="_blank" rel="noopener noreferrer"
                                        className="flex-1 flex items-center justify-center gap-1 py-2 border border-border/40 rounded-xl text-[10px] font-black uppercase hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground">
                                        <Eye className="w-3.5 h-3.5" /> Ver
                                    </a>
                                    <button onClick={() => downloadQR(card)}
                                        className="flex-1 flex items-center justify-center gap-1 py-2 border border-border/40 rounded-xl text-[10px] font-black uppercase hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground">
                                        <QrCode className="w-3.5 h-3.5" /> QR
                                    </button>
                                    {isSuperAdmin && <>
                                        <button onClick={() => openEdit(card)}
                                            className="flex-1 flex items-center justify-center gap-1 py-2 bg-primary/10 border border-primary/20 text-primary rounded-xl text-[10px] font-black uppercase hover:bg-primary/20 transition-colors">
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDelete(card.id)}
                                            className="p-2 border border-border/40 rounded-xl text-muted-foreground hover:text-rose-500 hover:border-rose-500/30 transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── EDITOR MODAL ── */}
            {showEditor && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
                    <div className="w-full max-w-3xl bg-card border border-border/40 rounded-[2.5rem] shadow-2xl overflow-hidden my-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-8 py-6 border-b border-border/40">
                            <div>
                                <h2 className="font-black text-xl tracking-tight">
                                    {editingCard ? 'Editar tarjeta digital' : 'Nueva tarjeta digital'}
                                </h2>
                                <p className="text-xs text-muted-foreground mt-0.5">Datos corporativos del empleado</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setShowPreview(v => !v)}
                                    className={clsx("flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase border transition-colors",
                                        showPreview ? "bg-primary/10 border-primary/30 text-primary" : "border-border/40 text-muted-foreground hover:bg-muted/30")}>
                                    <Eye className="w-3.5 h-3.5" /> Preview
                                </button>
                                <button onClick={() => setShowEditor(false)} className="p-2 hover:bg-muted/40 rounded-xl transition-colors">
                                    <X className="w-5 h-5 text-muted-foreground" />
                                </button>
                            </div>
                        </div>

                        <div className={clsx("grid gap-0", showPreview ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
                            {/* Form */}
                            <div className="p-8 space-y-6 overflow-y-auto max-h-[75vh]">
                                {/* Photo */}
                                <div className="space-y-2">
                                    <label className={labelCls}>Foto del empleado</label>
                                    <div className="flex items-center gap-4">
                                        {form.photo ? (
                                            <img src={form.photo} alt="foto" className="w-16 h-16 rounded-full object-cover border-2 border-border/40" />
                                        ) : (
                                            <div className="w-16 h-16 rounded-full bg-muted/40 border-2 border-border/30 flex items-center justify-center">
                                                <User className="w-7 h-7 text-muted-foreground/30" />
                                            </div>
                                        )}
                                        <div>
                                            <input type="file" ref={photoInputRef} accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                                            <button type="button" onClick={() => photoInputRef.current?.click()}
                                                className="flex items-center gap-1.5 px-4 py-2 border border-border/40 rounded-xl text-[10px] font-black uppercase hover:bg-muted/30 transition-colors text-muted-foreground">
                                                {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Image className="w-3.5 h-3.5" />}
                                                {uploadingPhoto ? 'Cargando...' : 'Seleccionar foto'}
                                            </button>
                                            {form.photo && (
                                                <button type="button" onClick={() => f('photo', '')} className="ml-2 text-[10px] text-rose-400 hover:text-rose-500 font-bold">Quitar</button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Basic info */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className={labelCls}>Nombre *</label>
                                        <input type="text" placeholder="Juan Pérez" value={form.name || ''} onChange={e => f('name', e.target.value)} className={inputCls} required />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className={labelCls}>Cargo</label>
                                        <input type="text" placeholder="Asesor Comercial" value={form.title || ''} onChange={e => f('title', e.target.value)} className={inputCls} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className={labelCls}>Teléfono empresa</label>
                                        <input type="tel" placeholder="+57 300 000 0000" value={form.phone || ''} onChange={e => f('phone', e.target.value)} className={inputCls} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className={labelCls}>Email empresa</label>
                                        <input type="email" placeholder="juan@arteconcreto.co" value={form.email || ''} onChange={e => f('email', e.target.value)} className={inputCls} />
                                    </div>
                                </div>

                                {/* Slug */}
                                <div className="space-y-1.5">
                                    <label className={labelCls}>Slug de URL (auto-generado si se deja vacío)</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground font-bold">/b/</span>
                                        <input type="text" placeholder="juan-perez" value={form.slug || ''} onChange={e => f('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} className={clsx(inputCls, "flex-1")} />
                                    </div>
                                </div>

                                {/* Social links */}
                                <div>
                                    <p className={clsx(labelCls, "mb-3")}>Redes sociales de la empresa</p>
                                    <div className="space-y-3">
                                        {[
                                            { icon: <Instagram className="w-4 h-4 text-pink-500" />, key: 'instagram' as keyof Biolink, placeholder: '@arteconcreto o URL completa' },
                                            { icon: <Facebook  className="w-4 h-4 text-blue-500" />,  key: 'facebook'  as keyof Biolink, placeholder: 'arteconcreto o URL completa' },
                                            { icon: <Linkedin  className="w-4 h-4 text-sky-600" />,   key: 'linkedin'  as keyof Biolink, placeholder: 'company/arteconcreto o URL' },
                                            { icon: <MessageCircle className="w-4 h-4 text-emerald-500" />, key: 'whatsapp' as keyof Biolink, placeholder: '573001234567 (sin + ni guiones)' },
                                            { icon: <Globe     className="w-4 h-4 text-primary" />,   key: 'website'   as keyof Biolink, placeholder: 'https://arteconcreto.co' },
                                        ].map(s => (
                                            <div key={s.key} className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-muted/30 border border-border/30 flex items-center justify-center shrink-0">{s.icon}</div>
                                                <input type="text" placeholder={s.placeholder} value={(form[s.key] as string) || ''} onChange={e => f(s.key, e.target.value)} className={clsx(inputCls, "flex-1")} />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* YouTube & Maps */}
                                <div className="space-y-3">
                                    <p className={clsx(labelCls, "mb-1")}>Contenido multimedia (opcional)</p>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-muted/30 border border-border/30 flex items-center justify-center shrink-0">
                                            <Youtube className="w-4 h-4 text-red-500" />
                                        </div>
                                        <input type="url" placeholder="https://youtube.com/watch?v=..." value={form.youtube_url || ''} onChange={e => f('youtube_url', e.target.value)} className={clsx(inputCls, "flex-1")} />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-muted/30 border border-border/30 flex items-center justify-center shrink-0">
                                            <MapPin className="w-4 h-4 text-rose-400" />
                                        </div>
                                        <input type="url" placeholder="URL de embed de Google Maps (iframe src=...)" value={form.maps_url || ''} onChange={e => f('maps_url', e.target.value)} className={clsx(inputCls, "flex-1")} />
                                    </div>
                                </div>

                                {/* Active toggle */}
                                <div className="flex items-center justify-between py-3 px-4 bg-muted/20 border border-border/30 rounded-xl">
                                    <span className="text-sm font-bold text-foreground">Tarjeta activa</span>
                                    <button type="button" onClick={() => f('active', !form.active)}
                                        className={clsx("w-12 h-6 rounded-full relative transition-all", form.active ? "bg-primary" : "bg-gray-300")}>
                                        <div className={clsx("w-4 h-4 bg-white rounded-full absolute top-1 transition-all", form.active ? "right-1" : "left-1")} />
                                    </button>
                                </div>
                            </div>

                            {/* Preview panel */}
                            {showPreview && (
                                <div className="border-l border-border/40 bg-muted/5 flex flex-col items-center p-6 overflow-y-auto max-h-[75vh]">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-4">Vista previa</p>
                                    <div className="w-full max-w-[320px] rounded-[2rem] overflow-hidden shadow-2xl border border-border/30" style={{ transform: 'scale(0.92)', transformOrigin: 'top center' }}>
                                        <BiolinkPreview form={form} settings={settings} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal footer */}
                        <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-border/40 bg-muted/5">
                            <button onClick={() => setShowEditor(false)} className="px-5 py-2.5 border border-border/40 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-muted/30 transition-colors text-muted-foreground">
                                Cancelar
                            </button>
                            <button onClick={handleSave} disabled={saving || !form.name?.trim()}
                                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-black rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-50 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Guardando...' : 'Guardar tarjeta'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── SETTINGS MODAL ── */}
            {showSettings && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-card border border-border/40 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between px-8 py-6 border-b border-border/40">
                            <div>
                                <h2 className="font-black text-lg tracking-tight">Plantilla global</h2>
                                <p className="text-xs text-muted-foreground">Aplica a todas las tarjetas</p>
                            </div>
                            <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-muted/40 rounded-xl transition-colors">
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            {/* Theme */}
                            <div className="space-y-2">
                                <p className={labelCls}>Tema de fondo</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {['dark', 'light'].map(t => (
                                        <button key={t} onClick={() => setSettingsDraft(s => ({ ...s, theme: t }))}
                                            className={clsx("py-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all",
                                                settingsDraft.theme === t ? "bg-primary/10 border-primary/30 text-primary" : "border-border/40 text-muted-foreground hover:bg-muted/30")}>
                                            {t === 'dark' ? '🌙 Oscuro' : '☀️ Claro'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Primary color */}
                            <div className="space-y-2">
                                <p className={labelCls}>Color principal</p>
                                <div className="flex items-center gap-3">
                                    <input type="color" value={settingsDraft.primary_color}
                                        onChange={e => setSettingsDraft(s => ({ ...s, primary_color: e.target.value }))}
                                        className="w-10 h-10 rounded-xl border border-border/40 cursor-pointer p-0.5 bg-transparent" />
                                    <input type="text" value={settingsDraft.primary_color}
                                        onChange={e => setSettingsDraft(s => ({ ...s, primary_color: e.target.value }))}
                                        className="flex-1 bg-muted/30 border border-border/40 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-primary/60 transition-all text-foreground" />
                                </div>
                            </div>

                            {/* Form fields */}
                            <div className="space-y-2">
                                <p className={labelCls}>Campos del formulario "Dejar datos"</p>
                                <div className="space-y-2">
                                    {[
                                        { key: 'name', label: 'Nombre' },
                                        { key: 'email', label: 'Correo electrónico' },
                                        { key: 'phone', label: 'Teléfono' },
                                        { key: 'city', label: 'Ciudad' },
                                    ].map(field => (
                                        <div key={field.key} className="flex items-center justify-between py-2.5 px-4 bg-muted/20 border border-border/30 rounded-xl">
                                            <span className="text-sm font-bold text-foreground">{field.label}</span>
                                            <button onClick={() => setSettingsDraft(s => ({
                                                ...s, form_fields: { ...s.form_fields, [field.key]: !s.form_fields[field.key] }
                                            }))} className={clsx("w-10 h-5 rounded-full relative transition-all", settingsDraft.form_fields[field.key] !== false ? "bg-primary" : "bg-gray-300")}>
                                                <div className={clsx("w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all", settingsDraft.form_fields[field.key] !== false ? "right-[3px]" : "left-[3px]")} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Show YouTube / Map toggles */}
                            {[
                                { key: 'show_youtube' as keyof BiolinkSettings, label: '🎥 Mostrar video YouTube' },
                                { key: 'show_map'     as keyof BiolinkSettings, label: '📍 Mostrar mapa de ubicación' },
                            ].map(tog => (
                                <div key={tog.key} className="flex items-center justify-between py-2.5 px-4 bg-muted/20 border border-border/30 rounded-xl">
                                    <span className="text-sm font-bold text-foreground">{tog.label}</span>
                                    <button onClick={() => setSettingsDraft(s => ({ ...s, [tog.key]: !s[tog.key] }))}
                                        className={clsx("w-10 h-5 rounded-full relative transition-all", settingsDraft[tog.key] ? "bg-primary" : "bg-gray-300")}>
                                        <div className={clsx("w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all", settingsDraft[tog.key] ? "right-[3px]" : "left-[3px]")} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3 px-8 py-5 border-t border-border/40">
                            <button onClick={() => setShowSettings(false)} className="flex-1 py-2.5 border border-border/40 rounded-xl text-xs font-black uppercase tracking-wider text-muted-foreground hover:bg-muted/30 transition-colors">Cancelar</button>
                            <button onClick={handleSaveSettings} disabled={savingSettings}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-black rounded-xl text-xs font-black uppercase tracking-wider hover:bg-primary/90 transition-all disabled:opacity-60">
                                {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                {savingSettings ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Inline preview component (mini version of public card)
function BiolinkPreview({ form, settings }: { form: Partial<Biolink>; settings: BiolinkSettings }) {
    const pc = settings.primary_color || '#fab510';
    const isDark = settings.theme !== 'light';
    const bg = isDark ? '#111' : '#f8f8fa';
    const txt = isDark ? '#fff' : '#111';
    const sub = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
    return (
        <div style={{ background: bg, minHeight: 480, padding: '28px 20px 24px', fontFamily: 'system-ui,sans-serif' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                {/* Logo arriba */}
                <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'center' }}>
                    <img
                        src="https://arteconcreto.co/wp-content/uploads/2026/03/cropped-Logo-Web-72ppi-237x96-1.png"
                        alt="Arte Concreto"
                        style={{ height: 34, objectFit: 'contain', filter: isDark ? 'brightness(0) invert(1)' : 'none', opacity: isDark ? 0.95 : 0.85 }}
                    />
                </div>
                {form.photo ? (
                    <img src={form.photo} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${pc}`, margin: '0 auto 10px', display: 'block' }} />
                ) : (
                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${pc}20`, border: `3px solid ${pc}`, margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: pc }}>
                        {form.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                )}
                <p style={{ margin: 0, fontWeight: 900, fontSize: 16, color: txt }}>{form.name || 'Nombre del empleado'}</p>
                {form.title && <p style={{ margin: '4px 0 0', fontSize: 11, color: sub }}>{form.title}</p>}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                {form.instagram && <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(225,48,108,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📸</div>}
                {form.facebook  && <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(24,119,242,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📘</div>}
                {form.whatsapp  && <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(37,211,102,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💬</div>}
                {form.website   && <div style={{ width: 36, height: 36, borderRadius: 10, background: `${pc}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🌐</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ padding: '12px 16px', borderRadius: 12, background: pc, color: '#000', fontWeight: 900, fontSize: 12, textAlign: 'center', letterSpacing: '0.05em' }}>DEJAR MIS DATOS</div>
                <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: txt, fontWeight: 900, fontSize: 12, textAlign: 'center' }}>DESCARGAR CONTACTO</div>
            </div>
        </div>
    );
}
