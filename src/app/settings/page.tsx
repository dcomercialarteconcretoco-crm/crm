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
            classes: 'text-muted-foreground bg-muted/30 border-border',
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
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2">
                <div>
                    <h1 className="text-2xl lg:text-4xl font-black tracking-tighter text-foreground">Configuración</h1>
                    <p className="text-muted-foreground text-[10px] lg:text-sm font-medium uppercase tracking-[0.2em] lg:normal-case lg:tracking-normal mt-1">Administra tu perfil e inteligencia del CRM.</p>
                </div>
                <button className="bg-primary text-black font-black px-6 lg:px-8 py-3.5 lg:py-4 rounded-xl lg:rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/10 w-full lg:w-auto text-[10px] lg:text-xs uppercase tracking-widest">
                    <Save className="w-4 h-4 lg:w-5 lg:h-5" />
                    <span>Guardar Cambios</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Side Navigation */}
                <div className="lg:col-span-3 flex lg:flex-col overflow-x-auto lg:overflow-x-visible items-center lg:items-stretch gap-2 pb-4 lg:pb-0 scrollbar-hide">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveTab(cat.id)}
                            className={clsx(
                                "flex items-center gap-4 px-5 py-3.5 lg:px-6 lg:py-4 rounded-xl lg:rounded-2xl text-[9px] lg:text-sm font-black uppercase tracking-widest transition-all border whitespace-nowrap",
                                activeTab === cat.id
                                    ? "bg-primary/10 text-primary border-primary/20 shadow-lg shadow-primary/5"
                                    : "text-muted-foreground hover:bg-accent/10 border-transparent"
                            )}
                        >
                            <cat.icon className={clsx(
                                "w-4 h-4 lg:w-5 lg:h-5 transition-transform",
                                activeTab === cat.id && "scale-110"
                            )} />
                            <span className="text-left">{cat.name}</span>
                        </button>
                    ))}
                    <div className="lg:pt-6">
                        <button className="flex items-center gap-4 px-5 py-3.5 lg:px-6 lg:py-4 rounded-xl lg:rounded-2xl text-[9px] lg:text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-500/5 transition-all group whitespace-nowrap">
                            <LogOut className="w-4 h-4 lg:w-5 lg:h-5 group-hover:-translate-x-1 transition-transform" />
                            Salir
                        </button>
                    </div>
                </div>

                {/* Tab Content Area */}
                <div className="lg:col-span-9">
                    <div className="bg-card text-card-foreground border border-border lg:rounded-[2.5rem] rounded-[2rem] p-6 lg:p-10 min-h-[500px] lg:min-h-[600px] shadow-2xl backdrop-blur-sm relative overflow-hidden">

                        {/* Tab: Intelligence Engine (Cerebro) */}
                        {activeTab === 'intelligence' && (
                            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h3 className="text-2xl font-black tracking-tight text-foreground mb-2">Motor de Inteligencia (MiWibi Engine)</h3>
                                        <p className="text-sm text-muted-foreground font-medium">Configura la lógica de razonamiento y monitorea el consumo de IA.</p>
                                    </div>
                                    <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-3xl border border-border">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Switch Maestro</span>
                                            <span className={clsx("text-xs font-black uppercase", aiActive ? "text-emerald-500" : "text-rose-500")}>
                                                {aiActive ? 'Motor Activo' : 'Motor Pausado'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => setAiActive(!aiActive)}
                                            className={clsx(
                                                "w-14 h-8 rounded-full relative transition-all duration-300",
                                                aiActive ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]" : "bg-muted"
                                            )}
                                        >
                                            <div className={clsx(
                                                "absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-lg",
                                                aiActive ? "left-7" : "left-1"
                                            )}></div>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Prompt Mastery */}
                                    <div className="md:col-span-2 p-8 bg-muted/5 border border-border rounded-[2.5rem] space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                                <Smartphone className="w-5 h-5 text-primary" />
                                            </div>
                                            <h4 className="text-sm font-black uppercase tracking-[0.2em] text-foreground">Lógica de Razonamiento Principal</h4>
                                        </div>
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">System Prompt (Personalidad de la IA)</label>
                                            <textarea
                                                className="w-full h-40 bg-muted/20 border border-border rounded-2xl p-6 text-sm focus:border-primary/50 outline-none transition-all font-medium leading-relaxed text-foreground shadow-inner"
                                                defaultValue="Eres el asistente experto de Arte Concreto. Tu objetivo es calificar prospectos basados en su interés por mobiliario urbano, cubiertas de mármol y soluciones de diseño en concreto. Prioriza contratos de suministro masivo para constructoras y entidades públicas (parques, plazas). Usa un tono profesional y ejecutivo."
                                            />
                                            <div className="flex items-center justify-between">
                                                <p className="text-[10px] text-muted-foreground font-medium italic">Actualización instantánea aplicada a todos los nuevos leads.</p>
                                                <button className="text-[10px] font-black uppercase text-primary tracking-widest hover:opacity-80 transition-opacity">Resetear a Default</button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Data Isolation & Security */}
                                    <div className="p-8 bg-muted/5 border border-border rounded-[2.5rem] space-y-6">
                                        <h4 className="text-xs font-black uppercase tracking-[0.2em] opacity-40">Infraestructura y Consumo</h4>
                                        <div className="space-y-6">
                                            <div>
                                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                                                    <span>Uso de Tokens (Mensual)</span>
                                                    <span className="text-muted-foreground">Gemini Flash</span>
                                                </div>
                                                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(250,181,16,0.3)]" style={{ width: '0%' }}></div>
                                                </div>
                                                <p className="text-[9px] text-muted-foreground mt-1">El consumo real se gestiona desde la consola de Google AI Studio.</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                                                    <span className="text-[9px] font-black text-muted-foreground uppercase block mb-1">Cerebro Principal</span>
                                                    <span className="text-xs font-bold text-foreground uppercase flex items-center gap-2">
                                                        <Zap className="w-3 h-3 text-primary" /> Gemini 2.0 Flash
                                                    </span>
                                                </div>
                                                <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                                                    <span className="text-[9px] font-black text-muted-foreground uppercase block mb-1">API Key</span>
                                                    <span className="text-xs font-bold uppercase flex items-center gap-1">
                                                        <Check className="w-3 h-3 text-emerald-500" />
                                                        <span className="text-emerald-500">{settings.geminiKey ? 'Configurada' : 'Sin configurar'}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-8 bg-muted/5 border border-border rounded-[2.5rem] space-y-6">
                                        <h4 className="text-xs font-black uppercase tracking-[0.2em] opacity-40">Audit & Reasoning Logs</h4>
                                        <div className="space-y-4">
                                            {[
                                                { label: 'Guardar pasos de razonamiento', active: true },
                                                { label: 'Explicar Score a Vendedores', active: true },
                                                { label: 'Optimización Automática de Prompts', active: false },
                                            ].map((opt) => (
                                                <div key={opt.label} className="flex items-center justify-between">
                                                    <span className="text-[11px] font-bold opacity-70">{opt.label}</span>
                                                    <button className={clsx(
                                                        "w-10 h-5 rounded-full relative transition-all",
                                                        opt.active ? "bg-primary" : "bg-muted"
                                                    )}>
                                                        <div className={clsx(
                                                            "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                                                            opt.active ? "left-6" : "left-1"
                                                        )}></div>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <button className="w-full py-4 border border-border rounded-2xl text-[10px] font-black uppercase tracking-widest opacity-40 hover:bg-muted transition-all">
                                            Limpiar Logs de la IA
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Perfil de Usuario */}
                        {activeTab === 'profile' && (
                            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center gap-8">
                                    <div className="relative group">
                                        <div className="w-28 h-28 rounded-[2rem] bg-primary flex items-center justify-center text-black font-black text-4xl shadow-[0_0_30px_rgba(250,181,16,0.2)] border-4 border-background overflow-hidden">
                                            {currentUser?.name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() || 'AC'}
                                        </div>
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-[2rem] cursor-pointer">
                                            <Save className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-2xl font-black tracking-tight text-foreground">{currentUser?.name || 'Usuario'}</h3>
                                        <p className="text-sm font-bold text-primary uppercase tracking-widest">{currentUser?.role || 'Administrador'}</p>
                                        <button className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-colors mt-2">Cambiar Avatar</button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] pl-1">Nombre Completo</label>
                                        <input
                                            type="text"
                                            defaultValue={currentUser?.name || ''}
                                            className="w-full bg-muted/20 border border-border rounded-2xl px-6 py-4 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] pl-1">Correo Electrónico</label>
                                        <input
                                            type="email"
                                            defaultValue={currentUser?.email || ''}
                                            className="w-full bg-muted/20 border border-border rounded-2xl px-6 py-4 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] pl-1">Idioma</label>
                                        <select className="w-full bg-muted/20 border border-border rounded-2xl px-6 py-4 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground appearance-none cursor-pointer">
                                            <option className="bg-card">Español (Colombia)</option>
                                            <option className="bg-card">English (US)</option>
                                            <option className="bg-card">Português (Brasil)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] pl-1">Zona Horaria</label>
                                        <div className="flex items-center gap-3 bg-muted/20 border border-border rounded-2xl px-6 py-4 text-sm font-bold text-foreground">
                                            <Globe className="w-4 h-4 text-primary" />
                                            Bogotá, COL (GMT-5)
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-10 border-t border-border">
                                    <div className="flex items-center gap-3 mb-8">
                                        <Check className="w-5 h-5 text-emerald-500" />
                                        <h4 className="text-xs font-black uppercase tracking-[0.3em] opacity-40">Integraciones Activas</h4>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {[
                                            { name: 'WhatsApp Business', status: whatsappStatusMeta.label, icon: MessageCircle, color: settings.whatsapp.status === 'connected' ? 'text-emerald-500' : settings.whatsapp.status === 'error' ? 'text-rose-500' : 'text-amber-500' },
                                            { name: 'WooCommerce', status: 'Conectado', icon: Cloud, color: 'text-sky-500' },
                                            { name: 'Google Calendar', status: 'Conectado', icon: Calendar, color: 'text-emerald-500' },
                                        ].map((int) => (
                                            <div key={int.name} className="flex items-center justify-between p-6 bg-muted/10 border border-border rounded-3xl hover:border-primary/20 transition-all group">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-muted/50 rounded-xl group-hover:scale-110 transition-transform">
                                                        <int.icon className={clsx("w-5 h-5", int.color)} />
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <span className="text-sm font-black block text-foreground">{int.name}</span>
                                                        <span className={clsx(
                                                            "text-[9px] font-black uppercase tracking-widest",
                                                            int.status === 'Conectado' ? "text-emerald-500" : int.status === 'Error' ? 'text-rose-500' : 'text-amber-500'
                                                        )}>{int.status}</span>
                                                    </div>
                                                </div>
                                                {int.status === 'Conectado' ? (
                                                    <Check className="w-5 h-5 text-emerald-500" />
                                                ) : (
                                                    <button className="text-[9px] font-black text-primary uppercase tracking-[0.2em] hover:opacity-80 transition-opacity">Conectar</button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Notificaciones */}
                        {activeTab === 'notifications' && (
                            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div>
                                    <h3 className="text-2xl font-black tracking-tight text-foreground mb-2">Preferencias de Notificación</h3>
                                    <p className="text-sm text-muted-foreground font-medium">Controla cómo y cuándo recibes alertas del sistema.</p>
                                </div>

                                <div className="space-y-4">
                                    {[
                                        { title: 'Nuevos Leads', desc: 'Recibe una alerta inmediata cuando entra un prospecto.', type: 'Push + Email' },
                                        { title: 'Actualización de Pipeline', desc: 'Notificar cuando un lead cambia de etapa.', type: 'Push' },
                                        { title: 'Recordatorios de Tareas', desc: 'Alertas sobre citas y llamadas pendientes.', type: 'Push + WhatsApp' },
                                        { title: 'Reportes Semanales', desc: 'Resumen ejecutivo de ventas todos los lunes.', type: 'Email' },
                                    ].map((pref) => (
                                        <div key={pref.title} className="flex items-center justify-between p-8 bg-muted/10 border border-border rounded-[2rem] hover:border-primary/20 transition-all">
                                            <div className="space-y-1">
                                                <h4 className="text-sm font-black text-foreground">{pref.title}</h4>
                                                <p className="text-[11px] text-muted-foreground font-medium">{pref.desc}</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-[10px] font-black text-primary/50 uppercase tracking-widest bg-primary/5 px-3 py-1 rounded-full">{pref.type}</span>
                                                <button className="w-12 h-6 bg-primary rounded-full relative p-1 transition-all">
                                                    <div className="w-4 h-4 bg-background rounded-full absolute right-1"></div>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tab: Seguridad */}
                        {activeTab === 'security' && (
                            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div>
                                    <h3 className="text-2xl font-black tracking-tight text-foreground mb-2">Seguridad y Privacidad</h3>
                                    <p className="text-sm text-muted-foreground font-medium">Gestiona tu contraseña y métodos de autenticación.</p>
                                </div>

                                <div className="space-y-8">
                                    <div className="p-8 bg-muted/10 border border-border rounded-[2rem] space-y-6">
                                        <div className="flex items-center gap-3">
                                            <Lock className="w-5 h-5 text-primary" />
                                            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Cambiar Contraseña</h4>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Contraseña Actual"
                                                    className="w-full bg-muted/20 border border-border rounded-2xl px-6 py-4 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground shadow-inner"
                                                />
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Nueva Contraseña"
                                                    className="w-full bg-muted/20 border border-border rounded-2xl px-6 py-4 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground shadow-inner"
                                                />
                                            </div>
                                            <button
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-80 transition-opacity ml-1"
                                            >
                                                {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                {showPassword ? 'Ocultar Contraseña' : 'Ver Contraseña'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-8 bg-muted/5 rounded-[2rem] border border-border flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-primary/10 rounded-xl">
                                                <Smartphone className="w-5 h-5 text-primary" />
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className="text-sm font-black uppercase tracking-tight text-foreground">Autenticación de 2 Factores</h4>
                                                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">Altamente recomendado</p>
                                            </div>
                                        </div>
                                        <button className="bg-muted hover:bg-muted/80 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-border transition-all text-foreground">Activar</button>
                                    </div>

                                    <div className="p-8 bg-muted/5 rounded-[2rem] border border-border flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-rose-500/10 rounded-xl">
                                                <Download className="w-5 h-5 text-rose-500" />
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className="text-sm font-black uppercase tracking-tight text-foreground">Permitir Exportación de Datos</h4>
                                                <p className="text-[10px] items-center text-muted-foreground font-black uppercase tracking-wider">
                                                    Habilita la descarga de CSVs {settings.allowExports ? '(Activado)' : '(Desactivado)'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => updateSettings({ allowExports: !settings.allowExports })}
                                            className={clsx(
                                                "w-12 h-6 rounded-full relative p-1 transition-all",
                                                settings.allowExports ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-muted"
                                            )}
                                        >
                                            <div className={clsx(
                                                "w-4 h-4 bg-white rounded-full absolute transition-all",
                                                settings.allowExports ? "right-1" : "left-1"
                                            )}></div>
                                        </button>
                                    </div>

                                    <div className="p-8 bg-muted/5 rounded-[2rem] border border-rose-500/20 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-rose-500/10 rounded-xl">
                                                <Lock className="w-5 h-5 text-rose-500" />
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className="text-sm font-black uppercase tracking-tight text-foreground">Bloquear Capturas de Pantalla</h4>
                                                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">
                                                    Desactiva selección de texto e impresión {settings.blockScreenshots ? <span className="text-rose-400">(ACTIVO — Protegido)</span> : <span className="text-emerald-500">(Desactivado)</span>}
                                                </p>
                                                <p className="text-[9px] text-muted-foreground/40 italic">Nota: No bloquea capturas nativas del SO. Disuade fugas digitales.</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => updateSettings({ blockScreenshots: !settings.blockScreenshots })}
                                            className={clsx(
                                                "w-12 h-6 rounded-full relative p-1 transition-all",
                                                settings.blockScreenshots ? "bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]" : "bg-muted"
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
                            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div>
                                    <h3 className="text-2xl font-black tracking-tight text-foreground mb-2">Personalización Visual</h3>
                                    <p className="text-sm text-muted-foreground font-medium">Ajusta la interfaz del CRM a tus preferencias y marca.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-6">
                                        <h4 className="text-xs font-black uppercase tracking-[0.2em] opacity-40">Tema del Sistema</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                onClick={() => toggleTheme('dark')}
                                                className={clsx(
                                                    "flex flex-col items-center gap-4 p-8 rounded-3xl transition-all border-2",
                                                    themeMode === 'dark' ? "bg-primary/5 border-primary" : "bg-card border-border hover:border-primary/30"
                                                )}
                                            >
                                                <Moon className={clsx("w-10 h-10", themeMode === 'dark' ? "text-primary" : "opacity-40")} />
                                                <span className="text-xs font-black uppercase tracking-widest text-foreground">Dark Mode</span>
                                            </button>
                                            <button
                                                onClick={() => toggleTheme('light')}
                                                className={clsx(
                                                    "flex flex-col items-center gap-4 p-8 rounded-3xl transition-all border-2",
                                                    themeMode === 'light' ? "bg-primary/5 border-primary" : "bg-card border-border hover:border-primary/30"
                                                )}
                                            >
                                                <Sun className={clsx("w-10 h-10", themeMode === 'light' ? "text-primary" : "opacity-40")} />
                                                <span className="text-xs font-black uppercase tracking-widest text-foreground">Light Mode</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <h4 className="text-xs font-black uppercase tracking-[0.2em] opacity-40">Color Primario</h4>
                                        <div className="flex flex-wrap gap-4">
                                            {['#FAB510', '#3B82F6', '#EF4444', '#10B981', '#8B5CF6'].map((color) => (
                                                <button
                                                    key={color}
                                                    onClick={() => updatePrimaryColor(color)}
                                                    className={clsx(
                                                        "w-12 h-12 rounded-2xl border-4 transition-all hover:scale-110 shadow-lg",
                                                        primaryColor === color ? "border-foreground/40 shadow-[0_0_20px_rgba(0,0,0,0.1)]" : "border-transparent"
                                                    )}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-10 border-t border-border space-y-8">
                                    <h4 className="text-xs font-black uppercase tracking-[0.2em] opacity-40">Layout del Panel</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {[
                                            { id: 'classic', name: 'Sidebar Clásico', desc: 'Menú fijo a la izquierda', icon: Layout },
                                            { id: 'compact', name: 'Navegación Compacta', desc: 'Solo iconos laterales', icon: Layout },
                                            { id: 'top', name: 'Menú Superior', desc: 'Acceso desde el header', icon: Layout },
                                        ].map((layout) => (
                                            <div
                                                key={layout.id}
                                                onClick={() => updateLayout(layout.id)}
                                                className={clsx(
                                                    "p-6 border rounded-3xl cursor-pointer hover:border-primary/20 transition-all group",
                                                    layoutMode === layout.id ? "border-primary bg-primary/5 shadow-lg shadow-primary/5" : "bg-card border-border"
                                                )}
                                            >
                                                <layout.icon className={clsx("w-8 h-8 mb-4 transition-transform group-hover:scale-110", layoutMode === layout.id ? "text-primary" : "opacity-20")} />
                                                <h5 className="text-sm font-black mb-1 text-foreground">{layout.name}</h5>
                                                <p className="text-[10px] text-muted-foreground font-medium">{layout.desc}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Integraciones API */}
                        {activeTab === 'integrations' && (
                            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-2xl font-black tracking-tight text-foreground mb-2">Configuración de Conexiones Maestras</h3>
                                        <p className="text-sm text-muted-foreground font-medium">Estas llaves son el motor principal del sistema. Úsalas con precaución.</p>
                                    </div>
                                    <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em]">
                                        <Shield className="w-3 h-3" />
                                        Seguridad Activa
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    {/* Gemini & Resend APIs */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Gemini */}
                                        <div className="p-8 bg-muted/5 border border-border rounded-[2.5rem] space-y-6">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                                                    <Zap className="w-6 h-6 text-primary" />
                                                </div>
                                                <div>
                                                    <h4 className="font-black tracking-tight text-lg text-foreground">Google Gemini AI</h4>
                                                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Cerebro IA MiWibi</p>
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">API Key</label>
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    value={settings.geminiKey || ''}
                                                    onChange={(e) => updateSettings({ geminiKey: e.target.value })}
                                                    placeholder="AIzaSy..."
                                                    className="w-full bg-muted/20 border border-border rounded-2xl px-6 py-4 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground"
                                                />
                                            </div>
                                        </div>

                                        {/* Google Calendar */}
                                        <div className="p-8 bg-muted/5 border border-border rounded-[2.5rem] space-y-6">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                                                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                                                        <path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3z" fill="#4285F4"/>
                                                        <path d="M12 8.25a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z" fill="white"/>
                                                        <path d="M12 3v2.25M12 18.75V21M3 12H.75M23.25 12H21" stroke="white" strokeWidth="1.5"/>
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h4 className="font-black tracking-tight text-lg text-foreground">Google Calendar</h4>
                                                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">
                                                        {settings.googleClientId ? '✅ Configurado' : 'Sin configurar'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">OAuth Client ID</label>
                                                <input
                                                    type="text"
                                                    value={settings.googleClientId || ''}
                                                    onChange={(e) => updateSettings({ googleClientId: e.target.value.trim() })}
                                                    placeholder="XXXXXXXXXX-xxxx.apps.googleusercontent.com"
                                                    className="w-full bg-muted/20 border border-border rounded-2xl px-6 py-4 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground"
                                                />
                                            </div>
                                            <p className="text-[10px] text-muted-foreground/60 font-bold leading-relaxed">
                                                <span className="text-blue-500 font-black">¿Cómo obtenerlo?</span> Ve a <strong>console.cloud.google.com</strong> → APIs y Servicios → Credenciales → Crear credencial → ID de cliente OAuth 2.0 → Aplicación web. Agrega <strong>crm-sand-three.vercel.app</strong> como origen autorizado.
                                            </p>
                                        </div>

                                        {/* Resend */}
                                        <div className="p-8 bg-muted/5 border border-border rounded-[2.5rem] space-y-6">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                                                    <Mail className="w-6 h-6 text-emerald-500" />
                                                </div>
                                                <div>
                                                    <h4 className="font-black tracking-tight text-lg text-foreground">Resend Email Service</h4>
                                                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Envíos Transaccionales</p>
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">API Key</label>
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    value={settings.resendKey || ''}
                                                    onChange={(e) => updateSettings({ resendKey: e.target.value })}
                                                    placeholder="re_..."
                                                    className="w-full bg-muted/20 border border-border rounded-2xl px-6 py-4 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* WooCommerce */}
                                    <div className="p-8 bg-muted/5 border border-border rounded-[2.5rem] space-y-6">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                                                    <Globe className="w-6 h-6 text-purple-400" />
                                                </div>
                                                <div>
                                                    <h4 className="font-black tracking-tight text-lg text-foreground">WooCommerce (arteconcreto.co)</h4>
                                                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Sincronización de Catálogo</p>
                                                </div>
                                            </div>
                                            <div className={clsx(
                                                "px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em]",
                                                settings.wooUrl && settings.wooKey && settings.wooSecret
                                                    ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                                                    : "text-muted-foreground bg-muted/30 border-border"
                                            )}>
                                                {settings.wooUrl && settings.wooKey && settings.wooSecret ? 'Configurado' : 'Sin configurar'}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-3 md:col-span-2">
                                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">URL de la Tienda</label>
                                                <input
                                                    type="text"
                                                    value={settings.wooUrl || ''}
                                                    onChange={(e) => updateSettings({ wooUrl: e.target.value })}
                                                    placeholder="https://arteconcreto.co"
                                                    className="w-full bg-muted/20 border border-border rounded-2xl px-6 py-4 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Consumer Key</label>
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    value={settings.wooKey || ''}
                                                    onChange={(e) => updateSettings({ wooKey: e.target.value })}
                                                    placeholder="ck_xxxxxxxxxxxxxxxxxxxx"
                                                    className="w-full bg-muted/20 border border-border rounded-2xl px-6 py-4 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Consumer Secret</label>
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    value={settings.wooSecret || ''}
                                                    onChange={(e) => updateSettings({ wooSecret: e.target.value })}
                                                    placeholder="cs_xxxxxxxxxxxxxxxxxxxx"
                                                    className="w-full bg-muted/20 border border-border rounded-2xl px-6 py-4 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground"
                                                />
                                            </div>
                                        </div>
                                        <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-2xl">
                                            <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
                                                <span className="text-purple-400 font-black">¿Cómo obtener las credenciales?</span> En tu WordPress: <strong>WooCommerce → Ajustes → Avanzado → REST API → Crear nueva clave</strong>. Selecciona permiso <strong>Lectura/Escritura</strong> y copia las claves aquí.
                                            </p>
                                        </div>
                                    </div>

                                    {/* WhatsApp */}
                                    <div className="p-8 bg-muted/5 border border-border rounded-[2.5rem] space-y-8">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                                                    <MessageCircle className="w-6 h-6 text-emerald-500" />
                                                </div>
                                                <div>
                                                    <h4 className="font-black tracking-tight text-lg text-foreground">WhatsApp Business Cloud API</h4>
                                                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Canal oficial de Meta</p>
                                                </div>
                                            </div>
                                            <div className={clsx("px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em]", whatsappStatusMeta.classes)}>
                                                {whatsappStatusMeta.label}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Access Token</label>
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    value={settings.whatsapp.accessToken || ''}
                                                    onChange={(e) => updateWhatsApp({ accessToken: e.target.value, status: e.target.value ? 'configured' : 'disconnected' })}
                                                    placeholder="EAA..."
                                                    className="w-full bg-muted/20 border border-border rounded-2xl px-6 py-4 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Phone Number ID</label>
                                                <input
                                                    type="text"
                                                    value={settings.whatsapp.phoneNumberId || ''}
                                                    onChange={(e) => updateWhatsApp({ phoneNumberId: e.target.value, status: e.target.value ? 'configured' : 'disconnected' })}
                                                    placeholder="123456789012345"
                                                    className="w-full bg-muted/20 border border-border rounded-2xl px-6 py-4 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Business Account ID</label>
                                                <input
                                                    type="text"
                                                    value={settings.whatsapp.businessAccountId || ''}
                                                    onChange={(e) => updateWhatsApp({ businessAccountId: e.target.value })}
                                                    placeholder="1029384756"
                                                    className="w-full bg-muted/20 border border-border rounded-2xl px-6 py-4 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Verify Token</label>
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    value={settings.whatsapp.verifyToken || ''}
                                                    onChange={(e) => updateWhatsApp({ verifyToken: e.target.value })}
                                                    placeholder="miwibi_verify_token"
                                                    className="w-full bg-muted/20 border border-border rounded-2xl px-6 py-4 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Display Number</label>
                                                <input
                                                    type="text"
                                                    value={settings.whatsapp.displayPhoneNumber || ''}
                                                    onChange={(e) => updateWhatsApp({ displayPhoneNumber: e.target.value })}
                                                    placeholder="+57 300 123 4567"
                                                    className="w-full bg-muted/20 border border-border rounded-2xl px-6 py-4 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Webhook URL</label>
                                                <input
                                                    type="text"
                                                    value={settings.whatsapp.webhookUrl || ''}
                                                    onChange={(e) => updateWhatsApp({ webhookUrl: e.target.value })}
                                                    placeholder="https://tu-dominio.com/api/whatsapp/webhook"
                                                    className="w-full bg-muted/20 border border-border rounded-2xl px-6 py-4 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_auto] gap-4">
                                            <input
                                                type="text"
                                                value={whatsAppTestTo}
                                                onChange={(e) => setWhatsAppTestTo(e.target.value)}
                                                placeholder="Numero de prueba en formato internacional. Ej: 573001234567"
                                                className="w-full bg-muted/20 border border-border rounded-2xl px-6 py-4 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground"
                                            />
                                            <button
                                                onClick={handleWhatsAppHealthCheck}
                                                disabled={isTestingWhatsApp || !settings.whatsapp.accessToken || !settings.whatsapp.phoneNumberId}
                                                className="bg-card border border-border/60 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-muted/40 transition-all disabled:opacity-50"
                                            >
                                                {isTestingWhatsApp ? 'Validando...' : 'Validar Canal'}
                                            </button>
                                            <button
                                                onClick={handleWhatsAppTestMessage}
                                                disabled={isSendingWhatsApp || !whatsAppTestTo || !settings.whatsapp.accessToken || !settings.whatsapp.phoneNumberId}
                                                className="bg-primary text-black px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all disabled:opacity-50"
                                            >
                                                {isSendingWhatsApp ? 'Enviando...' : 'Enviar Prueba'}
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="p-5 bg-white/50 border border-border rounded-2xl">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Webhook Meta</p>
                                                <p className="mt-2 text-xs font-bold text-foreground break-all">/api/whatsapp/webhook</p>
                                            </div>
                                            <div className="p-5 bg-white/50 border border-border rounded-2xl">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ultima validación</p>
                                                <p className="mt-2 text-xs font-bold text-foreground">{settings.whatsapp.lastVerifiedAt ? new Date(settings.whatsapp.lastVerifiedAt).toLocaleString('es-CO') : 'Sin validar'}</p>
                                            </div>
                                            <div className="p-5 bg-white/50 border border-border rounded-2xl">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Último error</p>
                                                <p className="mt-2 text-xs font-bold text-foreground">{settings.whatsapp.lastError || 'Ninguno'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Connection Status Helper */}
                                    <div className="flex items-center gap-4 p-6 bg-primary/10 border border-primary/20 rounded-3xl">
                                        <Activity className="w-5 h-5 text-primary animate-pulse" />
                                        <p className="text-[11px] font-bold text-foreground leading-snug">
                                            <span className="text-primary uppercase block mb-0.5 tracking-widest">Información de Sincronización</span>
                                            Para WhatsApp Business ya quedaron listos el webhook, la validación del canal y el endpoint de envío. En producción, el token debe migrarse a variables de entorno del servidor.
                                        </p>
                                    </div>
                                </div>

                                {/* Production Order Email Config */}
                                <div className="mt-10 pt-8 border-t border-border space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                            <Mail className="w-5 h-5 text-emerald-500" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black uppercase tracking-[0.2em] text-foreground">📦 Órdenes de Producción Automáticas</h4>
                                            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Cuando se cierra una venta, el sistema envía automáticamente la orden a estos correos.</p>
                                        </div>
                                    </div>

                                    {/* Recipient Emails */}
                                    <div className="bg-muted/10 border border-border rounded-[2rem] p-8 space-y-6">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block mb-3">Correos Destinatarios de Producción</label>
                                            <div className="flex gap-3">
                                                <input
                                                    type="email"
                                                    id="new-production-email"
                                                    placeholder="produccion@arteconcreto.co"
                                                    className="flex-1 bg-muted/20 border border-border rounded-xl px-4 py-3 text-sm focus:border-primary/50 outline-none transition-all font-bold text-foreground"
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
                                                    className="px-5 py-3 bg-primary text-black rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Agregar
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mt-2 ml-1">Presiona Enter o el botón para agregar. Puedes agregar múltiples correos.</p>
                                        </div>

                                        {/* Email Tags */}
                                        {((settings as any).productionEmails || []).length > 0 ? (
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Destinatarios Actuales</label>
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
                                            <div className="text-center py-6 text-muted-foreground/40">
                                                <Mail className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                                <p className="text-[11px] font-bold uppercase tracking-widest">Sin destinatarios configurados</p>
                                                <p className="text-[10px] mt-1">Agrega al menos un correo para activar las órdenes automáticas</p>
                                            </div>
                                        )}

                                        {/* Status indicator */}
                                        <div className={clsx(
                                            "flex items-center gap-3 p-4 rounded-xl border",
                                            ((settings as any).productionEmails || []).length > 0
                                                ? "bg-emerald-500/5 border-emerald-500/20"
                                                : "bg-muted/10 border-border"
                                        )}>
                                            <div className={clsx(
                                                "w-2 h-2 rounded-full",
                                                ((settings as any).productionEmails || []).length > 0 ? "bg-emerald-500 animate-pulse" : "bg-muted"
                                            )}></div>
                                            <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
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
                            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-2xl font-black tracking-tight text-foreground mb-2">Gestión de Base de Datos</h3>
                                        <p className="text-sm text-muted-foreground font-medium">Controla el almacenamiento y el estado de tus datos.</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button className="p-3 bg-muted border border-border rounded-xl hover:bg-muted/80 transition-all">
                                            <RefreshCw className="w-4 h-4 text-foreground" />
                                        </button>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Estado Online</span>
                                            <span className="text-[9px] text-muted-foreground font-bold">Latency: 24ms</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="p-8 bg-muted/10 border border-border rounded-[2.5rem] space-y-4">
                                        <Activity className="w-6 h-6 text-primary" />
                                        <div>
                                            <h4 className="text-sm font-black uppercase tracking-widest opacity-40">Uso Actual</h4>
                                            <p className="text-3xl font-black tracking-tighter text-foreground">1.2 GB</p>
                                        </div>
                                        <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-primary w-[65%] h-full rounded-full shadow-[0_0_10px_rgba(250,181,16,0.3)]"></div>
                                        </div>
                                    </div>
                                    <div className="p-8 bg-muted/10 border border-border rounded-[2.5rem] space-y-4">
                                        <Cloud className="w-6 h-6 text-sky-500" />
                                        <div>
                                            <h4 className="text-sm font-black uppercase tracking-widest opacity-40">Tablas Sync</h4>
                                            <p className="text-3xl font-black tracking-tighter text-foreground">42/42</p>
                                        </div>
                                        <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded inline-block">Sincronizado</span>
                                    </div>
                                    <div className="p-8 bg-muted/10 border border-border rounded-[2.5rem] space-y-4">
                                        <Save className="w-6 h-6 text-emerald-500" />
                                        <div>
                                            <h4 className="text-sm font-black uppercase tracking-widest opacity-40">Próximo Backup</h4>
                                            <p className="text-2xl font-black tracking-tighter text-foreground">En 14h 22m</p>
                                        </div>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Auto-Backup Diario</span>
                                    </div>
                                </div>

                                <div className="pt-8 border-t border-border space-y-6">
                                    <h4 className="text-xs font-black uppercase tracking-[0.3em] opacity-40">Acciones de Datos</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <button className="flex items-center justify-between p-6 bg-muted/20 hover:bg-muted/40 border border-border rounded-3xl transition-all group">
                                            <div className="flex items-center gap-4">
                                                <Download className="w-5 h-5 text-primary group-hover:translate-y-1 transition-transform" />
                                                <span className="text-sm font-black text-foreground">Exportar Base de Datos (SQL/CSV)</span>
                                            </div>
                                            <Check className="w-4 h-4 opacity-20" />
                                        </button>
                                        <button className="flex items-center justify-between p-6 bg-rose-500/5 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/10 rounded-3xl transition-all">
                                            <div className="flex items-center gap-4">
                                                <Trash className="w-5 h-5" />
                                                <span className="text-sm font-black">Limpiar Cache y Logs Temporales</span>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-8 border-t border-border space-y-8">
                                    <div className="flex items-center justify-between px-4">
                                        <h4 className="text-xs font-black uppercase tracking-[0.3em] opacity-40">Variables Maestras (Globales)</h4>
                                        <span className="text-[10px] font-black bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">Modo Administrador</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        {/* Cities Management */}
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] pl-1">Listado de Ciudades</label>
                                                <span className="text-[10px] font-bold opacity-40">{settings.cities.length} Registradas</span>
                                            </div>
                                            <div className="space-y-3">
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Nombre Ciudad..."
                                                        className="flex-1 bg-muted/20 border border-border rounded-xl px-4 py-3 text-xs focus:border-primary/50 outline-none transition-all font-bold"
                                                        value={newCity}
                                                        onChange={(e) => setNewCity(e.target.value)}
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Depto..."
                                                        className="w-1/3 bg-muted/20 border border-border rounded-xl px-4 py-3 text-xs focus:border-primary/50 outline-none transition-all font-bold"
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
                                                        className="p-3 bg-primary text-black rounded-xl hover:scale-105 transition-all"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                                {settings.cities.map((city) => (
                                                    <div key={`${city.name}-${city.department}`} className="flex items-center gap-2 bg-muted/30 border border-border px-3 py-1.5 rounded-lg group hover:border-primary/40 transition-all">
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-bold text-foreground/80 leading-none">{city.name}</span>
                                                            <span className="text-[8px] uppercase tracking-tighter opacity-40 font-black">{city.department}</span>
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
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] pl-1">Sectores Industriales</label>
                                                <span className="text-[10px] font-bold opacity-40">{settings.sectors.length} Registrados</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Nuevo sector..."
                                                    className="flex-1 bg-muted/20 border border-border rounded-xl px-4 py-3 text-xs focus:border-primary/50 outline-none transition-all font-bold"
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
                                                    className="p-3 bg-primary text-black rounded-xl hover:scale-105 transition-all"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                                {settings.sectors.map((sector) => (
                                                    <div key={sector} className="flex items-center gap-2 bg-muted/30 border border-border px-3 py-1.5 rounded-lg group hover:border-primary/40 transition-all">
                                                        <span className="text-[11px] font-bold text-foreground/80">{sector}</span>
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
                            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div>
                                    <h3 className="text-2xl font-black tracking-tight text-foreground mb-2">Licenciamiento Digital</h3>
                                    <p className="text-sm text-muted-foreground font-medium italic">Control de integridad validado por MiWibi Intelligence Security.</p>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                    <div className="p-8 bg-muted/10 border border-border rounded-[2.5rem] space-y-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg">
                                                <Key className="w-6 h-6 text-primary" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black uppercase tracking-[0.2em] text-foreground leading-none">Llave de Activación</h4>
                                                <p className="text-[10px] text-muted-foreground mt-2 font-bold uppercase tracking-widest">Enterprise Format</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="relative group">
                                                <Zap className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary group-focus-within:animate-pulse" />
                                                <input
                                                    type="text"
                                                    placeholder="AC-RRRR-TTTT-2026"
                                                    className="w-full bg-muted/20 border border-border rounded-2xl py-5 pl-12 pr-6 text-sm font-mono text-foreground outline-none focus:border-primary/50 transition-all uppercase placeholder:opacity-30 tracking-[0.2em]"
                                                />
                                            </div>
                                            <button className="w-full py-5 bg-primary text-black font-black rounded-2xl text-[10px] uppercase tracking-[0.3em] hover:scale-[1.02] hover:shadow-[0_15px_30px_rgba(250,181,16,0.3)] active:scale-[0.98] transition-all">
                                                Validar y Sincronizar
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-10 bg-gradient-to-br from-primary/5 to-transparent border border-border rounded-[2.5rem] flex flex-col items-center justify-center text-center space-y-6 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-4">
                                            <Shield className="w-20 h-20 opacity-[0.03] rotate-12 group-hover:rotate-0 transition-transform duration-700" />
                                        </div>
                                        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                                            <Check className="w-10 h-10 text-emerald-500" />
                                        </div>
                                        <div className="space-y-2">
                                            <h5 className="text-[11px] font-black uppercase text-emerald-500 tracking-[0.5em]">Producto Original</h5>
                                            <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">Registrado para Arte Concreto S.A.S</p>
                                            <div className="pt-4">
                                                <span className="text-[8px] font-bold opacity-30 bg-muted/30 px-3 py-1 rounded-full border border-border italic">Expira en: 312 días</span>
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
