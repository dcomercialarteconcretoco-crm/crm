"use client";

import React, { useEffect, useState } from 'react';
import { Save, Loader2, Plus, Trash2, RefreshCw, Instagram, Facebook, Linkedin, MessageCircle, Globe, Youtube, MapPin, ShoppingBag } from 'lucide-react';
import { useApp } from '@/context/AppContext';

interface FeaturedProduct {
    id: string;
    name: string;
    image?: string;
    price?: string;
    url?: string;
}

interface VideoEntry {
    id: string;
    title: string;
    url: string;
}

interface GlobalSettings {
    form_fields: { name?: boolean; email?: boolean; phone?: boolean; city?: boolean };
    theme: 'dark' | 'light';
    primary_color: string;
    show_youtube: boolean;
    show_map: boolean;
    company_name: string;
    company_tagline: string;
    company_description: string;
    company_logo: string;
    instagram: string;
    facebook: string;
    linkedin: string;
    tiktok: string;
    whatsapp: string;
    website: string;
    youtube_url: string;
    maps_url: string;
    featured_products: FeaturedProduct[];
    catalog_title: string;
    videos: VideoEntry[];
}

const DEFAULT: GlobalSettings = {
    form_fields: { name: true, email: true, phone: true, city: true },
    theme: 'dark',
    primary_color: '#fab510',
    show_youtube: false,
    show_map: false,
    company_name: 'Arte Concreto',
    company_tagline: '',
    company_description: '',
    company_logo: '',
    instagram: '',
    facebook: '',
    linkedin: '',
    tiktok: '',
    whatsapp: '',
    website: '',
    youtube_url: '',
    maps_url: '',
    featured_products: [],
    catalog_title: 'Productos destacados',
    videos: [],
};

export function BiolinkGlobalSettings() {
    const { products, refreshProducts, addNotification } = useApp();
    const [settings, setSettings] = useState<GlobalSettings>(DEFAULT);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [pickerSearch, setPickerSearch] = useState('');
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        fetch('/api/biolinks/settings')
            .then(r => r.json())
            .then(data => {
                // Migrate legacy single youtube_url into the videos array on first load
                let videos: VideoEntry[] = Array.isArray(data.videos) ? data.videos : [];
                if (videos.length === 0 && data.youtube_url) {
                    videos = [{ id: 'v-legacy', title: 'Video', url: data.youtube_url }];
                }
                setSettings({
                    ...DEFAULT,
                    ...data,
                    featured_products: Array.isArray(data.featured_products) ? data.featured_products : [],
                    videos,
                    form_fields: data.form_fields || DEFAULT.form_fields,
                });
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const update = <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) => {
        setSettings(s => ({ ...s, [key]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/biolinks/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            if (res.ok) {
                addNotification({
                    title: 'Tarjetas digitales actualizadas',
                    description: 'Los cambios se reflejan en todas las tarjetas.',
                    type: 'success',
                });
            } else {
                addNotification({
                    title: 'Error al guardar',
                    description: 'No se pudo guardar la configuración.',
                    type: 'alert',
                });
            }
        } finally {
            setSaving(false);
        }
    };

    const handleSyncWoo = async () => {
        setSyncing(true);
        try {
            await refreshProducts();
            addNotification({
                title: 'Catálogo sincronizado',
                description: 'Productos actualizados desde WooCommerce.',
                type: 'success',
            });
        } catch {
            addNotification({
                title: 'Error al sincronizar',
                description: 'Revisa las credenciales de WooCommerce.',
                type: 'alert',
            });
        } finally {
            setSyncing(false);
        }
    };

    const addProduct = (p: { id: string | number; name: string; image?: string; price?: string; url?: string }) => {
        const id = String(p.id);
        if (settings.featured_products.some(fp => fp.id === id)) return;
        update('featured_products', [
            ...settings.featured_products,
            { id, name: p.name, image: p.image, price: p.price, url: p.url },
        ]);
    };

    const removeProduct = (id: string) => {
        update('featured_products', settings.featured_products.filter(p => p.id !== id));
    };

    const availableProducts = products
        .filter(p => !p.isDeleted)
        .filter(p => {
            if (!pickerSearch.trim()) return true;
            const q = pickerSearch.toLowerCase();
            return p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
        });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-foreground">Configuración de tarjetas digitales</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Toda esta información aparece en <strong>todas las tarjetas</strong> de tu equipo.
                        Cada vendedor solo pone su nombre, foto, teléfono y email — el resto es común.
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-primary text-black font-bold rounded-xl px-5 py-2.5 hover:brightness-105 transition-all flex items-center gap-2 text-sm shadow-[0_2px_8px_rgba(250,181,16,0.3)] disabled:opacity-60 shrink-0"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
            </div>

            {/* Company info */}
            <section className="bg-white border border-border rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Identidad corporativa</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Nombre de la empresa">
                        <input type="text" value={settings.company_name} onChange={e => update('company_name', e.target.value)}
                            placeholder="Arte Concreto" className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none transition-all focus:border-primary focus:bg-white" />
                    </Field>
                    <Field label="Tagline (una línea)">
                        <input type="text" value={settings.company_tagline} onChange={e => update('company_tagline', e.target.value)}
                            placeholder="Mobiliario de concreto premium" className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none transition-all focus:border-primary focus:bg-white" />
                    </Field>
                </div>
                <Field label="Descripción corta (aparece al final de la tarjeta)">
                    <textarea value={settings.company_description} onChange={e => update('company_description', e.target.value)}
                        rows={3} className="settings-input resize-none"
                        placeholder="Diseñamos, producimos e instalamos piezas únicas para proyectos arquitectónicos." />
                </Field>
            </section>

            {/* Social links */}
            <section className="bg-white border border-border rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Redes sociales de la empresa</h3>
                <p className="text-xs text-muted-foreground -mt-2">
                    Estos enlaces aparecen en todas las tarjetas. Si un vendedor quiere usar su propia red, la pone en su tarjeta individual y esa gana.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SocialInput icon={<Instagram className="w-4 h-4 text-[#E1306C]" />} label="Instagram" placeholder="@arteconcreto o URL"
                        value={settings.instagram} onChange={v => update('instagram', v)} />
                    <SocialInput icon={<Facebook className="w-4 h-4 text-[#1877F2]" />} label="Facebook" placeholder="arteconcreto o URL"
                        value={settings.facebook} onChange={v => update('facebook', v)} />
                    <SocialInput icon={<Linkedin className="w-4 h-4 text-[#0A66C2]" />} label="LinkedIn" placeholder="company/arteconcreto o URL"
                        value={settings.linkedin} onChange={v => update('linkedin', v)} />
                    <SocialInput icon={<Globe className="w-4 h-4 text-foreground" />} label="TikTok" placeholder="@arteconcreto o URL"
                        value={settings.tiktok} onChange={v => update('tiktok', v)} />
                    <SocialInput icon={<MessageCircle className="w-4 h-4 text-[#25D366]" />} label="WhatsApp corporativo" placeholder="573001234567 (sin + ni guiones)"
                        value={settings.whatsapp} onChange={v => update('whatsapp', v)} />
                    <SocialInput icon={<Globe className="w-4 h-4 text-primary" />} label="Sitio web" placeholder="https://arteconcreto.co"
                        value={settings.website} onChange={v => update('website', v)} />
                </div>
            </section>

            {/* Multimedia */}
            <section className="bg-white border border-border rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Contenido multimedia</h3>

                {/* Videos list */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wide text-foreground">Videos YouTube</p>
                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                            <input type="checkbox" checked={settings.show_youtube} onChange={e => update('show_youtube', e.target.checked)} />
                            Mostrar en las tarjetas
                        </label>
                    </div>

                    {settings.videos.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4 bg-muted/20 rounded-xl border border-dashed border-border">
                            Sin videos aún. Agrega uno abajo.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {settings.videos.map((v, idx) => (
                                <li key={v.id} className="flex items-center gap-2 p-2 bg-muted/30 border border-border rounded-xl">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground bg-white border border-border rounded-lg px-2 py-1 shrink-0">
                                        #{idx + 1}
                                    </span>
                                    <input
                                        type="text"
                                        value={v.title}
                                        onChange={e => {
                                            const next = [...settings.videos];
                                            next[idx] = { ...v, title: e.target.value };
                                            update('videos', next);
                                        }}
                                        placeholder="Título (ej: Proceso de fabricación)"
                                        className="w-40 bg-white border border-border rounded-xl px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary"
                                    />
                                    <input
                                        type="url"
                                        value={v.url}
                                        onChange={e => {
                                            const next = [...settings.videos];
                                            next[idx] = { ...v, url: e.target.value };
                                            update('videos', next);
                                        }}
                                        placeholder="https://youtube.com/watch?v=..."
                                        className="flex-1 bg-white border border-border rounded-xl px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary"
                                    />
                                    <button
                                        onClick={() => update('videos', settings.videos.filter(x => x.id !== v.id))}
                                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                                        title="Eliminar video"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <button
                        onClick={() => {
                            const id = `v-${Date.now()}`;
                            update('videos', [...settings.videos, { id, title: '', url: '' }]);
                        }}
                        className="flex items-center gap-2 bg-primary/10 text-primary font-bold rounded-xl px-4 py-2 hover:bg-primary/20 transition-colors text-xs"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Agregar video
                    </button>
                </div>

                {/* Map */}
                <div className="space-y-3 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wide text-foreground">Google Maps</p>
                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                            <input type="checkbox" checked={settings.show_map} onChange={e => update('show_map', e.target.checked)} />
                            Mostrar en las tarjetas
                        </label>
                    </div>
                    <Field label="Embed URL (del iframe de Google Maps)">
                        <input type="url" value={settings.maps_url} onChange={e => update('maps_url', e.target.value)}
                            placeholder="https://www.google.com/maps/embed?..."
                            className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none transition-all focus:border-primary focus:bg-white" />
                    </Field>
                </div>
            </section>

            {/* Featured products */}
            <section className="bg-white border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <ShoppingBag className="w-3.5 h-3.5" /> Productos destacados
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            Se muestran como tarjetas al final del biolink. Sincronizados con WooCommerce.
                        </p>
                    </div>
                    <button onClick={handleSyncWoo} disabled={syncing}
                        className="flex items-center gap-2 bg-white border border-border text-foreground font-semibold rounded-xl px-3 py-2 hover:bg-muted text-xs disabled:opacity-60">
                        {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Sync WooCommerce
                    </button>
                </div>

                <Field label="Título del catálogo">
                    <input type="text" value={settings.catalog_title} onChange={e => update('catalog_title', e.target.value)}
                        placeholder="Productos destacados" className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none transition-all focus:border-primary focus:bg-white" />
                </Field>

                {settings.featured_products.length > 0 ? (
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {settings.featured_products.map(p => (
                            <li key={p.id} className="flex items-center gap-3 p-3 bg-muted/30 border border-border rounded-xl">
                                {p.image ? (
                                    <img src={p.image} alt={p.name} className="w-12 h-12 rounded-lg object-cover border border-border" />
                                ) : (
                                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                        <ShoppingBag className="w-5 h-5" />
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold truncate">{p.name}</p>
                                    {p.price && <p className="text-xs font-mono text-primary">{p.price}</p>}
                                </div>
                                <button onClick={() => removeProduct(p.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-xs text-muted-foreground text-center py-6 bg-muted/20 rounded-xl border border-dashed border-border">
                        Sin productos destacados aún. Agrega algunos de tu inventario.
                    </p>
                )}

                <button onClick={() => setShowPicker(v => !v)}
                    className="flex items-center gap-2 bg-primary/10 text-primary font-bold rounded-xl px-4 py-2 hover:bg-primary/20 transition-colors text-xs">
                    <Plus className="w-3.5 h-3.5" />
                    {showPicker ? 'Cerrar selector' : 'Agregar producto del inventario'}
                </button>

                {showPicker && (
                    <div className="border border-border rounded-xl p-3 space-y-2 bg-muted/20">
                        <input type="text" value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
                            placeholder="Buscar por nombre o SKU..." className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none transition-all focus:border-primary focus:bg-white" />
                        {availableProducts.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-4 text-center">
                                {products.length === 0
                                    ? 'No hay productos aún. Sincroniza con WooCommerce primero.'
                                    : 'Ningún producto coincide con la búsqueda.'}
                            </p>
                        ) : (
                            <ul className="max-h-64 overflow-y-auto space-y-1">
                                {availableProducts.slice(0, 30).map(p => {
                                    const selected = settings.featured_products.some(fp => fp.id === String(p.id));
                                    return (
                                        <li key={p.id}>
                                            <button
                                                onClick={() => addProduct({ id: p.id, name: p.name, image: p.image, price: String(p.price ?? ''), url: (p as any).permalink })}
                                                disabled={selected}
                                                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-border transition-colors text-left"
                                            >
                                                {p.image ? (
                                                    <img src={p.image} alt="" className="w-8 h-8 rounded object-cover" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded bg-primary/10" />
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold truncate">{p.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">SKU: {p.sku} · {p.price}</p>
                                                </div>
                                                {selected && <span className="text-[10px] font-bold text-primary">✓ Agregado</span>}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                )}
            </section>

            {/* Appearance */}
            <section className="bg-white border border-border rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Apariencia</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Color primario">
                        <div className="flex items-center gap-2">
                            <input type="color" value={settings.primary_color} onChange={e => update('primary_color', e.target.value)}
                                className="w-12 h-10 rounded-lg border border-border cursor-pointer" />
                            <input type="text" value={settings.primary_color} onChange={e => update('primary_color', e.target.value)}
                                className="settings-input flex-1" />
                        </div>
                    </Field>
                    <Field label="Tema">
                        <select value={settings.theme} onChange={e => update('theme', e.target.value as 'dark' | 'light')}
                            className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none transition-all focus:border-primary focus:bg-white">
                            <option value="dark">Oscuro</option>
                            <option value="light">Claro</option>
                        </select>
                    </Field>
                </div>
            </section>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-primary text-black font-bold rounded-xl px-5 py-2.5 hover:brightness-105 transition-all flex items-center gap-2 text-sm shadow-[0_2px_8px_rgba(250,181,16,0.3)] disabled:opacity-60"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
            </div>

        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">{label}</label>
            {children}
        </div>
    );
}

function SocialInput({
    icon, label, placeholder, value, onChange,
}: { icon: React.ReactNode; label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
    return (
        <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">{label}</label>
            <div className="flex items-center gap-2 bg-muted border border-border rounded-xl px-3 py-2.5 focus-within:border-primary focus-within:bg-white transition-all">
                {icon}
                <input type="text" value={value} onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent text-sm outline-none" />
            </div>
        </div>
    );
}
