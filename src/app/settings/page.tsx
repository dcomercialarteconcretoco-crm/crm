"use client";

import React, { useMemo, useState } from 'react';
import {
    User,
    Bell,
    Shield,
    Link as LinkIcon,
    Palette,
    Database,
    Globe,
    LogOut,
    Save,
    Check,
    MessageCircle,
    Server,
    Calendar,
    Eye,
    EyeOff,
    Smartphone,
    Cloud,
    Download,
    RefreshCw,
    Activity,
    Lock,
    Trash,
    Moon,
    Sun,
    Layout,
    Plus,
    X,
    Key,
    Zap,
    Mail
} from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '@/context/AppContext';

const categories = [
    { id: 'profile', name: 'Perfil de Usuario', icon: User },
    { id: 'intelligence', name: 'Cerebro IA (MiWibi)', icon: Activity },
    { id: 'notifications', name: 'Notificaciones', icon: Bell },
    { id: 'security', name: 'Seguridad y Acceso', icon: Shield },
    { id: 'integrations', name: 'Integraciones API', icon: LinkIcon },
    { id: 'appearance', name: 'Personalización', icon: Palette },
    { id: 'data', name: 'Base de Datos', icon: Database },
    { id: 'license', name: 'Licencia del Sistema', icon: Key },
];

export default function SettingsPage() {
    const { settings, updateSettings, currentUser } = useApp();
    const allowClientSecrets = process.env.NODE_ENV !== 'production';
    const [activeTab, setActiveTab] = useState('profile');
    const [showPassword, setShowPassword] = useState(false);
    const [aiActive, setAiActive] = useState(true);
    const [notifEnabled, setNotifEnabled] = useState([true, true, true, true]);
    const [primaryColor, setPrimaryColor] = useState('#FAB510');
    const [themeMode, setThemeMode] = useState('dark');
    const [layoutMode, setLayoutMode] = useState('classic');

    const [newCity, setNewCity] = useState('');
    const [newCityDept, setNewCityDept] = useState('');
    const [newSector, setNewSector] = useState('');
    const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false);
    const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
    const [whatsAppTestTo, setWhatsAppTestTo] = useState('');

    const whatsappStatusMeta = useMemo(() => {
        const status = settings.whatsapp?.status || 'disconnected';
        if (status === 'connected') {
            return {
                label: 'Conectado',
                classes: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
            };
        }
        if (status === 'configured') {
            return {
                label: 'Configurado',
                classes: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
            };
        }
        if (status === 'error') {
            return {
                label: 'Error',
                classes: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
            };
        }
        return {
            label: 'Desconectado',
            classes: 'text-muted-foreground bg-muted border-border',
        };
    }, [settings.whatsapp?.status]);

    const updateWhatsApp = (updates: Partial<typeof settings.whatsapp>) => {
        updateSettings({
            whatsapp: {
                ...settings.whatsapp,
                ...updates,
            },
        });
    };

    const handleWhatsAppHealthCheck = async () => {
        try {
            setIsTestingWhatsApp(true);
            const response = await fetch('/api/whatsapp/health', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify(allowClientSecrets ? {
                    accessToken: settings.whatsapp.accessToken,
                    phoneNumberId: settings.whatsapp.phoneNumberId,
                    businessAccountId: settings.whatsapp.businessAccountId,
                } : {}),
            });

            const payload = await response.json();

            if (!response.ok || !payload.ok) {
                throw new Error(payload.error || 'No se pudo validar el canal de WhatsApp.');
            }

            updateWhatsApp({
                status: 'connected',
                displayPhoneNumber: payload.displayPhoneNumber || settings.whatsapp.displayPhoneNumber,
                lastVerifiedAt: new Date().toISOString(),
                lastError: '',
            });
        } catch (error) {
            updateWhatsApp({
                status: 'error',
                lastError: error instanceof Error ? error.message : 'No se pudo validar el canal.',
            });
        } finally {
            setIsTestingWhatsApp(false);
        }
    };

    const handleWhatsAppTestMessage = async () => {
        try {
            setIsSendingWhatsApp(true);
            const response = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    to: whatsAppTestTo,
                    text: 'Mensaje de prueba desde MiWibi CRM. Si recibiste esto, el canal de WhatsApp Business quedo listo.',
                    ...(allowClientSecrets ? { config: settings.whatsapp } : {}),
                }),
            });

            const payload = await response.json();
            if (!response.ok || !payload.ok) {
                throw new Error(payload.error || 'No se pudo enviar el mensaje de prueba.');
            }

            updateWhatsApp({
                status: 'connected',
                lastVerifiedAt: new Date().toISOString(),
                lastError: '',
            });
        } catch (error) {
            updateWhatsApp({
                status: 'error',
                lastError: error instanceof Error ? error.message : 'No se pudo enviar el mensaje.',
            });
        } finally {
            setIsSendingWhatsApp(false);
        }
    };

    const updatePrimaryColor = (color: string) => {
        setPrimaryColor(color);
        document.documentElement.style.setProperty('--color-primary', color);
        document.documentElement.style.setProperty('--color-ring', color);
        localStorage.setItem('crm-primary-color', color);
    };

    const toggleTheme = (mode: string) => {
        setThemeMode(mode);
        if (mode === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('crm-theme', mode);
    };

    const updateLayout = (mode: string) => {
        setLayoutMode(mode);
        localStorage.setItem('crm-layout', mode);
        window.dispatchEvent(new Event('storage'));
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 px-4 lg:px-0">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-foreground tracking-tight">Configuración</h1>
                    <p className="text-sm text-muted-foreground mt-1">Administra tu perfil e inteligencia del CRM.</p>
                </div>
                <button className="bg-primary text-black font-bold rounded-xl px-4 py-2.5 hover:brightness-105 transition-all flex items-center justify-center gap-2 w-full lg:w-auto">
                    <Save className="w-4 h-4" />
                    <span>Guardar Cambios</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Side Navigation */}
                <div className="lg:col-span-3 flex lg:flex-col overflow-x-auto lg:overflow-x-visible items-center lg:items-stretch gap-1 pb-4 lg:pb-0">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveTab(cat.id)}
                            className={clsx(
                                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all border whitespace-nowrap",
                                activeTab === cat.id
                                    ? "bg-primary/10 text-primary border-primary/20"
                                    : "text-muted-foreground hover:bg-muted border-transparent"
                            )}
                        >
                            <cat.icon className={clsx(
                                "w-4 h-4 transition-transform",
                                activeTab === cat.id && "scale-110"
                            )} />
                            <span className="text-left">{cat.name}</span>
                        </button>
                    ))}
                    <div className="lg:pt-4">
                        <button className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-rose-500 hover:bg-rose-500/5 transition-all group whitespace-nowrap w-full">
                            <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            Salir
                        </button>
                    </div>
                </div>

                {/* Tab Content Area */}
                <div className="lg:col-span-9">
                    <div className="bg-white border border-border rounded-2xl shadow-sm p-6 lg:p-10 min-h-[500px] lg:min-h-[600px]">

                        {/* Tab: Intelligence Engine (Cerebro) */}
                        {activeTab === 'intelligence' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-black text-foreground tracking-tight">Motor de Inteligencia (MiWibi Engine)</h3>
                                        <p className="text-sm text-muted-foreground">Configura la lógica de razonamiento y monitorea el consumo de IA.</p>
                                    </div>
                                    <div className="flex items-center gap-4 bg-muted border border-border p-4 rounded-2xl">
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Switch Maestro</span>
                                            <span className={clsx("text-xs font-black uppercase", aiActive ? "text-emerald-500" : "text-rose-500")}>
                                                {aiActive ? 'Motor Activo' : 'Motor Pausado'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => setAiActive(!aiActive)}
                                            className={clsx(
                                                "w-14 h-8 rounded-full relative transition-all duration-300",
                                                aiActive ? "bg-emerald-500" : "bg-gray-300"
                                            )}
                                        >
                                            <div className={clsx(
                                                "absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-lg",
                                                aiActive ? "left-7" : "left-1"
                                            )}></div>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Prompt Mastery */}
                                    <div className="md:col-span-2 bg-white border border-border rounded-2xl p-6 shadow-sm space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                                                <Smartphone className="w-4 h-4 text-primary" />
                                            </div>
                                            <h4 className="text-sm font-black uppercase tracking-wide text-foreground">Lógica de Razonamiento Principal</h4>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">System Prompt (Personalidad de la IA)</label>
                                            <textarea
                                                className="w-full h-40 bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all font-medium leading-relaxed text-foreground"
                                                defaultValue="Eres el asistente experto de ArteConcreto. Tu objetivo es calificar prospectos basados en su interés por mobiliario urbano, cubiertas de mármol y soluciones de diseño en concreto. Prioriza contratos de suministro masivo para constructoras y entidades públicas (parques, plazas). Usa un tono profesional y ejecutivo."
                                            />
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs text-muted-foreground">Actualización instantánea aplicada a todos los nuevos leads.</p>
                                                <button className="text-xs font-bold text-primary hover:opacity-80 transition-opacity">Resetear a Default</button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Infraestructura y Consumo */}
                                    <div className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-4">
                                        <h4 className="text-sm font-black text-foreground mb-4">Infraestructura y Consumo</h4>
                                        <div className="space-y-5">
                                            <div>
                                                <div className="flex justify-between text-xs font-bold mb-2">
                                                    <span className="text-foreground">Uso de Tokens (Mensual)</span>
                                                    <span className="text-muted-foreground">Gemini Flash</span>
                                                </div>
                                                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary rounded-full" style={{ width: '0%' }}></div>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">El consumo real se gestiona desde la consola de Google AI Studio.</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="p-3 bg-muted border border-border rounded-xl">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase block mb-1">Cerebro Principal</span>
                                                    <span className="text-xs font-bold text-foreground uppercase flex items-center gap-2">
                                                        <Zap className="w-3 h-3 text-primary" /> Gemini 2.0 Flash
                                                    </span>
                                                </div>
                                                <div className="p-3 bg-muted border border-border rounded-xl">
                                                    <span className="text-xs font-bold text-muted-foreground uppercase block mb-1">API Key</span>
                                                    <span className="text-xs font-bold uppercase flex items-center gap-1">
                                                        <Check className="w-3 h-3 text-emerald-500" />
                                                        <span className="text-emerald-500">{settings.geminiKey ? 'Configurada' : 'Sin configurar'}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Audit Logs */}
                                    <div className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-4">
                                        <h4 className="text-sm font-black text-foreground mb-4">Audit & Reasoning Logs</h4>
                                        <div className="space-y-4">
                                            {[
                                                { label: 'Guardar pasos de razonamiento', active: true },
                                                { label: 'Explicar Score a Vendedores', active: true },
                                                { label: 'Optimización Automática de Prompts', active: false },
                                            ].map((opt) => (
                                                <div key={opt.label} className="flex items-center justify-between">
                                                    <span className="text-sm font-medium text-foreground">{opt.label}</span>
                                                    <button className={clsx(
                                                        "w-10 h-5 rounded-full relative transition-all",
                                                        opt.active ? "bg-primary" : "bg-gray-300"
                                                    )}>
                                                        <div className={clsx(
                                                            "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                                                            opt.active ? "left-6" : "left-1"
                                                        )}></div>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <button className="w-full py-2.5 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all">
                                            Limpiar Logs de la IA
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Perfil de Usuario */}
                        {activeTab === 'profile' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center gap-6">
                                    <div className="relative group cursor-pointer" onClick={() => (document.getElementById('avatar-upload-settings') as HTMLInputElement)?.click()}>
                                        <div className="w-24 h-24 rounded-2xl bg-primary flex items-center justify-center text-black font-black text-3xl border-4 border-background overflow-hidden">
                                            {currentUser?.avatar
                                                ? <img src={currentUser.avatar} alt="avatar" className="w-full h-full object-cover" />
                                                : (currentUser?.name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() || 'AC')
                                            }
                                        </div>
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                                            <span className="text-white text-xs font-bold uppercase">Cambiar</span>
                                        </div>
                                    </div>
                                    <input
                                        id="avatar-upload-settings"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file || !currentUser) return;
                                            const reader = new FileReader();
                                            reader.onload = async (ev) => {
                                                const base64 = ev.target?.result as string;
                                                await fetch(`/api/team/${currentUser.id}`, {
                                                    method: 'PUT',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ avatar: base64 }),
                                                });
                                                window.location.reload();
                                            };
                                            reader.readAsDataURL(file);
                                        }}
                                    />
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-black text-foreground tracking-tight">{currentUser?.name || 'Usuario'}</h3>
                                        <p className="text-sm font-bold text-primary uppercase tracking-widest">{currentUser?.role || 'Administrador'}</p>
                                        <button
                                            onClick={() => (document.getElementById('avatar-upload-settings') as HTMLInputElement)?.click()}
                                            className="text-xs font-bold text-primary hover:opacity-80 transition-opacity mt-1 block"
                                        >Cambiar Avatar</button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Nombre Completo</label>
                                        <input
                                            type="text"
                                            defaultValue={currentUser?.name || ''}
                                            className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Correo Electrónico</label>
                                        <input
                                            type="email"
                                            defaultValue={currentUser?.email || ''}
                                            className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Idioma</label>
                                        <select className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all appearance-none cursor-pointer">
                                            <option className="bg-card">Español (Colombia)</option>
                                            <option className="bg-card">English (US)</option>
                                            <option className="bg-card">Português (Brasil)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Zona Horaria</label>
                                        <div className="flex items-center gap-3 bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground">
                                            <Globe className="w-4 h-4 text-primary" />
                                            Bogotá, COL (GMT-5)
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-8 border-t border-border">
                                    <div className="flex items-center gap-3 mb-6">
                                        <Check className="w-4 h-4 text-emerald-500" />
                                        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Integraciones Activas</h4>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {[
                                            { name: 'WhatsApp Business', status: whatsappStatusMeta.label, icon: MessageCircle, color: settings.whatsapp.status === 'connected' ? 'text-emerald-500' : settings.whatsapp.status === 'error' ? 'text-rose-500' : 'text-amber-500' },
                                            { name: 'WooCommerce', status: 'Conectado', icon: Cloud, color: 'text-sky-500' },
                                            { name: 'Google Calendar', status: 'Conectado', icon: Calendar, color: 'text-emerald-500' },
                                        ].map((int) => (
                                            <div key={int.name} className="flex items-center justify-between p-4 bg-muted border border-border rounded-xl hover:border-primary/20 transition-all group">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2.5 bg-white border border-border rounded-xl group-hover:scale-110 transition-transform">
                                                        <int.icon className={clsx("w-4 h-4", int.color)} />
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <span className="text-sm font-black block text-foreground">{int.name}</span>
                                                        <span className={clsx(
                                                            "text-xs font-bold uppercase tracking-wide",
                                                            int.status === 'Conectado' ? "text-emerald-500" : int.status === 'Error' ? 'text-rose-500' : 'text-amber-500'
                                                        )}>{int.status}</span>
                                                    </div>
                                                </div>
                                                {int.status === 'Conectado' ? (
                                                    <Check className="w-4 h-4 text-emerald-500" />
                                                ) : (
                                                    <button className="text-xs font-bold text-primary hover:opacity-80 transition-opacity">Conectar</button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Notificaciones */}
                        {activeTab === 'notifications' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div>
                                    <h3 className="text-xl font-black text-foreground tracking-tight">Preferencias de Notificación</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Controla cómo y cuándo recibes alertas del sistema.</p>
                                </div>

                                <div className="space-y-3">
                                    {[
                                        { title: 'Nuevos Leads', desc: 'Recibe una alerta inmediata cuando entra un prospecto.', type: 'Push + Email' },
                                        { title: 'Actualización de Pipeline', desc: 'Notificar cuando un lead cambia de etapa.', type: 'Push' },
                                        { title: 'Recordatorios de Tareas', desc: 'Alertas sobre citas y llamadas pendientes.', type: 'Push + WhatsApp' },
                                        { title: 'Reportes Semanales', desc: 'Resumen ejecutivo de ventas todos los lunes.', type: 'Email' },
                                    ].map((pref, i) => (
                                        <div key={pref.title} className="flex items-center justify-between p-5 bg-muted border border-border rounded-xl hover:border-primary/20 transition-all">
                                            <div className="space-y-0.5">
                                                <h4 className="text-sm font-black text-foreground">{pref.title}</h4>
                                                <p className="text-xs text-muted-foreground">{pref.desc}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">{pref.type}</span>
                                                <button
                                                    onClick={() => setNotifEnabled(prev => prev.map((v, idx) => idx === i ? !v : v))}
                                                    className={clsx("w-12 h-6 rounded-full relative p-1 transition-all duration-300", notifEnabled[i] ? "bg-primary" : "bg-gray-300")}
                                                >
                                                    <div className={clsx("w-4 h-4 bg-white rounded-full absolute transition-all", notifEnabled[i] ? "right-1" : "left-1")}></div>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tab: Seguridad */}
                        {activeTab === 'security' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div>
                                    <h3 className="text-xl font-black text-foreground tracking-tight">Seguridad y Privacidad</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Gestiona tu contraseña y métodos de autenticación.</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Lock className="w-4 h-4 text-primary" />
                                            <h4 className="text-sm font-black text-foreground">Cambiar Contraseña</h4>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Contraseña Actual"
                                                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                />
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Nueva Contraseña"
                                                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                />
                                            </div>
                                            <button
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="flex items-center gap-2 text-xs font-bold text-primary hover:opacity-80 transition-opacity"
                                            >
                                                {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                {showPassword ? 'Ocultar Contraseña' : 'Ver Contraseña'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-muted border border-border rounded-xl p-5 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2.5 bg-primary/10 rounded-xl">
                                                <Smartphone className="w-4 h-4 text-primary" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <h4 className="text-sm font-black text-foreground">Autenticación de 2 Factores</h4>
                                                <p className="text-xs text-muted-foreground font-semibold">Altamente recomendado</p>
                                            </div>
                                        </div>
                                        <button className="bg-white border border-border text-foreground font-semibold rounded-xl px-4 py-2.5 hover:bg-muted transition-all text-xs">Activar</button>
                                    </div>

                                    <div className="bg-muted border border-border rounded-xl p-5 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2.5 bg-rose-500/10 rounded-xl">
                                                <Download className="w-4 h-4 text-rose-500" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <h4 className="text-sm font-black text-foreground">Permitir Exportación de Datos</h4>
                                                <p className="text-xs text-muted-foreground font-semibold">
                                                    Habilita la descarga de CSVs {settings.allowExports ? '(Activado)' : '(Desactivado)'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => updateSettings({ allowExports: !settings.allowExports })}
                                            className={clsx(
                                                "w-12 h-6 rounded-full relative p-1 transition-all",
                                                settings.allowExports ? "bg-emerald-500" : "bg-gray-300"
                                            )}
                                        >
                                            <div className={clsx(
                                                "w-4 h-4 bg-white rounded-full absolute transition-all",
                                                settings.allowExports ? "right-1" : "left-1"
                                            )}></div>
                                        </button>
                                    </div>

                                    <div className="bg-muted border border-rose-500/20 rounded-xl p-5 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2.5 bg-rose-500/10 rounded-xl">
                                                <Lock className="w-4 h-4 text-rose-500" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <h4 className="text-sm font-black text-foreground">Bloquear Capturas de Pantalla</h4>
                                                <p className="text-xs text-muted-foreground font-semibold">
                                                    Desactiva selección de texto e impresión {settings.blockScreenshots ? <span className="text-rose-400">(ACTIVO — Protegido)</span> : <span className="text-emerald-500">(Desactivado)</span>}
                                                </p>
                                                <p className="text-xs text-muted-foreground/60 italic">Nota: No bloquea capturas nativas del SO. Disuade fugas digitales.</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => updateSettings({ blockScreenshots: !settings.blockScreenshots })}
                                            className={clsx(
                                                "w-12 h-6 rounded-full relative p-1 transition-all",
                                                settings.blockScreenshots ? "bg-rose-500" : "bg-gray-300"
                                            )}
                                        >
                                            <div className={clsx(
                                                "w-4 h-4 bg-white rounded-full absolute transition-all",
                                                settings.blockScreenshots ? "right-1" : "left-1"
                                            )}></div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Personalización */}
                        {activeTab === 'appearance' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div>
                                    <h3 className="text-xl font-black text-foreground tracking-tight">Personalización Visual</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Ajusta la interfaz del CRM a tus preferencias y marca.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-black text-foreground mb-4">Tema del Sistema</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                onClick={() => toggleTheme('dark')}
                                                className={clsx(
                                                    "flex flex-col items-center gap-3 p-6 rounded-2xl transition-all border-2",
                                                    themeMode === 'dark' ? "bg-primary/5 border-primary" : "bg-muted border-border hover:border-primary/30"
                                                )}
                                            >
                                                <Moon className={clsx("w-8 h-8", themeMode === 'dark' ? "text-primary" : "opacity-40")} />
                                                <span className="text-xs font-black uppercase tracking-wide text-foreground">Dark Mode</span>
                                            </button>
                                            <button
                                                onClick={() => toggleTheme('light')}
                                                className={clsx(
                                                    "flex flex-col items-center gap-3 p-6 rounded-2xl transition-all border-2",
                                                    themeMode === 'light' ? "bg-primary/5 border-primary" : "bg-muted border-border hover:border-primary/30"
                                                )}
                                            >
                                                <Sun className={clsx("w-8 h-8", themeMode === 'light' ? "text-primary" : "opacity-40")} />
                                                <span className="text-xs font-black uppercase tracking-wide text-foreground">Light Mode</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-sm font-black text-foreground mb-4">Color Primario</h4>
                                        <div className="flex flex-wrap gap-3">
                                            {['#FAB510', '#3B82F6', '#EF4444', '#10B981', '#8B5CF6'].map((color) => (
                                                <button
                                                    key={color}
                                                    onClick={() => updatePrimaryColor(color)}
                                                    className={clsx(
                                                        "w-11 h-11 rounded-xl border-4 transition-all hover:scale-110 shadow-sm",
                                                        primaryColor === color ? "border-foreground/40" : "border-transparent"
                                                    )}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-border space-y-5">
                                    <h4 className="text-sm font-black text-foreground mb-4">Layout del Panel</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {[
                                            { id: 'classic', name: 'Sidebar Clásico', desc: 'Menú fijo a la izquierda', icon: Layout },
                                            { id: 'compact', name: 'Navegación Compacta', desc: 'Solo iconos laterales', icon: Layout },
                                            { id: 'top', name: 'Menú Superior', desc: 'Acceso desde el header', icon: Layout },
                                        ].map((layout) => (
                                            <div
                                                key={layout.id}
                                                onClick={() => updateLayout(layout.id)}
                                                className={clsx(
                                                    "p-5 border rounded-xl cursor-pointer hover:border-primary/30 transition-all group",
                                                    layoutMode === layout.id ? "border-primary bg-primary/5" : "bg-muted border-border"
                                                )}
                                            >
                                                <layout.icon className={clsx("w-7 h-7 mb-3 transition-transform group-hover:scale-110", layoutMode === layout.id ? "text-primary" : "opacity-30")} />
                                                <h5 className="text-sm font-black mb-0.5 text-foreground">{layout.name}</h5>
                                                <p className="text-xs text-muted-foreground">{layout.desc}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Integraciones API */}
                        {activeTab === 'integrations' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-xl font-black text-foreground tracking-tight">Configuración de Conexiones Maestras</h3>
                                        <p className="text-sm text-muted-foreground mt-1">Estas llaves son el motor principal del sistema. Úsalas con precaución.</p>
                                    </div>
                                    <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 gap-1.5">
                                        <Shield className="w-3 h-3" />
                                        Seguridad Activa
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* Gemini & Resend APIs */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {/* Gemini */}
                                        <div className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
                                                    <Zap className="w-5 h-5 text-primary" />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-base text-foreground tracking-tight">Google Gemini AI</h4>
                                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide">Cerebro IA MiWibi</p>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">API Key</label>
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    value={settings.geminiKey || ''}
                                                    onChange={(e) => updateSettings({ geminiKey: e.target.value })}
                                                    placeholder="AIzaSy..."
                                                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                />
                                            </div>
                                        </div>

                                        {/* Google Calendar */}
                                        <div className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                                                        <path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3z" fill="#4285F4"/>
                                                        <path d="M12 8.25a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z" fill="white"/>
                                                        <path d="M12 3v2.25M12 18.75V21M3 12H.75M23.25 12H21" stroke="white" strokeWidth="1.5"/>
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-base text-foreground tracking-tight">Google Calendar</h4>
                                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide">
                                                        {settings.googleClientId ? 'Configurado' : 'Sin configurar'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">OAuth Client ID</label>
                                                <input
                                                    type="text"
                                                    value={settings.googleClientId || ''}
                                                    onChange={(e) => updateSettings({ googleClientId: e.target.value.trim() })}
                                                    placeholder="XXXXXXXXXX-xxxx.apps.googleusercontent.com"
                                                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                <span className="text-blue-500 font-black">¿Cómo obtenerlo?</span> Ve a <strong>console.cloud.google.com</strong> → APIs y Servicios → Credenciales → Crear credencial → ID de cliente OAuth 2.0 → Aplicación web. Agrega <strong>crm-sand-three.vercel.app</strong> como origen autorizado.
                                            </p>
                                        </div>

                                        {/* Resend */}
                                        <div className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                                    <Mail className="w-5 h-5 text-emerald-500" />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-base text-foreground tracking-tight">Resend Email Service</h4>
                                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide">Envíos Transaccionales</p>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">API Key</label>
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    value={settings.resendKey || ''}
                                                    onChange={(e) => updateSettings({ resendKey: e.target.value })}
                                                    placeholder="re_..."
                                                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* WooCommerce */}
                                    <div className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-5">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/20">
                                                    <Globe className="w-5 h-5 text-purple-400" />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-base text-foreground tracking-tight">WooCommerce (arteconcreto.co)</h4>
                                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide">Sincronización de Catálogo</p>
                                                </div>
                                            </div>
                                            <div className={clsx(
                                                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border",
                                                settings.wooUrl && settings.wooKey && settings.wooSecret
                                                    ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
                                                    : "text-muted-foreground bg-muted border-border"
                                            )}>
                                                {settings.wooUrl && settings.wooKey && settings.wooSecret ? 'Configurado' : 'Sin configurar'}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5 md:col-span-2">
                                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">URL de la Tienda</label>
                                                <input
                                                    type="text"
                                                    value={settings.wooUrl || ''}
                                                    onChange={(e) => updateSettings({ wooUrl: e.target.value })}
                                                    placeholder="https://arteconcreto.co"
                                                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Consumer Key</label>
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    value={settings.wooKey || ''}
                                                    onChange={(e) => updateSettings({ wooKey: e.target.value })}
                                                    placeholder="ck_xxxxxxxxxxxxxxxxxxxx"
                                                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Consumer Secret</label>
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    value={settings.wooSecret || ''}
                                                    onChange={(e) => updateSettings({ wooSecret: e.target.value })}
                                                    placeholder="cs_xxxxxxxxxxxxxxxxxxxx"
                                                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-xl">
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                <span className="text-purple-400 font-black">¿Cómo obtener las credenciales?</span> En tu WordPress: <strong>WooCommerce → Ajustes → Avanzado → REST API → Crear nueva clave</strong>. Selecciona permiso <strong>Lectura/Escritura</strong> y copia las claves aquí.
                                            </p>
                                        </div>
                                    </div>

                                    {/* WhatsApp */}
                                    <div className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-6">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                                    <MessageCircle className="w-5 h-5 text-emerald-500" />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-base text-foreground tracking-tight">WhatsApp Business Cloud API</h4>
                                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide">Canal oficial de Meta</p>
                                                </div>
                                            </div>
                                            <div className={clsx("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border", whatsappStatusMeta.classes)}>
                                                {whatsappStatusMeta.label}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Access Token</label>
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    value={settings.whatsapp.accessToken || ''}
                                                    onChange={(e) => updateWhatsApp({ accessToken: e.target.value, status: e.target.value ? 'configured' : 'disconnected' })}
                                                    placeholder="EAA..."
                                                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Phone Number ID</label>
                                                <input
                                                    type="text"
                                                    value={settings.whatsapp.phoneNumberId || ''}
                                                    onChange={(e) => updateWhatsApp({ phoneNumberId: e.target.value, status: e.target.value ? 'configured' : 'disconnected' })}
                                                    placeholder="123456789012345"
                                                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Business Account ID</label>
                                                <input
                                                    type="text"
                                                    value={settings.whatsapp.businessAccountId || ''}
                                                    onChange={(e) => updateWhatsApp({ businessAccountId: e.target.value })}
                                                    placeholder="1029384756"
                                                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Verify Token</label>
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    value={settings.whatsapp.verifyToken || ''}
                                                    onChange={(e) => updateWhatsApp({ verifyToken: e.target.value })}
                                                    placeholder="miwibi_verify_token"
                                                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Display Number</label>
                                                <input
                                                    type="text"
                                                    value={settings.whatsapp.displayPhoneNumber || ''}
                                                    onChange={(e) => updateWhatsApp({ displayPhoneNumber: e.target.value })}
                                                    placeholder="+57 300 123 4567"
                                                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Webhook URL</label>
                                                <input
                                                    type="text"
                                                    value={settings.whatsapp.webhookUrl || ''}
                                                    onChange={(e) => updateWhatsApp({ webhookUrl: e.target.value })}
                                                    placeholder="https://tu-dominio.com/api/whatsapp/webhook"
                                                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_auto] gap-3">
                                            <input
                                                type="text"
                                                value={whatsAppTestTo}
                                                onChange={(e) => setWhatsAppTestTo(e.target.value)}
                                                placeholder="Numero de prueba en formato internacional. Ej: 573001234567"
                                                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                            />
                                            <button
                                                onClick={handleWhatsAppHealthCheck}
                                                disabled={isTestingWhatsApp || !settings.whatsapp.accessToken || !settings.whatsapp.phoneNumberId}
                                                className="bg-white border border-border text-foreground font-semibold rounded-xl px-4 py-2.5 hover:bg-muted transition-all disabled:opacity-50 text-sm"
                                            >
                                                {isTestingWhatsApp ? 'Validando...' : 'Validar Canal'}
                                            </button>
                                            <button
                                                onClick={handleWhatsAppTestMessage}
                                                disabled={isSendingWhatsApp || !whatsAppTestTo || !settings.whatsapp.accessToken || !settings.whatsapp.phoneNumberId}
                                                className="bg-primary text-black font-bold rounded-xl px-4 py-2.5 hover:brightness-105 transition-all disabled:opacity-50 text-sm"
                                            >
                                                {isSendingWhatsApp ? 'Enviando...' : 'Enviar Prueba'}
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div className="p-4 bg-muted border border-border rounded-xl">
                                                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Webhook Meta</p>
                                                <p className="mt-1.5 text-xs font-bold text-foreground break-all">/api/whatsapp/webhook</p>
                                            </div>
                                            <div className="p-4 bg-muted border border-border rounded-xl">
                                                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Ultima validación</p>
                                                <p className="mt-1.5 text-xs font-bold text-foreground">{settings.whatsapp.lastVerifiedAt ? new Date(settings.whatsapp.lastVerifiedAt).toLocaleString('es-CO') : 'Sin validar'}</p>
                                            </div>
                                            <div className="p-4 bg-muted border border-border rounded-xl">
                                                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Último error</p>
                                                <p className="mt-1.5 text-xs font-bold text-foreground">{settings.whatsapp.lastError || 'Ninguno'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Connection Status Helper */}
                                    <div className="flex items-center gap-4 p-5 bg-primary/5 border border-primary/20 rounded-xl">
                                        <Activity className="w-4 h-4 text-primary animate-pulse shrink-0" />
                                        <p className="text-sm text-foreground leading-snug">
                                            <span className="text-primary font-black uppercase block mb-0.5 tracking-wide text-xs">Información de Sincronización</span>
                                            Para WhatsApp Business ya quedaron listos el webhook, la validación del canal y el endpoint de envío. En producción, el token debe migrarse a variables de entorno del servidor.
                                        </p>
                                    </div>
                                </div>

                                {/* Production Order Email Config */}
                                <div className="pt-8 border-t border-border space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                            <Mail className="w-4 h-4 text-emerald-500" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-foreground">Ordenes de Producción Automáticas</h4>
                                            <p className="text-xs text-muted-foreground mt-0.5">Cuando se cierra una venta, el sistema envía automáticamente la orden a estos correos.</p>
                                        </div>
                                    </div>

                                    {/* Recipient Emails */}
                                    <div className="bg-muted border border-border rounded-xl p-5 space-y-5">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Correos Destinatarios de Producción</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="email"
                                                    id="new-production-email"
                                                    placeholder="produccion@arteconcreto.co"
                                                    className="flex-1 bg-white border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary transition-all"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const input = e.target as HTMLInputElement;
                                                            const email = input.value.trim();
                                                            if (email && email.includes('@') && !(settings as any).productionEmails?.includes(email)) {
                                                                updateSettings({ productionEmails: [...((settings as any).productionEmails || []), email] } as any);
                                                                input.value = '';
                                                            }
                                                        }
                                                    }}
                                                />
                                                <button
                                                    onClick={() => {
                                                        const input = document.getElementById('new-production-email') as HTMLInputElement;
                                                        const email = input?.value.trim();
                                                        if (email && email.includes('@') && !(settings as any).productionEmails?.includes(email)) {
                                                            updateSettings({ productionEmails: [...((settings as any).productionEmails || []), email] } as any);
                                                            input.value = '';
                                                        }
                                                    }}
                                                    className="bg-primary text-black font-bold rounded-xl px-4 py-2.5 hover:brightness-105 transition-all flex items-center gap-2 text-sm"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Agregar
                                                </button>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-2">Presiona Enter o el botón para agregar. Puedes agregar múltiples correos.</p>
                                        </div>

                                        {/* Email Tags */}
                                        {((settings as any).productionEmails || []).length > 0 ? (
                                            <div className="space-y-2">
                                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Destinatarios Actuales</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {((settings as any).productionEmails || []).map((email: string) => (
                                                        <div key={email} className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl group hover:border-rose-500/40 transition-all">
                                                            <Mail className="w-3 h-3 text-emerald-500" />
                                                            <span className="text-xs font-bold text-foreground">{email}</span>
                                                            <button
                                                                onClick={() => updateSettings({ productionEmails: ((settings as any).productionEmails || []).filter((e: string) => e !== email) } as any)}
                                                                className="text-muted-foreground hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-5 text-muted-foreground/50">
                                                <Mail className="w-7 h-7 mx-auto mb-2 opacity-20" />
                                                <p className="text-xs font-bold uppercase tracking-wide">Sin destinatarios configurados</p>
                                                <p className="text-xs mt-1">Agrega al menos un correo para activar las órdenes automáticas</p>
                                            </div>
                                        )}

                                        {/* Status indicator */}
                                        <div className={clsx(
                                            "flex items-center gap-3 p-3 rounded-xl border",
                                            ((settings as any).productionEmails || []).length > 0
                                                ? "bg-emerald-500/5 border-emerald-500/20"
                                                : "bg-white border-border"
                                        )}>
                                            <div className={clsx(
                                                "w-2 h-2 rounded-full shrink-0",
                                                ((settings as any).productionEmails || []).length > 0 ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30"
                                            )}></div>
                                            <span className="text-xs font-bold text-muted-foreground">
                                                {((settings as any).productionEmails || []).length > 0
                                                    ? `Sistema Activo — ${((settings as any).productionEmails || []).length} destinatario(s) configurados`
                                                    : 'Sistema Inactivo — Agrega correos para activar'
                                                }
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Base de Datos */}
                        {activeTab === 'data' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-xl font-black text-foreground tracking-tight">Gestión de Base de Datos</h3>
                                        <p className="text-sm text-muted-foreground mt-1">Controla el almacenamiento y el estado de tus datos.</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button className="p-2.5 bg-muted border border-border rounded-xl hover:bg-muted/80 transition-all">
                                            <RefreshCw className="w-4 h-4 text-foreground" />
                                        </button>
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs font-black text-emerald-500 uppercase tracking-wide">Estado Online</span>
                                            <span className="text-xs text-muted-foreground">Latency: 24ms</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-3">
                                        <Activity className="w-5 h-5 text-primary" />
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-wide text-muted-foreground">Uso Actual</h4>
                                            <p className="text-2xl font-black text-foreground tracking-tight">1.2 GB</p>
                                        </div>
                                        <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-primary w-[65%] h-full rounded-full"></div>
                                        </div>
                                    </div>
                                    <div className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-3">
                                        <Cloud className="w-5 h-5 text-sky-500" />
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-wide text-muted-foreground">Tablas Sync</h4>
                                            <p className="text-2xl font-black text-foreground tracking-tight">42/42</p>
                                        </div>
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600">Sincronizado</span>
                                    </div>
                                    <div className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-3">
                                        <Save className="w-5 h-5 text-emerald-500" />
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-wide text-muted-foreground">Próximo Backup</h4>
                                            <p className="text-xl font-black text-foreground tracking-tight">En 14h 22m</p>
                                        </div>
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Auto-Backup Diario</span>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-border space-y-4">
                                    <h4 className="text-sm font-black text-foreground mb-4">Acciones de Datos</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <button className="flex items-center justify-between p-4 bg-muted hover:bg-muted/80 border border-border rounded-xl transition-all group">
                                            <div className="flex items-center gap-3">
                                                <Download className="w-4 h-4 text-primary group-hover:translate-y-1 transition-transform" />
                                                <span className="text-sm font-bold text-foreground">Exportar Base de Datos (SQL/CSV)</span>
                                            </div>
                                            <Check className="w-4 h-4 opacity-20" />
                                        </button>
                                        <button className="flex items-center justify-between p-4 bg-rose-500/5 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/10 rounded-xl transition-all">
                                            <div className="flex items-center gap-3">
                                                <Trash className="w-4 h-4" />
                                                <span className="text-sm font-bold">Limpiar Cache y Logs Temporales</span>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-border space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-black text-foreground">Variables Maestras (Globales)</h4>
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">Modo Administrador</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Cities Management */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Listado de Ciudades</label>
                                                <span className="text-xs text-muted-foreground">{settings.cities.length} Registradas</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Nombre Ciudad..."
                                                    className="flex-1 bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                    value={newCity}
                                                    onChange={(e) => setNewCity(e.target.value)}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Depto..."
                                                    className="w-1/3 bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                    value={newCityDept}
                                                    onChange={(e) => setNewCityDept(e.target.value)}
                                                />
                                                <button
                                                    onClick={() => {
                                                        if (newCity && newCityDept) {
                                                            updateSettings({ cities: [...settings.cities, { name: newCity, department: newCityDept }] });
                                                            setNewCity('');
                                                            setNewCityDept('');
                                                        }
                                                    }}
                                                    className="p-2.5 bg-primary text-black rounded-xl hover:brightness-105 transition-all"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-1">
                                                {settings.cities.map((city) => (
                                                    <div key={`${city.name}-${city.department}`} className="flex items-center gap-2 bg-muted border border-border px-3 py-1.5 rounded-lg group hover:border-primary/40 transition-all">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-foreground leading-none">{city.name}</span>
                                                            <span className="text-[9px] uppercase tracking-tight text-muted-foreground font-bold">{city.department}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => updateSettings({ cities: settings.cities.filter(c => c.name !== city.name) })}
                                                            className="text-muted-foreground hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all ml-1"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Sectors Management */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Sectores Industriales</label>
                                                <span className="text-xs text-muted-foreground">{settings.sectors.length} Registrados</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Nuevo sector..."
                                                    className="flex-1 bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                    value={newSector}
                                                    onChange={(e) => setNewSector(e.target.value)}
                                                />
                                                <button
                                                    onClick={() => {
                                                        if (newSector) {
                                                            updateSettings({ sectors: [...settings.sectors, newSector] });
                                                            setNewSector('');
                                                        }
                                                    }}
                                                    className="p-2.5 bg-primary text-black rounded-xl hover:brightness-105 transition-all"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-1">
                                                {settings.sectors.map((sector) => (
                                                    <div key={sector} className="flex items-center gap-2 bg-muted border border-border px-3 py-1.5 rounded-lg group hover:border-primary/40 transition-all">
                                                        <span className="text-xs font-bold text-foreground">{sector}</span>
                                                        <button
                                                            onClick={() => updateSettings({ sectors: settings.sectors.filter(s => s !== sector) })}
                                                            className="text-muted-foreground hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all ml-1"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Licencia del Sistema */}
                        {activeTab === 'license' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div>
                                    <h3 className="text-xl font-black text-foreground tracking-tight">Licenciamiento Digital</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Control de integridad validado por MiWibi Intelligence Security.</p>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                                <Key className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-foreground">Llave de Activación</h4>
                                                <p className="text-xs text-muted-foreground mt-0.5 font-bold uppercase tracking-wide">Enterprise Format</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="relative group">
                                                <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary group-focus-within:animate-pulse" />
                                                <input
                                                    type="text"
                                                    placeholder="AC-RRRR-TTTT-2026"
                                                    className="w-full bg-muted border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:bg-white transition-all font-mono uppercase placeholder:opacity-30 tracking-widest"
                                                />
                                            </div>
                                            <button className="w-full bg-primary text-black font-bold rounded-xl px-4 py-2.5 hover:brightness-105 transition-all">
                                                Validar y Sincronizar
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-white border border-border rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center text-center space-y-5 relative overflow-hidden group">
                                        <div className="absolute top-3 right-3">
                                            <Shield className="w-16 h-16 opacity-[0.04] rotate-12 group-hover:rotate-0 transition-transform duration-700" />
                                        </div>
                                        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                                            <Check className="w-8 h-8 text-emerald-500" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <h5 className="text-xs font-black uppercase text-emerald-600 tracking-widest">Producto Original</h5>
                                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide">Registrado para ArteConcreto S.A.S</p>
                                            <div className="pt-3">
                                                <span className="text-xs text-muted-foreground/60 bg-muted px-3 py-1 rounded-full border border-border">Expira en: 312 días</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
