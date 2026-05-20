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
 * Permisos:
 *   - SuperAdmin/Admin: ve todos, sube, asigna, aprueba, descarta.
 *   - Vendedor: ve sólo los suyos, marca contactado, aprueba o descarta.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
    legalId: string | null;
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

const RAW_TEMPLATE = [
    'nombre,correo,telefono,ciudad,pais,documento,referencia',
    'Juan García,juan@empresa.co,3001234567,Bogotá,Colombia,901234567,Feria Construcción 2026',
    'María López,maria@obras.co,3109876543,Medellín,Colombia,52123456,Lista LinkedIn Sector Salud',
].join('\n');

function parseCSV(text: string): Record<string, string>[] {
    const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
        const values = line.split(',');
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = (values[i] || '').trim(); });
        return row;
    });
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

export default function RawLeadsPage() {
    const { currentUser, sellers, addNotification } = useApp();
    const isAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';

    const [leads, setLeads] = useState<RawLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const [showManualForm, setShowManualForm] = useState(false);
    const [manualForm, setManualForm] = useState({
        name: '', email: '', phone: '', city: '', country: 'Colombia', legalId: '', reference: '',
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignSellerId, setAssignSellerId] = useState('');

    const refresh = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/raw-leads${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`);
            const data = await res.json();
            setLeads(Array.isArray(data.leads) ? data.leads : []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statusFilter]);

    const filteredLeads = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return leads;
        return leads.filter(l =>
            l.name.toLowerCase().includes(q) ||
            (l.email || '').toLowerCase().includes(q) ||
            (l.phone || '').includes(q) ||
            (l.legalId || '').includes(q) ||
            (l.reference || '').toLowerCase().includes(q)
        );
    }, [leads, search]);

    const allSelected = filteredLeads.length > 0 && filteredLeads.every(l => selected.has(l.id));
    const toggleSelectAll = () => {
        if (allSelected) setSelected(new Set());
        else setSelected(new Set(filteredLeads.map(l => l.id)));
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
            addNotification({ title: 'CSV vacío o inválido', description: 'Asegurate de incluir headers y al menos una fila de datos.', type: 'alert' });
            return;
        }
        const mapped = rows.map(r => ({
            name: r.nombre || r.name || '',
            email: r.correo || r.email || '',
            phone: r.telefono || r.phone || '',
            city: r.ciudad || r.city || '',
            country: r.pais || r.country || '',
            legalId: r.documento || r.documento_legal || r.nit || r.cedula || r.legalid || '',
            reference: r.referencia || r.reference || '',
        }));
        const res = await fetch('/api/raw-leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leads: mapped }),
        });
        const data = await res.json();
        if (res.ok) {
            addNotification({ title: 'Leads cargados', description: `${data.inserted} leads ingresaron a la bandeja.`, type: 'success' });
            await refresh();
        } else {
            addNotification({ title: 'Error al cargar CSV', description: data.error || 'Error desconocido', type: 'alert' });
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
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
            await refresh();
        }
    };

    const counts = useMemo(() => {
        const c = { all: leads.length, new: 0, assigned: 0, contacted: 0, approved: 0, discarded: 0 };
        leads.forEach(l => { c[l.status] = (c[l.status] || 0) + 1; });
        return c;
    }, [leads]);

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
                {/* Acciones del header. "Lead Manual" lo ven TODOS los vendedores
                    (pedido 20-may-2026: los chicos necesitan crear leads de
                    licitaciones en pre-directorio sin esperar a un admin).
                    Plantilla/Subir CSV se quedan admin-only porque son bulk
                    operations que tocan la cola compartida. */}
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
                                className="bg-white border border-border rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-2 hover:border-primary/40 hover:bg-primary/5 transition-all"
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

            {/* Status tabs */}
            <div className="flex flex-wrap gap-2">
                {[
                    { id: 'all', label: 'Todos', count: counts.all },
                    { id: 'new', label: 'Sin asignar', count: counts.new },
                    { id: 'assigned', label: 'Asignados', count: counts.assigned },
                    { id: 'contacted', label: 'Contactados', count: counts.contacted },
                    { id: 'approved', label: 'Aprobados', count: counts.approved },
                    { id: 'discarded', label: 'Descartados', count: counts.discarded },
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
                        {tab.label} <span className="opacity-60 ml-1">({tab.count})</span>
                    </button>
                ))}
            </div>

            {/* Search + bulk actions */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, email, teléfono, documento, referencia..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-muted border border-border rounded-xl pl-10 pr-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
                    />
                </div>
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
            </div>

            {/* Tabla */}
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                        <tr>
                            <th className="w-10 px-3 py-3">
                                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded" />
                            </th>
                            <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre</th>
                            <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contacto</th>
                            <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ubicación</th>
                            <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Documento</th>
                            <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Referencia</th>
                            <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</th>
                            <th className="text-left px-3 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Asignado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">Cargando…</td></tr>
                        )}
                        {!loading && filteredLeads.length === 0 && (
                            <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">
                                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No hay leads en este filtro.</p>
                                {isAdmin && statusFilter === 'all' && (
                                    <p className="text-xs mt-1">Subí un CSV o creá uno manual para empezar.</p>
                                )}
                            </td></tr>
                        )}
                        {!loading && filteredLeads.map(lead => (
                            <tr key={lead.id} className={clsx(
                                'border-b border-border/40 hover:bg-muted/30 transition-colors',
                                selected.has(lead.id) && 'bg-primary/5'
                            )}>
                                <td className="px-3 py-3">
                                    <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleOne(lead.id)} className="rounded" />
                                </td>
                                <td className="px-3 py-3">
                                    <p className="font-bold text-foreground">{lead.name}</p>
                                    {lead.promotedClientId && (
                                        <a href={`/leads/${lead.promotedClientId}`} className="text-[10px] text-primary hover:underline font-bold">
                                            Ver en directorio →
                                        </a>
                                    )}
                                </td>
                                <td className="px-3 py-3 text-xs">
                                    {lead.email && <p className="flex items-center gap-1 text-muted-foreground"><Mail className="w-3 h-3" /> {lead.email}</p>}
                                    {lead.phone && <p className="flex items-center gap-1 text-muted-foreground"><Phone className="w-3 h-3" /> {lead.phone}</p>}
                                </td>
                                <td className="px-3 py-3 text-xs text-muted-foreground">
                                    {(lead.city || lead.country) && (
                                        <p className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {[lead.city, lead.country].filter(Boolean).join(', ')}</p>
                                    )}
                                </td>
                                <td className="px-3 py-3 text-xs font-mono text-muted-foreground">{lead.legalId || '—'}</td>
                                <td className="px-3 py-3 text-xs text-muted-foreground max-w-[200px]">
                                    {lead.reference && <span className="flex items-center gap-1"><FileText className="w-3 h-3 shrink-0" /> <span className="truncate" title={lead.reference}>{lead.reference}</span></span>}
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
