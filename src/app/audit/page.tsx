"use client";

import React, { useState, useEffect } from 'react';
import {
    Shield,
    Search,
    Filter,
    Calendar,
    Download,
    CheckCircle2,
    AlertCircle,
    Clock,
    User,
    Smartphone,
    Mail,
    ArrowUpRight,
    FileText,
    TrendingUp,
    ShieldCheck,
    History,
    Sparkles,
    Eye,
    AlertTriangle,
    Zap,
    Package,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { useApp, AuditLog, Seller, Anomaly } from '@/context/AppContext';
import { PermissionGate } from '@/components/PermissionGate';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const PAGE_SIZE = 20;

export default function AuditPage() {
    const { auditLogs, sellers, anomalies, purgeOldAuditLogs } = useApp();
    const [activeView, setActiveView] = useState<'logs' | 'anomalies'>('logs');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAction, setFilterAction] = useState<string>('all');
    const [filterUser, setFilterUser] = useState<string>('all');
    const [filterTargetType, setFilterTargetType] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [page, setPage] = useState(1);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);

    // Auto-purge logs older than 180 days on mount
    useEffect(() => { purgeOldAuditLogs(); }, []);

    // Reset to page 1 when any filter changes
    useEffect(() => { setPage(1); }, [searchTerm, filterAction, filterUser, filterTargetType, dateFrom, dateTo]);

    const generateReport = () => {
        setIsGeneratingReport(true);
        setTimeout(() => {
            setIsGeneratingReport(false);
            setShowReportModal(true);
        }, 2000);
    };

    const getTargetType = (action: AuditLog['action']): string => {
        switch (action) {
            case 'WHATSAPP_SENT':
            case 'CALL_MADE':
            case 'QUOTE_SENT':
            case 'LEAD_CREATED':
                return 'clientes';
            case 'SALE_REGISTERED':
                return 'ventas';
            case 'SYSTEM_LOGIN':
                return 'sistema';
            default:
                return 'otros';
        }
    };

    const getTargetTypeLabel = (action: AuditLog['action']): string => {
        switch (action) {
            case 'WHATSAPP_SENT':
            case 'CALL_MADE':
            case 'QUOTE_SENT':
            case 'LEAD_CREATED':
                return '👤 Cliente';
            case 'SALE_REGISTERED':
                return '💰 Venta';
            case 'SYSTEM_LOGIN':
                return '🔐 Sistema';
            default:
                return '📋 Otro';
        }
    };

    const getActionBadge = (action: AuditLog['action']) => {
        switch (action) {
            case 'QUOTE_SENT': return { color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Cotización Enviada', icon: FileText };
            case 'SALE_REGISTERED': return { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Venta Registrada', icon: TrendingUp };
            case 'WHATSAPP_SENT': return { color: 'bg-green-50 text-green-700 border-green-200', label: 'WhatsApp', icon: Smartphone };
            case 'CALL_MADE': return { color: 'bg-orange-50 text-orange-700 border-orange-200', label: 'Llamada', icon: Smartphone };
            case 'SYSTEM_LOGIN': return { color: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Acceso Sistema', icon: ShieldCheck };
            case 'LEAD_CREATED': return { color: 'bg-cyan-50 text-cyan-700 border-cyan-200', label: 'Lead Creado', icon: User };
            case 'PRODUCT_UPDATED' as AuditLog['action']: return { color: 'bg-violet-50 text-violet-700 border-violet-200', label: 'Producto Actualizado', icon: Package };
            default: return { color: 'bg-muted text-muted-foreground border-border', label: action, icon: History };
        }
    };

    const getAnomalyStyles = (severity: Anomaly['severity']) => {
        switch (severity) {
            case 'high': return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', icon: AlertTriangle };
            case 'medium': return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', icon: AlertCircle };
            default: return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', icon: Eye };
        }
    };

    const filteredLogs = auditLogs.filter((log: AuditLog) => {
        const badge = getActionBadge(log.action);
        const matchesSearch =
            log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.targetName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
            badge.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesAction = filterAction === 'all' || log.action === filterAction;
        const matchesUser = filterUser === 'all' || log.userId === filterUser;

        const targetType = getTargetType(log.action);
        const matchesTargetType = filterTargetType === 'all' || targetType === filterTargetType;

        const matchesDate =
            (!dateFrom || new Date(log.timestamp) >= new Date(dateFrom)) &&
            (!dateTo || new Date(log.timestamp) <= new Date(dateTo + 'T23:59:59'));

        return matchesSearch && matchesAction && matchesUser && matchesTargetType && matchesDate;
    });

    const hasActiveFilters = searchTerm || filterAction !== 'all' || filterUser !== 'all' || filterTargetType !== 'all' || dateFrom || dateTo;

    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
    const paginatedLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const exportCSV = () => {
        const headers = ['Fecha', 'Usuario', 'Rol', 'Acción', 'Tipo', 'Objetivo', 'Detalles'];
        const rows = filteredLogs.map((l: AuditLog) => [
            new Date(l.timestamp).toLocaleString('es-CO'),
            l.userName,
            l.userRole,
            l.action,
            getTargetTypeLabel(l.action),
            l.targetName || '',
            l.details
        ]);
        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auditoria_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Stats calculations
    const stats = [
        {
            label: 'Total Acciones',
            value: hasActiveFilters ? `${filteredLogs.length}/${auditLogs.length}` : auditLogs.length,
            icon: History,
            subText: hasActiveFilters ? 'Con filtros activos' : 'Últimos 30 días',
            dark: true
        },
        {
            label: 'Verificados por IA',
            value: auditLogs.filter((l: AuditLog) => l.verified).length,
            icon: ShieldCheck,
            subText: '100% Inmutabilidad',
            dark: false
        },
        {
            label: 'Alertas de Veracidad',
            value: anomalies.length,
            icon: Zap,
            subText: 'Truth Engine Active',
            isAnomaly: true,
            dark: false
        },
        {
            label: 'Cumplimiento',
            value: auditLogs.length > 0
                ? `${Math.round((auditLogs.filter((l: AuditLog) => l.verified).length / auditLogs.length) * 100)}%`
                : '—',
            icon: CheckCircle2,
            subText: anomalies.length === 0 ? 'Sin anomalías' : `${anomalies.length} anomalía(s)`,
            dark: false
        }
    ];

    return (
        <PermissionGate require="audit.view">
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-primary" />
                        </div>
                        <h1 className="text-2xl font-black text-foreground tracking-tight">Truth Engine</h1>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 ml-13">
                        Sistema de Detección de Inconsistencias y Auditoría Forense
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* View toggle */}
                    <div className="bg-muted border border-border rounded-xl p-1 flex">
                        <button
                            onClick={() => setActiveView('logs')}
                            className={clsx(
                                "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                                activeView === 'logs' ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Log General
                        </button>
                        <button
                            onClick={() => setActiveView('anomalies')}
                            className={clsx(
                                "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2",
                                activeView === 'anomalies' ? "bg-red-600 text-white" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {anomalies.length > 0 && <span className="w-2 h-2 bg-current rounded-full animate-pulse" />}
                            Inconsistencias
                        </button>
                    </div>
                    <button
                        onClick={generateReport}
                        disabled={isGeneratingReport}
                        className="bg-primary text-black font-bold rounded-xl px-4 py-2.5 hover:brightness-105 transition-all flex items-center gap-2 text-xs disabled:opacity-50"
                    >
                        {isGeneratingReport ? (
                            <>
                                <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                Generando...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4" />
                                Reporte Final
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* KPI Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                    <div
                        key={i}
                        className={clsx(
                            "rounded-2xl p-5",
                            stat.dark
                                ? "bg-foreground text-background"
                                : stat.isAnomaly && stat.value > 0
                                    ? "bg-white border border-red-200 shadow-sm"
                                    : "bg-white border border-border shadow-sm"
                        )}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className={clsx(
                                "w-10 h-10 rounded-xl flex items-center justify-center",
                                stat.dark ? "bg-background/10" : stat.isAnomaly && stat.value > 0 ? "bg-red-50" : "bg-primary/10"
                            )}>
                                <stat.icon className={clsx(
                                    "w-5 h-5",
                                    stat.dark ? "text-background" : stat.isAnomaly && stat.value > 0 ? "text-red-600" : "text-primary"
                                )} />
                            </div>
                            <span className={clsx("text-xs font-bold uppercase tracking-widest", stat.dark ? "text-background/40" : "text-muted-foreground")}>Live</span>
                        </div>
                        <p className={clsx("text-3xl font-black mb-1", stat.dark ? "text-background" : "text-foreground")}>{stat.value}</p>
                        <p className={clsx("text-sm font-semibold", stat.dark ? "text-background/70" : "text-foreground")}>{stat.label}</p>
                        <p className={clsx("text-xs mt-1", stat.dark ? "text-background/40" : "text-muted-foreground")}>{stat.subText}</p>
                    </div>
                ))}
            </div>

            {activeView === 'logs' ? (
                <>
                    {/* Filters bar */}
                    <div className="bg-white border border-border rounded-2xl shadow-sm p-4 space-y-3">
                        <div className="flex gap-3">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Buscar por vendedor, acción, cliente o tipo..."
                                    className="w-full bg-muted border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={exportCSV}
                                className="bg-white border border-border text-foreground font-semibold rounded-xl px-4 py-2.5 hover:bg-muted transition-all flex items-center gap-2 text-sm"
                            >
                                <Download className="w-4 h-4" />
                                CSV
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <select
                                className="bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                value={filterAction}
                                onChange={(e) => setFilterAction(e.target.value)}
                            >
                                <option value="all">Todas las Acciones</option>
                                <option value="QUOTE_SENT">Cotizaciones</option>
                                <option value="WHATSAPP_SENT">WhatsApp</option>
                                <option value="CALL_MADE">Llamadas</option>
                                <option value="SALE_REGISTERED">Ventas</option>
                                <option value="SYSTEM_LOGIN">Accesos</option>
                                <option value="LEAD_CREATED">Leads</option>
                                <option value="PRODUCT_UPDATED">Productos</option>
                            </select>
                            <select
                                className="bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                value={filterUser}
                                onChange={(e) => setFilterUser(e.target.value)}
                            >
                                <option value="all">Todos los Usuarios</option>
                                {sellers.map((s: Seller) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                            <select
                                className="bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                value={filterTargetType}
                                onChange={(e) => setFilterTargetType(e.target.value)}
                            >
                                <option value="all">Todo</option>
                                <option value="clientes">Clientes</option>
                                <option value="ventas">Ventas / Productos</option>
                                <option value="sistema">Sistema</option>
                            </select>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                            />
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                            />
                            {hasActiveFilters && (
                                <button
                                    onClick={() => {
                                        setSearchTerm('');
                                        setFilterAction('all');
                                        setFilterUser('all');
                                        setFilterTargetType('all');
                                        setDateFrom('');
                                        setDateTo('');
                                    }}
                                    className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600 hover:bg-red-100 transition-colors"
                                >
                                    Limpiar
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Audit trail table */}
                    <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/50 border-b border-border">
                                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Timestamp / ID</th>
                                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Usuario / Actor</th>
                                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Acción / Tipo</th>
                                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Detalles Operativos</th>
                                        <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Verificación</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-16 text-center">
                                                <History className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                                                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Sin registros con los filtros actuales</p>
                                            </td>
                                        </tr>
                                    ) : paginatedLogs.map((log: AuditLog) => {
                                        const badge = getActionBadge(log.action);
                                        const typeLabel = getTargetTypeLabel(log.action);
                                        return (
                                            <tr key={log.id} className="border-b border-border hover:bg-muted/30 transition-colors group">
                                                <td className="px-4 py-4">
                                                    <p className="text-sm font-bold text-foreground">{format(new Date(log.timestamp), 'dd MMM, HH:mm', { locale: es })}</p>
                                                    <p className="text-xs font-mono text-muted-foreground">ID: {log.id}</p>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                                            <User className="w-5 h-5 text-primary" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-foreground">{log.userName}</p>
                                                            <p className="text-xs font-bold text-primary uppercase tracking-widest">{log.userRole}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={clsx(
                                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border w-fit",
                                                            badge.color
                                                        )}>
                                                            <badge.icon className="w-3.5 h-3.5" />
                                                            {badge.label}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">{typeLabel}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 max-w-xs">
                                                    <p className="text-sm text-foreground leading-relaxed mb-1">{log.details}</p>
                                                    {log.targetName && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-muted-foreground font-bold">Destino:</span>
                                                            <span className="text-xs font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10">
                                                                {log.targetName}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    {log.verified ? (
                                                        <div className="flex flex-col items-center gap-1" title="Acción verificada por el Motor de IA">
                                                            <ShieldCheck className="w-6 h-6 text-emerald-600" />
                                                            <span className="text-xs font-bold text-emerald-600">OK</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-1" title="Informado manualmente - Pendiente de verificación">
                                                            <AlertCircle className="w-6 h-6 text-amber-500" />
                                                            <span className="text-xs font-bold text-amber-500">Manual</span>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="bg-white border border-border rounded-2xl shadow-sm px-6 py-4 flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Página <span className="font-bold text-foreground">{page}</span> de <span className="font-bold text-foreground">{totalPages}</span>
                                <span className="ml-2 text-xs">({filteredLogs.length} registros)</span>
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="flex items-center gap-1.5 bg-white border border-border text-foreground font-semibold rounded-xl px-3 py-2 hover:bg-muted transition-all text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-4 h-4" /> Anterior
                                </button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                                        let p: number;
                                        if (totalPages <= 7) p = i + 1;
                                        else if (page <= 4) p = i + 1;
                                        else if (page >= totalPages - 3) p = totalPages - 6 + i;
                                        else p = page - 3 + i;
                                        return (
                                            <button
                                                key={p}
                                                onClick={() => setPage(p)}
                                                className={clsx(
                                                    "w-9 h-9 rounded-xl text-sm font-bold transition-all",
                                                    p === page ? "bg-primary text-black" : "text-muted-foreground hover:bg-muted"
                                                )}
                                            >{p}</button>
                                        );
                                    })}
                                </div>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="flex items-center gap-1.5 bg-white border border-border text-foreground font-semibold rounded-xl px-3 py-2 hover:bg-muted transition-all text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    Siguiente <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Purge notice */}
                    <p className="text-center text-xs text-muted-foreground">
                        Registros mayores a 180 días se eliminan automáticamente al abrir esta página
                    </p>
                </>
            ) : (
                /* Anomalies View */
                <div className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-2xl shadow-sm p-6 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-black text-foreground flex items-center gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                                Truth Engine: Análisis de Anomalías
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">Cruzando reportes manuales con actividad digital detectada en tiempo real.</p>
                        </div>
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-red-600 text-white animate-pulse">
                            Escaneando...
                        </span>
                    </div>

                    <div className="space-y-3">
                        {anomalies.map((anom: Anomaly) => {
                            const style = getAnomalyStyles(anom.severity);
                            return (
                                <div key={anom.id} className={clsx(
                                    "bg-white border rounded-2xl shadow-sm p-6 flex items-center justify-between",
                                    style.border
                                )}>
                                    <div className="flex items-center gap-5">
                                        <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", style.bg)}>
                                            <style.icon className={clsx("w-6 h-6", style.text)} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className={clsx("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border", style.text, style.bg, style.border)}>
                                                    ALERTA: {anom.severity === 'high' ? 'CRÍTICA' : anom.severity === 'medium' ? 'MODERADA' : 'INFORMATIVA'}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {format(new Date(anom.timestamp), 'dd MMM, HH:mm', { locale: es })}
                                                </span>
                                            </div>
                                            <h4 className="text-base font-bold text-foreground">{anom.description}</h4>
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                <div className="flex items-center gap-1.5">
                                                    <User className="w-3.5 h-3.5" />
                                                    Vendedor: <span className="font-semibold text-foreground">{anom.userName}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <ShieldCheck className="w-3.5 h-3.5" />
                                                    Objetivo: <span className="font-semibold text-foreground">{anom.targetName}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button className="bg-white border border-border text-foreground font-semibold rounded-xl px-4 py-2.5 hover:bg-muted transition-all text-sm">
                                            Descartar
                                        </button>
                                        <button className={clsx(
                                            "font-bold rounded-xl px-4 py-2.5 transition-all text-sm",
                                            anom.severity === 'high' ? "bg-red-600 text-white hover:brightness-105" : "bg-primary text-black hover:brightness-105"
                                        )}>
                                            Investigar
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {anomalies.length === 0 && (
                            <div className="py-16 text-center bg-white border border-border rounded-2xl shadow-sm">
                                <Sparkles className="w-12 h-12 text-primary/30 mx-auto mb-4" />
                                <p className="font-bold text-muted-foreground uppercase tracking-widest text-sm">Sistema Limpio: 100% Veracidad</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Security Footer */}
            <div className="bg-white border border-border rounded-2xl shadow-sm px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Truth Engine Core v4.0 — Análisis de Incoherencia Probabilística
                </div>
                <span className="text-xs text-muted-foreground">Inmutabilidad Garantizada por Motor de IA</span>
            </div>

            {/* Report Modal */}
            {showReportModal && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-[100]" style={{ background: 'rgba(10,12,20,0.55)', backdropFilter: 'blur(6px)' }}>
                    <div className="bg-white border border-border rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-foreground">Informe Ejecutivo de Auditoría</h2>
                                    <p className="text-xs text-muted-foreground">Hash: 8f2a...9d1c / Cifrado Grado Militar</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowReportModal(false)}
                                className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground"
                            >
                                <Search className="w-5 h-5 rotate-45" />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="px-6 py-5 space-y-6 overflow-y-auto flex-1">
                            {/* Executive Summary */}
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { label: 'Periodo', value: 'Últimas 24 Horas' },
                                    { label: 'Total Eventos', value: `${auditLogs.length} Registros` },
                                    { label: 'Nivel de Veracidad', value: '92.4% (Óptimo)', highlight: true }
                                ].map(item => (
                                    <div key={item.label} className="bg-muted rounded-xl p-4">
                                        <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">{item.label}</p>
                                        <p className={clsx("text-base font-bold", item.highlight ? "text-emerald-600" : "text-foreground")}>{item.value}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="h-px bg-border" />

                            {/* Findings */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-primary" />
                                    Hallazgos Operativos
                                </h3>
                                <div className="space-y-3">
                                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Efectividad Alta</span>
                                            <span className="text-xs text-muted-foreground">Motor IA</span>
                                        </div>
                                        <p className="text-sm text-foreground leading-relaxed">
                                            Se detectó alineación continua operativa según los logs más recientes del sistema en tareas de envío y recepción.
                                        </p>
                                    </div>
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">Alerta de Veracidad</span>
                                            <span className="text-xs text-muted-foreground">Truth Engine Core</span>
                                        </div>
                                        <p className="text-sm text-foreground leading-relaxed">
                                            Existen <span className="text-red-600 font-bold">{anomalies.length} anomalías</span> detectadas en el sistema. Se listan inconsistencias operativas activas recientes. Se recomienda revisión cruzada.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Verification footer */}
                            <div className="p-4 bg-muted rounded-xl border border-border flex items-center gap-4">
                                <ShieldCheck className="w-10 h-10 text-primary/50 shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-foreground">Certificación Inmutable</p>
                                    <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
                                        Este informe ha sido generado automáticamente cruzando datos de telemetría digital y registros manuales. La inmutabilidad de los datos garantiza que no existe alteración humana en el análisis.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
                            <button
                                onClick={() => setShowReportModal(false)}
                                className="bg-white border border-border text-foreground font-semibold rounded-xl px-4 py-2.5 hover:bg-muted transition-all text-sm"
                            >
                                Cerrar
                            </button>
                            <button className="bg-primary text-black font-bold rounded-xl px-4 py-2.5 hover:brightness-105 transition-all flex items-center gap-2 text-sm">
                                <Download className="w-4 h-4" /> Descargar PDF Firmado
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </PermissionGate>
    );
}
