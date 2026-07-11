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
  Loader2,
  Download,
} from "lucide-react";
import { clsx } from "clsx";
import { useApp, type Quote, type Task } from "@/context/AppContext";
import { generatePDFReport } from "@/lib/pdf-generator";
import { canSeeAll, ownsRecord } from "@/lib/scope";
import { aggregateSellerActivity, getPresetRange, type PeriodPreset } from "@/lib/seller-activity";

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
  PendingApproval: 'Por aprobar',
  ChangesRequested: 'Cambios solicitados',
  PENDING_APPROVAL: 'Por aprobar',  // legacy
};

const SPANISH_MONTHS: Record<string, number> = {
  ene: 0, enero: 0,
  feb: 1, febrero: 1,
  mar: 2, marzo: 2,
  abr: 3, abril: 3,
  may: 4, mayo: 4,
  jun: 5, junio: 5,
  jul: 6, julio: 6,
  ago: 7, agosto: 7,
  sep: 8, sept: 8, septiembre: 8,
  oct: 9, octubre: 9,
  nov: 10, noviembre: 10,
  dic: 11, diciembre: 11,
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

function normalizeQuoteRef(value: any): string {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function quoteRefCandidates(input: any): string[] {
  const fields = [input?.id, input?.quoteId, input?.quoteNumber, input?.number, input?.baseNumber, input?.title];
  const raw = fields.filter(Boolean).join(' ').toUpperCase();
  const matches = raw.match(/[A-Z]{2,5}-[A-Z0-9-]+/g) || [];
  return Array.from(new Set([...fields, ...matches].map(normalizeQuoteRef).filter(Boolean)));
}

function quoteYearHint(input: any): number {
  const raw = [input?.quoteNumber, input?.number, input?.baseNumber, input?.title, input?.quoteId, input?.id].filter(Boolean).join(' ');
  const match = raw.match(/(20\d{2})/);
  return match ? Number(match[1]) : new Date().getFullYear();
}

function parseCRMDate(value: any, fallbackYear = new Date().getFullYear()): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const raw = String(value).trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const numeric = raw.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/);
  if (numeric) {
    const year = numeric[3] ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]) : fallbackYear;
    return new Date(year, Number(numeric[2]) - 1, Number(numeric[1]));
  }

  const normalized = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '');
  const spanish = normalized.match(/(\d{1,2})\s*(?:de\s*)?([a-z]+)(?:\s*(?:de\s*)?(\d{4}))?/);
  if (spanish && SPANISH_MONTHS[spanish[2]] !== undefined) {
    return new Date(spanish[3] ? Number(spanish[3]) : fallbackYear, SPANISH_MONTHS[spanish[2]], Number(spanish[1]));
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateFromEpochId(value: any): Date | null {
  const match = String(value || '').match(/(1[6-9]\d{11})/);
  if (!match) return null;
  const date = new Date(Number(match[1]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function earliestDate(dates: Array<Date | null | undefined>): Date | null {
  const valid = dates.filter((date): date is Date => !!date && !Number.isNaN(date.getTime()));
  if (valid.length === 0) return null;
  return valid.sort((a, b) => a.getTime() - b.getTime())[0];
}

function getMonthCountdown(now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  const diff = Math.max(0, end.getTime() - now.getTime());
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes };
}

export default function Home() {
  const { clients, tasks, quotes, sellers, settings, currentUser, auditLogs, events, notifications, addNotification } = useApp();
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [monthCountdown, setMonthCountdown] = useState(() => getMonthCountdown());

  // Descarga el catálogo PDF actualizado (lo genera el servidor leyendo
  // WooCommerce en vivo; lleva impresa la fecha/hora de generación). Disponible
  // para cualquier usuario logueado.
  const handleDownloadCatalog = async () => {
    if (isCatalogLoading) return;
    setIsCatalogLoading(true);
    try {
      const res = await fetch('/api/catalogo', { cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Catalogo-ArteConcreto-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      addNotification({ title: 'Catálogo descargado', description: 'PDF generado con la fecha y hora actual.', type: 'success' });
    } catch (e) {
      addNotification({ title: 'No se pudo generar el catálogo', description: e instanceof Error ? e.message : 'Intentá de nuevo.', type: 'alert' });
    } finally {
      setIsCatalogLoading(false);
    }
  };
  const isLeadership = canSeeAll(currentUser);
  // ⚠️ Top vendedores SOLO SuperAdmin/Admin — nunca Manager ni Vendedor
  const canSeePerformance = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';
  const [topSellersPreset, setTopSellersPreset] = useState<Exclude<PeriodPreset, 'custom'>>('today');

  // Top sellers widget — usa el mismo motor de /team/performance y del correo diario
  const topSellers = useMemo(() => {
    if (!canSeePerformance) return [];
    const { from, to } = getPresetRange(topSellersPreset);
    const acts = aggregateSellerActivity({
      sellers, clients, quotes, auditLogs, events, from, to,
    });
    return [...acts].sort((a, b) => b.score - a.score).slice(0, 5);
  }, [canSeePerformance, sellers, clients, quotes, auditLogs, events, topSellersPreset]);

  const userIsSuperAdmin = currentUser?.role === "SuperAdmin" || currentUser?.role === "Admin";
  const isAdmin = userIsSuperAdmin;
  const canExport = userIsSuperAdmin && settings.allowExports;

  const [carouselIdx, setCarouselIdx] = useState(0);
  const [carouselDir, setCarouselDir] = useState<'up' | 'down'>('up');

  const pendingQuotes = useMemo(
    () => quotes.filter((q) => q.status === 'PendingApproval' || q.status === 'PENDING_APPROVAL' || q.status === 'ChangesRequested'),
    [quotes]
  );

  // Ownership scoping: Vendedores only get stats for their own clients/quotes/tasks.
  // Leadership (SuperAdmin/Admin/Manager) sees the whole business.
  const scopedClients = useMemo(
    () => clients.filter(c => ownsRecord(currentUser, c)),
    [clients, currentUser]
  );
  const scopedQuotes = useMemo(
    // Las históricas (pre-CRM sistematizadas) son solo consulta: fuera de
    // contadores, conversión y top compradores del dashboard.
    () => quotes.filter(q => !q.isHistorical && ownsRecord(currentUser, q)),
    [quotes, currentUser]
  );
  const scopedTasks = useMemo(
    () => tasks.filter(t => ownsRecord(currentUser, t)),
    [tasks, currentUser]
  );

  const currentMonthKey = useMemo(() => monthKey(new Date()), []);
  const currentMonthLabel = useMemo(() => monthLabel(currentMonthKey), [currentMonthKey]);
  const quoteById = useMemo(() => new Map(scopedQuotes.map(q => [q.id, q])), [scopedQuotes]);
  const quoteByRef = useMemo(() => {
    const map = new Map<string, Quote>();
    for (const quote of scopedQuotes) {
      for (const ref of quoteRefCandidates(quote)) {
        if (!map.has(ref)) map.set(ref, quote);
      }
    }
    return map;
  }, [scopedQuotes]);

  const quoteMonthKey = (quote: Quote) => {
    const fallbackYear = quoteYearHint(quote);
    if (fallbackYear < new Date().getFullYear()) return `${fallbackYear}-01`;
    const date = parseCRMDate((quote as any).sentAt, fallbackYear) || parseCRMDate(quote.date, fallbackYear) || dateFromEpochId(quote.id) || new Date();
    return monthKey(date);
  };

  const taskMonthKey = (task: Task) => {
    const quote = quoteById.get((task as any).quoteId)
      || quoteRefCandidates(task).map(ref => quoteByRef.get(ref)).find(Boolean);
    const fallbackYear = quoteYearHint(quote || task);
    const retakenDate = parseCRMDate((task as any).retakenAt, fallbackYear);
    if (retakenDate) return monthKey(retakenDate);
    if (fallbackYear < new Date().getFullYear()) return `${fallbackYear}-01`;
    const activityDates = (task.activities || []).map(activity => parseCRMDate(activity.timestamp, fallbackYear));
    const originalDate = earliestDate([
      parseCRMDate(quote?.date, fallbackYear),
      parseCRMDate((quote as any)?.sentAt, fallbackYear),
      dateFromEpochId((task as any).quoteId),
      dateFromEpochId(task.id),
      ...activityDates,
    ]) || new Date();
    return monthKey(originalDate);
  };

  const currentMonthQuotes = useMemo(
    () => scopedQuotes.filter(q => quoteMonthKey(q) === currentMonthKey),
    [scopedQuotes, currentMonthKey]
  );
  const currentMonthTasks = useMemo(
    () => scopedTasks.filter(t => taskMonthKey(t) === currentMonthKey),
    [scopedTasks, currentMonthKey, scopedQuotes]
  );

  const totalForecast = useMemo(
    () => currentMonthTasks.reduce((sum, task) => sum + task.numericValue, 0),
    [currentMonthTasks]
  );

  const approvedQuotes = currentMonthQuotes.filter((quote) => quote.status === "Approved").length;
  const conversionRate =
    currentMonthQuotes.length > 0 ? ((approvedQuotes / currentMonthQuotes.length) * 100).toFixed(1) : "0.0";

  // Top buyers: only clients with at least one Approved quote, sorted by their total approved revenue
  const topClients = useMemo(() => {
    const approvedByClient = new Map<string, number>();
    scopedQuotes
      .filter(q => q.status === 'Approved' && q.clientId)
      .forEach(q => {
        const prev = approvedByClient.get(q.clientId!) || 0;
        approvedByClient.set(q.clientId!, prev + (q.numericTotal || 0));
      });
    return scopedClients
      .filter(c => (approvedByClient.get(c.id) || 0) > 0)
      .map(c => ({ ...c, ltv: approvedByClient.get(c.id) || c.ltv }))
      .sort((a, b) => b.ltv - a.ltv)
      .slice(0, 4);
  }, [scopedClients, scopedQuotes]);
  const recentQuotes = scopedQuotes.slice(0, 5);
  const liveTasks = scopedTasks.slice(0, 4);
  const bannerFallbackImage = '/uploads/products/product_1773159753422_p63bk.jpg';
  const uniqueImages = (images: Array<string | undefined>) =>
    Array.from(new Set(images.filter(Boolean) as string[]));
  const quoteImageFor = (quote?: Pick<Quote, 'items' | 'client'> | null) =>
    quote?.items?.find((item) => item.image)?.image || '';
  const quoteImagesFor = (quote?: Pick<Quote, 'items'> | null) =>
    quote?.items?.map((item) => item.image).filter(Boolean).slice(0, 4) as string[] || [];
  const quoteForTask = (task?: Task | null) =>
    task ? scopedQuotes.find((quote) => quote.taskId === task.id || quote.clientId === task.clientId) : undefined;
  const taskImageFor = (task?: Task | null) => quoteImageFor(quoteForTask(task));
  const taskImagesFor = (task?: Task | null) => quoteImagesFor(quoteForTask(task));

  // Returns up to 5 insight cards — all same importance, rotated in banner
  const allInsightCards = useMemo(() => {
    const cards: { label: string; title: string; body: string; href: string; cta: string; image?: string; imageAlt?: string; gallery?: string[] }[] = [];

    if (scopedClients.length === 0) {
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

    if (scopedQuotes.length === 0) {
      cards.push({
        label: "Oportunidad Detectada",
        title: "Hay clientes, pero no hay propuestas activas.",
        body: "Sin cotizaciones no hay señal de interés. Lanza la primera para medir intención comercial.",
        href: "/quotes/new",
        cta: "Crear cotización",
      });
      cards.push({
        label: "Cobertura",
        title: `${scopedClients.length} cliente${scopedClients.length > 1 ? 's' : ''} listo${scopedClients.length > 1 ? 's' : ''} para cotizar.`,
        body: "Cada cliente registrado es una oportunidad de negocio. Activa el pipeline para no perder ninguna.",
        href: "/clients",
        cta: "Ver directorio",
      });
      return cards;
    }

    // Live leads
    liveTasks.slice(0, 2).forEach((t, i) => {
      const image = taskImageFor(t);
      cards.push({
        label: i === 0 ? "Seguimiento Vivo" : "Lead Activo",
        title: `${t.contactName || t.client} sigue activo sin cierre.`,
        body: "Define la siguiente acción concreta y mueve este negocio en el pipeline esta semana.",
        href: t.clientId ? `/leads/${t.clientId}` : "/pipeline",
        cta: "Ver lead",
        image,
        imageAlt: t.contactName || t.client,
        gallery: taskImagesFor(t),
      });
    });

    // Conversion alert
    if (approvedQuotes === 0 && scopedQuotes.length > 0) {
      cards.push({
        label: "Alerta de Conversión",
        title: `${scopedQuotes.length} cotizaciones emitidas, ninguna cerrada.`,
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
        image: quoteImageFor(topQuote),
        imageAlt: topQuote.client,
        gallery: quoteImagesFor(topQuote),
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
        body: `Llevas ${approvedQuotes} de ${scopedQuotes.length} cotizaciones convertidas. Analiza qué tienen en común los cierres exitosos.`,
        href: "/analytics",
        cta: "Ver analíticas",
      });
    }

    return cards.slice(0, 5);
  }, [approvedQuotes, scopedClients, liveTasks, scopedQuotes, recentQuotes, scopedTasks, topClients]);

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

  useEffect(() => {
    const tick = () => setMonthCountdown(getMonthCountdown());
    tick();
    const timer = setInterval(tick, 60000);
    return () => clearInterval(timer);
  }, []);

  const activeCard = allInsightCards[Math.min(carouselIdx, allInsightCards.length - 1)];
  const activeCardGallery = uniqueImages([
    ...(activeCard?.gallery || []),
    activeCard?.image,
    ...recentQuotes.flatMap((quote) => quoteImagesFor(quote)),
    bannerFallbackImage,
  ]).slice(0, 4);
  const activeCardHeroImage = activeCardGallery[0] || bannerFallbackImage;

  const realAlerts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const toMinutes = (time: string) => {
      const [h, m] = (time || '00:00').split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const unread = notifications.filter(n => !n.read && (!n.targetUserId || n.targetUserId === currentUser?.id || canSeeAll(currentUser)));
    const todaysEvents = events
      .filter(e => e.date === today && (canSeeAll(currentUser) || e.ownerUserId === currentUser?.id))
      .sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
    const nextEvent = todaysEvents.find(e => toMinutes(e.time) >= nowMinutes);
    const hotTask = scopedTasks.find(t => (t.aiScore || 0) >= 80) || scopedTasks[0];
    const alerts: { id: string; title: string; body: string; href: string; tone: string; icon: typeof AlertTriangle; image?: string; imageAlt?: string }[] = [];

    unread.slice(0, 2).forEach(n => {
      const relatedQuote = n.quoteId
        ? scopedQuotes.find(q => q.id === n.quoteId)
        : n.clientId
          ? scopedQuotes.find(q => q.clientId === n.clientId)
          : undefined;
      alerts.push({
        id: n.id,
        title: n.title,
        body: n.description,
        href: n.clientId ? `/leads/${n.clientId}` : n.quoteId ? '/quotes' : '/bot',
        tone: 'border-sky-200 bg-sky-50 text-sky-900',
        icon: AlertTriangle,
        image: quoteImageFor(relatedQuote),
        imageAlt: relatedQuote?.client || n.title,
      });
    });
    if (nextEvent) alerts.push({
      id: `event-${nextEvent.id}`,
      title: `Agenda ${nextEvent.time}`,
      body: `${nextEvent.title}${nextEvent.description ? ` · ${nextEvent.description}` : ''}`,
      href: '/scheduler',
      tone: 'border-amber-200 bg-amber-50 text-amber-950',
      icon: Clock,
    });
    if (isAdmin && pendingQuotes.length > 0) alerts.push({
      id: 'pending-quotes',
      title: `${pendingQuotes.length} cotización${pendingQuotes.length > 1 ? 'es' : ''} por aprobar`,
      body: `Total en revisión: ${formatCurrency(pendingQuotes.reduce((s, q) => s + (q.numericTotal || 0), 0))}`,
      href: '/autorizaciones',
      tone: 'border-rose-200 bg-rose-50 text-rose-950',
      icon: AlertTriangle,
      image: quoteImageFor(pendingQuotes[0]),
      imageAlt: pendingQuotes[0]?.client,
    });
    if (hotTask) alerts.push({
      id: `task-${hotTask.id}`,
      title: 'Seguimiento pendiente',
      body: `${hotTask.title || hotTask.client} · ${hotTask.value || 'Sin valor'}`,
      href: hotTask.clientId ? `/leads/${hotTask.clientId}` : '/pipeline',
      tone: 'border-primary/30 bg-primary/10 text-foreground',
      icon: Target,
      image: taskImageFor(hotTask),
      imageAlt: hotTask.contactName || hotTask.client,
    });
    return alerts.slice(0, 4);
  }, [notifications, events, currentUser, scopedTasks, scopedQuotes, isAdmin, pendingQuotes]);

  const handleExport = () => {
    generatePDFReport({
      title: "Informe de Inteligencia Operacional",
      stats: [
        { label: "Propuestas Activas", value: currentMonthTasks.length.toString(), change: currentMonthLabel },
        { label: "Ingresos Proyectados", value: formatCurrency(totalForecast), change: "" },
        { label: "Tasa Conversión", value: `${conversionRate}%`, change: "" },
        { label: "Leads Activos", value: scopedClients.length.toString(), change: "" },
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
      note: `${currentMonthTasks.length} propuestas activas · ${currentMonthLabel}`,
      icon: TrendingUp,
      tone: "bg-primary/14 text-primary border-primary/20",
    },
    {
      label: "Conversión",
      value: `${conversionRate}%`,
      note: `${approvedQuotes} cierres · ${currentMonthLabel}`,
      icon: Target,
      tone: "bg-accent/42 text-primary border-primary/15",
    },
    {
      label: "Base de Clientes",
      value: scopedClients.length.toString(),
      note: "seguimiento en vivo",
      icon: Users,
      tone: "bg-white text-foreground border-border/70",
    },
    {
      label: "Cotizaciones",
      value: currentMonthQuotes.length.toString(),
      note: `mes actual · ${currentMonthLabel}`,
      icon: FileText,
      tone: "bg-accent/45 text-foreground border-primary/15",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Resumen Comercial</h1>
          <p className="page-subtitle">Resumen del mes en curso: {currentMonthLabel}.</p>
        </div>
        <Link
          href="/quotes/new"
          className="btn-primary hidden sm:inline-flex"
        >
          <Plus className="h-4 w-4" />
          Nueva Cotización
        </Link>
      </div>

      {/* ── PENDING APPROVALS SHORTCUT (SuperAdmin only) ── */}
      {isAdmin && pendingQuotes.length > 0 && (
        <Link
          href="/autorizaciones"
          className="block bg-gradient-to-r from-rose-50 to-amber-50 border-2 border-rose-200 rounded-2xl p-5 hover:border-rose-400 hover:shadow-lg transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500 flex items-center justify-center shrink-0 animate-pulse">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-black text-rose-900 text-base">
                {pendingQuotes.length} cotización{pendingQuotes.length > 1 ? 'es' : ''} esperando tu decisión
              </h2>
              <p className="text-xs text-rose-800/70 mt-1">
                Vendedores: {[...new Set(pendingQuotes.map(q => q.requestedByName).filter(Boolean))].slice(0, 3).join(', ')}
                {' · '}Total en revisión: {formatCurrency(pendingQuotes.reduce((s, q) => s + (q.numericTotal || 0), 0))}
              </p>
            </div>
            <div className="text-rose-600 font-black text-sm group-hover:translate-x-1 transition-transform">
              Revisar →
            </div>
          </div>
        </Link>
      )}

      {/* ── WIDGET para vendedor: sus cotizaciones con cambios pedidos ── */}
      {!isAdmin && (() => {
        const myChangesRequested = quotes.filter(q =>
          q.status === 'ChangesRequested' && q.requestedBy === currentUser?.id
        );
        if (myChangesRequested.length === 0) return null;
        return (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-amber-700" fill="currentColor" viewBox="0 0 20 20"><path d="M18 13a3 3 0 01-3 3H7l-4 4V5a3 3 0 013-3h9a3 3 0 013 3v8z"/></svg>
              </div>
              <h2 className="font-bold text-amber-900 text-sm">
                El SuperAdmin pidió cambios en {myChangesRequested.length} cotizaci{myChangesRequested.length > 1 ? 'ones' : 'ón'}
              </h2>
            </div>
            <ul className="space-y-1.5">
              {myChangesRequested.map(q => (
                <li key={q.id}>
                  <Link href={`/quotes/${q.id}`} className="block bg-white border border-amber-100 rounded-xl p-3 hover:border-amber-300 transition-all">
                    <p className="text-sm font-semibold text-foreground">{q.quoteNumber || q.number} — {q.client}</p>
                    {q.reviewNotes && q.reviewNotes.length > 0 && (() => {
                      const last = [...q.reviewNotes].reverse().find(n => n.action === 'changes_requested');
                      return last?.comment ? (
                        <p className="text-xs text-amber-800 mt-1 line-clamp-2">💬 {last.comment}</p>
                      ) : null;
                    })()}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      {realAlerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {realAlerts.map(alert => (
            <Link
              key={alert.id}
              href={alert.href}
              className={clsx("border rounded-2xl p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all group", alert.tone)}
            >
              <div className="flex items-start gap-3">
                {alert.image ? (
                  <img
                    src={alert.image}
                    alt={alert.imageAlt || alert.title}
                    className="h-12 w-12 shrink-0 rounded-2xl border-2 border-white object-cover shadow-sm"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-white/75 border border-white/80 flex items-center justify-center shrink-0 shadow-sm">
                    <alert.icon className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest truncate">{alert.title}</p>
                  <p className="text-xs opacity-75 mt-1 line-clamp-2">{alert.body}</p>
                </div>
              </div>
            </Link>
          ))}
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
              <p className="mt-2 text-xs text-white/50">{currentMonthTasks.length} propuestas activas · {currentMonthLabel}</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {monthCountdown.days}d {String(monthCountdown.hours).padStart(2, '0')}h {String(monthCountdown.minutes).padStart(2, '0')}m para cierre
                </span>
              </div>
            </div>
            <div className="shrink-0 w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
          </div>
          <div className="mt-4 progress-track" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div className="progress-fill" style={{ width: `${Math.min(100, currentMonthTasks.length * 10)}%` }} />
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
          <div className="surface-card relative h-[200px] flex flex-col bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,246,231,0.88))]">
            <Link
              key={carouselIdx}
              href={activeCard?.href ?? '#'}
              className="group flex-1 block p-6 animate-in slide-in-from-bottom-4 fade-in duration-400"
            >
              <div className="flex items-start justify-between gap-4 h-full">
                <div className="min-w-0 flex-1">
                  <span className="inline-block px-3 py-1 bg-primary/16 text-primary text-[9px] font-black uppercase tracking-widest rounded-full mb-2 shadow-sm">
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
                <div className="hidden sm:block shrink-0">
                  <div className="relative h-32 w-36">
                    <div className="absolute right-0 top-0 h-28 w-28 overflow-hidden rounded-[1.6rem] border-4 border-white bg-muted shadow-xl shadow-primary/15">
                      <img
                        src={activeCardHeroImage}
                        alt={activeCard?.imageAlt || activeCard?.title || 'ArteConcreto'}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="absolute -bottom-1 left-0 flex items-center">
                      {activeCardGallery.slice(0, 3).map((image, index) => (
                        <div
                          key={`${image}-${index}`}
                          className={clsx(
                            "h-11 w-11 overflow-hidden rounded-2xl border-2 border-white bg-muted shadow-md",
                            index > 0 && "-ml-3"
                          )}
                        >
                          <img src={image} alt="" className="h-full w-full object-cover" />
                        </div>
                      ))}
                      {activeCardGallery.length > 3 && (
                        <div className="-ml-3 flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-white bg-primary text-[10px] font-black text-black shadow-md">
                          +{activeCardGallery.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
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

          {/* Descargar catálogo PDF actualizado — disponible para todo el equipo */}
          <button
            onClick={handleDownloadCatalog}
            disabled={isCatalogLoading}
            title="Genera y descarga el catálogo de productos en PDF, con la fecha y hora de generación impresas"
            className="mt-3 w-full flex items-center justify-between rounded-xl border border-foreground bg-foreground px-4 py-4 text-xs font-bold text-primary hover:brightness-125 transition-all disabled:opacity-60 shadow"
          >
            <span className="flex items-center gap-2">
              {isCatalogLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {isCatalogLoading ? 'Generando catálogo PDF…' : 'Descargar catálogo PDF'}
            </span>
            {!isCatalogLoading && <Download className="h-3.5 w-3.5" />}
          </button>

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
                liveTasks.map((task, index) => {
                  const image = taskImageFor(task);
                  return (
                    <Link key={task.id} href={`/leads/${task.clientId}`}
                      className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30 hover:bg-accent/70 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        {image ? (
                          <img src={image} alt={task.contactName || task.client} className="h-11 w-11 shrink-0 rounded-2xl border border-white object-cover shadow-sm" />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
                            <Eye className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Lead {String(index + 1).padStart(2, "0")}</p>
                          <p className="text-sm font-semibold text-foreground truncate">{task.contactName || task.client}</p>
                          <p className="text-xs text-muted-foreground font-medium">{task.value}</p>
                        </div>
                      </div>
                      <span className="badge shrink-0 bg-primary/10 text-primary">Activo</span>
                    </Link>
                  );
                })
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
                    recentQuotes.map((quote) => {
                      const image = quoteImageFor(quote);
                      return (
                      <tr key={quote.id}>
                        <td className="font-semibold">{quote.number}</td>
                        <td>
                          <div className="flex items-center gap-2.5">
                            {image ? (
                              <img src={image} alt={quote.client} className="h-9 w-9 shrink-0 rounded-xl border border-border object-cover" />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                                <FileText className="h-3.5 w-3.5" />
                              </div>
                            )}
                            <span className="truncate">{quote.client}</span>
                          </div>
                        </td>
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
                    );
                    })
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
                const maxVal = Math.max(scopedClients.length, currentMonthQuotes.length, currentMonthTasks.length, approvedQuotes, 1);
                return [
                  { label: "Leads totales", value: scopedClients.length || 0 },
                  { label: `Cotizaciones ${currentMonthLabel}`, value: currentMonthQuotes.length || 0 },
                  { label: `Propuestas ${currentMonthLabel}`, value: currentMonthTasks.length || 0 },
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

          {/* Top vendedores — widget con filtros día/semana/mes · SOLO SuperAdmin/Admin */}
          {canSeePerformance && topSellers.length > 0 && (
            <div className="surface-card p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Top Vendedores</p>
                  <h3 className="section-title mt-1">Ranking del equipo</h3>
                </div>
                <Link href="/team/performance" className="text-xs font-bold text-primary hover:underline shrink-0">
                  Ver todo →
                </Link>
              </div>

              {/* Selector de periodo */}
              <div className="flex gap-1.5 mb-4 bg-muted rounded-xl p-1">
                {([
                  { key: 'today', label: 'Hoy' },
                  { key: 'week',  label: 'Semana' },
                  { key: 'month', label: 'Mes' },
                ] as const).map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setTopSellersPreset(p.key)}
                    className={clsx(
                      'flex-1 px-3 py-1.5 rounded-lg text-[11px] font-black transition-all',
                      topSellersPreset === p.key
                        ? 'bg-white text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5">
                {(() => {
                  const topScore = topSellers[0]?.score || 0;
                  return topSellers.map((act, idx) => {
                    const pct = topScore > 0 ? Math.max(6, Math.round((act.score / topScore) * 100)) : 6;
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
                    return (
                      <Link
                        key={act.seller.id}
                        href="/team/performance"
                        className="block p-3 rounded-xl bg-muted/30 border border-border space-y-2 hover:border-primary/30 hover:bg-primary/5 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-white border border-border flex items-center justify-center text-sm font-black shrink-0">
                            {medal}
                          </div>
                          {act.seller.avatar ? (
                            <img src={act.seller.avatar} alt={act.seller.name} className="w-9 h-9 rounded-full object-cover border border-border shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-black text-muted-foreground shrink-0">
                              {act.seller.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-foreground truncate">{act.seller.name}</p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{act.seller.role}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-black text-primary leading-none">{act.score}</p>
                            <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest mt-1">Score</p>
                          </div>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex items-center gap-2.5 text-[10px] font-bold text-muted-foreground flex-wrap">
                          <span>{act.clientsAdded.length + act.leadsCreated.length} nuevos</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span>{act.callsMade.length + act.whatsappsSent.length} contactos</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span>{act.quotesSent.length} cotiz.</span>
                          {act.totalRevenue > 0 && (
                            <>
                              <span className="text-muted-foreground/40">·</span>
                              <span className="text-emerald-600">{formatCurrency(act.totalRevenue)}</span>
                            </>
                          )}
                        </div>
                      </Link>
                    );
                  });
                })()}
              </div>
            </div>
          )}

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
                const newLeads = scopedClients.filter(c => c.status === 'Lead').length;
                const distMax = Math.max(newLeads, scopedTasks.length, approvedQuotes, 1);
                return [
                  { label: "Nuevos leads", value: newLeads },
                  { label: "En seguimiento", value: scopedTasks.length },
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
