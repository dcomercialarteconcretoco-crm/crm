"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Eye,
  FileText,
  PlusCircle,
  Plus,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { clsx } from "clsx";
import { useApp, Quote } from "@/context/AppContext";
import { generatePDFReport } from "@/lib/pdf-generator";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

const QUOTE_STATUS_LABEL: Record<string, string> = {
  Draft: 'Borrador',
  Sent: 'Enviado',
  Approved: 'Aprobado',
  Rejected: 'Rechazado',
  PENDING_APPROVAL: 'Pend. Aprobación',
};

export default function Home() {
  const { clients, tasks, quotes, settings, currentUser, updateQuote, addNotification, addAuditLog } = useApp();

  const userIsSuperAdmin = currentUser?.role === "SuperAdmin" || currentUser?.role === "Admin";
  const isAdmin = userIsSuperAdmin;
  const canExport = userIsSuperAdmin && settings.allowExports;

  const [carouselIdx, setCarouselIdx] = useState(0);
  const [carouselDir, setCarouselDir] = useState<'up' | 'down'>('up');

  const pendingQuotes = useMemo(
    () => quotes.filter((q) => q.status === "PENDING_APPROVAL"),
    [quotes]
  );

  const handleApproveQuote = async (q: Quote) => {
    if (q.pendingAction === 'send_email') {
      // Actually send the email
      try {
        const res = await fetch('/api/quotes/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quoteNumber: q.number,
            clientName: q.client,
            clientEmail: q.clientEmail,
            clientCompany: q.clientCompany || '',
            sellerName: q.sellerName || 'ArteConcreto',
            sellerId: q.sellerId || '',
            sentAt: new Date().toISOString(),
            sentByName: currentUser?.name || '',
            sentById: currentUser?.id || '',
            items: q.items || [],
            subtotal: q.subtotal || q.numericTotal,
            tax: q.tax || 0,
            total: q.numericTotal,
          }),
        });
        if (res.ok) {
          updateQuote(q.id, { status: 'Sent', pendingAction: undefined, requestedBy: undefined, requestedByName: undefined, requestedAt: undefined });
        } else {
          updateQuote(q.id, { status: 'Draft', pendingAction: undefined, requestedBy: undefined, requestedByName: undefined, requestedAt: undefined });
        }
      } catch {
        updateQuote(q.id, { status: 'Draft', pendingAction: undefined, requestedBy: undefined, requestedByName: undefined, requestedAt: undefined });
      }
    } else {
      // generate_pdf or send_whatsapp: revert to Draft so seller can proceed
      updateQuote(q.id, { status: 'Draft', pendingAction: undefined, requestedBy: undefined, requestedByName: undefined, requestedAt: undefined });
    }
    addAuditLog({
      userId: currentUser?.id || '',
      userName: currentUser?.name || 'Admin',
      userRole: currentUser?.role || 'Admin',
      action: 'QUOTE_APPROVED',
      targetId: q.id,
      targetName: q.client,
      details: `Admin ${currentUser?.name} aprobó cotización ${q.number} para ${q.client} solicitada por ${q.requestedByName}`,
      verified: true,
    });
    addNotification({
      title: `Cotización ${q.number} aprobada`,
      description: `Aprobada por ${currentUser?.name}. ${q.pendingAction === 'generate_pdf' ? 'El vendedor puede descargar el PDF.' : 'El email fue enviado al cliente.'}`,
      type: 'success',
      targetUserId: q.requestedBy,
    });
  };

  const handleRejectQuote = (q: Quote) => {
    updateQuote(q.id, { status: 'Draft', pendingAction: undefined, requestedBy: undefined, requestedByName: undefined, requestedAt: undefined });
    addAuditLog({
      userId: currentUser?.id || '',
      userName: currentUser?.name || 'Admin',
      userRole: currentUser?.role || 'Admin',
      action: 'QUOTE_REJECTED',
      targetId: q.id,
      targetName: q.client,
      details: `Admin ${currentUser?.name} rechazó cotización ${q.number} para ${q.client} solicitada por ${q.requestedByName}`,
      verified: true,
    });
    addNotification({
      title: `Cotización ${q.number} rechazada`,
      description: `Rechazada por el administrador. Contacta al admin para más detalles.`,
      type: 'alert',
      targetUserId: q.requestedBy,
    });
  };

  const totalForecast = useMemo(
    () => tasks.reduce((sum, task) => sum + task.numericValue, 0),
    [tasks]
  );

  const approvedQuotes = quotes.filter((quote) => quote.status === "Approved").length;
  const conversionRate =
    quotes.length > 0 ? ((approvedQuotes / quotes.length) * 100).toFixed(1) : "0.0";

  // Top buyers: only clients with at least one Approved quote, sorted by their total approved revenue
  const topClients = useMemo(() => {
    const approvedByClient = new Map<string, number>();
    quotes
      .filter(q => q.status === 'Approved' && q.clientId)
      .forEach(q => {
        const prev = approvedByClient.get(q.clientId!) || 0;
        approvedByClient.set(q.clientId!, prev + (q.numericTotal || 0));
      });
    return clients
      .filter(c => (approvedByClient.get(c.id) || 0) > 0)
      .map(c => ({ ...c, ltv: approvedByClient.get(c.id) || c.ltv }))
      .sort((a, b) => b.ltv - a.ltv)
      .slice(0, 4);
  }, [clients, quotes]);
  const recentQuotes = quotes.slice(0, 5);
  const liveTasks = tasks.slice(0, 4);

  // Returns up to 5 insight cards — all same importance, rotated in banner
  const allInsightCards = useMemo(() => {
    const cards: { label: string; title: string; body: string; href: string; cta: string }[] = [];

    if (clients.length === 0) {
      cards.push({
        label: "Alerta Prioritaria",
        title: "Aún no tienes clientes cargados.",
        body: "Sin clientes no hay seguimiento ni alertas comerciales. Registra el primero para activar el CRM.",
        href: "/clients",
        cta: "Crear cliente",
      });
      cards.push({
        label: "Siguiente Paso",
        title: "Crea tu primera cotización.",
        body: "Después del primer cliente, una cotización activa el ciclo comercial completo del CRM.",
        href: "/quotes/new",
        cta: "Nueva cotización",
      });
      return cards;
    }

    if (quotes.length === 0) {
      cards.push({
        label: "Oportunidad Detectada",
        title: "Hay clientes, pero no hay propuestas activas.",
        body: "Sin cotizaciones no hay señal de interés. Lanza la primera para medir intención comercial.",
        href: "/quotes/new",
        cta: "Crear cotización",
      });
      cards.push({
        label: "Cobertura",
        title: `${clients.length} cliente${clients.length > 1 ? 's' : ''} listo${clients.length > 1 ? 's' : ''} para cotizar.`,
        body: "Cada cliente registrado es una oportunidad de negocio. Activa el pipeline para no perder ninguna.",
        href: "/clients",
        cta: "Ver directorio",
      });
      return cards;
    }

    // Live leads
    liveTasks.slice(0, 2).forEach((t, i) => {
      cards.push({
        label: i === 0 ? "Seguimiento Vivo" : "Lead Activo",
        title: `${t.contactName || t.client} sigue activo sin cierre.`,
        body: "Define la siguiente acción concreta y mueve este negocio en el pipeline esta semana.",
        href: t.clientId ? `/leads/${t.clientId}` : "/pipeline",
        cta: "Ver lead",
      });
    });

    // Conversion alert
    if (approvedQuotes === 0 && quotes.length > 0) {
      cards.push({
        label: "Alerta de Conversión",
        title: `${quotes.length} cotizaciones emitidas, ninguna cerrada.`,
        body: "El embudo está activo pero sin cierres. Prioriza las propuestas de mayor valor para destrabar el pipeline.",
        href: "/quotes",
        cta: "Revisar cotizaciones",
      });
    }

    // Hottest quote
    const topQuote = recentQuotes.find(q => q.status === 'Sent' || q.status === 'Draft');
    if (topQuote) {
      cards.push({
        label: "Propuesta Caliente",
        title: `${topQuote.client || 'Un cliente'} tiene una propuesta sin respuesta.`,
        body: `La cotización ${topQuote.number} lleva tiempo en espera. Un seguimiento ahora puede inclinar la decisión.`,
        href: "/quotes",
        cta: "Ver cotización",
      });
    }

    // Top client
    if (topClients[0] && cards.length < 5) {
      cards.push({
        label: "Cliente Prioritario",
        title: `${topClients[0].name} es tu cliente de mayor valor.`,
        body: "Mantener la relación activa con tus mejores clientes multiplica las posibilidades de recompra.",
        href: `/leads/${topClients[0].id}`,
        cta: "Ver ficha",
      });
    }

    // Analytics nudge
    if (approvedQuotes > 0 && cards.length < 5) {
      cards.push({
        label: "Lectura del Día",
        title: `${approvedQuotes} cierre${approvedQuotes > 1 ? 's' : ''} aprobado${approvedQuotes > 1 ? 's' : ''}. Repite el patrón.`,
        body: `Llevas ${approvedQuotes} de ${quotes.length} cotizaciones convertidas. Analiza qué tienen en común los cierres exitosos.`,
        href: "/analytics",
        cta: "Ver analíticas",
      });
    }

    return cards.slice(0, 5);
  }, [approvedQuotes, clients.length, clients, liveTasks, quotes.length, recentQuotes, tasks.length, topClients]);

  // Auto-rotate every 6s
  useEffect(() => {
    if (allInsightCards.length < 2) return;
    const timer = setInterval(() => {
      setCarouselDir('up');
      setCarouselIdx(i => (i + 1) % allInsightCards.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [allInsightCards.length]);

  // Reset index when cards change (e.g. data loaded)
  useEffect(() => { setCarouselIdx(0); }, [allInsightCards.length]);

  const activeCard = allInsightCards[Math.min(carouselIdx, allInsightCards.length - 1)];

  const handleExport = () => {
    generatePDFReport({
      title: "Informe de Inteligencia Operacional",
      stats: [
        { label: "Propuestas Activas", value: tasks.length.toString(), change: "" },
        { label: "Ingresos Proyectados", value: formatCurrency(totalForecast), change: "" },
        { label: "Tasa Conversión", value: `${conversionRate}%`, change: "" },
        { label: "Leads Activos", value: clients.length.toString(), change: "" },
      ],
      topLeads: topClients.map((client) => ({
        name: client.name,
        company: client.company,
        score: client.score,
      })),
    });
  };

  const stats = [
    {
      label: "Proyección Comercial",
      value: formatCurrency(totalForecast),
      note: `${tasks.length} propuestas activas`,
      icon: TrendingUp,
      tone: "bg-primary/14 text-primary border-primary/20",
    },
    {
      label: "Conversión",
      value: `${conversionRate}%`,
      note: `${approvedQuotes} cierres aprobados`,
      icon: Target,
      tone: "bg-accent/42 text-primary border-primary/15",
    },
    {
      label: "Base de Clientes",
      value: clients.length.toString(),
      note: "seguimiento en vivo",
      icon: Users,
      tone: "bg-white text-foreground border-border/70",
    },
    {
      label: "Cotizaciones",
      value: quotes.length.toString(),
      note: "pipeline activo",
      icon: FileText,
      tone: "bg-accent/45 text-foreground border-primary/15",
    },
  ];

  return (
    <div className="space-y-4 lg:space-y-6 animate-in fade-in duration-700">

      {/* ── PENDING APPROVALS PANEL (admins only) ── */}
      {isAdmin && pendingQuotes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-[2rem] p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <h2 className="font-black text-amber-800 text-sm uppercase tracking-widest">
              {pendingQuotes.length} Aprobación{pendingQuotes.length > 1 ? 'es' : ''} Pendiente{pendingQuotes.length > 1 ? 's' : ''}
            </h2>
          </div>
          <div className="space-y-3">
            {pendingQuotes.map(q => (
              <div key={q.id} className="bg-white border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-black text-foreground">{q.number} — {q.client}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {q.requestedByName} solicita {q.pendingAction === 'send_email' ? 'enviar email' : q.pendingAction === 'send_whatsapp' ? 'enviar WhatsApp' : 'generar PDF'} · {q.total}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleApproveQuote(q)}
                    className="px-4 py-2 bg-emerald-500 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-emerald-400 transition-all"
                  >
                    ✓ Aprobar
                  </button>
                  <button
                    onClick={() => handleRejectQuote(q)}
                    className="px-4 py-2 bg-rose-500/10 text-rose-600 text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-rose-500/20 transition-all border border-rose-200"
                  >
                    ✕ Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 items-start gap-4 lg:gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-5">
          <div className="surface-panel rounded-[2rem] lg:rounded-[2.5rem] p-4 sm:p-5 lg:p-7 overflow-hidden relative">
            <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_top_right,rgba(250,181,16,0.14),transparent_58%)] pointer-events-none" />
            <div className="relative space-y-4 lg:space-y-5">
              {/* ── Rotating Insight Banner — fixed height so layout never jumps ── */}
              <div className="relative overflow-hidden rounded-[1.6rem] lg:rounded-[2rem] border border-primary/15 bg-[linear-gradient(135deg,rgba(250,181,16,0.08),rgba(255,255,255,0.58))] h-[220px] sm:h-[210px] lg:h-[220px] flex flex-col">
                {/* Card content — fills remaining space */}
                <Link
                  key={carouselIdx}
                  href={activeCard?.href ?? '#'}
                  className="group flex-1 block px-5 pt-5 sm:px-6 sm:pt-6 lg:px-7 lg:pt-7 animate-in slide-in-from-bottom-4 fade-in duration-400"
                >
                  <div className="flex items-start justify-between gap-4 h-full">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                        {activeCard?.label}
                      </p>
                      <h1 className="mt-2 text-[1.45rem] leading-[1.1] font-black tracking-[-0.04em] text-foreground sm:text-[1.7rem] lg:text-[2rem] line-clamp-2">
                        {activeCard?.title}
                      </h1>
                      <p className="mt-2 text-[13px] font-semibold leading-5 text-muted-foreground line-clamp-2">
                        {activeCard?.body}
                      </p>
                      <div className="mt-3 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                        {activeCard?.cta}
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                    <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-primary/20 bg-primary/10 text-primary">
                      <AlertTriangle className="h-4.5 w-4.5" />
                    </div>
                  </div>
                </Link>

                {/* Dot nav — pinned to bottom */}
                {allInsightCards.length > 1 && (
                  <div className="flex items-center gap-2 px-5 sm:px-6 lg:px-7 pb-4 pt-2 shrink-0">
                    {allInsightCards.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => { setCarouselDir('up'); setCarouselIdx(i); }}
                        className={clsx(
                          "transition-all duration-300 rounded-full",
                          i === carouselIdx ? "w-6 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-primary/25 hover:bg-primary/50"
                        )}
                      />
                    ))}
                    <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-muted-foreground/35">
                      {carouselIdx + 1} / {allInsightCards.length}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <Link
                  href="/quotes/new"
                  className="inline-flex min-h-[76px] items-center justify-between rounded-[1.35rem] border border-primary/25 bg-[linear-gradient(135deg,rgba(250,181,16,0.24),rgba(255,255,255,0.56))] px-4 sm:px-5 py-4 text-[10px] font-black uppercase tracking-[0.22em] text-foreground backdrop-blur-xl transition hover:-translate-y-0.5"
                >
                  <span className="inline-flex items-center gap-3">
                    <Plus className="h-4 w-4 text-primary" />
                    Nueva cotización
                  </span>
                  <ArrowRight className="h-4 w-4 text-primary" />
                </Link>

                <Link
                  href="/clients"
                  className="inline-flex min-h-[76px] items-center justify-between rounded-[1.35rem] border border-white/85 bg-white/56 px-4 sm:px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-foreground backdrop-blur-xl transition hover:-translate-y-0.5"
                >
                  <span className="inline-flex items-center gap-3">
                    <Users className="h-4 w-4 text-primary" />
                    Clientes
                  </span>
                  <ArrowRight className="h-4 w-4 text-primary" />
                </Link>

                {canExport ? (
                  <button
                    onClick={handleExport}
                    className="inline-flex min-h-[76px] items-center justify-between rounded-[1.35rem] border border-white/85 bg-white/52 px-4 sm:px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-foreground backdrop-blur-xl transition hover:-translate-y-0.5"
                  >
                    <span className="inline-flex items-center gap-3">
                      <FileText className="h-4 w-4 text-primary" />
                      Exportar PDF
                    </span>
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </button>
                ) : (
                  <Link
                    href="/pipeline"
                    className="inline-flex min-h-[76px] items-center justify-between rounded-[1.35rem] border border-white/85 bg-white/52 px-4 sm:px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-foreground backdrop-blur-xl transition hover:-translate-y-0.5"
                  >
                    <span className="inline-flex items-center gap-3">
                      <PlusCircle className="h-4 w-4 text-primary" />
                      Activar pipeline
                    </span>
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 lg:gap-4 lg:grid-cols-4">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[1.75rem] border border-white/85 bg-white/58 p-5 sm:p-6 overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground leading-tight">
                          {stat.label}
                        </p>
                        <p className={clsx(
                          "mt-3 leading-none font-black tracking-tight text-foreground whitespace-nowrap overflow-hidden",
                          stat.value.length <= 4  ? "text-[2rem]" :
                          stat.value.length <= 7  ? "text-[1.6rem]" :
                          stat.value.length <= 10 ? "text-[1.15rem]" :
                          stat.value.length <= 13 ? "text-[0.9rem]" :
                                                    "text-[0.78rem]"
                        )}>
                          {stat.value}
                        </p>
                        <p className="mt-2 text-[11px] font-semibold leading-4 text-muted-foreground">
                          {stat.note}
                        </p>
                      </div>
                      <div
                        className={clsx(
                          "shrink-0 flex h-10 w-10 items-center justify-center rounded-[1rem] border",
                          stat.tone
                        )}
                      >
                        <stat.icon className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 self-start surface-panel rounded-[2rem] lg:rounded-[2.5rem] p-5 lg:p-7">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
              Sales Funnel
            </p>
            <h2 className="mt-3 text-[1.7rem] lg:text-2xl font-black tracking-[-0.05em] text-foreground">
              Conversión por etapa
            </h2>
          </div>
          <div className="mt-6 space-y-5">
            {(() => {
              const maxVal = Math.max(clients.length, quotes.length, tasks.length, approvedQuotes, 1);
              return [
                { label: "Leads totales", value: clients.length || 0 },
                { label: "Cotizaciones", value: quotes.length || 0 },
                { label: "Propuestas activas", value: tasks.length || 0 },
                { label: "Cierres", value: approvedQuotes || 0 },
              ].map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span className="text-foreground">{item.label}</span>
                    <span className="text-muted-foreground">{item.value}</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/44 border border-white/70 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,rgba(250,181,16,0.95),rgba(250,181,16,0.35))] transition-all duration-500"
                      style={{ width: `${Math.max(4, Math.round((item.value / maxVal) * 100))}%` }}
                    />
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-6">
          <div className="surface-panel rounded-[2rem] lg:rounded-[2.5rem] p-5 lg:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-muted-foreground">
                  Radar de Actividad
                </p>
                <h2 className="mt-2 text-[1.7rem] lg:text-3xl font-black tracking-[-0.05em] text-foreground">
                  Propuestas abiertas por cliente
                </h2>
              </div>
              <Link
                href="/pipeline"
                className="inline-flex items-center gap-2 rounded-full border border-white/75 bg-white/34 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-foreground backdrop-blur-xl"
              >
                Ver Pipeline
                <ArrowRight className="h-3.5 w-3.5 text-primary" />
              </Link>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {liveTasks.length > 0 ? (
                liveTasks.map((task, index) => (
                  <Link
                    key={task.id}
                    href={`/leads/${task.clientId}`}
                    className="surface-card rounded-[2rem] p-5 transition hover:-translate-y-1"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-accent/48 text-primary border border-white/70">
                          <Eye className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                            Lead {String(index + 1).padStart(2, "0")}
                          </p>
                          <p className="mt-1 truncate text-sm font-black uppercase text-foreground">
                            {task.contactName || task.client}
                          </p>
                          <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
                            {task.title || task.client}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-full bg-primary/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                        Activo
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-4">
                      <span className="text-xl font-black tracking-[-0.05em] text-foreground">
                        {task.value}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                        seguimiento vivo
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="surface-card rounded-[1.5rem] lg:rounded-[2rem] p-6 text-sm font-semibold text-muted-foreground">
                  No hay actividad reciente detectada todavía.
                </div>
              )}
            </div>
          </div>

          <div className="surface-panel rounded-[2rem] lg:rounded-[2.5rem] overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-5 lg:px-8">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                  Historial Reciente
                </p>
                <h3 className="mt-2 text-[1.7rem] lg:text-2xl font-black tracking-[-0.04em] text-foreground">
                  Cotizaciones recientes
                </h3>
              </div>
              <Link
                href="/quotes"
                className="rounded-full border border-primary/18 bg-primary/14 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-foreground"
              >
                Abrir módulo
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-border/70 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    <th className="px-6 py-4 lg:px-8">Código</th>
                    <th className="px-6 py-4 lg:px-8">Cliente</th>
                    <th className="px-6 py-4 lg:px-8">Total</th>
                    <th className="px-6 py-4 lg:px-8">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentQuotes.length > 0 ? (
                    recentQuotes.map((quote) => (
                      <tr
                        key={quote.id}
                        className="border-b border-border/50 transition hover:bg-white/40"
                      >
                        <td className="px-6 py-4 lg:px-8 text-sm font-black text-foreground">
                          {quote.number}
                        </td>
                        <td className="px-6 py-4 lg:px-8 text-sm font-semibold text-muted-foreground">
                          {quote.client}
                        </td>
                        <td className="px-6 py-4 lg:px-8 text-sm font-black text-foreground">
                          {quote.total}
                        </td>
                        <td className="px-6 py-4 lg:px-8">
                          <span
                            className={clsx(
                              "inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]",
                              quote.status === "Approved"
                                ? "bg-emerald-500/12 text-emerald-600"
                                : quote.status === "Sent"
                                  ? "bg-primary/14 text-primary"
                                  : "bg-[#171717] text-[#fff4cc]"
                            )}
                          >
                            {QUOTE_STATUS_LABEL[quote.status] || quote.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-10 lg:px-8 text-sm font-semibold text-muted-foreground"
                      >
                        Aún no hay cotizaciones registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 space-y-4 lg:space-y-6">
          <div className="surface-panel rounded-[2rem] lg:rounded-[2.5rem] p-5 lg:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-muted-foreground">
              Clientes Premium
            </p>
            <h3 className="mt-2 text-[1.7rem] lg:text-2xl font-black tracking-[-0.05em] text-foreground">
              Top compradores
            </h3>
            <div className="mt-6 space-y-4">
              {topClients.length > 0 ? (
                topClients.map((client, index) => (
                  <div
                    key={client.id}
                    className="surface-card rounded-[1.8rem] p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-accent/48 border border-white/70 text-primary text-xs font-black">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black uppercase text-foreground">
                          {client.name}
                        </p>
                        <p className="truncate text-xs font-semibold text-muted-foreground">
                          {client.company || "Cliente directo"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-emerald-600">{formatCurrency(client.ltv)}</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-500">
                        compra confirmada
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="surface-card rounded-[1.8rem] p-5 space-y-1">
                  <p className="text-sm font-black text-muted-foreground">Sin compras cerradas aún.</p>
                  <p className="text-[10px] text-muted-foreground/60 font-medium">Los clientes con cotizaciones <span className="font-black text-emerald-600">Aprobadas</span> aparecerán aquí con su revenue real.</p>
                </div>
              )}
            </div>
          </div>

          <div className="surface-panel rounded-[2rem] lg:rounded-[2.5rem] p-5 lg:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-muted-foreground">
              Estado del Funnel
            </p>
            <h3 className="mt-2 text-[1.7rem] lg:text-2xl font-black tracking-[-0.05em] text-foreground">
              Distribución comercial
            </h3>
            <div className="mt-6 space-y-4">
              {(() => {
                const newLeads = clients.filter(c => c.status === 'Lead').length;
                const distMax = Math.max(newLeads, tasks.length, approvedQuotes, 1);
                return [
                  { label: "Nuevos leads", value: newLeads },
                  { label: "En seguimiento", value: tasks.length },
                  { label: "Ganado", value: approvedQuotes },
                ].map((item) => (
                  <div key={item.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-bold">
                      <span className="text-foreground">{item.label}</span>
                      <span className="text-muted-foreground">{item.value}</span>
                    </div>
                    <div className="h-3 rounded-full bg-white/52 border border-white/62 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/80 transition-all duration-500"
                        style={{ width: `${Math.max(4, Math.round((item.value / distMax) * 100))}%` }}
                      />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
