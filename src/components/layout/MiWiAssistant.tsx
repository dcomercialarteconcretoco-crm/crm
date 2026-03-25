"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
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
    FileText,
    AlertTriangle,
    Target,
    ArrowRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useApp, Client, Task, Quote } from '@/context/AppContext';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface MiWiAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    onNewSuggestion?: () => void;
}

const QUICK_ACTIONS = [
    { label: 'Diagnóstico', icon: Sparkles, prompt: '## ANÁLISIS GENERAL\nRevisa todo el CRM y dame un diagnóstico completo: oportunidades calientes, leads en riesgo, cotizaciones sin seguimiento y cuál debería ser mi próxima acción prioritaria.' },
    { label: 'Oportunidades', icon: Target, prompt: '## OPORTUNIDADES DE CIERRE\n¿Cuáles son los leads o cotizaciones con mayor probabilidad de cierre esta semana? Dame un ranking con argumentos y el paso a seguir para cada uno.' },
    { label: 'Leads en Riesgo', icon: AlertTriangle, prompt: '## LEADS EN RIESGO\n¿Cuáles leads llevan más tiempo sin contacto o actividad? Identifica los que podríamos perder y qué hacer para recuperarlos.' },
    { label: 'Pipeline', icon: TrendingUp, prompt: '## ANÁLISIS DE PIPELINE\nAnaliza la distribución del pipeline por etapas y valor. ¿Dónde hay cuellos de botella? ¿Qué etapa necesita más atención?' },
    { label: 'Seguimientos', icon: Zap, prompt: '## SEGUIMIENTOS PENDIENTES\n¿Qué cotizaciones enviadas no han recibido respuesta? Redacta un mensaje de seguimiento personalizado para el cliente más importante.' },
    { label: 'Resumen Ejecutivo', icon: FileText, prompt: '## RESUMEN EJECUTIVO DEL DÍA\nDame un resumen ejecutivo del estado comercial: métricas clave, logros, pendientes urgentes y la estrategia recomendada para hoy.' },
];

/** Builds a rich CRM snapshot to inject into every MiWi request */
function buildCrmSnapshot(
    clients: Client[],
    tasks: Task[],
    quotes: Quote[],
    userName?: string
): string {
    const today = new Date();
    const fmt = (d: string) => {
        if (!d) return 'sin fecha';
        const diff = Math.floor((today.getTime() - new Date(d).getTime()) / 86400000);
        return diff === 0 ? 'hoy' : diff === 1 ? 'ayer' : `hace ${diff} días`;
    };

    const lines: string[] = [
        `=== SNAPSHOT CRM ARTE CONCRETO — ${today.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} ===`,
        `Usuario activo: ${userName || 'Equipo comercial'}`,
        '',
    ];

    // --- CLIENTS ---
    lines.push(`CLIENTES (${clients.length} total):`);
    if (clients.length === 0) {
        lines.push('  (sin clientes registrados)');
    } else {
        clients.slice(0, 30).forEach(c => {
            lines.push(
                `  • ${c.name}${c.company ? ' / ' + c.company : ''} | ${c.status} | Último contacto: ${fmt(c.lastContact)} | Valor: ${c.value || 'N/A'} | Score: ${c.score || 0} | Ciudad: ${c.city || 'N/A'}`
            );
        });
    }
    lines.push('');

    // --- PIPELINE / TASKS ---
    const openTasks = tasks.filter(t => !['Cerrado', 'Closed', 'Won', 'Lost'].includes(t.stageId || ''));
    lines.push(`PIPELINE / LEADS ACTIVOS (${openTasks.length} de ${tasks.length} total):`);
    if (tasks.length === 0) {
        lines.push('  (sin leads en el pipeline)');
    } else {
        tasks.slice(0, 30).forEach(t => {
            lines.push(
                `  • "${t.title}" | Cliente: ${t.client} | Etapa: ${t.stageId || 'sin etapa'} | Prioridad: ${t.priority} | Valor: ${t.value || 'N/A'} | Asignado: ${t.assignedTo || 'sin asignar'} | AI Score: ${t.aiScore || 0}`
            );
        });
    }
    lines.push('');

    // --- QUOTES ---
    const draftQuotes = quotes.filter(q => q.status === 'Draft');
    const sentQuotes = quotes.filter(q => q.status === 'Sent');
    const approvedQuotes = quotes.filter(q => q.status === 'Approved');
    const totalValue = quotes.reduce((s, q) => s + (q.numericTotal || 0), 0);

    lines.push(`COTIZACIONES (${quotes.length} total | ${draftQuotes.length} borrador | ${sentQuotes.length} enviadas | ${approvedQuotes.length} aprobadas):`);
    lines.push(`  Valor total pipeline cotizaciones: $${totalValue.toLocaleString('es-CO')}`);
    if (quotes.length === 0) {
        lines.push('  (sin cotizaciones registradas)');
    } else {
        quotes.slice(0, 20).forEach(q => {
            lines.push(
                `  • ${q.number || 'Sin número'} | Cliente: ${q.client || 'N/A'} | Total: ${q.total || 'N/A'} | Estado: ${q.status} | Fecha: ${q.date || 'N/A'} | Aperturas: ${q.opens || 0}`
            );
        });
    }
    lines.push('');

    // --- RISK ALERTS ---
    const riskyLeads = clients.filter(c => {
        if (!c.lastContact) return true;
        const days = Math.floor((today.getTime() - new Date(c.lastContact).getTime()) / 86400000);
        return days > 14 && c.status !== 'Inactive';
    });
    if (riskyLeads.length > 0) {
        lines.push(`ALERTAS — CLIENTES SIN CONTACTO +14 DÍAS (${riskyLeads.length}):`);
        riskyLeads.forEach(c => {
            const days = c.lastContact
                ? Math.floor((today.getTime() - new Date(c.lastContact).getTime()) / 86400000)
                : 999;
            lines.push(`  ⚠ ${c.name} — ${days === 999 ? 'nunca contactado' : days + ' días sin contacto'}`);
        });
        lines.push('');
    }

    const oldDrafts = quotes.filter(q => {
        if (q.status !== 'Draft' || !q.date) return false;
        const days = Math.floor((today.getTime() - new Date(q.date).getTime()) / 86400000);
        return days > 7;
    });
    if (oldDrafts.length > 0) {
        lines.push(`ALERTAS — COTIZACIONES EN BORRADOR +7 DÍAS (${oldDrafts.length}):`);
        oldDrafts.forEach(q => {
            lines.push(`  ⚠ ${q.number || 'Sin número'} (${q.client || 'sin cliente'}) — creada ${fmt(q.date)}`);
        });
        lines.push('');
    }

    lines.push('=== FIN SNAPSHOT ===');
    return lines.join('\n');
}

/** Extract CRM entity links mentioned in an AI response */
function extractActionLinks(
    text: string,
    clients: Client[],
    tasks: Task[],
    quotes: Quote[]
): { label: string; href: string; icon: string }[] {
    const results: { label: string; href: string; icon: string }[] = [];
    const seen = new Set<string>();
    const low = text.toLowerCase();

    // Match clients by name or company (case-insensitive, partial)
    clients.forEach(c => {
        const names = [c.name, c.company].filter(n => n && n.length > 2) as string[];
        if (names.some(n => low.includes(n.toLowerCase()))) {
            if (!seen.has(c.id)) {
                seen.add(c.id);
                results.push({ label: `Ver ficha: ${c.company || c.name}`, href: `/leads/${c.id}`, icon: '👤' });
            }
        }
    });

    // Match tasks → prefer linking to client profile
    tasks.forEach(t => {
        const tNames = [t.title, t.client, t.contactName].filter(n => n && n.length > 3) as string[];
        if (tNames.some(n => low.includes(n.toLowerCase()))) {
            const clientId = t.clientId ||
                clients.find(c =>
                    c.name?.toLowerCase() === t.client?.toLowerCase() ||
                    c.company?.toLowerCase() === t.client?.toLowerCase()
                )?.id;
            const key = `task-${clientId || t.id}`;
            if (!seen.has(key)) {
                seen.add(key);
                results.push(clientId
                    ? { label: `Pipeline: ${t.client}`, href: `/leads/${clientId}`, icon: '📌' }
                    : { label: 'Ver Pipeline', href: '/pipeline', icon: '📌' }
                );
            }
        }
    });

    // Match quote numbers
    quotes.forEach(q => {
        if (q.number && text.includes(q.number)) {
            const key = `quote-${q.id}`;
            if (!seen.has(key)) {
                seen.add(key);
                const clientId = clients.find(c =>
                    c.name?.toLowerCase() === q.client?.toLowerCase() ||
                    c.company?.toLowerCase() === q.client?.toLowerCase()
                )?.id || (q.clientId ? q.clientId : undefined);
                results.push(clientId
                    ? { label: `Cotización ${q.number}`, href: `/leads/${clientId}`, icon: '📄' }
                    : { label: `Cotización ${q.number}`, href: '/quotes', icon: '📄' }
                );
            }
        }
    });

    // Context-based fallback links if no entity found
    if (results.length === 0) {
        if (low.includes('pipeline') || low.includes('etapa') || low.includes('lead')) {
            results.push({ label: 'Ir al Pipeline', href: '/pipeline', icon: '📌' });
        }
        if (low.includes('cotizaci')) {
            results.push({ label: 'Ver Cotizaciones', href: '/quotes', icon: '📄' });
        }
        if (low.includes('cliente') || low.includes('directorio')) {
            results.push({ label: 'Ver Clientes', href: '/clients', icon: '👥' });
        }
    }

    return results.slice(0, 4); // max 4 action buttons
}

export function MiWiAssistant({ isOpen, onClose, onNewSuggestion }: MiWiAssistantProps) {
    const { settings, currentUser, clients, tasks, quotes } = useApp();
    const firstName = currentUser?.name?.split(' ')[0] || '';

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [hasAutoAnalyzed, setHasAutoAnalyzed] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen && textareaRef.current) textareaRef.current.focus();
    }, [isOpen]);

    // Auto-analysis on first open
    useEffect(() => {
        if (!isOpen || hasAutoAnalyzed) return;
        setHasAutoAnalyzed(true);
        runAutoAnalysis();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const runAutoAnalysis = async () => {
        setIsLoading(true);

        const snapshot = buildCrmSnapshot(clients, tasks, quotes, currentUser?.name);
        const greeting = `Hola${firstName ? ' ' + firstName : ''}! Acabo de revisar el CRM. Aquí están las oportunidades y alertas más importantes para hoy:`;

        // Optimistic greeting
        const greetingMsg: Message = {
            id: 'greeting',
            role: 'assistant',
            content: greeting,
            timestamp: new Date()
        };
        setMessages([greetingMsg]);

        const apiKey = settings.geminiKey || ''; // server uses GEMINI_API_KEY env var as fallback

        const autoPrompt = `${snapshot}\n\n## ANÁLISIS AUTOMÁTICO DE APERTURA\nRevisa el snapshot del CRM y dame un diagnóstico ejecutivo con EXACTAMENTE este formato:\n\n1. **Oportunidades Calientes:** lista máx 2-3 clientes con su nombre EXACTO del CRM, el valor en pesos y la acción concreta a hacer (ej: "llamar hoy", "enviar seguimiento", "cerrar propuesta")\n2. **Alertas:** leads o cotizaciones que necesitan atención urgente, con nombre exacto del cliente\n3. **Acción #1 para HOY:** una sola acción específica con el nombre del cliente y qué hacer\n\nReglas: usa negritas para nombres de clientes, usa bullets para listas, máximo 180 palabras, NO uses asteriscos sueltos como viñetas (usa guiones), sé directo y actionable.`;

        try {
            const res = await fetch('/api/assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: autoPrompt,
                    messages: [],
                    apiKey,
                })
            });

            const data = await res.json();
            setMessages([{
                id: 'auto-analysis',
                role: 'assistant',
                content: res.ok ? data.text : `¡Hola${firstName ? ' ' + firstName : ''}! Soy MiWi, listo para ayudarte. Tengo acceso a **${clients.length} clientes**, **${tasks.length} leads** y **${quotes.length} cotizaciones**. ¿En qué te ayudo?`,
                timestamp: new Date()
            }]);
            if (!isOpen) onNewSuggestion?.();
        } catch {
            setMessages([{
                id: 'auto-fallback',
                role: 'assistant',
                content: `¡Hola${firstName ? ' ' + firstName : ''}! Soy MiWi. Tengo acceso a **${clients.length} clientes**, **${tasks.length} leads** y **${quotes.length} cotizaciones**. ¿En qué te ayudo hoy?`,
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const sendMessage = async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        const snapshot = buildCrmSnapshot(clients, tasks, quotes, currentUser?.name);
        const enrichedInput = `${snapshot}\n\n${text}`;

        try {
            const res = await fetch('/api/assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: enrichedInput,
                    messages: messages.map(m => ({ role: m.role, content: m.content })),
                    apiKey: settings.geminiKey || '',
                })
            });

            const data = await res.json();
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: res.ok ? data.text : (data.error || 'Lo siento, hubo un error al conectar con MiWi.'),
                timestamp: new Date()
            }]);
            if (!isOpen) onNewSuggestion?.();
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

    const handleReset = () => {
        setMessages([]);
        setHasAutoAnalyzed(false);
        setTimeout(() => {
            setHasAutoAnalyzed(false);
            runAutoAnalysis();
        }, 100);
    };

    const renderContent = (text: string) => {
        const md = (s: string) => s
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*((?!\s)[^*]+)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code class="bg-primary/10 text-primary px-1 rounded text-[10px] font-mono">$1</code>');

        return text.split('\n').map((line, i) => {
            const trimmed = line.trim();

            // Empty line → spacer
            if (!trimmed) return <div key={i} className="h-1.5" />;

            // H2: ## text
            if (trimmed.startsWith('## ')) return (
                <p key={i} className="font-black text-[11px] uppercase tracking-widest text-primary mt-3 mb-0.5"
                    dangerouslySetInnerHTML={{ __html: md(trimmed.slice(3)) }} />
            );

            // H3: ### text
            if (trimmed.startsWith('### ')) return (
                <p key={i} className="font-black text-[10px] uppercase tracking-widest text-primary/80 mt-2 mb-0.5"
                    dangerouslySetInnerHTML={{ __html: md(trimmed.slice(4)) }} />
            );

            // Numbered list: "1. text" or "1) text"
            const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
            if (numMatch) return (
                <div key={i} className="flex gap-2 mt-1.5">
                    <span className="shrink-0 w-4 h-4 rounded-full bg-primary/20 text-primary text-[8px] font-black flex items-center justify-center mt-0.5">{numMatch[1]}</span>
                    <p className="flex-1 text-sm leading-snug" dangerouslySetInnerHTML={{ __html: md(numMatch[2]) }} />
                </div>
            );

            // Bullet: "* text" or "- text" or "• text"
            const bulletMatch = trimmed.match(/^[*\-•]\s+(.+)$/);
            if (bulletMatch) return (
                <div key={i} className="flex gap-2 mt-1.5 items-start">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                    <p className="flex-1 text-sm leading-snug" dangerouslySetInnerHTML={{ __html: md(bulletMatch[1]) }} />
                </div>
            );

            // Normal line
            return (
                <p key={i} className="text-sm leading-snug mt-1"
                    dangerouslySetInnerHTML={{ __html: md(trimmed) }} />
            );
        });
    };

    return (
        <div className={clsx(
            "flex flex-col h-full bg-[linear-gradient(180deg,rgba(255,253,248,0.99),rgba(244,237,225,0.97))] border-l border-border/50 transition-all duration-300 overflow-hidden",
            isOpen ? "w-[400px] min-w-[400px]" : "w-0 min-w-0"
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
                                    MiWi
                                    <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-black uppercase">IA</span>
                                </h2>
                                <p className="text-[9px] text-muted-foreground font-black uppercase tracking-wider flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block" />
                                    Gemini 2.5 Flash · Acceso completo al CRM
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleReset}
                                title="Nuevo análisis"
                                className="p-2 hover:bg-primary/10 rounded-xl border border-border/60 transition-all"
                            >
                                <RefreshCcw className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={onClose} className="p-2 hover:bg-accent/60 rounded-xl border border-border/60 transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Stats bar */}
                    <div className="shrink-0 px-4 py-2 border-b border-border/40 bg-white/30 flex items-center gap-3 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3 text-primary" />{clients.length} clientes</span>
                        <span className="text-border/60">·</span>
                        <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-primary" />{tasks.length} leads</span>
                        <span className="text-border/60">·</span>
                        <span className="flex items-center gap-1"><FileText className="w-3 h-3 text-primary" />{quotes.length} cotizaciones</span>
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
                                    "rounded-2xl text-sm leading-relaxed max-w-[88%]",
                                    msg.role === 'assistant'
                                        ? "bg-white/80 border border-border/60 text-foreground"
                                        : "bg-primary text-black font-semibold shadow-md shadow-primary/15"
                                )}>
                                    <div className="px-4 pt-3 pb-2">
                                        {renderContent(msg.content)}
                                        <p className="text-[8px] opacity-40 mt-1.5 font-black uppercase tracking-wider">
                                            {msg.timestamp.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    {msg.role === 'assistant' && (() => {
                                        const links = extractActionLinks(msg.content, clients, tasks, quotes);
                                        if (links.length === 0) return null;
                                        return (
                                            <div className="px-3 pb-3 flex flex-wrap gap-1.5 border-t border-border/30 pt-2.5">
                                                {links.map((link, idx) => (
                                                    <Link
                                                        key={idx}
                                                        href={link.href}
                                                        onClick={onClose}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary hover:text-black text-primary border border-primary/20 hover:border-primary rounded-xl text-[9px] font-black uppercase tracking-wide transition-all group"
                                                    >
                                                        <span>{link.icon}</span>
                                                        <span>{link.label}</span>
                                                        <ArrowRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                                                    </Link>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/20 flex items-center justify-center animate-pulse">
                                    <Bot className="w-3.5 h-3.5 text-primary" />
                                </div>
                                <div className="bg-white/80 border border-border/60 px-4 py-3 rounded-2xl flex gap-1.5 items-center">
                                    <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider mr-1">Analizando CRM</span>
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
                                placeholder="Pregúntame sobre clientes, oportunidades, cotizaciones..."
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
                            MiWi ve todos tus datos en tiempo real · Shift+Enter para salto de línea
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}
