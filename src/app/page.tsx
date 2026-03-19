"use client";

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Users,
  Briefcase,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  X,
  Eye,
  ArrowRight,
  Download,
  FileText
} from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '@/context/AppContext';
import { generatePDFReport } from '@/lib/pdf-generator';

export default function Home() {
  const { clients, tasks, quotes, auditLogs, settings, currentUser } = useApp();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(val);
  };

  const userIsSuperAdmin = currentUser?.role === 'SuperAdmin';
  const canExport = userIsSuperAdmin && settings.allowExports;

  const totalForecast = useMemo(() => tasks.reduce((sum, task) => sum + task.numericValue, 0), [tasks]);
  const formattedForecast = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(totalForecast);

  const approvedQuotes = quotes.filter(q => q.status === 'Approved').length;
  const conversionRate = quotes.length > 0 ? ((approvedQuotes / quotes.length) * 100).toFixed(1) + '%' : '0%';
  const activeLeads = clients.length;

  const handleExport = () => {
    generatePDFReport({
      title: 'Informe de Inteligencia Operacional',
      stats: [
        { label: 'Propuestas Activas', value: tasks.length.toString(), change: '+12%' },
        { label: 'Ingresos Proyectados', value: formattedForecast, change: '+5%' },
        { label: 'Tasa Conversión', value: conversionRate, change: 'Estable' },
        { label: 'Leads Activos', value: activeLeads.toString(), change: 'Nuevo' }
      ],
      topLeads: [...clients].sort((a, b) => b.score - a.score).slice(0, 3).map(c => ({
        name: c.name,
        company: c.company,
        score: c.score
      }))
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">Panel Principal</h1>
          <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-1">
            Bienvenido de nuevo, <span className="text-white">{currentUser?.name}</span>. Aquí está el resumen de hoy.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/clients" className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary transition-all flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            Clientes
          </Link>
          <Link href="/quotes/new" className="bg-primary text-black px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shadow-lg shadow-primary/20">
            <Plus className="w-3.5 h-3.5" />
            Nueva Cotización
          </Link>
        </div>
      </div>

      {/* Top Banner: Propuestas Abiertas */}
      <div className="bg-primary/5 border border-primary/20 rounded-[2rem] p-6 relative overflow-hidden">
        <div className="absolute top-4 right-4 text-white/10 cursor-pointer hover:text-white/30 transition-colors">
          <X className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(250,181,16,0.6)]"></div>
            <Eye className="w-4 h-4 text-primary" />
          </div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Propuestas abiertas por el cliente</h3>
        </div>
        <div className="flex flex-wrap gap-4">
          {tasks.slice(0, 3).map((task) => (
            <Link key={task.id} href={`/leads/${task.clientId}`} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex items-center gap-4 min-w-[300px] group hover:border-primary/50 transition-all cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-black transition-all">
                <Eye className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-white uppercase group-hover:text-primary transition-colors truncate">{task.contactName || task.client} — {task.id}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-black text-primary italic tracking-tighter">{task.value}</span>
                  <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest">• Abrió la propuesta</span>
                </div>
              </div>
            </Link>
          ))}
          {tasks.length === 0 && (
            <div className="py-2 px-1 text-[10px] font-bold text-white/20 italic uppercase tracking-widest">No hay actividad reciente detectada</div>
          )}
        </div>
      </div>

      {/* Stats Grid - 3 Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
        <div className="bg-[#0a0a0b] border border-white/10 rounded-[2.5rem] p-10 relative overflow-hidden group hover:border-primary/20 transition-all shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Total Cotizado</p>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase mb-2 group-hover:scale-105 transition-transform origin-left">
            $0
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-emerald-500 uppercase">Proporción Anual</span>
            <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">• 0 Cotizaciones Activas</span>
          </div>
        </div>

        <div className="bg-[#0a0a0b] border border-white/10 rounded-[2.5rem] p-10 relative overflow-hidden group hover:border-sky-500/20 transition-all shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Ticket Promedio</p>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-500 border border-sky-500/20">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase mb-2 group-hover:scale-105 transition-transform origin-left">
            $0
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-sky-500 uppercase">Meta Regional</span>
            <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">• Basado en Ofertas</span>
          </div>
        </div>
      </div>

      {/* Historial de Cotizaciones - Multi-status Bar */}
      <div className="bg-[#0a0a0b] border border-white/10 rounded-[2.5rem] p-10 shadow-2xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white italic">Historial de Cotizaciones</h3>
            <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.1em] mt-1">Estado actual del flujo comercial</p>
          </div>
          <Link href="/pipeline" className="group text-[9px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-3 bg-white/5 hover:bg-white/10 px-6 py-3 rounded-2xl transition-all border border-white/5">
            Ver Pipeline Completo <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {[
            { label: 'Nuevo', count: 0, color: 'text-white/40', bg: 'bg-white/5', border: 'border-white/10' },
            { label: 'Enviado', count: 0, color: 'text-sky-400', bg: 'bg-sky-400/5', border: 'border-sky-400/20' },
            { label: 'Visto', count: tasks.length, color: 'text-primary', bg: 'bg-primary/5', border: 'border-primary/20' },
            { label: 'Negociando', count: 0, color: 'text-amber-500', bg: 'bg-amber-500/5', border: 'border-amber-500/20' },
            { label: 'Ganado', count: approvedQuotes, color: 'text-emerald-500', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20' },
            { label: 'Perdido', count: 0, color: 'text-rose-500', bg: 'bg-rose-500/5', border: 'border-rose-500/20' },
          ].map((status) => (
            <div key={status.label} className={clsx("flex flex-col items-center justify-center p-8 rounded-[1.5rem] border transition-all hover:scale-[1.05] group cursor-default shadow-lg", status.bg, status.border)}>
              <span className={clsx("text-4xl font-black italic tracking-tighter mb-2 transition-all group-hover:scale-110", status.color)}>{status.count}</span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 group-hover:text-white/40">{status.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Grid: Buyers and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 bg-[#0a0a0b] border border-white/10 rounded-[2.5rem] p-10 flex flex-col shadow-2xl">
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white italic">Top Compradores</h3>
            <TrendingUp className="w-5 h-5 text-primary opacity-50" />
          </div>
          <div className="space-y-8 flex-1">
            {[...clients].sort((a, b) => b.ltv - a.ltv).slice(0, 5).map((client, i) => (
              <div key={client.id} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-white/40 group-hover:border-primary group-hover:text-primary transition-all">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-white uppercase group-hover:text-primary transition-colors truncate">{client.name}</p>
                    <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest mt-0.5">{client.company || 'Personal'}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-black text-white italic tracking-tighter">{formatCurrency(client.ltv)}</p>
                  <p className="text-[8px] font-black text-primary uppercase tracking-tighter">{client.ltv > 5000000 ? 'VIP Target' : 'Lead Activo'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8 bg-[#0a0a0b] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
            <div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white italic">Cotizaciones Recientes</h3>
              <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.1em] mt-1">Monitor en vivo de actividad comercial</p>
            </div>
            <Link href="/quotes" className="text-[9px] font-black text-primary uppercase tracking-[0.2em] hover:text-white transition-colors">Ver historial completo</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="px-10 py-6 text-[9px] font-black text-white/20 uppercase tracking-[0.3em] border-b border-white/5">Cotización</th>
                  <th className="px-10 py-6 text-[9px] font-black text-white/20 uppercase tracking-[0.3em] border-b border-white/5">Cliente</th>
                  <th className="px-10 py-6 text-[9px] font-black text-white/20 uppercase tracking-[0.3em] border-b border-white/5 text-right">Monto</th>
                  <th className="px-10 py-6 text-[9px] font-black text-white/20 uppercase tracking-[0.3em] border-b border-white/5 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {quotes.slice(0, 6).map((quote) => (
                  <tr key={quote.id} className="hover:bg-white/[0.02] transition-all group cursor-pointer" onClick={() => window.location.href = `/quotes/${quote.id}`}>
                    <td className="px-10 py-6">
                      <p className="text-[11px] font-black text-white group-hover:text-primary transition-colors hover:translate-x-1 decoration-dashed">{quote.number}</p>
                      <p className="text-[8px] font-bold text-white/20 mt-1 uppercase tracking-tighter">REF: {quote.id}</p>
                    </td>
                    <td className="px-10 py-6">
                      <p className="text-[10px] font-black text-white uppercase truncate max-w-[200px]">{quote.client}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40"></div>
                        <p className="text-[8px] font-bold text-white/20 lowercase tracking-tight">contacto@cliente.co</p>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <p className="text-[14px] font-black text-white italic tracking-tighter">{quote.total}</p>
                    </td>
                    <td className="px-10 py-6 text-center">
                      <span className={clsx(
                        "text-[9px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest border transition-all",
                        quote.status === 'Approved' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-black" :
                          quote.status === 'Sent' ? "bg-primary/10 text-primary border-primary/20 group-hover:bg-primary group-hover:text-black" :
                            "bg-white/5 text-white/40 border-white/10 group-hover:bg-white/10"
                      )}>
                        {quote.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {quotes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-10 py-20 text-center">
                      <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.5em] italic">No hay registros para mostrar</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Activity Monitor - As Footer Section */}
      <div className="bg-[#0a0a0b] border border-white/10 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px]"></div>
        <div className="flex items-center justify-between mb-10 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-primary animate-ping"></div>
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white italic">Monitor de Operaciones MiWi</h3>
          </div>
          <button
            onClick={handleExport}
            className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all flex items-center gap-3"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar Auditoría
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
          {auditLogs.slice(0, 3).map((log) => (
            <div key={log.id} className="p-6 rounded-[1.5rem] bg-white/[0.02] border border-white/5 hover:border-primary/20 transition-all group">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-black transition-colors">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">{new Date(log.timestamp).toLocaleTimeString()}</p>
                  <p className="text-[10px] font-black text-white uppercase">{log.userName}</p>
                </div>
              </div>
              <p className="text-[11px] font-bold text-white/60 leading-relaxed italic truncate">"{log.details}"</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
