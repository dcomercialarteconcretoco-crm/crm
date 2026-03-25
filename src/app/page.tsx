"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Eye,
  FileText,
  PlusCircle,
  Plus,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { clsx } from "clsx";
import { useApp } from "@/context/AppContext";
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
};

export default function Home() {
  const { clients, tasks, quotes, settings, currentUser } = useApp();

  const userIsSuperAdmin = currentUser?.role === "SuperAdmin" || currentUser?.role === "Admin";
  const canExport = userIsSuperAdmin && settings.allowExports;

  const totalForecast = useMemo(
    () => tasks.reduce((sum, task) => sum + task.numericValue, 0),
    [tasks]
  );

  const approvedQuotes = quotes.filter((quote) => quote.status === "Approved").length;
  const conversionRate =
    quotes.length > 0 ? ((approvedQuotes / quotes.length) * 100).toFixed(1) : "0.0";

  const topClients = [...clients].sort((a, b) => b.ltv - a.ltv).slice(0, 4);
  const recentQuotes = quotes.slice(0, 5);
  const liveTasks = tasks.slice(0, 4);
  const insightCards = useMemo(() => {
    if (clients.length === 0) {
      return {
        primary: {
          label: "Alerta Prioritaria",
          title: "Aún no tienes clientes cargados.",
          body: "Sin clientes no hay seguimiento ni alertas comerciales. Registra el primero para activar el CRM.",
          href: "/clients",
          cta: "Crear cliente",
        },
        secondary: [
          {
            label: "Siguiente paso",
            body: "Después del primer cliente, crea una cotización para que el sistema empiece a medir intención y avance comercial.",
            href: "/quotes/new",
          },
        ],
      };
    }

    if (quotes.length === 0) {
      return {
        primary: {
          label: "Oportunidad Detectada",
          title: "Ya hay clientes, pero no hay cotizaciones activas.",
          body: "Sin propuestas no hay señales de interés. Lanza la primera para empezar a leer intención comercial.",
          href: "/quotes/new",
          cta: "Crear cotización",
        },
        secondary: [
          {
            label: "Cobertura",
            body: `${clients.length} clientes ya están listos para entrar a pipeline.`,
            href: "/clients",
          },
        ],
      };
    }

    if (tasks.length === 0) {
      const hottestQuote = recentQuotes[0];
      return {
        primary: {
          label: "Alerta Comercial",
          title: hottestQuote
            ? `La cotización ${hottestQuote.number} necesita seguimiento.`
            : "Tus cotizaciones no están llegando a seguimiento.",
          body: "No hay propuestas vivas en pipeline. Abre seguimiento para no perder trazabilidad del cierre.",
          href: "/pipeline",
          cta: "Abrir pipeline",
        },
        secondary: hottestQuote
          ? [
              {
                label: "Cotización reciente",
                body: `${hottestQuote.client} ya tiene una propuesta emitida. Conviene activar llamada o tarea de seguimiento.`,
                href: "/quotes",
              },
            ]
          : [],
      };
    }

    if (approvedQuotes === 0) {
      const liveLead = liveTasks[0];
      return {
        primary: {
          label: "Seguimiento Vivo",
          title: liveLead
            ? `${liveLead.contactName || liveLead.client} sigue activo sin cierre.`
            : "Hay actividad, pero falta cerrar negocio.",
          body: "Prioriza las cotizaciones abiertas con mayor valor y define una siguiente acción esta semana.",
          href: liveLead ? `/leads/${liveLead.clientId}` : "/pipeline",
          cta: liveLead ? "Ver lead" : "Revisar pipeline",
        },
        secondary: [
          {
            label: "Conversión",
            body: `Tienes ${quotes.length} cotizaciones emitidas y 0 aprobadas. La prioridad es convertir interés en cierre.`,
            href: "/quotes",
          },
        ],
      };
    }

    return {
      primary: {
        label: "Lectura AI del día",
        title: "Tu embudo ya tiene señal suficiente para optimizar.",
        body: `Llevas ${approvedQuotes} cierres aprobados sobre ${quotes.length} cotizaciones. Repite el patrón de los clientes que sí avanzaron.`,
        href: "/analytics",
        cta: "Ver analíticas",
      },
      secondary: topClients.slice(0, 2).map((client) => ({
        label: "Cliente caliente",
        body: `${client.name} aparece entre los clientes de mayor valor. Conviene revisar su relación comercial y próximas acciones.`,
        href: "/clients",
      })),
    };
  }, [approvedQuotes, clients.length, liveTasks, quotes.length, recentQuotes, tasks.length, topClients]);

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
      <section className="grid grid-cols-1 items-start gap-4 lg:gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-5">
          <div className="surface-panel rounded-[2rem] lg:rounded-[2.5rem] p-4 sm:p-5 lg:p-7 overflow-hidden relative">
            <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_top_right,rgba(250,181,16,0.14),transparent_58%)] pointer-events-none" />
            <div className="relative space-y-4 lg:space-y-5">
              <Link
                href={insightCards.primary.href}
                className="group block rounded-[1.6rem] lg:rounded-[2rem] border border-primary/15 bg-[linear-gradient(135deg,rgba(250,181,16,0.08),rgba(255,255,255,0.58))] p-5 sm:p-6 lg:p-7 transition hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 max-w-3xl">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                      {insightCards.primary.label}
                    </p>
                    <h1 className="mt-3 text-[1.8rem] leading-[1.02] font-black tracking-[-0.06em] text-foreground sm:text-[2.25rem] lg:text-[2.75rem]">
                      {insightCards.primary.title}
                    </h1>
                    <p className="mt-4 max-w-2xl text-[15px] font-semibold leading-7 text-muted-foreground">
                      {insightCards.primary.body}
                    </p>
                    <div className="mt-5 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                      {insightCards.primary.cta}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                  <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-primary/20 bg-primary/10 text-primary">
                    <AlertTriangle className="h-4.5 w-4.5" />
                  </div>
                </div>
              </Link>

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

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[1.45rem] border border-white/85 bg-white/58 p-4 sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                          {stat.label}
                        </p>
                        <p className="mt-3 text-[1.65rem] sm:text-[2rem] leading-none font-black tracking-[-0.08em] text-foreground">
                          {stat.value}
                        </p>
                        <p className="mt-2 text-xs font-semibold leading-5 text-muted-foreground">
                          {stat.note}
                        </p>
                      </div>
                      <div
                        className={clsx(
                          "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] border",
                          stat.tone
                        )}
                      >
                        <stat.icon className="h-4.5 w-4.5" />
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
                      <p className="text-sm font-black text-foreground">{formatCurrency(client.ltv)}</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                        alta prioridad
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="surface-card rounded-[1.8rem] p-5 text-sm font-semibold text-muted-foreground">
                  No hay clientes destacados todavía.
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
