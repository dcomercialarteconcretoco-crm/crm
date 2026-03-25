"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
    X,
    Send,
    Bot,
    User,
    Sparkles,
    RefreshCcw,
    BrainCircuit,
    Zap,
    TrendingUp,
    Users,
    FileText
} from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '@/context/AppContext';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface MiWiAssistantProps {
    isOpen: boolean;
    onClose: () => void;
}

const QUICK_ACTIONS = [
    { label: 'Analizar Pipeline', icon: TrendingUp, prompt: 'Analiza el estado actual de mi pipeline de ventas y dame recomendaciones.' },
    { label: 'Resumen del Día', icon: Sparkles, prompt: 'Dame un resumen ejecutivo del estado del CRM hoy: leads, cotizaciones y tareas pendientes.' },
    { label: 'Leads en Riesgo', icon: Users, prompt: '¿Cuáles leads llevan más tiempo sin contacto y están en riesgo de perderse?' },
    { label: 'Próximo Paso', icon: Zap, prompt: '¿Cuál debería ser mi próxima acción prioritaria en ventas hoy?' },
    { label: 'Redactar Cotización', icon: FileText, prompt: 'Ayúdame a redactar un mensaje de seguimiento para una cotización que envié hace 5 días.' },
    { label: 'Actualizar Pipeline', icon: RefreshCcw, prompt: 'Analiza mis tareas actuales y sugiere cómo reorganizar el pipeline.' },
];

export function MiWiAssistant({ isOpen, onClose }: MiWiAssistantProps) {
    const { settings, currentUser, clients, tasks, quotes } = useApp();
    const firstName = currentUser?.name?.split(' ')[0] || '';
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: `¡Hola${firstName ? ' ' + firstName : ''}! Soy **MiWi**, tu asistente de inteligencia para Arte Concreto.\n\nTengo acceso a tus **${clients.length} clientes**, **${tasks.length} tareas** y **${quotes.length} cotizaciones**. ¿En qué te ayudo hoy?`,
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen) textareaRef.current?.focus();
    }, [isOpen]);

    const sendMessage = async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: text,
                    messages: messages.map(m => ({ role: m.role, content: m.content })),
                    apiKey: settings.geminiKey || '',
                    context: {
                        clientsCount: clients.length,
                        tasksCount: tasks.length,
                        quotesCount: quotes.length,
                        user: currentUser?.name,
                    }
                })
            });

            const data = await res.json();
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: res.ok ? data.text : (data.error || 'Lo siento, hubo un error al conectar con MiWi.'),
                timestamp: new Date()
            }]);
        } catch {
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Error de conexión. Verifica tu clave Gemini en Configuración.',
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const renderContent = (text: string) => {
        return text.split('\n').map((line, i) => {
            const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            return <p key={i} className={i > 0 ? 'mt-1' : ''} dangerouslySetInnerHTML={{ __html: bold }} />;
        });
    };

    return (
        <div className={clsx(
            "flex flex-col h-full bg-[linear-gradient(180deg,rgba(255,253,248,0.99),rgba(244,237,225,0.97))] border-l border-border/50 transition-all duration-300 overflow-hidden",
            isOpen ? "w-[380px] min-w-[380px]" : "w-0 min-w-0"
        )}>
            {isOpen && (
                <>
                    {/* Header */}
                    <div className="shrink-0 px-5 py-4 border-b border-border/50 flex items-center justify-between bg-white/50">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_16px_rgba(250,181,16,0.35)]">
                                <BrainCircuit className="w-5 h-5 text-black" />
                            </div>
                            <div>
                                <h2 className="text-sm font-black tracking-tight flex items-center gap-2">
                                    MiWi <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-black uppercase">IA</span>
                                </h2>
                                <p className="text-[9px] text-muted-foreground font-black uppercase tracking-wider flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block" />
                                    Gemini 2.0 Flash
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-accent/60 rounded-xl border border-border/60 transition-all">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Quick Actions */}
                    <div className="shrink-0 px-3 py-2.5 border-b border-border/40 bg-white/20 flex gap-2 overflow-x-auto scrollbar-hide">
                        {QUICK_ACTIONS.map(({ label, icon: Icon, prompt }) => (
                            <button
                                key={label}
                                onClick={() => sendMessage(prompt)}
                                disabled={isLoading}
                                className="shrink-0 flex items-center gap-1.5 bg-white/80 hover:bg-primary hover:text-black border border-border/50 hover:border-primary px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all disabled:opacity-50"
                            >
                                <Icon className="w-3 h-3 text-primary group-hover:text-black" />
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
                        {messages.map((msg) => (
                            <div key={msg.id} className={clsx("flex gap-2.5", msg.role === 'user' ? "flex-row-reverse" : "")}>
                                <div className={clsx(
                                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                                    msg.role === 'assistant' ? "bg-primary/20 text-primary border border-primary/20" : "bg-foreground text-background"
                                )}>
                                    {msg.role === 'assistant' ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                                </div>
                                <div className={clsx(
                                    "px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-[85%]",
                                    msg.role === 'assistant'
                                        ? "bg-white/80 border border-border/60 text-foreground"
                                        : "bg-primary text-black font-semibold shadow-md shadow-primary/15"
                                )}>
                                    {renderContent(msg.content)}
                                    <p className="text-[8px] opacity-40 mt-1.5 font-black uppercase tracking-wider">
                                        {msg.timestamp.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/20 flex items-center justify-center animate-pulse">
                                    <Bot className="w-3.5 h-3.5 text-primary" />
                                </div>
                                <div className="bg-white/80 border border-border/60 px-4 py-3 rounded-2xl flex gap-1.5 items-center">
                                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.15s]" />
                                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.3s]" />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="shrink-0 p-4 border-t border-border/50 bg-white/30">
                        <div className="relative">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
                                }}
                                placeholder="Pregúntame algo... (Enter para enviar)"
                                rows={2}
                                className="w-full bg-white/80 border border-border/60 rounded-2xl px-4 py-3 pr-12 outline-none focus:border-primary/50 transition-all text-sm resize-none custom-scrollbar"
                            />
                            <button
                                onClick={() => sendMessage(input)}
                                disabled={!input.trim() || isLoading}
                                className="absolute right-3 bottom-3 p-2 bg-primary text-black rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-[8px] text-center text-muted-foreground/40 mt-2 font-black uppercase tracking-widest">
                            MiWi puede cometer errores · Shift+Enter para salto de línea
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}
