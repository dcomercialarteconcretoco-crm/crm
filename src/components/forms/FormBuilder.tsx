"use client";

import React, { useState } from 'react';
import {
    Puzzle,
    Copy,
    Check,
    Terminal,
    Columns,
    Type,
    Mail,
    Phone,
    Send,
    ExternalLink
} from 'lucide-react';

export default function FormBuilder() {
    const [copied, setCopied] = useState(false);
    const [formName, setFormName] = useState("Contacto Web Principal");

    const embedCode = `<script src="https://crm.arteconcreto.co/api/forms/embed.js?id=form_992837"></script>
<div id="ac-form-container"></div>`;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(embedCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Editor Side */}
            <div className="lg:col-span-8 space-y-6">
                <div className="bg-card border border-border/40 rounded-2xl p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/20 rounded-lg">
                                <Puzzle className="w-5 h-5 text-primary" />
                            </div>
                            <h2 className="text-xl font-bold">Constructor de Formularios</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2 py-1 rounded">V1.0</span>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest pl-1">Nombre del Formulario</label>
                            <input
                                type="text"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                className="w-full bg-muted/20 border border-border/40 rounded-lg px-4 py-3 text-sm focus:border-primary outline-none transition-all font-medium"
                            />
                        </div>

                        <div className="pt-6 border-t border-border/20">
                            <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Camos Activos</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    { icon: Type, label: 'Nombre Completo', required: true },
                                    { icon: Mail, label: 'Correo Electrónico', required: true },
                                    { icon: Phone, label: 'WhatsApp / Teléfono', required: true },
                                    { icon: Send, label: 'Mensaje / Detalles', required: false },
                                ].map((field) => (
                                    <div key={field.label} className="flex items-center justify-between p-4 bg-muted/30 border border-border/40 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <field.icon className="w-4 h-4 text-primary" />
                                            <span className="text-sm font-medium">{field.label}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {field.required && <span className="text-[8px] font-bold text-primary uppercase bg-primary/10 px-1.5 py-0.5 rounded tracking-tighter">Requerido</span>}
                                            <input type="checkbox" checked={true} readOnly className="rounded border-border/40 bg-muted/20 text-primary focus:ring-primary" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Embed Side */}
            <div className="lg:col-span-4 space-y-6">
                <div className="bg-card border border-border/40 rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/50"></div>
                    <h3 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-primary" />
                        Código de Embeber
                    </h3>

                    <div className="bg-black/40 rounded-xl p-4 font-mono text-xs text-emerald-400 border border-white/5 relative group">
                        <pre className="whitespace-pre-wrap break-all leading-relaxed">
                            {embedCode}
                        </pre>
                        <button
                            onClick={copyToClipboard}
                            className="absolute top-2 right-2 p-2 bg-primary/10 text-primary rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/20"
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>

                    <p className="mt-4 text-[10px] text-muted-foreground leading-relaxed italic">
                        Copia este código e insértalo en tu sitio web (Webflow, Elementor, WP) para empezar a recibir leads automáticamente en el CRM.
                    </p>

                    <button className="w-full mt-8 bg-white/5 hover:bg-white/10 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 border border-white/5 transition-all">
                        <ExternalLink className="w-4 h-4 text-primary" />
                        Previsualizar Formulario
                    </button>
                </div>
            </div>
        </div>
    );
}
