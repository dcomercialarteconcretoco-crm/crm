"use client";

/**
 * /companies — Listado de empresas (clientes corporativos).
 *
 * Una empresa agrupa varios contactos (Client). Esta página muestra todas las
 * empresas registradas, conteo de contactos, conteo de cotizaciones, y permite
 * crear empresa nueva. El click en una fila lleva a /companies/[id] donde se
 * ven los contactos asociados.
 *
 * Permisos: reusa `clients.view` (si podés ver clientes, podés ver empresas
 * que los agrupan). No hay un permiso companies.* nuevo todavía.
 */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, Plus, Search, Users, FileText, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PermissionGate } from '@/components/PermissionGate';

export default function CompaniesPage() {
    const { companies, clients, quotes, addCompany, addNotification } = useApp();
    const [search, setSearch] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Por cada empresa contamos contactos y cotizaciones agrupando localmente.
    // Es O(clients + quotes) pero el dataset cabe en memoria — si crece se
    // puede mover al GET /api/companies.
    const enriched = useMemo(() => {
        const clientsByCompany = new Map<string, number>();
        const quotesByCompany = new Map<string, { count: number; total: number }>();

        for (const c of clients) {
            if (!c.companyId) continue;
            clientsByCompany.set(c.companyId, (clientsByCompany.get(c.companyId) || 0) + 1);
        }
        for (const q of quotes) {
            if (!q.companyId) continue;
            const prev = quotesByCompany.get(q.companyId) || { count: 0, total: 0 };
            prev.count += 1;
            prev.total += q.numericTotal || 0;
            quotesByCompany.set(q.companyId, prev);
        }

        return companies.map(co => {
            const qs = quotesByCompany.get(co.id);
            return {
                ...co,
                clientCount: clientsByCompany.get(co.id) || 0,
                quoteCount: qs?.count || 0,
                quoteValue: qs?.total || 0,
            };
        });
    }, [companies, clients, quotes]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const sorted = [...enriched].sort((a, b) => a.name.localeCompare(b.name, 'es'));
        if (!q) return sorted;
        return sorted.filter(c => c.name.toLowerCase().includes(q));
    }, [enriched, search]);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

    const handleCreate = async () => {
        const name = newName.trim();
        if (!name || submitting) return;
        setSubmitting(true);
        try {
            const created = await addCompany(name);
            if (created) {
                addNotification({
                    title: 'Empresa creada',
                    description: `${created.name} ya está disponible para asignar a leads y cotizaciones.`,
                    type: 'success',
                });
                setNewName('');
                setIsCreating(false);
            } else {
                addNotification({
                    title: 'No se pudo crear',
                    description: 'Verificá la conexión y volvé a intentar.',
                    type: 'alert',
                });
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <PermissionGate require="clients.view">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <h1 className="page-title">Empresas</h1>
                        <p className="page-subtitle">Clientes corporativos · {companies.length} {companies.length === 1 ? 'empresa registrada' : 'empresas registradas'}.</p>
                    </div>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="bg-primary text-black font-bold rounded-xl px-4 py-2 hover:brightness-105 shadow-[0_2px_8px_rgba(250,181,16,0.3)] transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva empresa
                    </button>
                </div>

                {/* Search */}
                <div className="surface-card p-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Buscar empresa..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-muted border border-border rounded-xl pl-11 pr-4 py-3 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                        />
                    </div>
                </div>

                {/* List */}
                {filtered.length === 0 ? (
                    <div className="surface-card p-12 text-center">
                        <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm font-bold text-muted-foreground">
                            {search.trim() ? 'No se encontraron empresas con ese nombre' : 'Aún no hay empresas registradas'}
                        </p>
                        {!search.trim() && (
                            <p className="text-xs text-muted-foreground/70 mt-1">
                                Las empresas aparecen automáticamente cuando creás un lead con empresa, o las podés crear acá.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2 pb-4">
                        {filtered.map(co => (
                            <Link
                                key={co.id}
                                href={`/companies/${co.id}`}
                                className="block bg-white border border-border rounded-xl px-4 py-3.5 grid grid-cols-12 items-center gap-3 hover:shadow-md hover:border-primary/40 transition-all group"
                            >
                                <div className="col-span-12 md:col-span-5 flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center text-primary shrink-0">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">{co.name}</p>
                                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-0.5">Cliente corporativo</p>
                                    </div>
                                </div>
                                <div className="hidden md:flex md:col-span-3 items-center gap-2 min-w-0">
                                    <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Contactos</p>
                                        <p className="text-xs font-semibold text-foreground">{co.clientCount}</p>
                                    </div>
                                </div>
                                <div className="hidden md:flex md:col-span-3 items-center gap-2 min-w-0">
                                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Cotizaciones</p>
                                        <p className="text-xs font-semibold text-foreground">
                                            {co.quoteCount}
                                            {co.quoteValue > 0 && <span className="text-muted-foreground font-normal"> · {formatCurrency(co.quoteValue)}</span>}
                                        </p>
                                    </div>
                                </div>
                                <div className="hidden md:flex md:col-span-1 items-center justify-end text-primary text-xs font-bold">
                                    Ver →
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Modal: nueva empresa */}
                {isCreating && (
                    <div className="fixed inset-0 flex items-center justify-center p-4 z-[200]" style={{ background: 'rgba(10,12,20,0.55)', backdropFilter: 'blur(6px)' }}>
                        <div className="bg-white border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                            <div className="flex items-center justify-between p-6 border-b border-border">
                                <h2 className="text-base font-bold text-foreground">Nueva empresa</h2>
                                <button
                                    onClick={() => { setIsCreating(false); setNewName(''); }}
                                    className="bg-white border border-border text-foreground rounded-xl p-1.5 hover:bg-muted transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-6 space-y-3">
                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Nombre de la empresa</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="Ej: Constructora Bolívar"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                                        className="w-full bg-muted border border-border rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                    />
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    Si ya existe una empresa con ese nombre, te la asociamos en vez de crear duplicado.
                                </p>
                            </div>
                            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
                                <button
                                    onClick={() => { setIsCreating(false); setNewName(''); }}
                                    className="bg-white border border-border text-foreground font-medium rounded-xl px-4 py-2 hover:bg-muted transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={!newName.trim() || submitting}
                                    className="bg-primary text-black font-bold rounded-xl px-4 py-2 hover:brightness-105 shadow-[0_2px_8px_rgba(250,181,16,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    {submitting ? 'Creando...' : 'Crear'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PermissionGate>
    );
}
