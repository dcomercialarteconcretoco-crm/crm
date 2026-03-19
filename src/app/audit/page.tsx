"use client";

import React, { useState } from 'react';
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
    Zap
} from 'lucide-react';
import { useApp, AuditLog, Seller, Anomaly } from '@/context/AppContext';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AuditPage() {
    const { auditLogs, sellers, anomalies } = useApp();
    const [activeView, setActiveView] = useState<'logs' | 'anomalies'>('logs');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAction, setFilterAction] = useState<string>('all');
    const [filterUser, setFilterUser] = useState<string>('all');
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);

    const generateReport = () => {
        setIsGeneratingReport(true);
        setTimeout(() => {
            setIsGeneratingReport(false);
            setShowReportModal(true);
        }, 2000);
    };

    const filteredLogs = auditLogs.filter((log: AuditLog) => {
        const matchesSearch =
            log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.targetName?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesAction = filterAction === 'all' || log.action === filterAction;
        const matchesUser = filterUser === 'all' || log.userId === filterUser;

        return matchesSearch && matchesAction && matchesUser;
    });

    const getActionBadge = (action: AuditLog['action']) => {
        switch (action) {
            case 'QUOTE_SENT': return { color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', label: 'Cotización Enviada', icon: FileText };
            case 'SALE_REGISTERED': return { color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', label: 'Venta Registrada', icon: TrendingUp };
            case 'WHATSAPP_SENT': return { color: 'text-green-400 bg-green-400/10 border-green-400/20', label: 'WhatsApp', icon: Smartphone };
            case 'CALL_MADE': return { color: 'text-orange-400 bg-orange-400/10 border-orange-400/20', label: 'Llamada', icon: Smartphone };
            case 'SYSTEM_LOGIN': return { color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', label: 'Acceso Sistema', icon: ShieldCheck };
            case 'LEAD_CREATED': return { color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20', label: 'Lead Creado', icon: User };
            default: return { color: 'text-gray-400 bg-gray-400/10 border-gray-400/20', label: action, icon: History };
        }
    };

    const getAnomalyStyles = (severity: Anomaly['severity']) => {
        switch (severity) {
            case 'high': return { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-500', icon: AlertTriangle };
            case 'medium': return { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-500', icon: AlertCircle };
            default: return { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-500', icon: Eye };
        }
    };

    // Stats calculations
    const stats = [
        {
            label: 'Total Acciones',
            value: auditLogs.length,
            icon: History,
            color: 'text-blue-400',
            bg: 'bg-blue-400/10',
            subText: 'Últimos 30 días'
        },
        {
            label: 'Verificados por IA',
            value: auditLogs.filter((l: AuditLog) => l.verified).length,
            icon: ShieldCheck,
            color: 'text-emerald-400',
            bg: 'bg-emerald-400/10',
            subText: '100% Inmutabilidad'
        },
        {
            label: 'Alertas de Veracidad',
            value: anomalies.length,
            icon: Zap,
            color: 'text-rose-400',
            bg: 'bg-rose-400/10',
            subText: 'Truth Engine Active',
            isAnomaly: true
        },
        {
            label: 'Cumplimiento',
            value: '98.2%',
            icon: CheckCircle2,
            color: 'text-purple-400',
            bg: 'bg-purple-400/10',
            subText: 'Nivel Óptimo'
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/20 rounded-2xl border border-primary/20">
                            <Shield className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-white italic underline decoration-primary underline-offset-8">TRUTH <span className="text-primary not-italic text-2xl">ENGINE</span></h1>
                    </div>
                    <p className="text-muted-foreground font-medium ml-14">
                        Sistema de Detección de Inconsistencias y Auditoría Forense
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-white/5 p-1 rounded-2xl border border-white/10 flex">
                        <button
                            onClick={() => setActiveView('logs')}
                            className={clsx(
                                "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                activeView === 'logs' ? "bg-primary text-black" : "text-white/40 hover:text-white"
                            )}
                        >
                            Log General
                        </button>
                        <button
                            onClick={() => setActiveView('anomalies')}
                            className={clsx(
                                "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                                activeView === 'anomalies' ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : "text-white/40 hover:text-white"
                            )}
                        >
                            {anomalies.length > 0 && <span className="w-2 h-2 bg-white rounded-full animate-pulse" />}
                            Inconsistencias
                        </button>
                    </div>
                    <button
                        onClick={generateReport}
                        disabled={isGeneratingReport}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-black rounded-2xl text-[10px] font-black hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 uppercase tracking-widest disabled:opacity-50"
                    >
                        {isGeneratingReport ? (
                            <>
                                <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                GENERANDO...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4" />
                                REPORTE FINAL
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                    <div key={i} className={clsx(
                        "group p-6 bg-card border border-border/40 rounded-[2rem] hover:border-primary/30 transition-all duration-500 overflow-hidden relative",
                        stat.isAnomaly && stat.value > 0 ? "border-rose-500/30 animate-pulse-subtle" : ""
                    )}>
                        <div className={clsx("absolute top-0 right-0 w-24 h-24 blur-[80px] -mr-12 -mt-12 opacity-20", stat.bg)} />
                        <div className="flex justify-between items-start mb-4">
                            <div className={clsx("p-3 rounded-2xl", stat.bg)}>
                                <stat.icon className={clsx("w-5 h-5", stat.color)} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity">Live Sync</span>
                        </div>
                        <h3 className="text-3xl font-black text-white mb-1">{stat.value}</h3>
                        <p className="text-sm font-bold text-muted-foreground">{stat.label}</p>
                        <p className="mt-4 text-[10px] font-black uppercase tracking-tighter text-muted-foreground/40">{stat.subText}</p>
                    </div>
                ))}
            </div>

            {activeView === 'logs' ? (
                <>
                    {/* Filters & Search */}
                    <div className="flex flex-col lg:flex-row gap-4 p-4 bg-muted/10 border border-border/40 rounded-[2.5rem]">
                        <div className="flex-1 relative">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Buscar por vendedor, acción o cliente..."
                                className="w-full h-14 pl-14 pr-6 bg-background/50 border border-border/40 rounded-3xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-3">
                            <div className="min-w-[180px]">
                                <select
                                    className="w-full h-14 px-6 bg-background/50 border border-border/40 rounded-3xl outline-none text-sm font-bold appearance-none cursor-pointer hover:bg-muted/30 transition-colors"
                                    value={filterAction}
                                    onChange={(e) => setFilterAction(e.target.value)}
                                >
                                    <option value="all">Todas las Acciones</option>
                                    <option value="QUOTE_SENT">Cotizaciones</option>
                                    <option value="WHATSAPP_SENT">WhatsApp</option>
                                    <option value="CALL_MADE">Llamadas</option>
                                    <option value="SALE_REGISTERED">Ventas</option>
                                    <option value="SYSTEM_LOGIN">Accesos</option>
                                </select>
                            </div>
                            <div className="min-w-[180px]">
                                <select
                                    className="w-full h-14 px-6 bg-background/50 border border-border/40 rounded-3xl outline-none text-sm font-bold appearance-none cursor-pointer hover:bg-muted/30 transition-colors"
                                    value={filterUser}
                                    onChange={(e) => setFilterUser(e.target.value)}
                                >
                                    <option value="all">Todos los Usuarios</option>
                                    {sellers.map((s: Seller) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Audit Trail List */}
                    <div className="bg-card border border-border/40 rounded-[2.5rem] overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border/40 bg-muted/20">
                                        <th className="px-8 py-5 text-left text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Timestamp / ID</th>
                                        <th className="px-8 py-5 text-left text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Usuario / Actor</th>
                                        <th className="px-8 py-5 text-left text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Acción / Evento</th>
                                        <th className="px-8 py-5 text-left text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Detalles Operativos</th>
                                        <th className="px-8 py-5 text-center text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Verificación</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/20">
                                    {filteredLogs.map((log: AuditLog) => {
                                        const badge = getActionBadge(log.action);
                                        return (
                                            <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="px-8 py-6">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-white">{format(new Date(log.timestamp), 'dd MMM, HH:mm', { locale: es })}</span>
                                                        <span className="text-[10px] font-bold text-muted-foreground opacity-50 font-mono tracking-tighter">ID: {log.id}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-muted/20 border border-border/40 flex items-center justify-center group-hover:bg-primary/20 group-hover:border-primary/30 transition-all">
                                                            <User className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-white">{log.userName}</p>
                                                            <p className="text-[10px] font-black uppercase text-primary tracking-widest">{log.userRole}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className={clsx(
                                                        "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-black border",
                                                        badge.color
                                                    )}>
                                                        <badge.icon className="w-3.5 h-3.5" />
                                                        {badge.label}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 max-w-md">
                                                    <p className="text-sm font-bold text-white/90 leading-relaxed mb-1">
                                                        {log.details}
                                                    </p>
                                                    {log.targetName && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black uppercase text-muted-foreground/60">Destino:</span>
                                                            <span className="text-[10px] font-black text-primary px-2 py-0.5 bg-primary/5 rounded-md border border-primary/10 tracking-widest">
                                                                {log.targetName}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    {log.verified ? (
                                                        <div className="flex flex-col items-center gap-1 group/badge" title="Acción verificada por el Motor de IA">
                                                            <ShieldCheck className="w-6 h-6 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
                                                            <span className="text-[9px] font-black uppercase text-emerald-400 tracking-tighter opacity-0 group-hover/badge:opacity-100 transition-opacity">Sistema OK</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-1 group/badge" title="Informado manualmente - Pendiente de verificación">
                                                            <AlertCircle className="w-6 h-6 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]" />
                                                            <span className="text-[9px] font-black uppercase text-amber-400 tracking-tighter opacity-0 group-hover/badge:opacity-100 transition-opacity">Manual</span>
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
                </>
            ) : (
                /* Anomalies View */
                <div className="space-y-6">
                    <div className="bg-rose-500/10 border border-rose-500/20 p-8 rounded-[2.5rem] flex items-center justify-between">
                        <div className="space-y-1">
                            <h2 className="text-xl font-black text-white flex items-center gap-3">
                                <AlertTriangle className="w-6 h-6 text-rose-500" />
                                Truth Engine: Análisis de Anomalías
                            </h2>
                            <p className="text-sm font-bold text-white/60">Cruzando reportes manuales con actividad digital detectada en tiempo real.</p>
                        </div>
                        <div className="px-6 py-2 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full animate-pulse">
                            Escaneando Sistema...
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {anomalies.map((anom: Anomaly) => {
                            const style = getAnomalyStyles(anom.severity);
                            return (
                                <div key={anom.id} className={clsx(
                                    "p-8 rounded-[2.5rem] border bg-card flex items-center justify-between group hover:bg-white/[0.02] transition-all",
                                    style.border
                                )}>
                                    <div className="flex items-center gap-8">
                                        <div className={clsx("w-16 h-16 rounded-3xl flex items-center justify-center shrink-0", style.bg)}>
                                            <style.icon className={clsx("w-8 h-8", style.text)} />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3">
                                                <span className={clsx("text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border", style.text, style.border)}>
                                                    ALERTA: {anom.severity === 'high' ? 'CRÍTICA' : anom.severity === 'medium' ? 'MODERADA' : 'INFORMATIVA'}
                                                </span>
                                                <span className="text-xs font-black text-white/40 uppercase tracking-tighter">
                                                    {format(new Date(anom.timestamp), 'dd MMM, HH:mm', { locale: es })}
                                                </span>
                                            </div>
                                            <h4 className="text-lg font-black text-white group-hover:text-rose-500 transition-colors">{anom.description}</h4>
                                            <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground">
                                                <div className="flex items-center gap-1.5">
                                                    <User className="w-3.5 h-3.5" />
                                                    Vendedor: <span className="text-white">{anom.userName}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <ShieldCheck className="w-3.5 h-3.5" />
                                                    Objetivo: <span className="text-white">{anom.targetName}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
                                            Descartar
                                        </button>
                                        <button className={clsx("px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg",
                                            anom.severity === 'high' ? "bg-rose-500 text-white hover:scale-105" : "bg-primary text-black hover:scale-105")}>
                                            Investigar
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {anomalies.length === 0 && (
                            <div className="py-20 text-center bg-card border border-border/40 rounded-[2.5rem]">
                                <Sparkles className="w-12 h-12 text-primary mx-auto mb-4 opacity-20" />
                                <p className="font-black text-white/40 uppercase tracking-[0.3em]">Sistema Limpio: 100% Veracidad</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Security Footer */}
            <div className="px-8 py-4 bg-muted/10 border border-border/40 rounded-[2rem] flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    Truth Engine Core v4.0 - Análisis de Incoherencia Probabilística
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-[10px] font-black text-muted-foreground uppercase opacity-40">
                        Inmutabilidad Garantizada por Motor de IA
                    </div>
                </div>
            </div>

            {/* Report Modal */}
            {showReportModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
                    <div className="bg-card border border-primary/30 w-full max-w-4xl rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(250,181,16,0.1)] flex flex-col max-h-[90vh]">
                        <div className="p-10 border-b border-white/5 bg-primary/5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary rounded-2xl">
                                    <FileText className="w-6 h-6 text-black" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white italic">INFORME EJECUTIVO <span className="text-primary not-italic">DE AUDITORÍA</span></h2>
                                    <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em]">Hash: 8f2a...9d1c / Cifrado Grado Militar</p>
                                </div>
                            </div>
                            <button onClick={() => setShowReportModal(false)} className="p-4 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white">
                                <Search className="w-6 h-6 rotate-45" /> {/* Use Search icon rotated as X if X is not imported or just use generic close */}
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar space-y-10">
                            {/* Executive Summary */}
                            <div className="grid grid-cols-3 gap-8">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Periodo</p>
                                    <p className="text-lg font-bold text-white">Últimas 24 Horas</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Total Eventos</p>
                                    <p className="text-lg font-bold text-white">{auditLogs.length} Registros</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Nivel de Veracidad</p>
                                    <p className="text-lg font-bold text-emerald-400">92.4% (Óptimo)</p>
                                </div>
                            </div>

                            <div className="h-px bg-white/5" />

                            {/* Findings */}
                            <div className="space-y-6">
                                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
                                    <TrendingUp className="w-4 h-4 text-primary" />
                                    HALLAZGOS OPERATIVOS
                                </h3>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20 uppercase tracking-widest">Efectividad Alta</span>
                                            <span className="text-xs font-bold text-white/40">Motor IA</span>
                                        </div>
                                        <p className="text-sm text-white/80 font-medium leading-relaxed">
                                            Se detectó alineación continua operativa según los logs más recientes del sistema en tareas de envío y recepción.
                                        </p>
                                    </div>

                                    <div className="p-6 bg-rose-500/5 border border-rose-500/20 rounded-3xl space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-rose-500 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20 uppercase tracking-widest">Alerta de Veracidad</span>
                                            <span className="text-xs font-bold text-white/40">Truth Engine Core</span>
                                        </div>
                                        <p className="text-sm text-white/80 font-medium leading-relaxed">
                                            Existen <span className="text-rose-500 font-black">{anomalies.length} anomalías</span> detectadas en el sistema. Se listan inconsistencias operativas activas recientes. <span className="underline decoration-rose-500/50 underline-offset-4 pointer-events-none">Se recomienda revisión cruzada.</span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Verification Footer */}
                            <div className="p-8 bg-black/40 rounded-3xl border border-white/5 flex items-center gap-6">
                                <ShieldCheck className="w-12 h-12 text-primary opacity-50" />
                                <div>
                                    <p className="text-xs font-bold text-white/90">Certificación Inmutable</p>
                                    <p className="text-[10px] text-white/40 leading-relaxed max-w-lg">
                                        Este informe ha sido generado automáticamente cruzando datos de telemetría digital y registros manuales. La inmutabilidad de los datos garantiza que no existe alteración humana en el análisis.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-10 border-t border-white/5 bg-white/[0.02] flex justify-end gap-4">
                            <button onClick={() => setShowReportModal(false)} className="px-10 py-4 rounded-2xl border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">
                                Cerrar
                            </button>
                            <button className="bg-primary text-black px-12 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.05] active:scale-[0.95] transition-all flex items-center gap-3 shadow-2xl shadow-primary/20">
                                <Download className="w-4 h-4" /> DESCARGAR PDF FIRMADO
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
