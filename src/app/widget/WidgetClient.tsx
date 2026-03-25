"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { Bot, Send, User, X, Loader2 } from "lucide-react";
import { useApp } from "@/context/AppContext";

interface WidgetClientProps {
  initialBotName?: string;
  initialPrimaryColor?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export function WidgetClient({ initialBotName, initialPrimaryColor }: WidgetClientProps) {
  const { settings } = useApp();
  const savedBotSettings = settings.botSettings;
  const botName = initialBotName || savedBotSettings?.widget.botName || "MiWi AI";
  const primaryColor = initialPrimaryColor || savedBotSettings?.widget.primaryColor || "#FAB510";

  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [sessionId] = useState(() => `wchat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`);
  const [clientSaved, setClientSaved] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState("");
  const [lead, setLead] = useState({ name: "", email: "", phone: "", city: "", company: "" });
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Hola, soy ${botName}. Estoy listo para ayudarte con mobiliario, cotizaciones y tiempos de entrega de Arte Concreto.`,
      timestamp: new Date().toISOString(),
    },
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const captureFields = savedBotSettings?.captureFields || {
    name: true, email: true, phone: true, city: true, company: true,
  };

  const requiredFields = useMemo(
    () =>
      Object.entries(captureFields)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key),
    [captureFields]
  );

  const closeWidget = () => {
    window.parent.postMessage({ type: "miwi-widget-close" }, "*");
  };

  // Save conversation to CRM DB
  const saveConversation = async (msgs: ChatMessage[]) => {
    try {
      await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation: {
            id: sessionId,
            lead,
            messages: msgs,
            createdAt: msgs[0]?.timestamp || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: "active",
            source: "widget",
          },
        }),
      });
    } catch (e) {
      console.error("Widget: failed to save conversation", e);
    }
  };

  // Create client in CRM
  const createCrmClient = async () => {
    if (clientSaved) return;
    try {
      const clientId = `widget-${sessionId}`;
      await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: clientId,
          name: lead.name || "Lead Web",
          company: lead.company || "",
          email: lead.email || "",
          phone: lead.phone || "",
          city: lead.city || "",
          status: "Lead",
          value: "$0",
          ltv: 0,
          lastContact: new Date().toISOString().split("T")[0],
          score: 15,
          category: "Widget Lead",
          registrationDate: new Date().toISOString().split("T")[0],
        }),
      });
      setClientSaved(true);
    } catch (e) {
      console.error("Widget: failed to create client", e);
    }
  };

  const startConversation = async () => {
    const missing = requiredFields.some((field) => !lead[field as keyof typeof lead].trim());
    if (missing) return;

    const welcomeMsg: ChatMessage = {
      role: "assistant",
      content: `Perfecto ${lead.name ? lead.name.split(" ")[0] : ""}. Ya registré tus datos. Cuéntame qué producto o proyecto necesitas y te ayudo.`,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, welcomeMsg];
    setMessages(newMessages);
    setStarted(true);

    // Save to DB in background
    await createCrmClient();
    await saveConversation(newMessages);
  };

  const sendMessage = async () => {
    const input = draft.trim();
    if (!input || loading) return;

    const userMsg: ChatMessage = { role: "user", content: input, timestamp: new Date().toISOString() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setDraft("");
    setLoading(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          messages: nextMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();
      const botMsg: ChatMessage = {
        role: "assistant",
        content: data?.text || data?.error || "No pude responder en este momento.",
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...nextMessages, botMsg];
      setMessages(finalMessages);

      // Persist conversation after every exchange
      await saveConversation(finalMessages);
    } catch (error) {
      console.error("Widget assistant error", error);
      const errMsg: ChatMessage = {
        role: "assistant",
        content: "No pude conectar con MiWi en este momento. Intenta de nuevo.",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const inputClassName =
    "w-full rounded-2xl border border-white/80 bg-white/78 px-4 py-3 text-sm font-bold text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/50";

  return (
    <div className="min-h-screen bg-premium-gradient p-3">
      <div className="surface-panel mx-auto flex h-[calc(100vh-1.5rem)] max-h-[720px] w-full max-w-[420px] flex-col overflow-hidden rounded-[2rem]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg"
              style={{ backgroundColor: primaryColor }}
            >
              <Bot className="h-5 w-5 text-black" />
            </div>
            <div>
              <p className="text-sm font-black text-foreground">{botName}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">En línea</p>
            </div>
          </div>
          <button
            onClick={closeWidget}
            className="rounded-xl border border-border/60 bg-white/60 p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        {!started ? (
          <div className="flex-1 overflow-y-auto px-4 py-5">
            <div className="space-y-5">
              <div className="rounded-[1.75rem] border border-border/50 bg-white/48 p-5">
                <h1 className="text-xl font-black tracking-tight text-foreground">Antes de comenzar</h1>
                <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
                  Déjanos tus datos básicos para atenderte mejor y vincular la conversación con el equipo comercial.
                </p>
              </div>
              <div className="space-y-3">
                {captureFields.name && (
                  <input className={inputClassName} placeholder="Nombre completo" value={lead.name}
                    onChange={(e) => setLead((p) => ({ ...p, name: e.target.value }))} />
                )}
                {captureFields.email && (
                  <input className={inputClassName} placeholder="Correo electrónico" type="email" value={lead.email}
                    onChange={(e) => setLead((p) => ({ ...p, email: e.target.value }))} />
                )}
                {captureFields.phone && (
                  <input className={inputClassName} placeholder="WhatsApp / Teléfono" value={lead.phone}
                    onChange={(e) => setLead((p) => ({ ...p, phone: e.target.value }))} />
                )}
                {captureFields.city && (
                  <input className={inputClassName} placeholder="Ciudad" value={lead.city}
                    onChange={(e) => setLead((p) => ({ ...p, city: e.target.value }))} />
                )}
                {captureFields.company && (
                  <input className={inputClassName} placeholder="Empresa / Proyecto" value={lead.company}
                    onChange={(e) => setLead((p) => ({ ...p, company: e.target.value }))} />
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[85%] rounded-[1.5rem] px-4 py-3 text-sm font-medium leading-relaxed ${
                    message.role === "assistant"
                      ? "border border-border/60 bg-white/76 text-foreground"
                      : "text-black"
                  }`}
                  style={message.role === "user" ? { backgroundColor: primaryColor } : undefined}
                >
                  <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-70">
                    {message.role === "assistant" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                    <span>{message.role === "assistant" ? botName : "Tú"}</span>
                  </div>
                  {message.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-[1.5rem] border border-border/60 bg-white/76 px-4 py-3 text-sm font-medium text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {botName} está escribiendo...
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border/60 px-4 py-4">
          {!started ? (
            <button
              onClick={startConversation}
              className="w-full rounded-2xl px-4 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-black shadow-lg transition-transform hover:scale-[1.01]"
              style={{ backgroundColor: primaryColor }}
            >
              Iniciar conversación
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <input
                className={inputClassName}
                placeholder="Escribe tu mensaje..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); sendMessage(); }
                }}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !draft.trim()}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-black transition-all disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
