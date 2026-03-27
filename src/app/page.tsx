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
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Sales Overview</h1>
          <p className="page-subtitle">Bienvenido de vuelta. Aquí está tu resumen comercial.</p>
        </div>
        <Link
          href="/quotes/new"
          className="btn-primary hidden sm:inline-flex"
        >
          <Plus className="h-4 w-4" />
          Nueva Cotización
        </Link>
      </div>

      {/* ── PENDING APPROVALS PANEL (admins only) ── */}
      {isAdmin && pendingQuotes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <h2 className="font-bold text-amber-800 text-sm">
              {pendingQuotes.length} Aprobación{pendingQuotes.length > 1 ? 'es' : ''} Pendiente{pendingQuotes.length > 1 ? 's' : ''}
            </h2>
          </div>
          <div className="space-y-2">
            {pendingQuotes.map(q => (
              <div key={q.id} className="bg-white border border-amber-100 rounded-xl p-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{q.number} — {q.client}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {q.requestedByName} solicita {q.pendingAction === 'send_email' ? 'enviar email' : q.pendingAction === 'send_whatsapp' ? 'enviar WhatsApp' : 'generar PDF'} · {q.total}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleApproveQuote(q)}
                    className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-400 transition-all"
                  >
                    Aprobar
                  </button>
                  <button
                    onClick={() => handleRejectQuote(q)}
                    className="px-3 py-1.5 bg-rose-50 text-rose-600 text-xs font-semibold rounded-lg hover:bg-rose-100 transition-all border border-rose-200"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI STAT CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* First card — dark hero */}
        <div className="stat-card-dark col-span-2 lg:col-span-1 card-interactive">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Proyección</p>
              <p className={clsx(
                "mt-2 font-black leading-none tracking-tight text-white",
                totalForecast === 0 ? "text-2xl" :
                formatCurrency(totalForecast).length <= 12 ? "text-xl" : "text-base"
              )}>
                {formatCurrency(totalForecast)}
              </p>
              <p className="mt-2 text-xs text-white/50">{tasks.length} propuestas activas</p>
            </div>
            <div className="shrink-0 w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
          </div>
          <div className="mt-4 progress-track" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div className="progress-fill" style={{ width: `${Math.min(100, tasks.length * 10)}%` }} />
          </div>
        </div>

        {stats.slice(1).map((stat) => (
          <div key={stat.label} className="stat-card card-interactive">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="stat-label">{stat.label}</p>
                <p className={clsx(
                  "mt-2 font-black leading-none tracking-tight text-foreground",
                  stat.value.length <= 4  ? "text-2xl" :
                  stat.value.length <= 7  ? "text-xl" :
                  stat.value.length <= 10 ? "text-lg" : "text-base"
                )}>
                  {stat.value}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">{stat.note}</p>
              </div>
              <div className="shrink-0 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <stat.icon className="w-4 h-4 text-primary" />
              </div>
            </div>
            <div className="mt-4 progress-track">
              <div className="progress-fill" style={{ width: `${Math.min(100, parseInt(stat.value) * 5 || 25)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── MAIN CONTENT GRID ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

        {/* Left — Insight banner + quick actions + leads */}
        <div className="xl:col-span-8 space-y-6">

          {/* Insight banner */}
          <div className="surface-card relative overflow-hidden h-[200px] flex flex-col">
            <Link
              key={carouselIdx}
              href={activeCard?.href ?? '#'}
              className="group flex-1 block p-6 animate-in slide-in-from-bottom-4 fade-in duration-400"
            >
              <div className="flex items-start justify-between gap-4 h-full">
                <div className="min-w-0 flex-1">
                  <span className="inline-block px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-widest rounded-md mb-2">
                    {activeCard?.label}
                  </span>
                  <h2 className="text-xl font-bold tracking-tight text-foreground line-clamp-2">
                    {activeCard?.title}
                  </h2>
                  <p className="mt-1.5 text-sm text-muted-foreground line-clamp-1">
                    {activeCard?.body}
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                    {activeCard?.cta}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
                <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
            </Link>
            {allInsightCards.length > 1 && (
              <div className="flex items-center gap-2 px-6 pb-4 shrink-0">
                {allInsightCards.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setCarouselDir('up'); setCarouselIdx(i); }}
                    className={clsx(
                      "transition-all duration-300 rounded-full",
                      i === carouselIdx ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-border hover:bg-primary/40"
                    )}
                  />
                ))}
                <span className="ml-auto text-[9px] text-muted-foreground">
                  {carouselIdx + 1}/{allInsightCards.length}
                </span>
              </div>
            )}
          </div>

          {/* Quick action buttons */}
          <div className="grid grid-cols-3 gap-3">
            <Link href="/quotes/new"
              className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary px-4 py-4 text-xs font-bold text-black shadow-[0_4px_16px_rgba(250,181,16,0.3)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(250,181,16,0.4)] transition-all active:scale-95">
              <span className="flex items-center gap-2"><Plus className="h-4 w-4" />Nueva cotización</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link href="/clients"
              className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-4 text-xs font-bold text-foreground hover:bg-muted hover:-translate-y-0.5 transition-all">
              <span className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Clientes</span>
              <ArrowRight className="h-3.5 w-3.5 text-primary" />
            </Link>
            {canExport ? (
              <button onClick={handleExport}
                className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-4 text-xs font-bold text-foreground hover:bg-muted hover:-translate-y-0.5 transition-all">
                <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />Exportar PDF</span>
                <ArrowRight className="h-3.5 w-3.5 text-primary" />
              </button>
            ) : (
              <Link href="/pipeline"
                className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-4 text-xs font-bold text-foreground hover:bg-muted hover:-translate-y-0.5 transition-all">
                <span className="flex items-center gap-2"><PlusCircle className="h-4 w-4 text-primary" />Pipeline</span>
                <ArrowRight className="h-3.5 w-3.5 text-primary" />
              </Link>
            )}
          </div>

          {/* Live leads grid */}
          <div className="surface-card">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Radar de Actividad</p>
                <h3 className="section-title mt-0.5">Propuestas abiertas</h3>
              </div>
              <Link href="/pipeline" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                Ver Pipeline <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="p-5 grid gap-3 lg:grid-cols-2">
              {liveTasks.length > 0 ? (
                liveTasks.map((task, index) => (
                  <Link key={task.id} href={`/leads/${task.clientId}`}
                    className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                        <Eye className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Lead {String(index + 1).padStart(2, "0")}</p>
                        <p className="text-sm font-semibold text-foreground truncate">{task.contactName || task.client}</p>
                        <p className="text-xs text-muted-foreground font-medium">{task.value}</p>
                      </div>
                    </div>
                    <span className="badge shrink-0 bg-primary/10 text-primary">Activo</span>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground col-span-2 py-4">No hay actividad reciente detectada.</p>
              )}
            </div>
          </div>

          {/* Recent quotes table */}
          <div className="surface-card overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Historial Reciente</p>
                <h3 className="section-title mt-0.5">Cotizaciones recientes</h3>
              </div>
              <Link href="/quotes" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                Ver todas <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentQuotes.length > 0 ? (
                    recentQuotes.map((quote) => (
                      <tr key={quote.id}>
                        <td className="font-semibold">{quote.number}</td>
                        <td>{quote.client}</td>
                        <td className="font-semibold">{quote.total}</td>
                        <td>
                          <span className={clsx(
                            "badge",
                            quote.status === "Approved" ? "bg-emerald-100 text-emerald-700" :
                            quote.status === "Sent" ? "bg-primary/10 text-primary" :
                            "bg-muted text-muted-foreground"
                          )}>
                            {QUOTE_STATUS_LABEL[quote.status] || quote.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-muted-foreground py-8">Aún no hay cotizaciones registradas.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right — Funnel + Top buyers */}
        <div className="xl:col-span-4 space-y-6">

          {/* Sales funnel */}
          <div className="surface-card p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sales Funnel</p>
            <h3 className="section-title mt-1 mb-5">Conversión por etapa</h3>
            <div className="space-y-5">
              {(() => {
                const maxVal = Math.max(clients.length, quotes.length, tasks.length, approvedQuotes, 1);
                return [
                  { label: "Leads totales", value: clients.length || 0 },
                  { label: "Cotizaciones", value: quotes.length || 0 },
                  { label: "Propuestas activas", value: tasks.length || 0 },
                  { label: "Cierres", value: approvedQuotes || 0 },
                ].map((item) => (
                  <div key={item.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{item.label}</span>
                      <span className="font-bold text-foreground">{item.value}</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${Math.max(4, Math.round((item.value / maxVal) * 100))}%` }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Top clients */}
          <div className="surface-card p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Clientes Premium</p>
            <h3 className="section-title mt-1 mb-5">Top compradores</h3>
            <div className="space-y-3">
              {topClients.length > 0 ? (
                topClients.map((client, index) => (
                  <div key={client.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-black text-primary shrink-0">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{client.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{client.company || "Cliente directo"}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-emerald-600">{formatCurrency(client.ltv)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-xl bg-muted/30 border border-border">
                  <p className="text-sm text-muted-foreground">Sin compras cerradas aún.</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Las cotizaciones <span className="font-bold text-emerald-600">Aprobadas</span> aparecerán aquí.</p>
                </div>
              )}
            </div>
          </div>

          {/* Distribución comercial */}
          <div className="surface-card p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estado del Funnel</p>
            <h3 className="section-title mt-1 mb-5">Distribución comercial</h3>
            <div className="space-y-4">
              {(() => {
                const newLeads = clients.filter(c => c.status === 'Lead').length;
                const distMax = Math.max(newLeads, tasks.length, approvedQuotes, 1);
                return [
                  { label: "Nuevos leads", value: newLeads },
                  { label: "En seguimiento", value: tasks.length },
                  { label: "Ganado", value: approvedQuotes },
                ].map((item) => (
                  <div key={item.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{item.label}</span>
                      <span className="font-bold text-foreground">{item.value}</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${Math.max(4, Math.round((item.value / distMax) * 100))}%` }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
