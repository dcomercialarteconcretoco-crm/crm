"use client";

import React, { useState } from 'react';
import {
    FileText,
    Plus,
    Search,
    Download,
    Mail,
    Trash2,
    MoreVertical,
    Clock,
    CheckCircle2,
    AlertCircle,
    Printer,
    ExternalLink,
    ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { useApp, Quote, Seller } from '@/context/AppContext';

const QUOTE_STATUS_LABEL: Record<string, string> = {
    'Draft': 'Borrador',
    'Sent': 'Enviado',
    'Approved': 'Aprobado',
    'Rejected': 'Rechazado'
};

export default function QuotesPage() {
    const { quotes, sellers, tasks, addNotification } = useApp();
    const [searchTerm, setSearchTerm] = useState("");
    const [isGenerating, setIsGenerating] = useState<string | null>(null);

    const filteredQuotes = quotes.filter(q =>
        q.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.client.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stats = {
        sent: quotes.filter(q => q.status === 'Sent').length,
        approved: quotes.filter(q => q.status === 'Approved').length,
        pending: quotes.filter(q => q.status === 'Draft' || q.status === 'Sent').length,
        totalValue: quotes.reduce((acc, q) => acc + (q.numericTotal || 0), 0)
    };

    const handleDownloadPDF = async (quote: Quote) => {
        setIsGenerating(quote.id);

        // Find the task and the seller for the signature
        const task = tasks.find(t => t.id === quote.taskId);
        const seller = sellers.find(s => s.name === task?.assignedTo) || sellers[0];

        addNotification({
            title: 'Motor de Impresión Arte Concreto',
            description: `Generando documento oficial bajo firma de ${seller.name}...`,
            type: 'ai'
        });

        await new Promise(r => setTimeout(r, 2000));

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Oferta Comercial - ${quote.number}</title>
                        <style>
                            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                            body { 
                                font-family: 'Inter', sans-serif; 
                                padding: 60px; 
                                color: #1a1a1a; 
                                line-height: 1.6;
                                max-width: 800px;
                                margin: 0 auto;
                            }
                            .header { 
                                display: flex; 
                                justify-content: space-between; 
                                align-items: flex-start;
                                margin-bottom: 60px; 
                            }
                            .logo-container {
                                display: flex;
                                align-items: center;
                                gap: 12px;
                            }
                            .logo-icon {
                                width: 40px;
                                height: 40px;
                                background: #FAB510;
                                border-radius: 8px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                color: black;
                                font-weight: 900;
                                font-size: 20px;
                            }
                            .logo-text {
                                font-size: 22px;
                                font-weight: 900;
                                letter-spacing: -1px;
                                text-transform: uppercase;
                            }
                            .quote-meta {
                                text-align: right;
                            }
                            .quote-meta h1 {
                                margin: 0;
                                font-size: 14px;
                                text-transform: uppercase;
                                letter-spacing: 2px;
                                color: #999;
                            }
                            .quote-meta p {
                                margin: 5px 0 0;
                                font-weight: 900;
                                font-size: 20px;
                            }
                            .salutation {
                                margin-bottom: 30px;
                            }
                            .salutation h2 {
                                font-size: 24px;
                                font-weight: 900;
                                margin-bottom: 10px;
                                color: #111;
                            }
                            .presentation {
                                margin-bottom: 40px;
                                font-size: 15px;
                                color: #555;
                                text-align: justify;
                            }
                            .table-container {
                                margin-bottom: 40px;
                            }
                            table { 
                                width: 100%; 
                                border-collapse: collapse; 
                            }
                            th { 
                                text-align: left; 
                                padding: 15px; 
                                background: #f8f8f8;
                                font-size: 11px;
                                text-transform: uppercase;
                                letter-spacing: 1px;
                                border-bottom: 2px solid #000;
                            }
                            td { 
                                padding: 20px 15px; 
                                border-bottom: 1px solid #eee;
                                font-size: 14px;
                            }
                            .total-row {
                                background: #000;
                                color: #fff;
                            }
                            .total-row td {
                                border-bottom: none;
                                font-weight: 900;
                            }
                            .signature-section {
                                margin-top: 80px;
                                display: flex;
                                flex-direction: column;
                                align-items: flex-start;
                            }
                            .signature-line {
                                width: 250px;
                                border-bottom: 1px solid #000;
                                margin-bottom: 15px;
                            }
                            .signature-name {
                                font-weight: 900;
                                font-size: 16px;
                            }
                            .signature-role {
                                font-size: 12px;
                                color: #666;
                                font-weight: 700;
                                text-transform: uppercase;
                                letter-spacing: 1px;
                            }
                            .footer {
                                margin-top: 100px;
                                padding-top: 20px;
                                border-top: 1px solid #eee;
                                font-size: 10px;
                                color: #aaa;
                                text-align: center;
                            }
                            @media print {
                                body { padding: 0; }
                                .no-print { display: none; }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <div class="logo-container">
                                <div class="logo-icon">A</div>
                                <div class="logo-text">Arte Concreto</div>
                            </div>
                            <div class="quote-meta">
                                <h1>Oferta Comercial</h1>
                                <p>${quote.number}</p>
                                <span style="font-size: 12px; color: #666;">Fecha: ${quote.date}, 2026</span>
                            </div>
                        </div>

                        <div class="salutation">
                            <h2>Hola, ${quote.client}</h2>
                            <p>Atn: Directivos y Equipo de Compras</p>
                        </div>

                        <div class="presentation">
                            Es un gusto saludarlos. En <strong>Arte Concreto</strong>, nos especializamos en la transformación de espacios industriales y urbanos a través de soluciones de diseño en concreto arquitectónico de alta resistencia. Nuestra misión es fusionar la durabilidad del material industrial con la estética premium que sus proyectos merecen. A continuación, presentamos nuestra propuesta formal detallada para los requerimientos discutidos:
                        </div>

                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Descripción de Solución Industrial</th>
                                        <th style="text-align: right;">Inversión Estimada</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style="font-weight: 700; padding-bottom: 5px;">Suministro y Logística Operativa</td>
                                        <td style="text-align: right; font-weight: 700;">${quote.total}</td>
                                    </tr>
                                    <tr>
                                        <td style="color: #888; font-size: 12px; padding-top: 0;">Incluye pre-fabricación, curado especializado y transporte a obra.</td>
                                        <td></td>
                                    </tr>
                                    <tr class="total-row">
                                        <td style="text-transform: uppercase; letter-spacing: 2px;">Total Propuesta Bancaria</td>
                                        <td style="text-align: right; font-size: 18px;">${quote.total}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div class="presentation" style="margin-top: 20px;">
                            Quedamos a su entera disposición para ajustar cualquier detalle técnico u operativo que requiera la fase actual de su proyecto.
                        </div>

                        <div class="signature-section">
                            <div class="signature-line"></div>
                            <div class="signature-name">${seller.name}</div>
                            <div class="signature-role">${seller.role} • Arte Concreto</div>
                            <div style="font-size: 11px; margin-top: 5px;">${seller.email}</div>
                        </div>

                        <div class="footer">
                            Arte Concreto S.A.S | Nit: 900.123.456-7 | Bogotá - Medellín - Cartagena<br>
                            Documento generado automáticamente por CRM Intelligence System.
                        </div>
                    </body>
                </html>
            `);
            printWindow.document.close();
            // Wait for fonts to load
            setTimeout(() => {
                printWindow.print();
            }, 500);
        }

        setIsGenerating(null);
        addNotification({
            title: 'Archivo Entregado',
            description: `Se ha generado la oferta ${quote.number} con la firma de ${seller.name}.`,
            type: 'success'
        });
    };

    const handleSendEmail = async (quote: Quote) => {
        addNotification({
            title: 'Despacho de Correo',
            description: `Enviando propuesta ${quote.number} al contacto de ${quote.client}...`,
            type: 'task'
        });

        await new Promise(r => setTimeout(r, 2000));

        addNotification({
            title: 'Confirmación de Envío',
            description: `La oferta ha sido entregada en la bandeja de entrada de ${quote.client}.`,
            type: 'success'
        });
    };

    return (
        <div className="space-y-4 lg:space-y-6 animate-in fade-in duration-500 pb-24 lg:pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="page-hero-title page-hero-title--accent text-[1.85rem] sm:text-2xl font-black tracking-tight flex flex-wrap items-center gap-3 italic uppercase">
                        Gestión de Cotizaciones
                        <span className="text-[10px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 animate-pulse">Sync Live</span>
                    </h1>
                    <p className="text-[15px] sm:text-sm text-muted-foreground font-medium">Exportación oficial de PDFs con firma digital y tracking de inteligencia.</p>
                </div>
                <Link href="/quotes/new" className="bg-primary text-black font-black px-5 py-3.5 rounded-xl flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-lg shadow-primary/20 text-[10px] uppercase tracking-widest">
                    <Plus className="w-4 h-4" />
                    <span>Nueva Cotización</span>
                </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-6">
                {[
                    { label: 'Enviadas', value: stats.sent.toString().padStart(2, '0'), icon: Mail, color: 'text-sky-500', bg: 'bg-sky-500/10' },
                    { label: 'Aprobadas', value: stats.approved.toString().padStart(2, '0'), icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { label: 'Pendientes', value: stats.pending.toString().padStart(2, '0'), icon: Clock, color: 'text-orange-500', bg: 'bg-orange-500/10' },
                    { label: 'Valor Total', value: `$${(stats.totalValue / 1000000).toFixed(1)}M`, icon: FileText, color: 'text-primary', bg: 'bg-primary/10' },
                ].map((stat) => (
                    <div key={stat.label} className="bg-card border border-border/40 p-4 lg:p-6 rounded-[1.4rem] lg:rounded-[1.5rem] relative overflow-hidden transition-all hover:border-primary/25 group">
                        <div className={`p-2 rounded-lg w-fit mb-4 ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                            <stat.icon className="w-5 h-5" />
                        </div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                        <p className="text-[1.7rem] lg:text-2xl font-black">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="bg-card/85 border border-white/70 rounded-[2rem] lg:rounded-[2.5rem] overflow-hidden shadow-[0_24px_55px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <div className="p-5 lg:p-8 border-b border-white/55 bg-white/18 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Localizar oferta por número o cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/45 border border-white/75 rounded-2xl pl-12 pr-4 py-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-white/70 outline-none transition-all font-bold backdrop-blur-xl"
                        />
                    </div>
                </div>
                <div className="grid gap-3 p-4 sm:p-5 md:hidden">
                    {filteredQuotes.length > 0 ? filteredQuotes.map((quote) => (
                        <div key={quote.id} className="rounded-[1.4rem] border border-white/75 bg-white/46 p-4 backdrop-blur-xl">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-foreground">{quote.number}</p>
                                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{quote.date}</p>
                                </div>
                                <span className={clsx(
                                    "shrink-0 text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest border",
                                    quote.status === 'Approved' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                        quote.status === 'Sent' ? "bg-sky-500/10 text-sky-500 border-sky-500/20" :
                                            quote.status === 'Draft' ? "bg-white/50 text-muted-foreground border-white/80" :
                                                "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                )}>
                                    {QUOTE_STATUS_LABEL[quote.status] || quote.status}
                                </span>
                            </div>

                            <div className="mt-4 space-y-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Cliente</p>
                                    <p className="mt-1 text-sm font-black text-foreground">{quote.client}</p>
                                </div>
                                <div className="flex items-end justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Inversión</p>
                                        <p className="mt-1 text-lg font-black text-foreground">{quote.total}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Aperturas</p>
                                        <p className={clsx(
                                            "mt-1 text-sm font-black",
                                            (quote.opens || 0) > 4 ? "text-rose-500" : "text-muted-foreground"
                                        )}>
                                            {quote.opens || 0}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => handleDownloadPDF(quote)}
                                    disabled={isGenerating === quote.id}
                                    className="flex items-center justify-center rounded-xl border border-white/75 bg-white/55 px-3 py-3 text-foreground transition-all hover:bg-primary hover:text-black disabled:opacity-50"
                                    title="Descargar PDF Oficial"
                                >
                                    {isGenerating === quote.id ? (
                                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                    ) : <Download className="w-4.5 h-4.5" />}
                                </button>
                                <button
                                    onClick={() => handleSendEmail(quote)}
                                    className="flex items-center justify-center rounded-xl border border-white/75 bg-white/55 px-3 py-3 text-foreground transition-all hover:bg-sky-500 hover:text-white"
                                    title="Reenviar por Email Tracking"
                                >
                                    <Mail className="w-4.5 h-4.5" />
                                </button>
                                <button className="flex items-center justify-center rounded-xl border border-white/75 bg-white/55 px-3 py-3 text-muted-foreground transition-all hover:bg-white hover:text-foreground">
                                    <MoreVertical className="w-4.5 h-4.5" />
                                </button>
                            </div>
                        </div>
                    )) : (
                        <div className="rounded-[1.4rem] border border-white/75 bg-white/46 p-5 text-sm font-semibold text-muted-foreground">
                            No hay cotizaciones registradas todavía.
                        </div>
                    )}
                </div>
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/55 bg-white/14">
                                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Referencia / Fecha</th>
                                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Socio Industrial</th>
                                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Inversión</th>
                                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Estado</th>
                                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Aperturas</th>
                                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Herramientas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/45">
                            {filteredQuotes.map((quote) => (
                                <tr key={quote.id} className="hover:bg-white/20 transition-colors group">
                                    <td className="px-10 py-8">
                                        <p className="text-sm font-black text-foreground group-hover:text-primary transition-colors">{quote.number}</p>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1 tracking-widest">{quote.date}</p>
                                    </td>
                                    <td className="px-10 py-8 font-black text-foreground italic">{quote.client}</td>
                                    <td className="px-10 py-8 text-sm font-black text-foreground tracking-tighter">{quote.total}</td>
                                    <td className="px-10 py-8">
                                        <span className={clsx(
                                            "text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest border",
                                            quote.status === 'Approved' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                quote.status === 'Sent' ? "bg-sky-500/10 text-sky-500 border-sky-500/20" :
                                                    quote.status === 'Draft' ? "bg-white/50 text-muted-foreground border-white/80" :
                                                        "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                        )}>
                                            {QUOTE_STATUS_LABEL[quote.status] || quote.status}
                                        </span>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className="flex items-center gap-2">
                                            <span className={clsx(
                                                "text-xs font-black",
                                                (quote.opens || 0) > 4 ? "text-rose-500" : "text-muted-foreground"
                                            )}>
                                                {quote.opens || 0}
                                            </span>
                                            {(quote.opens || 0) > 4 && (
                                                <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-10 py-8 text-right">
                                        <div className="flex items-center justify-end gap-3 opacity-40 group-hover:opacity-100 transition-all">
                                            <button
                                                onClick={() => handleDownloadPDF(quote)}
                                                disabled={isGenerating === quote.id}
                                                className="p-3 bg-white/45 hover:bg-primary hover:text-black rounded-xl transition-all border border-white/75 text-foreground disabled:opacity-50"
                                                title="Descargar PDF Oficial"
                                            >
                                                {isGenerating === quote.id ? (
                                                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                                ) : <Download className="w-4.5 h-4.5" />}
                                            </button>
                                            <button
                                                onClick={() => handleSendEmail(quote)}
                                                className="p-3 bg-white/45 hover:bg-sky-500 hover:text-white rounded-xl transition-all border border-white/75 text-foreground"
                                                title="Reenviar por Email Tracking"
                                            >
                                                <Mail className="w-4.5 h-4.5" />
                                            </button>
                                            <button className="p-3 bg-white/45 hover:bg-white/80 rounded-xl transition-all border border-white/75 text-muted-foreground hover:text-foreground">
                                                <MoreVertical className="w-4.5 h-4.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
