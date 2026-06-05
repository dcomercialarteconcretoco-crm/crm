"use client";

/**
 * Bandeja de Leads Crudos.
 *
 * Universo "pre-directorio": el SuperAdmin sube datos masivos (CSV o manual)
 * que el equipo todavía no ha calificado. Desde acá se asignan a un vendedor,
 * el vendedor los contacta, y si son buenos prospectos se aprueban — al
 * aprobar el lead pasa a /clients (directorio principal) como status='Lead'.
 *
 * Estados:
 *   new        → recién subido, sin asignar
 *   assigned   → ya tiene vendedor responsable
 *   contacted  → vendedor ya contactó
 *   approved   → promovido al directorio (la fila acá queda como auditoría)
 *   discarded  → vendedor/admin lo descartó (queda como auditoría)
 *
 * Soporta bases masivas (ej. +70k empresas CO). Filtros y paginación viven en
 * el server (/api/raw-leads) — el cliente no carga todo en memoria. El upload
 * de CSV grandes se parte en chunks de 1000 filas con barra de progreso.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Inbox,
    Upload,
    Download,
    Plus,
    Trash2,
    UserCheck,
    CheckCircle2,
    XCircle,
    Phone,
    Mail,
    MapPin,
    FileText,
    Search,
    AlertCircle,
    Building2,
    Briefcase,
    ChevronLeft,
    ChevronRight,
    X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { clsx } from 'clsx';

interface RawLead {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    city: string | null;
    country: string | null;
    department: string | null;
    address: string | null;
    legalId: string | null;
    idType: string | null;
    legalRep: string | null;
    activities: string[] | null;
    companySize: string | null;
    registrationDate: string | null;
    reference: string | null;
    status: 'new' | 'assigned' | 'contacted' | 'approved' | 'discarded';
    assignedTo: string | null;
    assignedToName: string | null;
    assignedAt: string | null;
    contactedAt: string | null;
    promotedClientId: string | null;
    uploadedBy: string | null;
    uploadedByName: string | null;
    createdAt: string;
    updatedAt: string;
}

interface FacetOption { value: string; count: number }
interface Facets { departments: FacetOption[]; cities: FacetOption[]; sizes: FacetOption[]; activities: FacetOption[] }

const PAGE_SIZE = 50;
const UPLOAD_CHUNK = 1000;

// Plantilla CSV que muestra los headers que aceptamos. Soportamos en paralelo
// los nombres "simples" (nombre, correo, telefono) y los de la base masiva de
// empresas (razon_social, correo_comercial, etc.) — el parser detecta ambos.
const RAW_TEMPLATE = [
    'nombre,correo,telefono,ciudad,departamento,direccion,nit,tipo_id,representante,sector1,sector2,sector3,sector4,tamano,fecha_matricula,referencia',
    'Juan García,juan@empresa.co,3001234567,Bogotá,Cundinamarca,Cl 100 #10-10,901234567,NIT,Juan García,Construcción,,,,MICRO,01/15/2023,Feria 2026',
    'María López,maria@obras.co,3109876543,Medellín,Antioquia,Cr 50 #20-30,52123456,NIT,María López,Consultoría,,,,PEQUEÑA,03/10/2022,LinkedIn',
].join('\n');

const SIZE_LABELS: Record<string, string> = {
    MICRO: 'Micro',
    PEQUEÑA: 'Pequeña',
    PEQUENA: 'Pequeña',
    MEDIANA: 'Mediana',
    GRANDE: 'Grande',
};

// ─── CSV parser RFC4180 (maneja comillas dobles + comas embebidas) ──────
// Devuelve filas crudas. La detección de headers (o falta de ellos) y el
// mapeo a campos del lead vive en `csvToLeads` para que el parser sea
// agnóstico al formato del archivo.
function parseCSV(text: string): string[][] {
    const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
    // Auto-detect separador en la primera línea: si hay más ';' que ',', es
    // CSV regional latino (la base de Cámara de Comercio Bmanga, p.ej.).
    const firstNewline = clean.search(/[\r\n]/);
    const firstLine = firstNewline >= 0 ? clean.slice(0, firstNewline) : clean;
    const semis = (firstLine.match(/;/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    const sep = semis > commas ? ';' : ',';

    const rows: string[][] = [];
    let row: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < clean.length; i++) {
        const c = clean[i];
        if (inQuotes) {
            if (c === '"') {
                if (clean[i + 1] === '"') { cur += '"'; i++; }
                else inQuotes = false;
            } else cur += c;
        } else {
            if (c === '"') inQuotes = true;
            else if (c === sep) { row.push(cur); cur = ''; }
            else if (c === '\n' || c === '\r') {
                if (cur.length > 0 || row.length > 0) { row.push(cur); rows.push(row); row = []; cur = ''; }
                if (c === '\r' && clean[i + 1] === '\n') i++;
            } else cur += c;
        }
    }
    if (cur.length > 0 || row.length > 0) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim().length > 0));
}

type CsvFormat = 'standard' | 'bmanga-headerless';

// Si la primera celda es puramente numérica (matrícula o ID), asumimos que es
// data y no header. Cubre el dump del Registro de Cámara de Comercio de
// Bucaramanga 2023, que viene sin encabezado y con columnas en posición fija.
function detectFormat(rows: string[][]): CsvFormat {
    if (rows.length === 0) return 'standard';
    const first = (rows[0][0] || '').trim();
    return /^\d+$/.test(first) ? 'bmanga-headerless' : 'standard';
}

// Fechas estilo MM/DD/YY del dump (ej. "4/3/86"). Cutoff 50: 0-49 → 20xx,
// 50-99 → 19xx — mismo cutoff que usa Postgres y Excel por defecto.
function parseDateMDY(s: string): string | undefined {
    if (!s) return undefined;
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!m) return undefined;
    const [, mm, dd, yyStr] = m;
    let year = parseInt(yyStr, 10);
    if (year < 100) year = year < 50 ? 2000 + year : 1900 + year;
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

// Mapeo posicional del dump de Bucaramanga 2023. Las posiciones que no nos
// interesan (financieros, código CIIU, fecha de renovación) las ignoramos
// para no inflar el payload.
function rowToBmangaLead(row: string[]): Record<string, any> | null {
    const t = (i: number) => (row[i] || '').trim();
    const name = t(2);
    if (!name) return null;
    const phone = t(6) || t(7) || t(8) || null;
    const apodo = t(1);
    const activity = t(18);
    return {
        name,
        legalId: t(3) || null,
        legalRep: t(4) || null,
        address: t(5) || null,
        phone,
        email: t(9) || null,
        city: t(11) || null,
        // Sin departamento: la base cubre empresas de varios deptos, no solo
        // Santander. El usuario puede filtrar por ciudad o asignar el depto
        // a mano si después se necesita.
        country: 'Colombia',
        registrationDate: parseDateMDY(t(12)) || null,
        activities: activity ? [activity] : [],
        reference: apodo
            ? `Cámara de Comercio Bucaramanga 2023 · ${apodo}`
            : 'Cámara de Comercio Bucaramanga 2023',
    };
}

function csvToLeads(rows: string[][]): { format: CsvFormat; leads: Record<string, any>[] } {
    const format = detectFormat(rows);
    if (format === 'bmanga-headerless') {
        const leads = rows.map(rowToBmangaLead).filter((r): r is Record<string, any> => !!r);
        return { format, leads };
    }
    if (rows.length < 2) return { format, leads: [] };
    const headers = rows[0].map(normalizeHeader);
    const leads = rows.slice(1).map(r => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = (r[i] || '').trim(); });
        return mapRow(obj);
    }).filter(r => r.name);
    return { format, leads };
}

function normalizeHeader(h: string): string {
    return h
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .toLowerCase().trim()
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_');
}

// Cada alias mapea al campo canónico del POST. Permite cargar el CSV de
// "+70k empresas CO" tal cual y también el formato simple original.
const HEADER_ALIASES: Record<string, string> = {
    // nombre
    nombre: 'name', name: 'name', razon_social: 'name', razon: 'name', empresa: 'name',
    // email
    correo: 'email', email: 'email', correo_comercial: 'email', mail: 'email',
    // phone
    telefono: 'phone', phone: 'phone', tel: 'phone', celular: 'phone', movil: 'phone',
    // city
    ciudad: 'city', city: 'city', municipio: 'city',
    // department
    departamento: 'department', department: 'department', depto: 'department',
    // address
    direccion: 'address', direccion_comercial: 'address', address: 'address',
    // country
    pais: 'country', country: 'country',
    // legal id
    nit: 'legalId', documento: 'legalId', cedula: 'legalId', legal_id: 'legalId',
    legalid: 'legalId', numero_identificacion: 'legalId', identificacion: 'legalId',
    // id type
    tipo_id: 'idType', tipo_identificacion: 'idType', id_type: 'idType',
    // legal rep
    representante: 'legalRep', rep_legal: 'legalRep', legal_rep: 'legalRep',
    representante_legal: 'legalRep',
    // size
    tamano: 'companySize', tamano_empresa: 'companySize', desc_tamano_empresa: 'companySize',
    size: 'companySize', company_size: 'companySize',
    // registration date
    fecha_matricula: 'registrationDate', fecha_registro: 'registrationDate',
    registration_date: 'registrationDate',
    // reference
    referencia: 'reference', reference: 'reference', origen: 'reference',
    // activities
    actividad_economica_1: 'activity1', actividad_economica1: 'activity1',
    actividad_economica: 'activity1', sector1: 'activity1', sector: 'activity1',
    actividad_economica_2: 'activity2', actividad_economica2: 'activity2', sector2: 'activity2',
    actividad_economica_3: 'activity3', actividad_economica3: 'activity3', sector3: 'activity3',
    actividad_economica_4: 'activity4', actividad_economica4: 'activity4', sector4: 'activity4',
};

function mapRow(row: Record<string, string>): Record<string, any> {
    const out: Record<string, any> = {};
    const activities: string[] = [];
    for (const [k, v] of Object.entries(row)) {
        const canonical = HEADER_ALIASES[k];
        if (!canonical) continue;
        if (canonical.startsWith('activity')) {
            if (v && v.trim()) activities.push(v.trim());
        } else if (v && v.trim()) {
            out[canonical] = v.trim();
        }
    }
    if (activities.length) out.activities = activities;
    return out;
}

function downloadCSV(content: string, filename: string) {
    const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function useDebounce<T>(value: T, ms: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return debounced;
}

// Combobox típico: input para tipear + lista desplegable. Lo usamos para
// sectores (300+ opciones) donde el <select> nativo es imposible de navegar.
// Cuando hay un valor seleccionado, lo mostramos como placeholder del input
// para que el usuario sepa cuál tiene activo sin perder el campo de búsqueda.
function SearchableSelect({
    placeholder, anyLabel, value, onChange, options, minWidth = 220,
}: {
    placeholder: string;
    anyLabel: string;
    value: string;
    onChange: (v: string) => void;
    options: FacetOption[];
    minWidth?: number;
}) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options.slice(0, 80);
        return options.filter(o => o.value.toLowerCase().includes(q)).slice(0, 80);
    }, [options, query]);
    return (
        <div className="relative" style={{ minWidth }}>
            <input
                type="text"
                placeholder={value ? `▼ ${value.length > 30 ? value.slice(0, 30) + '…' : value}` : placeholder}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 180)}
                className={clsx(
                    "w-full bg-muted border border-border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-primary focus:bg-white",
                    value && "border-primary/40 bg-primary/5"
                )}
            />
            {value && (
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { onChange(''); setQuery(''); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-rose-100 rounded transition-colors"
                    title="Limpiar"
                >
                    <X className="w-3 h-3 text-muted-foreground" />
                </button>
            )}
            {open && (
                <ul className="absolute top-full left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white border border-border rounded-xl shadow-xl z-30">
                    <li>
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { onChange(''); setQuery(''); setOpen(false); }}
                            className={clsx(
                                'block w-full text-left px-3 py-2 text-xs hover:bg-primary/5 transition-colors border-b border-border/50',
                                !value && 'bg-primary/10 font-black'
                            )}
                        >
                            {anyLabel}
                        </button>
                    </li>
                    {filtered.map(o => (
                        <li key={o.value}>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => { onChange(o.value); setQuery(''); setOpen(false); }}
                                className={clsx(
                                    'flex w-full items-start justify-between gap-2 text-left px-3 py-2 text-xs hover:bg-primary/5 transition-colors',
                                    value === o.value && 'bg-primary/10 font-bold'
                                )}
                                title={o.value}
                            >
                                <span className="line-clamp-2 flex-1">{o.value}</span>
                                <span className="text-muted-foreground shrink-0 tabular-nums">{o.count.toLocaleString()}</span>
                            </button>
                        </li>
                    ))}
                    {filtered.length === 0 && (
                        <li className="px-3 py-3 text-xs text-muted-foreground text-center">Sin coincidencias</li>
                    )}
                </ul>
            )}
        </div>
    );
}

export default function RawLeadsPage() {
    const { currentUser, sellers, addNotification } = useApp();
    const isAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';

    const [leads, setLeads] = useState<RawLead[]>([]);
    const [total, setTotal] = useState(0);
    const [counts, setCounts] = useState<Record<string, number>>({ all: 0, new: 0, assigned: 0, contacted: 0, approved: 0, discarded: 0 });
    const [facets, setFacets] = useState<Facets>({ departments: [], cities: [], sizes: [], activities: [] });
    const [loading, setLoading] = useState(true);

    // Filtros
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [department, setDepartment] = useState('');
    const [city, setCity] = useState('');
    const [size, setSize] = useState('');
    const [activity, setActivity] = useState('');
    const [assignedFilter, setAssignedFilter] = useState('');
    const [searchRaw, setSearchRaw] = useState('');
    const search = useDebounce(searchRaw, 300);
    const [page, setPage] = useState(1);

    const [selected, setSelected] = useState<Set<string>>(new Set());

    const [showManualForm, setShowManualForm] = useState(false);
    const [manualForm, setManualForm] = useState({
        name: '', email: '', phone: '', city: '', country: 'Colombia', legalId: '', reference: '',
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignSellerId, setAssignSellerId] = useState('');

    // Upload progress (cuando se sube CSV masivo)
    const [upload, setUpload] = useState<{ total: number; done: number; errors: number; running: boolean } | null>(null);

    const refresh = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        try {
            const qs = new URLSearchParams();
            if (statusFilter !== 'all') qs.set('status', statusFilter);
            if (department) qs.set('department', department);
            if (city) qs.set('city', city);
            if (size) qs.set('size', size);
            if (activity) qs.set('activity', activity);
            if (assignedFilter) qs.set('assigned', assignedFilter);
            if (search.trim()) qs.set('q', search.trim());
            qs.set('page', String(page));
            qs.set('pageSize', String(PAGE_SIZE));
            const res = await fetch(`/api/raw-leads?${qs.toString()}`, { signal });
            const data = await res.json();
            setLeads(Array.isArray(data.leads) ? data.leads : []);
            setTotal(data.total || 0);
            setCounts(data.counts || {});
        } catch (e: any) {
            if (e?.name !== 'AbortError') throw e;
        } finally {
            setLoading(false);
        }
    }, [statusFilter, department, city, size, activity, assignedFilter, search, page]);

    const refreshFacets = useCallback(async (signal?: AbortSignal) => {
        const qs = department ? `?department=${encodeURIComponent(department)}` : '';
        try {
            const res = await fetch(`/api/raw-leads/facets${qs}`, { signal });
            if (res.ok) setFacets(await res.json());
        } catch (e: any) {
            if (e?.name !== 'AbortError') throw e;
        }
    }, [department]);

    // AbortController cancela la request anterior si el usuario cambia un
    // filtro mientras la primera todavía está en vuelo (sobre 153k filas
    // cada request puede tardar segundos — sin esto, el resultado final
    // puede ser de un filtro viejo).
    useEffect(() => {
        const ctrl = new AbortController();
        refresh(ctrl.signal);
        return () => ctrl.abort();
    }, [refresh]);
    useEffect(() => {
        const ctrl = new AbortController();
        refreshFacets(ctrl.signal);
        return () => ctrl.abort();
    }, [refreshFacets]);

    // Reset paginación cuando cambia cualquier filtro.
    useEffect(() => { setPage(1); }, [statusFilter, department, city, size, activity, assignedFilter, search]);

    const allSelected = leads.length > 0 && leads.every(l => selected.has(l.id));
    const toggleSelectAll = () => {
        if (allSelected) {
            const next = new Set(selected);
            leads.forEach(l => next.delete(l.id));
            setSelected(next);
        } else {
            const next = new Set(selected);
            leads.forEach(l => next.add(l.id));
            setSelected(next);
        }
    };
    const toggleOne = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelected(next);
    };

    const handleFileUpload = async (file: File) => {
        const text = await file.text();
        const rows = parseCSV(text);
        if (rows.length === 0) {
            addNotification({ title: 'CSV vacío o inválido', description: 'No detecté filas con contenido.', type: 'alert' });
            return;
        }
        const { format, leads: mapped } = csvToLeads(rows);
        if (mapped.length === 0) {
            addNotification({
                title: 'No detecté nombres de empresa',
                description: format === 'bmanga-headerless'
                    ? 'Esperaba el formato Cámara Comercio Bmanga 2023 (sin headers) pero las filas no traen razón social.'
                    : 'El CSV debe traer una columna nombre, razon_social, empresa o name.',
                type: 'alert',
            });
            return;
        }
        if (format === 'bmanga-headerless') {
            addNotification({
                title: 'Formato Cámara Comercio Bmanga 2023 detectado',
                description: `${mapped.length.toLocaleString()} empresas listas para cargar.`,
                type: 'success',
            });
        }
        // Partimos en chunks para no topar con el límite del lambda y poder
        // mostrar progreso al usuario en cargas grandes.
        const chunks: Record<string, any>[][] = [];
        for (let i = 0; i < mapped.length; i += UPLOAD_CHUNK) chunks.push(mapped.slice(i, i + UPLOAD_CHUNK));
        setUpload({ total: mapped.length, done: 0, errors: 0, running: true });
        let inserted = 0;
        let errors = 0;
        for (const chunk of chunks) {
            try {
                const res = await fetch('/api/raw-leads', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ leads: chunk }),
                });
                const data = await res.json();
                if (res.ok) inserted += (data.inserted || chunk.length);
                else errors += chunk.length;
            } catch {
                errors += chunk.length;
            }
            setUpload(u => u && { ...u, done: u.done + chunk.length, errors });
        }
        setUpload(u => u && { ...u, running: false });
        addNotification({
            title: errors ? 'Carga con errores' : 'Carga completada',
            description: `${inserted.toLocaleString()} insertados${errors ? ` · ${errors.toLocaleString()} fallaron` : ''}.`,
            type: errors ? 'alert' : 'success',
        });
        await Promise.all([refresh(), refreshFacets()]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        // Limpiamos el banner del upload a los 5s.
        setTimeout(() => setUpload(null), 5000);
    };

    const handleManualCreate = async () => {
        if (!manualForm.name.trim()) {
            addNotification({ title: 'Nombre requerido', description: 'Escribí al menos el nombre.', type: 'alert' });
            return;
        }
        const res = await fetch('/api/raw-leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead: manualForm }),
        });
        if (res.ok) {
            addNotification({ title: 'Lead creado', description: `${manualForm.name} agregado a la bandeja.`, type: 'success' });
            setManualForm({ name: '', email: '', phone: '', city: '', country: 'Colombia', legalId: '', reference: '' });
            setShowManualForm(false);
            await refresh();
        } else {
            const data = await res.json();
            addNotification({ title: 'Error', description: data.error || 'No se pudo crear el lead.', type: 'alert' });
        }
    };

    const handleAssign = async () => {
        if (!assignSellerId || selected.size === 0) return;
        const seller = sellers.find(s => s.id === assignSellerId);
        const res = await fetch('/api/raw-leads', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ids: Array.from(selected),
                action: 'assign',
                sellerId: assignSellerId,
                sellerName: seller?.name || '',
            }),
        });
        if (res.ok) {
            addNotification({ title: 'Asignados', description: `${selected.size} leads asignados a ${seller?.name}.`, type: 'success' });
            setSelected(new Set());
            setShowAssignModal(false);
            setAssignSellerId('');
            await refresh();
        }
    };

    const handleApprove = async () => {
        if (selected.size === 0) return;
        if (!confirm(`¿Promover ${selected.size} lead(s) al directorio principal?\n\nQuedarán como Leads en /clientes asignados a su vendedor.`)) return;
        const res = await fetch('/api/raw-leads/promote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selected) }),
        });
        const data = await res.json();
        if (res.ok) {
            addNotification({ title: 'Promovidos', description: `${data.promoted} leads pasaron al directorio.`, type: 'success' });
            setSelected(new Set());
            await refresh();
        } else {
            addNotification({ title: 'Error al promover', description: data.error || 'No se pudo aprobar.', type: 'alert' });
        }
    };

    const handleDiscard = async () => {
        if (selected.size === 0) return;
        if (!confirm(`¿Descartar ${selected.size} lead(s)? Quedan en histórico (no se borran).`)) return;
        const res = await fetch('/api/raw-leads', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selected), action: 'discard' }),
        });
        if (res.ok) {
            addNotification({ title: 'Descartados', description: `${selected.size} leads marcados como descartados.`, type: 'success' });
            setSelected(new Set());
            await refresh();
        }
    };

    const handleMarkContacted = async () => {
        if (selected.size === 0) return;
        const res = await fetch('/api/raw-leads', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selected), action: 'mark-contacted' }),
        });
        if (res.ok) {
            addNotification({ title: 'Contactados', description: `${selected.size} marcados como contactados.`, type: 'success' });
            setSelected(new Set());
            await refresh();
        }
    };

    const handleDelete = async () => {
        if (selected.size === 0) return;
        if (!confirm(`¿Eliminar permanentemente ${selected.size} lead(s)? Esto no se puede deshacer.`)) return;
        const ids = Array.from(selected).join(',');
        const res = await fetch(`/api/raw-leads?ids=${encodeURIComponent(ids)}`, { method: 'DELETE' });
        if (res.ok) {
            addNotification({ title: 'Eliminados', description: `${selected.size} leads borrados.`, type: 'success' });
            setSelected(new Set());
            await Promise.all([refresh(), refreshFacets()]);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const hasAnyFilter = !!(department || city || size || activity || assignedFilter || search.trim());
    const clearFilters = () => {
        setDepartment(''); setCity(''); setSize(''); setActivity('');
        setAssignedFilter(''); setSearchRaw('');
    };

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-foreground flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                            <Inbox className="w-5 h-5 text-primary" />
                        </span>
                        Bandeja de Leads Crudos
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Pre-directorio. Sube datos masivos, asigná a vendedor, y al aprobar pasan al directorio principal.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {isAdmin && (
                        <>
                            <button
                                onClick={() => downloadCSV(RAW_TEMPLATE, 'plantilla-leads-crudos.csv')}
                                className="bg-white border border-border rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-2 hover:border-primary/40 hover:bg-primary/5 transition-all"
                            >
                                <Download className="w-3.5 h-3.5" /> Plantilla CSV
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={upload?.running}
                                className="bg-white border border-border rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-2 hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-50"
                            >
                                <Upload className="w-3.5 h-3.5" /> Subir CSV
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setShowManualForm(true)}
                        className="bg-primary text-black font-bold rounded-xl px-3 py-2 text-xs flex items-center gap-2 hover:brightness-105 shadow transition-all"
                    >
                        <Plus className="w-3.5 h-3.5" /> Lead Manual
                    </button>
                </div>
            </div>

            {/* Upload progress */}
            {upload && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-black text-blue-900">
                            {upload.running ? 'Subiendo CSV…' : 'Carga finalizada'}
                        </p>
                        <p className="text-xs font-bold text-blue-700">
                            {upload.done.toLocaleString()} / {upload.total.toLocaleString()} filas
                            {upload.errors > 0 && <span className="text-rose-700"> · {upload.errors} con error</span>}
                        </p>
                    </div>
                    <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${Math.min(100, (upload.done / upload.total) * 100)}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Status tabs */}
            <div className="flex flex-wrap gap-2">
                {[
                    { id: 'all', label: 'Todos', count: counts.all || 0 },
                    { id: 'new', label: 'Sin asignar', count: counts.new || 0 },
                    { id: 'assigned', label: 'Asignados', count: counts.assigned || 0 },
                    { id: 'contacted', label: 'Contactados', count: counts.contacted || 0 },
                    { id: 'approved', label: 'Aprobados', count: counts.approved || 0 },
                    { id: 'discarded', label: 'Descartados', count: counts.discarded || 0 },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setStatusFilter(tab.id); setSelected(new Set()); }}
                        className={clsx(
                            'px-3 py-1.5 rounded-xl text-xs font-bold transition-all border',
                            statusFilter === tab.id
                                ? 'bg-primary text-black border-primary'
                                : 'bg-white text-muted-foreground border-border hover:border-primary/40'
                        )}
                    >
                        {tab.label} <span className="opacity-60 ml-1">({tab.count.toLocaleString()})</span>
                    </button>
                ))}
            </div>

            {/* Filtros: dropdowns + search */}
            <div className="bg-white border border-border rounded-2xl p-3 flex flex-wrap gap-2 items-center">
                <select
                    value={department}
                    onChange={(e) => { setDepartment(e.target.value); setCity(''); }}
                    className="bg-muted border border-border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-primary min-w-[150px]"
                >
                    <option value="">Todos los departamentos</option>
                    {facets.departments.map(d => (
                        <option key={d.value} value={d.value}>{d.value} ({d.count.toLocaleString()})</option>
                    ))}
                </select>
                <SearchableSelect
                    placeholder="Todas las ciudades"
                    anyLabel="Todas las ciudades"
                    value={city}
                    onChange={setCity}
                    options={facets.cities}
                    minWidth={180}
                />
                <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="bg-muted border border-border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-primary min-w-[120px]"
                >
                    <option value="">Cualquier tamaño</option>
                    {facets.sizes.map(s => (
                        <option key={s.value} value={s.value}>
                            {SIZE_LABELS[s.value] || s.value} ({s.count.toLocaleString()})
                        </option>
                    ))}
                </select>
                <SearchableSelect
                    placeholder="Cualquier sector (escribir para buscar)"
                    anyLabel="Cualquier sector"
                    value={activity}
                    onChange={setActivity}
                    options={facets.activities}
                    minWidth={260}
                />
                {isAdmin && (
                    <select
                        value={assignedFilter}
                        onChange={(e) => setAssignedFilter(e.target.value)}
                        className="bg-muted border border-border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-primary min-w-[150px]"
                    >
                        <option value="">Cualquier asignación</option>
                        <option value="unassigned">Sin asignar</option>
                        {sellers.filter(s => s.status === 'Activo').map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                )}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar nombre, email, teléfono, NIT, representante…"
                        value={searchRaw}
                        onChange={(e) => setSearchRaw(e.target.value)}
                        className="w-full bg-muted border border-border rounded-xl pl-10 pr-3 py-2 text-xs outline-none focus:border-primary focus:bg-white"
                    />
                </div>
                <button
                    onClick={clearFilters}
                    disabled={!hasAnyFilter}
                    className="bg-white border border-border rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground hover:border-rose-300 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all"
                    title={hasAnyFilter ? 'Limpiar todos los filtros activos' : 'No hay filtros activos'}
                >
                    <X className="w-3 h-3" /> Limpiar filtros
                </button>
            </div>

            {/* Bulk actions */}
            {selected.size > 0 && (
                <div className="flex flex-wrap gap-2 items-center bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <span className="text-xs font-black text-amber-800">{selected.size} seleccionados</span>
                    {isAdmin && (
                        <button onClick={() => setShowAssignModal(true)} className="bg-white border border-border rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 hover:border-primary/40 hover:bg-primary/5 transition-all">
                            <UserCheck className="w-3 h-3" /> Asignar
                        </button>
                    )}
                    <button onClick={handleMarkContacted} className="bg-white border border-border rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-all">
                        <Phone className="w-3 h-3" /> Marcar contactado
                    </button>
                    <button onClick={handleApprove} className="bg-emerald-500 text-white border border-emerald-600 rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-600 transition-all">
                        <CheckCircle2 className="w-3 h-3" /> Aprobar → Directorio
                    </button>
                    <button onClick={handleDiscard} className="bg-white border border-border rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 transition-all">
                        <XCircle className="w-3 h-3" /> Descartar
                    </button>
                    {isAdmin && (
                        <button onClick={handleDelete} className="bg-white border border-border rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 hover:border-rose-500 hover:bg-rose-500 hover:text-white transition-all">
                            <Trash2 className="w-3 h-3" /> Eliminar
                        </button>
                    )}
                </div>
            )}

            {/* Tabla */}
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1100px]">
                    <thead className="bg-muted/50 border-b border-border">
                        <tr>
                            <th className="w-10 px-3 py-3">
                                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded" />
                            </th>
                            <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Empresa</th>
                            <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contacto</th>
                            <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ubicación</th>
                            <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sector</th>
                            <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tamaño</th>
                            <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">NIT</th>
                            <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</th>
                            <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Asignado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td colSpan={9} className="text-center py-12 text-muted-foreground text-sm">Cargando…</td></tr>
                        )}
                        {!loading && leads.length === 0 && (
                            <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">
                                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No hay leads en este filtro.</p>
                                {isAdmin && statusFilter === 'all' && !hasAnyFilter && (
                                    <p className="text-xs mt-1">Subí un CSV o creá uno manual para empezar.</p>
                                )}
                            </td></tr>
                        )}
                        {!loading && leads.map(lead => (
                            <tr key={lead.id} className={clsx(
                                'border-b border-border/40 hover:bg-muted/30 transition-colors',
                                selected.has(lead.id) && 'bg-primary/5'
                            )}>
                                <td className="px-3 py-3">
                                    <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleOne(lead.id)} className="rounded" />
                                </td>
                                <td className="px-3 py-3 max-w-[260px]">
                                    <p className="font-bold text-foreground truncate" title={lead.name}>{lead.name}</p>
                                    {lead.legalRep && (
                                        <p className="text-[10px] text-muted-foreground truncate" title={lead.legalRep}>
                                            <Building2 className="w-2.5 h-2.5 inline mr-1" />
                                            {lead.legalRep}
                                        </p>
                                    )}
                                    {lead.promotedClientId && (
                                        <a href={`/leads/${lead.promotedClientId}`} className="text-[10px] text-primary hover:underline font-bold">
                                            Ver en directorio →
                                        </a>
                                    )}
                                </td>
                                <td className="px-3 py-3 text-xs">
                                    {lead.email && <p className="flex items-center gap-1 text-muted-foreground truncate max-w-[200px]" title={lead.email}><Mail className="w-3 h-3 shrink-0" /> {lead.email}</p>}
                                    {lead.phone && <p className="flex items-center gap-1 text-muted-foreground"><Phone className="w-3 h-3 shrink-0" /> {lead.phone}</p>}
                                </td>
                                <td className="px-3 py-3 text-xs text-muted-foreground">
                                    {(lead.city || lead.department) && (
                                        <p className="flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" /> {[lead.city, lead.department].filter(Boolean).join(' · ')}</p>
                                    )}
                                </td>
                                <td className="px-3 py-3 text-xs text-muted-foreground max-w-[200px]">
                                    {lead.activities && lead.activities.length > 0 && (
                                        <span className="flex items-start gap-1" title={lead.activities.join(' · ')}>
                                            <Briefcase className="w-3 h-3 shrink-0 mt-0.5" />
                                            <span className="line-clamp-2">{lead.activities[0]}</span>
                                        </span>
                                    )}
                                    {lead.reference && (
                                        <p className="text-[10px] mt-1 flex items-center gap-1"><FileText className="w-2.5 h-2.5" /> {lead.reference}</p>
                                    )}
                                </td>
                                <td className="px-3 py-3 text-xs">
                                    {lead.companySize && (
                                        <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                                            {SIZE_LABELS[lead.companySize] || lead.companySize}
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-3 text-xs font-mono text-muted-foreground">
                                    {lead.legalId ? (
                                        <span title={lead.idType || ''}>{lead.legalId}</span>
                                    ) : '—'}
                                </td>
                                <td className="px-3 py-3">
                                    <span className={clsx(
                                        'inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide',
                                        lead.status === 'new' && 'bg-slate-100 text-slate-700',
                                        lead.status === 'assigned' && 'bg-blue-50 text-blue-700',
                                        lead.status === 'contacted' && 'bg-amber-50 text-amber-700',
                                        lead.status === 'approved' && 'bg-emerald-50 text-emerald-700',
                                        lead.status === 'discarded' && 'bg-rose-50 text-rose-700'
                                    )}>
                                        {lead.status === 'new' ? 'Sin asignar' :
                                         lead.status === 'assigned' ? 'Asignado' :
                                         lead.status === 'contacted' ? 'Contactado' :
                                         lead.status === 'approved' ? 'Aprobado' : 'Descartado'}
                                    </span>
                                </td>
                                <td className="px-3 py-3 text-xs text-muted-foreground">{lead.assignedToName || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>

                {/* Paginación */}
                {!loading && total > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
                        <p className="text-xs text-muted-foreground">
                            Mostrando <span className="font-bold text-foreground">{((page - 1) * PAGE_SIZE + 1).toLocaleString()}</span>
                            {' '}–{' '}
                            <span className="font-bold text-foreground">{Math.min(page * PAGE_SIZE, total).toLocaleString()}</span>
                            {' '}de{' '}
                            <span className="font-bold text-foreground">{total.toLocaleString()}</span>
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-1.5 rounded-lg border border-border hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-xs font-bold px-2">
                                {page} / {totalPages.toLocaleString()}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="p-1.5 rounded-lg border border-border hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal: crear manual */}
            {showManualForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowManualForm(false)}>
                    <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-black">Nuevo lead crudo</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <input placeholder="Nombre *" value={manualForm.name} onChange={e => setManualForm({ ...manualForm, name: e.target.value })} className="col-span-2 bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white" />
                            <input placeholder="Email" value={manualForm.email} onChange={e => setManualForm({ ...manualForm, email: e.target.value })} className="bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white" />
                            <input placeholder="Teléfono" value={manualForm.phone} onChange={e => setManualForm({ ...manualForm, phone: e.target.value })} className="bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white" />
                            <input placeholder="Ciudad" value={manualForm.city} onChange={e => setManualForm({ ...manualForm, city: e.target.value })} className="bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white" />
                            <input placeholder="País" value={manualForm.country} onChange={e => setManualForm({ ...manualForm, country: e.target.value })} className="bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white" />
                            <input placeholder="NIT / Cédula" value={manualForm.legalId} onChange={e => setManualForm({ ...manualForm, legalId: e.target.value })} className="col-span-2 bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white" />
                            <input placeholder="Referencia (origen, campaña, contacto previo...)" value={manualForm.reference} onChange={e => setManualForm({ ...manualForm, reference: e.target.value })} className="col-span-2 bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white" />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => setShowManualForm(false)} className="bg-muted text-foreground font-bold rounded-xl px-4 py-2 text-sm border border-border hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 transition-all">Cancelar</button>
                            <button onClick={handleManualCreate} className="bg-primary text-black font-bold rounded-xl px-4 py-2 text-sm hover:brightness-105 transition-all">Crear lead</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: asignar */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAssignModal(false)}>
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-black">Asignar {selected.size} lead(s)</h3>
                        <select value={assignSellerId} onChange={e => setAssignSellerId(e.target.value)} className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white appearance-none">
                            <option value="">— Selecciona vendedor —</option>
                            {sellers.filter(s => s.status === 'Activo').map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                            ))}
                        </select>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => setShowAssignModal(false)} className="bg-muted text-foreground font-bold rounded-xl px-4 py-2 text-sm border border-border hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 transition-all">Cancelar</button>
                            <button onClick={handleAssign} disabled={!assignSellerId} className="bg-primary text-black font-bold rounded-xl px-4 py-2 text-sm hover:brightness-105 disabled:opacity-50 transition-all">Asignar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
