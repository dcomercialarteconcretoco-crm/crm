"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
    Shield,
    Zap,
    CheckCircle2,
    Circle,
    Plus,
    Save,
    Layout,
    ArrowRight,
    Eye,
    Code,
    Smartphone,
    FilePlus2,
    Palette,
    Settings2,
    Globe2,
    QrCode,
    Copy,
    Trash2,
    Clock,
    X,
    ExternalLink
} from 'lucide-react';
import { clsx } from 'clsx';
import { useApp, FormDefinition } from '@/context/AppContext';

export default function FormsPage() {
    const { forms, addForm, deleteForm, updateForm, refreshProducts, addNotification } = useApp();
    const [view, setView] = useState<'editor' | 'list'>('editor');

    // Form Creation State
    const [captureFields, setCaptureFields] = useState({
        name: { active: true, label: 'Nombre Completo' },
        email: { active: true, label: 'Correo Eléctrónico' },
        phone: { active: true, label: 'Teléfono Móvil' },
        city: { active: true, label: 'Ciudad / Departamento' },
        company: { active: true, label: 'Empresa / Institución' },
        interested_products: { active: true, label: 'Selección de Productos' }, // Added target field
        project_type: { active: false, label: 'Tipo de Proyecto' },
        budget: { active: false, label: 'Presupuesto Estimado' }
    });

    useEffect(() => {
        refreshProducts();
    }, []);

    const [formConfig, setFormConfig] = useState({
        title: 'Captura de Leads Premium',
        description: 'Completa el siguiente formulario para recibir una asesoría técnica especializada.',
        buttonText: 'Solicitar Información',
        primaryColor: '#FAB510'
    });

    const [activeEditorTab, setActiveEditorTab] = useState<'config' | 'style'>('config');
    const [styleConfig, setStyleConfig] = useState({
        theme: 'glass', // 'native', 'modern', 'glass'
        corners: '3rem',
        borderStyle: 'solid',
        showBadges: true
    });

    const [previewTab, setPreviewTab] = useState<'preview' | 'code' | 'qr'>('preview');
    const [savedFormId, setSavedFormId] = useState<string | null>(null);

    const toggleField = (field: keyof typeof captureFields) => {
        setCaptureFields(prev => ({
            ...prev,
            [field]: { ...prev[field], active: !prev[field].active }
        }));
    };

    const handleSaveForm = () => {
        const id = addForm({
            title: formConfig.title,
            description: formConfig.description,
            fields: Object.keys(captureFields).filter(k => captureFields[k as keyof typeof captureFields].active),
            primaryColor: formConfig.primaryColor,
            theme: styleConfig.theme,
            buttonText: formConfig.buttonText
        });
        setSavedFormId(id);
        setPreviewTab('qr');
        addNotification({ title: 'Formulario guardado', description: 'Motor de lead-capture activado. Comparte el enlace público.', type: 'success' });
    };

    const publicUrl = useMemo(() => {
        if (!savedFormId) return "";
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.arteconcreto.co';
        return `${baseUrl}/public/f/${savedFormId}`;
    }, [savedFormId]);

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicUrl)}&color=FAB510&bgcolor=0a0a0b`;

    const miwibiScriptUrl = typeof window !== 'undefined' ? `${window.location.origin}/sdk/form.js` : 'https://app.arteconcreto.co/sdk/form.js';

    const embeddedCode = `<script src="${miwibiScriptUrl}"></script>
<div id="miwibi-form-${savedFormId || 'preview'}" 
     data-id="${savedFormId || 'pending'}"
     data-theme="${styleConfig.theme}" 
     data-color="${formConfig.primaryColor}">
</div>
<script>
  MiWibi.initForm({
    id: '${savedFormId || 'pending'}',
    fields: ${JSON.stringify(Object.keys(captureFields).filter(k => captureFields[k as keyof typeof captureFields].active))}
  });
</script>`;

    const previewThemeClasses = useMemo(() => {
        if (styleConfig.theme === 'bold') {
            return {
                shell: 'bg-[#1b1710] border-[#3a3120] shadow-[0_24px_60px_rgba(0,0,0,0.16)]',
                title: 'text-[#fff7e1]',
                description: 'text-[#f3e5bf]',
                label: 'text-[#f3dfaa]',
                input: 'bg-[#241f17] border-[#433722] text-[#fff7e1]',
                placeholder: 'text-[#cdbf97]',
                footer: 'text-[#d8cba4]',
            };
        }

        if (styleConfig.theme === 'native') {
            return {
                shell: 'bg-[#fff9ed] border-[#eadfbd] shadow-[0_20px_50px_rgba(23,23,23,0.06)]',
                title: 'text-[#171717]',
                description: 'text-[#62594b]',
                label: 'text-[#4d473c]',
                input: 'bg-white border-[#e5dcc6] text-[#171717]',
                placeholder: 'text-[#8a816f]',
                footer: 'text-[#746b58]',
            };
        }

        return {
            shell: 'bg-white/78 border-white/90 shadow-[0_24px_60px_rgba(23,23,23,0.08)]',
            title: 'text-[#171717]',
            description: 'text-[#62594b]',
            label: 'text-[#4d473c]',
            input: 'bg-white/92 border-[#ece3cf] text-[#171717]',
            placeholder: 'text-[#8a816f]',
            footer: 'text-[#746b58]',
        };
    }, [styleConfig.theme]);

    if (view === 'list') {
        return (
            <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">Mis Formularios</h1>
                        <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-1">Gestión de puntos de captura de leads</p>
                    </div>
                    <button
                        onClick={() => setView('editor')}
                        className="bg-primary text-black font-black px-8 py-4 rounded-2xl flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Crear Otro</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {forms.map(f => (
                        <div key={f.id} className="surface-panel rounded-[2.5rem] p-8 space-y-6 group hover:border-primary/40 transition-all">
                            <div className="flex justify-between items-start">
                                <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                                    <FilePlus2 className="w-6 h-6" />
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => {
                                            setSavedFormId(f.id);
                                            setFormConfig({
                                                title: f.title,
                                                description: f.description,
                                                buttonText: f.buttonText,
                                                primaryColor: f.primaryColor
                                            });
                                            setStyleConfig(prev => ({ ...prev, theme: f.theme }));
                                            setView('editor');
                                            setPreviewTab('qr');
                                        }}
                                        className="p-3 bg-white/5 rounded-xl hover:bg-primary hover:text-black transition-all"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => deleteForm(f.id)}
                                        className="p-3 bg-white/60 border border-white/80 rounded-xl hover:bg-rose-500 hover:text-white transition-all text-muted-foreground"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-foreground uppercase italic tracking-tighter">{f.title}</h3>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{f.submissions} Leads</span>
                                    <div className="w-1 h-1 bg-white/20 rounded-full" />
                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Creado: {new Date(f.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {forms.length === 0 && (
                        <div className="col-span-full py-32 text-center bg-white/50 border border-dashed border-border/40 rounded-[3rem]">
                            <p className="text-sm font-black text-muted-foreground uppercase tracking-[0.2em] italic">No hay formularios creados aún</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-4 lg:px-0">
                <div className="space-y-1">
                    <div className="flex items-center gap-3 text-primary">
                        <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                            <Shield className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Intelligence Engine</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black tracking-tighter text-foreground mt-2">
                        Formbuilder IA
                    </h1>
                    <p className="text-sm text-muted-foreground font-medium max-w-xl">
                        Crea formularios y códigos QR de alto impacto. Los leads recolectados se califican y se sincronizan automáticamente con tu Pipeline.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setView('list')}
                        className="bg-muted/30 border border-border text-muted-foreground px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-foreground transition-all flex items-center gap-2"
                    >
                        <Clock className="w-4 h-4" />
                        Mis Formularios
                    </button>
                    <button
                        onClick={() => {
                            setSavedFormId(null);
                            setPreviewTab('preview');
                        }}
                        className="bg-primary text-black font-black px-8 py-4 rounded-2xl flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_10px_25px_rgba(250,181,16,0.3)]"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Nuevo Formulario</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
                {/* Editor Sidebar */}
                <div className="lg:col-span-4 space-y-8">
                    <div className="surface-panel rounded-[2.5rem] p-8 space-y-8 shadow-xl relative overflow-hidden group">
                        {/* Tab Switcher for Editor */}
                        <div className="flex gap-2 p-1 bg-white/60 border border-white/80 rounded-xl">
                            <button
                                onClick={() => setActiveEditorTab('config')}
                                className={clsx(
                                    "flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                                    activeEditorTab === 'config' ? "bg-primary text-black shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Configuración
                            </button>
                            <button
                                onClick={() => setActiveEditorTab('style')}
                                className={clsx(
                                    "flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                                    activeEditorTab === 'style' ? "bg-primary text-black shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Estilo
                            </button>
                        </div>

                        {activeEditorTab === 'config' ? (
                            <>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase text-primary tracking-[0.3em] pl-1 flex items-center gap-2">
                                        <Settings2 className="w-3 h-3" />
                                        Estructura del Form
                                    </label>
                                    <input
                                        type="text"
                                        value={formConfig.title}
                                        onChange={(e) => setFormConfig({ ...formConfig, title: e.target.value })}
                                        placeholder="Nombre del Formulario"
                                        className="w-full bg-white/70 border border-white/80 rounded-2xl p-4 text-sm font-bold text-foreground outline-none focus:border-primary/50 transition-all italic"
                                    />
                                    <textarea
                                        value={formConfig.description}
                                        onChange={(e) => setFormConfig({ ...formConfig, description: e.target.value })}
                                        placeholder="Descripción breve..."
                                        className="w-full bg-white/70 border border-white/80 rounded-2xl p-4 text-xs font-medium text-muted-foreground outline-none focus:border-primary/50 transition-all h-24 resize-none italic"
                                    />
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                        <h3 className="text-xs font-black uppercase text-foreground tracking-widest flex items-center gap-2 italic">
                                            <Layout className="w-4 h-4 text-primary" />
                                            Campos a Capturar
                                        </h3>
                                        <Zap className="w-4 h-4 text-primary animate-pulse" />
                                    </div>

                                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                        {Object.entries(captureFields).map(([key, val]) => (
                                            <div
                                                key={key}
                                                onClick={() => toggleField(key as any)}
                                                className={clsx(
                                                    "flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]",
                                                    val.active ? "bg-primary/8 border-primary/35 text-primary" : "bg-white/50 border-white/70 text-muted-foreground opacity-70 hover:opacity-100"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {val.active ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                                    <span className="text-[11px] font-black uppercase tracking-tight italic">
                                                        {val.label}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[8px] font-black uppercase tracking-widest opacity-40">{val.active ? 'Requerido' : 'Apagado'}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase text-primary tracking-[0.3em] pl-1 flex items-center gap-2">
                                        <Palette className="w-3 h-3" />
                                        Diseño y Herencia
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { id: 'native', label: 'Nativo (Herencia)', icon: Globe2 },
                                            { id: 'glass', label: 'Efecto Cristal', icon: Shield },
                                            { id: 'modern', label: 'Minimalista', icon: Smartphone },
                                            { id: 'bold', label: 'Alto Contraste', icon: Zap }
                                        ].map((theme) => (
                                            <button
                                                key={theme.id}
                                                onClick={() => setStyleConfig({ ...styleConfig, theme: theme.id })}
                                                className={clsx(
                                                    "p-4 rounded-xl border text-left transition-all space-y-2",
                                                    styleConfig.theme === theme.id ? "bg-primary/10 border-primary text-primary" : "bg-muted/40 border-border text-foreground/70 hover:text-foreground hover:border-border/80"
                                                )}
                                            >
                                                <theme.icon className="w-4 h-4" />
                                                <p className="text-[8px] font-black uppercase leading-tight italic">{theme.label}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] pl-1">Color de Marca</label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="color"
                                            value={formConfig.primaryColor}
                                            onChange={(e) => setFormConfig({ ...formConfig, primaryColor: e.target.value })}
                                            className="w-12 h-12 rounded-xl border-none cursor-pointer bg-transparent"
                                        />
                                        <input
                                            type="text"
                                            value={formConfig.primaryColor}
                                            onChange={(e) => setFormConfig({ ...formConfig, primaryColor: e.target.value })}
                                            className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl p-3 text-xs font-mono font-bold text-white outline-none focus:border-primary/50 uppercase"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] pl-1">Bordes y Ángulos</label>
                                    <div className="flex gap-2">
                                        {['0.5rem', '1.5rem', '3rem'].map((r) => (
                                            <button
                                                key={r}
                                                onClick={() => setStyleConfig({ ...styleConfig, corners: r })}
                                                className={clsx(
                                                    "flex-1 py-3 border rounded-lg transition-all text-[9px] font-black uppercase",
                                                    styleConfig.corners === r ? "bg-primary/10 border-primary text-primary" : "bg-muted/40 border-border text-foreground/70 hover:text-foreground"
                                                )}
                                            >
                                                {r === '0.5rem' ? 'Recto' : r === '1.5rem' ? 'Suave' : 'Curvo'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl space-y-3">
                            <div className="flex items-center gap-3 text-emerald-500">
                                <Globe2 className="w-5 h-5" />
                                <h4 className="text-[10px] font-black uppercase tracking-widest leading-none">Smart Adaptation</h4>
                            </div>
                            <p className="text-[9px] text-muted-foreground font-bold leading-relaxed italic">
                                "{styleConfig.theme === 'native'
                                    ? 'En modo Nativo, el formulario absorberá automáticamente las fuentes y estilos de tu página web.'
                                    : 'En modo Personalizado, el formulario mantendrá su diseño premium sobre cualquier sitio.'}"
                            </p>
                        </div>

                        <button
                            onClick={handleSaveForm}
                            className="w-full py-5 bg-primary text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] shadow-xl shadow-primary/10 transition-all flex items-center justify-center gap-3 border border-primary/20"
                        >
                            <Save className="w-4 h-4" />
                            {savedFormId ? "Actualizar Formulario" : "Guardar y Generar QR"}
                        </button>
                    </div>
                </div>

                {/* Preview Area */}
                <div className="lg:col-span-8 flex flex-col gap-8 px-4 lg:px-0">
                    <div className="flex bg-white/70 p-1.5 rounded-2xl border border-white/80 w-fit shadow-lg">
                        <button
                            onClick={() => setPreviewTab('preview')}
                            className={clsx(
                                "flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                previewTab === 'preview' ? "bg-primary text-black shadow-lg" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Eye className="w-3.5 h-3.5" />
                            Vista Previa
                        </button>
                        <button
                            onClick={() => setPreviewTab('qr')}
                            className={clsx(
                                "flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                previewTab === 'qr' ? "bg-primary text-black shadow-lg" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <QrCode className="w-3.5 h-3.5" />
                            Código QR
                        </button>
                        <button
                            onClick={() => setPreviewTab('code')}
                            className={clsx(
                                "flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                previewTab === 'code' ? "bg-primary text-black shadow-lg" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Code className="w-3.5 h-3.5" />
                            Código Embebido
                        </button>
                    </div>

                    <div className={clsx(
                        "flex-1 border border-white/50 rounded-[3rem] p-6 lg:p-8 flex items-center justify-center relative overflow-hidden group shadow-xl min-h-[560px] transition-all duration-1000",
                        "surface-panel"
                    )}>
                        {/* Background Decoration */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                            <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-primary rounded-full blur-[150px] opacity-20" />
                            <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(circle_at_2px_2px,rgba(255,255,255,0.05)_1px,transparent_0)] bg-[size:40px_40px] [mask-image:radial-gradient(white,transparent_70%)]" />
                        </div>

                        {previewTab === 'preview' ? (
                            <div
                                style={{
                                    borderRadius: styleConfig.corners,
                                    borderColor: styleConfig.theme === 'native' ? '#00000020' : undefined
                                }}
                                className={clsx(
                                    "w-full max-w-[42rem] p-6 lg:p-10 transition-all duration-700 relative z-10 backdrop-blur-sm border animate-in zoom-in-95 duration-500",
                                    previewThemeClasses.shell
                                )}
                            >
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div
                                            style={{ backgroundColor: formConfig.primaryColor }}
                                            className="w-px h-10 shadow-[0_0_15px_rgba(250,181,16,0.5)]"
                                        />
                                        <div>
                                            <h2 className={clsx(
                                                "text-2xl lg:text-3xl font-black tracking-tighter uppercase italic",
                                                previewThemeClasses.title
                                            )}>
                                                {formConfig.title}
                                            </h2>
                                            <p className={clsx("mt-2 text-sm font-medium tracking-wide", previewThemeClasses.description)}>{formConfig.description}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-5 mt-8">
                                    {Object.entries(captureFields).filter(([_, v]) => v.active).map(([k, v]) => (
                                        <div key={k} className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <label className={clsx(
                                                    "text-[10px] font-black uppercase tracking-[0.16em]",
                                                    previewThemeClasses.label
                                                )}>
                                                    {v.label}
                                                </label>
                                                <span className="text-[8px] font-black text-primary/70 uppercase">Dato requerido</span>
                                            </div>
                                            <div className={clsx(
                                                "h-12 border rounded-[1.1rem] px-5 flex items-center transition-all",
                                                previewThemeClasses.input
                                            )}>
                                                <span className={clsx("text-sm font-medium italic", previewThemeClasses.placeholder)}>Información del prospecto...</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-7">
                                    <button
                                        style={{
                                            backgroundColor: formConfig.primaryColor,
                                            borderRadius: `calc(${styleConfig.corners} / 2)`
                                        }}
                                        className="w-full h-14 text-black font-black text-sm uppercase tracking-[0.18em] flex items-center justify-center gap-3 hover:shadow-[0_20px_40px_rgba(0,0,0,0.16)] transition-all overflow-hidden relative group/btn shadow-xl active:scale-95"
                                    >
                                        <span className="relative z-10 italic">{formConfig.buttonText}</span>
                                        <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-2 transition-transform relative z-10" />
                                        <div className="absolute inset-0 bg-white opacity-0 group-hover/btn:opacity-20 transition-opacity" />
                                    </button>
                                    <p className={clsx("mt-5 text-[9px] text-center font-black uppercase tracking-[0.22em] flex items-center justify-center gap-2 italic", previewThemeClasses.footer)}>
                                        <Shield className="w-3 h-3 text-primary/40" />
                                        Tus datos están protegidos por MiWibi Intelligence
                                    </p>
                                </div>
                            </div>
                        ) : previewTab === 'qr' ? (
                            <div className="w-full max-w-lg surface-panel rounded-[3rem] p-12 lg:p-16 shadow-xl relative z-10 animate-in zoom-in-95 duration-500 text-center">
                                {!savedFormId ? (
                                    <div className="space-y-6">
                                        <div className="p-6 bg-primary/5 rounded-full w-24 h-24 flex items-center justify-center mx-auto text-primary animate-pulse border border-primary/20">
                                            <QrCode className="w-10 h-10" />
                                        </div>
                                        <h3 className="text-2xl font-black text-foreground italic uppercase tracking-tighter">Generador de Código QR</h3>
                                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest leading-relaxed">
                                            Guarda tu formulario primero para generar un código QR único que los clientes puedan escanear para agregarse al CRM.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-10">
                                        <div className="space-y-2">
                                            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Acceso Instantáneo</h3>
                                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest italic">Vinculado a: {formConfig.title}</p>
                                        </div>

                                        <div className="p-8 bg-white rounded-[2.5rem] shadow-xl inline-block group relative">
                                            <img
                                                src={qrUrl}
                                                alt="QR Code"
                                                className="w-56 h-56 object-contain"
                                            />
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-[2.5rem]">
                                                <button
                                                    onClick={() => window.open(publicUrl, '_blank')}
                                                    className="bg-primary text-black p-4 rounded-full hover:scale-110 active:scale-95 transition-all"
                                                >
                                                    <ExternalLink className="w-6 h-6" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="p-4 bg-white/60 border border-white/80 rounded-2xl flex items-center justify-between gap-4 group/url">
                                                <code className="text-[10px] text-muted-foreground truncate flex-1 block text-left">{publicUrl}</code>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(publicUrl).then(() =>
                                                            addNotification({ title: 'Enlace copiado', description: publicUrl, type: 'success' })
                                                        );
                                                    }}
                                                    className="p-3 bg-white/5 rounded-xl hover:bg-primary hover:text-black transition-all"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-[0.2em] leading-relaxed italic">
                                                Descarga o imprime este QR. Cualquier persona que lo escanee verá tu formulario y sus datos caerán directamente en tu **Pipeline**.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="w-full max-w-2xl surface-panel rounded-[2.5rem] p-10 lg:p-14 shadow-xl relative z-10 animate-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-black text-foreground tracking-tighter uppercase italic">Integración Rápida</h3>
                                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest italic">Copia y pega este código en tu sitio web</p>
                                    </div>
                                    <div className="flex items-center gap-2 p-1.5 bg-white/60 rounded-xl border border-white/80">
                                        <button className="px-4 py-2 text-[8px] font-black uppercase text-foreground bg-white rounded-lg">SDK (JS)</button>
                                        <button className="px-4 py-2 text-[8px] font-black uppercase text-muted-foreground hover:text-foreground">HTML / IFRAME</button>
                                    </div>
                                </div>

                                <div className="relative group/code">
                                    <pre className="bg-[#fff9ef] border border-[#eadfbd] rounded-2xl p-8 text-[11px] font-mono leading-relaxed overflow-x-auto custom-scrollbar text-[#4c463b]">
                                        <code>{embeddedCode}</code>
                                    </pre>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(embeddedCode).then(() =>
                                                addNotification({ title: 'Código copiado', description: 'Pega el snippet en tu WordPress.', type: 'success' })
                                            );
                                        }}
                                        className="absolute top-4 right-4 bg-primary text-black p-3 rounded-xl hover:scale-110 active:scale-95 transition-all opacity-0 group-hover/code:opacity-100 shadow-xl"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="mt-8 p-6 bg-white/60 border border-white/80 rounded-2xl flex items-start gap-4">
                                    <div className="p-3 bg-sky-500/10 rounded-xl">
                                        <Globe2 className="w-5 h-5 text-sky-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-foreground uppercase tracking-widest leading-none italic">Despliegue Instantáneo</p>
                                        <p className="text-[9px] text-muted-foreground font-bold leading-relaxed italic">
                                            Una vez pegues el código, cualquier cambio que hagas en este panel se reflejará **automáticamente** en tu web sin necesidad de volver a pegar nada.
                                        </p>
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
