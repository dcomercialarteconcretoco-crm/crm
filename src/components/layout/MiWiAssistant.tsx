"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Send,
    Bot,
    User,
    MessageSquare,
    Sparkles,
    RefreshCcw,
    ChevronLeft,
    ChevronRight,
    Search,
    BrainCircuit,
    Zap
} from 'lucide-react';
import { clsx } from 'clsx';
import { GoogleGenerativeAI } from "@google/generative-ai";
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

export function MiWiAssistant({ isOpen, onClose }: MiWiAssistantProps) {
    const { settings } = useApp();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: '¡Hola Juan! Soy MiWi, tu asistente de inteligencia para Arte Concreto. ¿En qué puedo ayudarte hoy?',
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Configuración de Gemini (Dinámica desde Settings)
    const getGenAI = () => {
        const key = settings.geminiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
        return new GoogleGenerativeAI(key);
    };
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const currentGenAI = getGenAI();
            const configKey = settings.geminiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

            // Si no hay API key, simular respuesta por ahora para que no falle el UI
            if (!configKey) {
                setTimeout(() => {
                    const assistantMessage: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: 'Lo siento, la API Key de Gemini no está configurada aún. Por favor, regístrala en Configuración > Integraciones API para activar mi inteligencia completa.',
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, assistantMessage]);
                    setIsLoading(false);
                }, 1000);
                return;
            }

            const model = currentGenAI.getGenerativeModel({
                model: "gemini-1.5-flash",
                systemInstruction: "Eres MiWi, un asistente de inteligencia artificial experto en ventas y gestión de Clientes para 'Arte Concreto', una empresa líder en mobiliario de concreto, cubiertas de cocina de lujo y soluciones para espacios públicos. Tu objetivo es ayudar a Juan Sierra (SuperAdmin) y su equipo a vender más y gestionar mejor sus leads. Eres audaz, profesional, premium y enfocado en resultados. Analizas pipelines, sugieres cierres de ventas, redactas correos persuasivos y das consejos sobre proyectos de concreto (mármol, terrazo, microcemento). Si te preguntan por recomendaciones, básate en la eficiencia y el valor del lead."
            });
            const chat = model.startChat({
                history: messages.map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }],
                })),
                generationConfig: {
                    maxOutputTokens: 1000,
                    temperature: 0.7,
                },
            });

            const result = await chat.sendMessage(input);
            const response = await result.response;
            const text = response.text();

            const assistantMessage: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: text,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error("Error calling Gemini:", error);
            const errorMessage: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: 'Hubo un error al conectar con mi cerebro (Gemini). Por favor, verifica la conexión.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100]"
                    />

                    {/* Assistant Panel */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 h-full w-full max-w-[450px] bg-[#0a0a0b] border-l border-white/10 z-[101] shadow-[-20px_0_50px_rgba(0,0,0,0.5)] flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(250,181,16,0.3)]">
                                    <BrainCircuit className="w-6 h-6 text-black" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                                        MiWi <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full uppercase">Intelligence</span>
                                    </h2>
                                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                        Sincronizado con Gemini 1.5
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/5 rounded-full border border-white/10 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Quick Insights / Suggestions */}
                        <div className="p-4 border-b border-white/5 bg-white/[0.01] flex gap-2 overflow-x-auto scrollbar-hide">
                            <button className="flex-shrink-0 flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all">
                                <Sparkles className="w-3 h-3 text-primary" />
                                Analizar Pipeline
                            </button>
                            <button className="flex-shrink-0 flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all">
                                <Zap className="w-3 h-3 text-primary" />
                                Recomendación Lead
                            </button>
                            <button className="flex-shrink-0 flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all">
                                <RefreshCcw className="w-3 h-3 text-primary" />
                                Resumen del Día
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={clsx(
                                        "flex gap-3 max-w-[85%]",
                                        msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                                    )}
                                >
                                    <div className={clsx(
                                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                                        msg.role === 'assistant' ? "bg-primary/20 text-primary border border-primary/20" : "bg-white/10 text-white"
                                    )}>
                                        {msg.role === 'assistant' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                    </div>
                                    <div className={clsx(
                                        "p-4 rounded-2xl text-sm leading-relaxed",
                                        msg.role === 'assistant'
                                            ? "bg-white/[0.03] border border-white/5 text-white/90"
                                            : "bg-primary text-black font-medium shadow-lg shadow-primary/10"
                                    )}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex gap-3 max-w-[85%]">
                                    <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary border border-primary/20 flex items-center justify-center animate-pulse">
                                        <Bot className="w-4 h-4" />
                                    </div>
                                    <div className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl flex gap-1">
                                        <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></span>
                                        <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                        <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Footer / Input Area */}
                        <div className="p-6 border-t border-white/5 bg-white/[0.02]">
                            <div className="relative">
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                    placeholder="Pregúntame algo sobre tus ventas..."
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 pr-14 outline-none focus:border-primary/50 transition-all font-medium text-sm resize-none min-h-[60px] max-h-[150px]"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!input.trim() || isLoading}
                                    className="absolute right-3 bottom-3 p-2.5 bg-primary text-black rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 disabled:bg-white/10 disabled:text-white/40"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-[9px] text-center text-muted-foreground mt-3 font-bold uppercase tracking-widest opacity-40">
                                MiWi puede cometer errores. Verifica la información importante.
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
