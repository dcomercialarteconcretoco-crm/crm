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
    const { forms, addForm, deleteForm, updateForm, refreshProducts } = useApp();
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
        alert("Formulario guardado y motor de lead-capture activado.");
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
                        <div key={f.id} className="bg-[#0a0a0b] border border-white/10 rounded-[2.5rem] p-8 space-y-6 group hover:border-primary/40 transition-all">
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
                                        className="p-3 bg-white/5 rounded-xl hover:bg-rose-500 hover:text-white transition-all text-white/20"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">{f.title}</h3>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{f.submissions} Leads</span>
                                    <div className="w-1 h-1 bg-white/20 rounded-full" />
                                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Creado: {new Date(f.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {forms.length === 0 && (
                        <div className="col-span-full py-32 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-[3rem]">
                            <p className="text-sm font-black text-white/20 uppercase tracking-[0.2em] italic">No hay formularios creados aún</p>
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
                    <div className="bg-[#0a0a0b] border border-white/10 rounded-[2.5rem] p-8 space-y-8 shadow-2xl relative overflow-hidden group">
                        {/* Tab Switcher for Editor */}
                        <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-xl">
                            <button
                                onClick={() => setActiveEditorTab('config')}
                                className={clsx(
                                    "flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                                    activeEditorTab === 'config' ? "bg-primary text-black shadow-sm" : "text-white/20 hover:text-white"
                                )}
                            >
                                Configuración
                            </button>
                            <button
                                onClick={() => setActiveEditorTab('style')}
                                className={clsx(
                                    "flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                                    activeEditorTab === 'style' ? "bg-primary text-black shadow-sm" : "text-white/20 hover:text-white"
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
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:border-primary/50 transition-all italic"
                                    />
                                    <textarea
                                        value={formConfig.description}
                                        onChange={(e) => setFormConfig({ ...formConfig, description: e.target.value })}
                                        placeholder="Descripción breve..."
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-xs font-medium text-white/40 outline-none focus:border-primary/50 transition-all h-24 resize-none italic"
                                    />
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                        <h3 className="text-xs font-black uppercase text-white tracking-widest flex items-center gap-2 italic">
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
                                                    val.active ? "bg-primary/5 border-primary/40 text-primary" : "bg-white/[0.02] border-white/5 text-white/20 opacity-40 hover:opacity-100"
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
                                                    styleConfig.theme === theme.id ? "bg-primary/10 border-primary text-primary" : "bg-white/5 border-white/10 text-white/20 hover:text-white"
                                                )}
                                            >
                                                <theme.icon className="w-4 h-4" />
                                                <p className="text-[8px] font-black uppercase leading-tight italic">{theme.label}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.3em] pl-1">Color de Marca</label>
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
                                    <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.3em] pl-1">Bordes y Ángulos</label>
                                    <div className="flex gap-2">
                                        {['0.5rem', '1.5rem', '3rem'].map((r) => (
                                            <button
                                                key={r}
                                                onClick={() => setStyleConfig({ ...styleConfig, corners: r })}
                                                className={clsx(
                                                    "flex-1 py-3 border rounded-lg transition-all text-[9px] font-black uppercase",
                                                    styleConfig.corners === r ? "bg-primary/10 border-primary text-primary" : "bg-white/5 border-white/10 text-white/20"
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
                            <p className="text-[9px] text-white/40 font-bold leading-relaxed italic">
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
                    <div className="flex bg-[#0a0a0b] p-1.5 rounded-2xl border border-white/10 w-fit shadow-lg">
                        <button
                            onClick={() => setPreviewTab('preview')}
                            className={clsx(
                                "flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                previewTab === 'preview' ? "bg-primary text-black shadow-lg" : "text-white/20 hover:text-white"
                            )}
                        >
                            <Eye className="w-3.5 h-3.5" />
                            Vista Previa
                        </button>
                        <button
                            onClick={() => setPreviewTab('qr')}
                            className={clsx(
                                "flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                previewTab === 'qr' ? "bg-primary text-black shadow-lg" : "text-white/20 hover:text-white"
                            )}
                        >
                            <QrCode className="w-3.5 h-3.5" />
                            Código QR
                        </button>
                        <button
                            onClick={() => setPreviewTab('code')}
                            className={clsx(
                                "flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                previewTab === 'code' ? "bg-primary text-black shadow-lg" : "text-white/20 hover:text-white"
                            )}
                        >
                            <Code className="w-3.5 h-3.5" />
                            Código Embebido
                        </button>
                    </div>

                    <div className={clsx(
                        "flex-1 border border-white/10 rounded-[3.5rem] p-8 lg:p-12 flex items-center justify-center relative overflow-hidden group shadow-2xl min-h-[700px] transition-all duration-1000",
                        styleConfig.theme === 'bold' ? "bg-white" : "bg-[#050505]"
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
                                    "w-full max-w-xl p-8 lg:p-14 transition-all duration-700 relative z-10 backdrop-blur-sm border animate-in zoom-in-95 duration-500",
                                    styleConfig.theme === 'glass' ? "bg-white/[0.02] border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.4)]" :
                                        styleConfig.theme === 'native' ? "bg-transparent border-dashed border-2 text-foreground font-serif" :
                                            styleConfig.theme === 'bold' ? "bg-black border-none shadow-2xl" :
                                                "bg-[#0a0a0b] border-white/5 shadow-xl"
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
                                                "text-3xl lg:text-4xl font-black tracking-tighter uppercase italic",
                                                styleConfig.theme === 'bold' ? "text-white" : "text-white"
                                            )}>
                                                {formConfig.title}
                                            </h2>
                                            <p className="text-xs lg:text-sm text-white/40 font-medium mt-1 uppercase tracking-wider">{formConfig.description}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6 mt-10">
                                    {Object.entries(captureFields).filter(([_, v]) => v.active).map(([k, v]) => (
                                        <div key={k} className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <label className={clsx(
                                                    "text-[10px] font-black uppercase tracking-[0.2em]",
                                                    styleConfig.theme === 'bold' ? "text-white/40" : "text-white/30"
                                                )}>
                                                    {v.label}
                                                </label>
                                                <span className="text-[8px] font-black text-primary/40 uppercase">Dato Requerido</span>
                                            </div>
                                            <div className={clsx(
                                                "h-14 border rounded-2xl px-6 flex items-center transition-all",
                                                styleConfig.theme === 'bold' ? "bg-white/5 border-white/10" : "bg-white/[0.03] border-white/10 border-dashed"
                                            )}>
                                                <span className="text-xs font-medium text-white/10 italic">Información del prospecto...</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-8">
                                    <button
                                        style={{
                                            backgroundColor: formConfig.primaryColor,
                                            borderRadius: `calc(${styleConfig.corners} / 2)`
                                        }}
                                        className="w-full h-18 text-black font-black text-sm lg:text-base uppercase tracking-[0.2em] flex items-center justify-center gap-4 hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)] transition-all overflow-hidden relative group/btn shadow-xl active:scale-95"
                                    >
                                        <span className="relative z-10 italic">{formConfig.buttonText}</span>
                                        <ArrowRight className="w-6 h-6 group-hover/btn:translate-x-2 transition-transform relative z-10" />
                                        <div className="absolute inset-0 bg-white opacity-0 group-hover/btn:opacity-20 transition-opacity" />
                                    </button>
                                    <p className="text-[8px] text-center text-white/20 mt-6 font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2 italic">
                                        <Shield className="w-3 h-3 text-primary/40" />
                                        Tus datos están protegidos por MiWibi Intelligence
                                    </p>
                                </div>
                            </div>
                        ) : previewTab === 'qr' ? (
                            <div className="w-full max-w-lg bg-[#0a0a0b] border border-white/10 rounded-[3rem] p-12 lg:p-16 shadow-2xl relative z-10 animate-in zoom-in-95 duration-500 text-center">
                                {!savedFormId ? (
                                    <div className="space-y-6">
                                        <div className="p-6 bg-primary/5 rounded-full w-24 h-24 flex items-center justify-center mx-auto text-primary animate-pulse border border-primary/20">
                                            <QrCode className="w-10 h-10" />
                                        </div>
                                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Generador de Código QR</h3>
                                        <p className="text-xs text-white/30 font-bold uppercase tracking-widest leading-relaxed">
                                            Guarda tu formulario primero para generar un código QR único que los clientes puedan escanear para agregarse al CRM.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-10">
                                        <div className="space-y-2">
                                            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Acceso Instantáneo</h3>
                                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest italic">Vinculado a: {formConfig.title}</p>
                                        </div>

                                        <div className="p-8 bg-white rounded-[2.5rem] shadow-2xl inline-block group relative">
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
                                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between gap-4 group/url">
                                                <code className="text-[10px] text-white/40 truncate flex-1 block text-left">{publicUrl}</code>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(publicUrl);
                                                        alert("Enlace copiado");
                                                    }}
                                                    className="p-3 bg-white/5 rounded-xl hover:bg-primary hover:text-black transition-all"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <p className="text-[9px] text-white/20 font-bold uppercase tracking-[0.2em] leading-relaxed italic">
                                                Descarga o imprime este QR. Cualquier persona que lo escanee verá tu formulario y sus datos caerán directamente en tu **Pipeline**.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="w-full max-w-2xl bg-black border border-white/10 rounded-[2.5rem] p-10 lg:p-14 shadow-2xl relative z-10 animate-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-black text-white tracking-tighter uppercase italic">Integración Rápida</h3>
                                        <p className="text-xs text-white/40 font-bold uppercase tracking-widest italic">Copia y pega este código en tu sitio web</p>
                                    </div>
                                    <div className="flex items-center gap-2 p-1.5 bg-white/5 rounded-xl border border-white/10">
                                        <button className="px-4 py-2 text-[8px] font-black uppercase text-white bg-white/10 rounded-lg">SDK (JS)</button>
                                        <button className="px-4 py-2 text-[8px] font-black uppercase text-white/40 hover:text-white">HTML / IFRAME</button>
                                    </div>
                                </div>

                                <div className="relative group/code">
                                    <pre className="bg-[#050505] border border-white/10 rounded-2xl p-8 text-[11px] font-mono leading-relaxed overflow-x-auto custom-scrollbar text-emerald-400">
                                        <code>{embeddedCode}</code>
                                    </pre>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(embeddedCode);
                                            alert('Código copiado al portapapeles');
                                        }}
                                        className="absolute top-4 right-4 bg-primary text-black p-3 rounded-xl hover:scale-110 active:scale-95 transition-all opacity-0 group-hover/code:opacity-100 shadow-xl"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-2xl flex items-start gap-4">
                                    <div className="p-3 bg-sky-500/10 rounded-xl">
                                        <Globe2 className="w-5 h-5 text-sky-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-white uppercase tracking-widest leading-none italic">Despliegue Instantáneo</p>
                                        <p className="text-[9px] text-white/40 font-bold leading-relaxed italic">
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
