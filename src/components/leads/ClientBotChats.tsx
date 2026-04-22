"use client";

import React, { useEffect, useState } from 'react';
import { Bot, MessageSquare, Loader2, Clock } from 'lucide-react';

interface BotConversation {
    id: string;
    lead: { name?: string; email?: string; phone?: string; city?: string; company?: string };
    messages: { role: 'user' | 'assistant'; content: string; timestamp: string }[];
    createdAt: string;
    updatedAt: string;
    status: 'active' | 'closed';
    clientId?: string;
    source: 'widget' | 'whatsapp';
}

export function ClientBotChats({ clientEmail, clientPhone, clientId }: {
    clientEmail?: string;
    clientPhone?: string;
    clientId?: string;
}) {
    const [loading, setLoading] = useState(true);
    const [conversations, setConversations] = useState<BotConversation[]>([]);
    const [selected, setSelected] = useState<BotConversation | null>(null);

    useEffect(() => {
        fetch('/api/conversations', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                const list: BotConversation[] = Array.isArray(data.conversations) ? data.conversations : [];
                const normalizedEmail = (clientEmail || '').toLowerCase().trim();
                const normalizedPhone = (clientPhone || '').replace(/\D/g, '');
                const matches = list.filter(c => {
                    if (clientId && c.clientId === clientId) return true;
                    const em = (c.lead?.email || '').toLowerCase().trim();
                    const ph = (c.lead?.phone || '').replace(/\D/g, '');
                    if (normalizedEmail && em && em === normalizedEmail) return true;
                    if (normalizedPhone && ph && ph === normalizedPhone) return true;
                    return false;
                });
                setConversations(matches);
                if (matches.length > 0) setSelected(matches[0]);
            })
            .catch(() => setConversations([]))
            .finally(() => setLoading(false));
    }, [clientEmail, clientPhone, clientId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (conversations.length === 0) {
        return (
            <div className="text-center py-10 bg-muted/30 border border-dashed border-border rounded-xl">
                <Bot className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Sin conversaciones con ConcreBOT</p>
                <p className="text-xs text-muted-foreground mt-1">Cuando este cliente chatee con el bot por WhatsApp o el widget web, aquí verás el hilo.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Bot className="w-3.5 h-3.5 text-primary" /> Chats con ConcreBOT ({conversations.length})
            </h3>

            {conversations.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {conversations.map(c => (
                        <button
                            key={c.id}
                            onClick={() => setSelected(c)}
                            className={`shrink-0 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                                selected?.id === c.id
                                    ? 'bg-primary/10 border-primary/30 text-primary'
                                    : 'bg-white border-border text-muted-foreground hover:bg-muted'
                            }`}
                        >
                            <span className="inline-flex items-center gap-1.5">
                                {c.source === 'whatsapp' ? <MessageSquare className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                                {new Date(c.updatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                                <span className="text-[10px] text-muted-foreground">· {c.messages.length} msg</span>
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {selected && (
                <div className="bg-white border border-border rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border text-xs">
                        <span className="inline-flex items-center gap-1.5 font-bold">
                            {selected.source === 'whatsapp' ? <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> : <Bot className="w-3.5 h-3.5 text-primary" />}
                            {selected.source === 'whatsapp' ? 'WhatsApp' : 'Widget Web'}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-muted-foreground">
                            {new Date(selected.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                        <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            {selected.status === 'active' ? 'Activa' : 'Cerrada'}
                        </span>
                    </div>
                    <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
                        {selected.messages.map((m, i) => (
                            <div
                                key={i}
                                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                                        m.role === 'user'
                                            ? 'bg-primary text-black rounded-br-md'
                                            : 'bg-muted text-foreground rounded-bl-md border border-border'
                                    }`}
                                >
                                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                                    <p className={`text-[10px] mt-1 ${m.role === 'user' ? 'text-black/50' : 'text-muted-foreground'}`}>
                                        {new Date(m.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
