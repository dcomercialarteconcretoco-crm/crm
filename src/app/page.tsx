"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Eye,
  FileText,
  Plus,
  Sparkles,
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

export default function Home() {
  const { clients, tasks, quotes, settings, currentUser } = useApp();

  const userIsSuperAdmin = currentUser?.role === "SuperAdmin";
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

  const handleExport = () => {
    generatePDFReport({
      title: "Informe de Inteligencia Operacional",
      stats: [
        { label: "Propuestas Activas", value: tasks.length.toString(), change: "+12%" },
        { label: "Ingresos Proyectados", value: formatCurrency(totalForecast), change: "+5%" },
        { label: "Tasa Conversión", value: `${conversionRate}%`, change: "Estable" },
        { label: "Leads Activos", value: clients.length.toString(), change: "Nuevo" },
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
      tone: "bg-[#171717] text-primary border-[#171717]",
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
    <div className="space-y-8 animate-in fade-in duration-700">
      <section className="surface-panel rounded-[2.5rem] p-6 lg:p-8 overflow-hidden relative">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(250,181,16,0.22),transparent_48%)] pointer-events-none" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#171717] px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#fff1bf] shadow-[0_16px_40px_rgba(23,23,23,0.18)]">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Arte Concreto Intelligence
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl lg:text-6xl font-black tracking-[-0.06em] text-foreground leading-none">
                Un CRM más limpio,
                <span className="block text-primary italic">más premium y más legible.</span>
              </h1>
              <p className="max-w-2xl text-sm lg:text-base text-muted-foreground font-medium leading-7">
                Bienvenido, {currentUser?.name}. Reorganizé el panel principal con una
                dirección visual clara: fondo suave, tarjetas amplias y jerarquía marcada
                en negro y amarillo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link
              href="/quotes/new"
              className="inline-flex items-center gap-2 rounded-[1.25rem] bg-[#171717] px-5 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-[#fff4cc] shadow-[0_22px_45px_rgba(23,23,23,0.18)] transition hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4 text-primary" />
              Nueva Cotización
            </Link>
            <Link
              href="/clients"
              className="inline-flex items-center gap-2 rounded-[1.25rem] border border-border/70 bg-white/80 px-5 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-foreground transition hover:bg-white"
            >
              <Users className="h-4 w-4 text-primary" />
              Clientes
            </Link>
            {canExport && (
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 rounded-[1.25rem] border border-primary/20 bg-primary/10 px-5 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-foreground transition hover:bg-primary/18"
              >
                <FileText className="h-4 w-4 text-primary" />
                Exportar PDF
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="surface-card rounded-[2rem] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-4 text-3xl lg:text-4xl font-black tracking-[-0.06em] text-foreground">
                  {stat.value}
                </p>
                <p className="mt-2 text-xs font-semibold text-muted-foreground">{stat.note}</p>
              </div>
              <div
                className={clsx(
                  "flex h-12 w-12 items-center justify-center rounded-[1.25rem] border shadow-[0_10px_24px_rgba(23,23,23,0.06)]",
                  stat.tone
                )}
              >
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-6">
          <div className="surface-panel rounded-[2.5rem] p-6 lg:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-muted-foreground">
                  Radar de Actividad
                </p>
                <h2 className="mt-2 text-2xl lg:text-3xl font-black tracking-[-0.05em] text-foreground">
                  Propuestas abiertas por cliente
                </h2>
              </div>
              <Link
                href="/pipeline"
                className="inline-flex items-center gap-2 rounded-full bg-accent/55 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-foreground"
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
                        <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-[#171717] text-primary shadow-[0_16px_32px_rgba(23,23,23,0.16)]">
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
                <div className="surface-card rounded-[2rem] p-8 text-sm font-semibold text-muted-foreground">
                  No hay actividad reciente detectada todavía.
                </div>
              )}
            </div>
          </div>

          <div className="surface-panel rounded-[2.5rem] overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/70 px-6 py-5 lg:px-8">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                  Historial Reciente
                </p>
                <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-foreground">
                  Cotizaciones recientes
                </h3>
              </div>
              <Link
                href="/quotes"
                className="rounded-full bg-[#171717] px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#fff4cc]"
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
                            {quote.status}
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

        <div className="xl:col-span-4 space-y-6">
          <div className="surface-panel rounded-[2.5rem] p-6 lg:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-muted-foreground">
              Clientes Premium
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.05em] text-foreground">
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
                      <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[#171717] text-primary text-xs font-black shadow-[0_14px_30px_rgba(23,23,23,0.16)]">
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

          <div className="surface-panel rounded-[2.5rem] p-6 lg:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-muted-foreground">
              Estado del Funnel
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.05em] text-foreground">
              Distribución comercial
            </h3>
            <div className="mt-6 space-y-4">
              {[
                { label: "Nuevo", value: 0, width: "w-[18%]" },
                { label: "Visto", value: tasks.length, width: "w-[72%]" },
                { label: "Ganado", value: approvedQuotes, width: "w-[38%]" },
              ].map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-bold">
                    <span className="text-foreground">{item.label}</span>
                    <span className="text-muted-foreground">{item.value}</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/70 border border-border/60 overflow-hidden">
                    <div className={clsx("h-full rounded-full bg-[#171717]", item.width)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
