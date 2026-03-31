"use client";

import React, { useState, useRef } from 'react';
import { Upload, Download, CheckCircle, AlertTriangle, Users, FileText, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PermissionGate } from '@/components/PermissionGate';

// ── CSV helpers ────────────────────────────────────────────────────────────────
function parseCSV(text: string): Record<string, string>[] {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = values[i] || ''; });
        return row;
    });
}

const CLIENT_TEMPLATE = [
    'nombre,empresa,email,telefono,ciudad,estado,valor_texto,categoria',
    'Juan García,Constructora XYZ,juan@xyz.co,3001234567,Bogotá,Active,$50.000.000,Construcción',
    'María López,Obras & Diseño,maria@obras.co,3109876543,Medellín,Active,$25.000.000,Arquitectura',
].join('\n');

const QUOTE_TEMPLATE = [
    'numero,cliente,email_cliente,empresa_cliente,fecha,total,subtotal,estado,referencia,vendedor',
    'ART-100-2025,Juan García,juan@xyz.co,Constructora XYZ,2025-03-15,59500000,50000000,Approved,Mobiliario Urbano Parque Central,Carlos Ramírez',
    'ART-101-2025,María López,maria@obras.co,Obras & Diseño,2025-03-20,29750000,25000000,Draft,Bancos y Jardineras,Ana Gómez',
].join('\n');

function downloadCSV(content: string, filename: string) {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

export default function ImportPage() {
    const { importClients, importQuotes, clients, quotes, addNotification } = useApp();

    // ── Clients import state ───────────────────────────────────────────────────
    const [clientRows, setClientRows] = useState<Record<string, string>[]>([]);
    const [clientError, setClientError] = useState('');
    const [clientDone, setClientDone] = useState(false);
    const clientRef = useRef<HTMLInputElement>(null);

    // ── Quotes import state ────────────────────────────────────────────────────
    const [quoteRows, setQuoteRows] = useState<Record<string, string>[]>([]);
    const [quoteError, setQuoteError] = useState('');
    const [quoteDone, setQuoteDone] = useState(false);
    const quoteRef = useRef<HTMLInputElement>(null);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleClientFile = (file: File) => {
        setClientError(''); setClientDone(false); setClientRows([]);
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const rows = parseCSV(e.target?.result as string);
                if (!rows.length) { setClientError('El archivo está vacío o no tiene datos.'); return; }
                if (!rows[0].nombre && !rows[0].name) { setClientError('El CSV debe tener columna "nombre" o "name".'); return; }
                setClientRows(rows);
            } catch { setClientError('Error al leer el archivo CSV.'); }
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handleQuoteFile = (file: File) => {
        setQuoteError(''); setQuoteDone(false); setQuoteRows([]);
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const rows = parseCSV(e.target?.result as string);
                if (!rows.length) { setQuoteError('El archivo está vacío o no tiene datos.'); return; }
                if (!rows[0].numero && !rows[0].number) { setQuoteError('El CSV debe tener columna "numero" o "number".'); return; }
                setQuoteRows(rows);
            } catch { setQuoteError('Error al leer el archivo CSV.'); }
        };
        reader.readAsText(file, 'UTF-8');
    };

    const importClientRows = () => {
        if (!clientRows.length) return;
        const mapped = clientRows.map(r => ({
            name: r.nombre || r.name || '',
            company: r.empresa || r.company || '',
            email: r.email || '',
            phone: r.telefono || r.phone || '',
            city: r.ciudad || r.city || '',
            status: (r.estado || r.status || 'Active') as 'Active' | 'Lead' | 'Inactive',
            value: r.valor_texto || r.value_text || '$0',
            ltv: parseFloat(r.ltv || '0'),
            lastContact: r.ultima_visita || r.last_contact || new Date().toISOString().split('T')[0],
            score: parseInt(r.score || '70'),
            category: r.categoria || r.category || 'General',
            registrationDate: r.fecha_registro || r.registration_date || new Date().toISOString().split('T')[0],
        }));
        importClients(mapped);
        setClientDone(true);
        setClientRows([]);
        addNotification({ title: `${mapped.length} clientes importados`, description: 'Los clientes han sido agregados al CRM.', type: 'success' });
    };

    const importQuoteRows = () => {
        if (!quoteRows.length) return;
        const mapped = quoteRows.map(r => {
            const num = r.numero || r.number || '';
            const total = parseFloat(r.total?.replace(/[^\d.]/g, '') || '0');
            const subtotal = parseFloat(r.subtotal?.replace(/[^\d.]/g, '') || '0') || total / 1.19;
            return {
                number: num,
                quoteNumber: num,
                client: r.cliente || r.client || '',
                clientId: '',
                clientEmail: r.email_cliente || r.client_email || '',
                clientCompany: r.empresa_cliente || r.client_company || '',
                date: r.fecha || r.date || new Date().toLocaleDateString('es-CO'),
                total: `$${total.toLocaleString('es-CO')}`,
                numericTotal: total,
                subtotal,
                tax: total - subtotal,
                status: (r.estado || r.status || 'Approved') as 'Draft' | 'Sent' | 'Approved' | 'Rejected',
                items: [],
                notes: r.notas || r.notes || '',
                sellerId: '',
                sellerName: r.vendedor || r.seller || '',
                referencia: r.referencia || r.reference || '',
                validUntil: r.vigencia || r.valid_until || '',
                deliveryTime: r.plazo_entrega || r.delivery_time || '',
                paymentTerms: r.forma_pago || r.payment_terms || '',
                sellerPhone: '',
                sentAt: r.fecha || r.date || '',
            };
        });
        importQuotes(mapped);
        setQuoteDone(true);
        setQuoteRows([]);
        addNotification({ title: `${mapped.length} cotizaciones importadas`, description: 'Las cotizaciones han sido cargadas al CRM.', type: 'success' });
    };

    return (
        <PermissionGate require="settings.view">
        <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="page-title">Importar Datos Históricos</h1>
                <p className="page-subtitle">Carga clientes y cotizaciones antiguas al CRM desde archivos CSV.</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
                <div className="surface-panel rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-foreground">{clients.length}</p>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Clientes en el CRM</p>
                    </div>
                </div>
                <div className="surface-panel rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-foreground">{quotes.length}</p>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cotizaciones en el CRM</p>
                    </div>
                </div>
            </div>

            {/* Import Clients */}
            <ImportCard
                title="Importar Clientes"
                icon={<Users className="w-5 h-5 text-primary" />}
                description="Sube un CSV con los clientes históricos. Descarga la plantilla para ver el formato correcto."
                templateName="plantilla_clientes.csv"
                templateContent={CLIENT_TEMPLATE}
                rows={clientRows}
                error={clientError}
                done={clientDone}
                inputRef={clientRef}
                onFileChange={f => handleClientFile(f)}
                onImport={importClientRows}
                onClear={() => { setClientRows([]); setClientError(''); setClientDone(false); }}
                columnLabels={['nombre', 'empresa', 'email', 'telefono', 'ciudad', 'estado', 'valor_texto', 'categoria']}
            />

            {/* Import Quotes */}
            <ImportCard
                title="Importar Cotizaciones"
                icon={<FileText className="w-5 h-5 text-primary" />}
                description="Sube un CSV con cotizaciones históricas. Descarga la plantilla para ver el formato correcto."
                templateName="plantilla_cotizaciones.csv"
                templateContent={QUOTE_TEMPLATE}
                rows={quoteRows}
                error={quoteError}
                done={quoteDone}
                inputRef={quoteRef}
                onFileChange={f => handleQuoteFile(f)}
                onImport={importQuoteRows}
                onClear={() => { setQuoteRows([]); setQuoteError(''); setQuoteDone(false); }}
                columnLabels={['numero', 'cliente', 'email_cliente', 'empresa_cliente', 'fecha', 'total', 'subtotal', 'estado', 'referencia', 'vendedor']}
            />
        </div>
        </PermissionGate>
    );
}

// ── Reusable import card ───────────────────────────────────────────────────────
interface ImportCardProps {
    title: string;
    icon: React.ReactNode;
    description: string;
    templateName: string;
    templateContent: string;
    rows: Record<string, string>[];
    error: string;
    done: boolean;
    inputRef: React.RefObject<HTMLInputElement | null>;
    onFileChange: (file: File) => void;
    onImport: () => void;
    onClear: () => void;
    columnLabels: string[];
}

function ImportCard({ title, icon, description, templateName, templateContent, rows, error, done, inputRef, onFileChange, onImport, onClear, columnLabels }: ImportCardProps) {
    const [dragging, setDragging] = useState(false);

    return (
        <div className="surface-panel rounded-[2rem] overflow-hidden">
            <div className="px-6 py-4 border-b border-border/40 bg-white/30 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    {icon}
                    <h2 className="text-sm font-black uppercase tracking-widest">{title}</h2>
                </div>
                <button
                    onClick={() => downloadCSV(templateContent, templateName)}
                    className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl bg-white border border-border/60 text-foreground hover:bg-primary/5 hover:border-primary/30 transition-all"
                >
                    <Download className="w-3.5 h-3.5 text-primary" />
                    Descargar Plantilla
                </button>
            </div>

            <div className="p-6 space-y-5">
                <p className="text-xs text-muted-foreground font-bold">{description}</p>

                {/* Column hints */}
                <div className="flex flex-wrap gap-1.5">
                    {columnLabels.map(col => (
                        <span key={col} className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-full bg-muted border border-border/60 text-muted-foreground">
                            {col}
                        </span>
                    ))}
                </div>

                {/* Drop zone */}
                {!rows.length && !done && (
                    <div
                        onDragOver={e => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onFileChange(f); }}
                        onClick={() => inputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                            dragging ? 'border-primary bg-primary/10' : 'border-border/50 bg-white/40 hover:border-primary/40 hover:bg-primary/5'
                        }`}
                    >
                        <Upload className={`w-8 h-8 ${dragging ? 'text-primary' : 'text-muted-foreground/40'}`} />
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">
                            Arrastra tu CSV aquí<br /><span className="text-primary">o haz clic para seleccionar</span>
                        </p>
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) onFileChange(f); }}
                        />
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                        <p className="text-xs font-bold text-rose-600">{error}</p>
                    </div>
                )}

                {/* Preview table */}
                {rows.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-black text-foreground">
                                <span className="text-primary">{rows.length}</span> registros listos para importar
                            </p>
                            <button onClick={onClear} className="p-1 text-muted-foreground hover:text-rose-500 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-border/40">
                            <table className="w-full text-[10px] border-collapse">
                                <thead>
                                    <tr className="bg-muted/60">
                                        {Object.keys(rows[0]).map(k => (
                                            <th key={k} className="px-3 py-2 text-left font-black uppercase tracking-widest text-muted-foreground border-b border-border/40 whitespace-nowrap">
                                                {k}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.slice(0, 5).map((row, i) => (
                                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                                            {Object.values(row).map((v, j) => (
                                                <td key={j} className="px-3 py-2 text-foreground/80 border-b border-border/20 truncate max-w-[150px]">
                                                    {v || '—'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    {rows.length > 5 && (
                                        <tr>
                                            <td colSpan={Object.keys(rows[0]).length} className="px-3 py-2 text-center text-muted-foreground font-bold">
                                                ... y {rows.length - 5} filas más
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <button
                            onClick={onImport}
                            className="w-full py-3 bg-primary text-black font-black text-[10px] uppercase tracking-widest rounded-2xl hover:brightness-105 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                        >
                            <Upload className="w-4 h-4" />
                            Importar {rows.length} registros
                        </button>
                    </div>
                )}

                {/* Done */}
                {done && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                        <p className="text-xs font-bold text-emerald-600">¡Importación completada exitosamente!</p>
                        <button onClick={onClear} className="ml-auto text-xs font-black text-emerald-600 hover:text-emerald-800 underline">
                            Importar más
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
