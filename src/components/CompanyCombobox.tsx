"use client";

/**
 * CompanyCombobox — selector de Empresa con búsqueda y "create-on-the-fly".
 *
 * Reemplaza al input libre de "Empresa" en los formularios de creación de
 * lead/cliente. Diferencias clave:
 *
 *  1. Muestra todas las empresas existentes en un dropdown filtrable, así el
 *     vendedor reusa "Constructora Marval" en vez de tipear cada vez.
 *  2. Si lo que escribió no existe todavía, ofrece "Crear empresa 'X'" y la
 *     persiste vía POST /api/companies (usando addCompany del AppContext).
 *  3. Permite "Sin empresa" (companyId = '') para leads que llegan por web sin
 *     declarar empleador — el form sigue siendo válido.
 *
 * El consumidor recibe ambos valores en cada cambio: id (FK) y name (snapshot
 * para `client.company` text). Mantenemos los dos para que los listados que
 * leen `client.company` no se rompan, y el FK queda como fuente de verdad.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useApp, type Company } from '@/context/AppContext';

interface CompanyComboboxProps {
    /** companyId seleccionado actualmente (FK). '' o undefined = sin empresa. */
    value?: string;
    /** Nombre actual (denormalizado). Se usa como fallback cuando aún no hay companyId. */
    valueName?: string;
    /** Llamado cuando el usuario selecciona/crea/limpia empresa. */
    onChange: (selection: { companyId: string; companyName: string }) => void;
    label?: string;
    placeholder?: string;
    /** Permite dejar el campo vacío. Default true. */
    allowEmpty?: boolean;
    /** Permite crear empresa nueva escribiendo. Default true. */
    allowCreate?: boolean;
    className?: string;
}

export default function CompanyCombobox({
    value,
    valueName,
    onChange,
    label = 'Empresa / Entidad',
    placeholder = 'Buscar o crear empresa…',
    allowEmpty = true,
    allowCreate = true,
    className,
}: CompanyComboboxProps) {
    const { companies, addCompany } = useApp();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [creating, setCreating] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Resolver el nombre que se muestra: prioriza el match por id, si no usa el
    // nombre denormalizado que vino. Esto evita que el combobox aparezca vacío
    // si el id quedó stale.
    const selected = useMemo<Company | null>(() => {
        if (!value) return null;
        return companies.find(c => c.id === value) || null;
    }, [companies, value]);
    const displayLabel = selected?.name || valueName || '';

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const sorted = [...companies].sort((a, b) => a.name.localeCompare(b.name, 'es'));
        if (!q) return sorted.slice(0, 50);
        return sorted.filter(c => c.name.toLowerCase().includes(q)).slice(0, 50);
    }, [companies, search]);

    const exactExists = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return companies.some(c => c.name.trim().toLowerCase() === q);
    }, [companies, search]);

    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [open]);

    const choose = (c: Company) => {
        onChange({ companyId: c.id, companyName: c.name });
        setSearch('');
        setOpen(false);
    };

    const handleCreate = async () => {
        const name = search.trim();
        if (!name || creating) return;
        setCreating(true);
        try {
            const created = await addCompany(name);
            if (created) choose(created);
        } finally {
            setCreating(false);
        }
    };

    const clear = () => {
        onChange({ companyId: '', companyName: '' });
        setSearch('');
        setOpen(false);
    };

    return (
        <div className={clsx('relative w-full', className)} ref={containerRef}>
            {label && (
                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">{label}</label>
            )}

            <div
                onClick={() => setOpen(o => !o)}
                className={clsx(
                    'relative w-full bg-muted border border-border rounded-xl py-2.5 pl-10 pr-10 text-sm font-medium cursor-pointer flex items-center hover:border-primary/50 transition-all',
                    open && 'border-primary ring-1 ring-primary/30 bg-white',
                    displayLabel ? 'text-foreground' : 'text-muted-foreground'
                )}
            >
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <span className="truncate">{displayLabel || placeholder}</span>
                <ChevronDown className={clsx('absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
            </div>

            {open && (
                <div className="absolute left-0 right-0 mt-1.5 bg-white border border-border rounded-2xl shadow-xl overflow-hidden z-50 max-h-[340px] flex flex-col">
                    <div className="p-2.5 border-b border-border">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                                autoFocus
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && allowCreate && search.trim() && !exactExists) {
                                        e.preventDefault();
                                        void handleCreate();
                                    }
                                }}
                                placeholder="Escribe el nombre de la empresa…"
                                className="w-full bg-muted border border-border rounded-xl pl-9 pr-9 py-2 text-xs text-foreground outline-none focus:border-primary focus:bg-white transition-all"
                            />
                            {search && (
                                <X
                                    className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground cursor-pointer hover:text-foreground"
                                    onClick={() => setSearch('')}
                                />
                            )}
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1">
                        {/* Crear nueva — aparece arriba cuando hay texto que no coincide */}
                        {allowCreate && search.trim() && !exactExists && (
                            <button
                                type="button"
                                disabled={creating}
                                onClick={handleCreate}
                                className="w-full flex items-center justify-between px-4 py-3 text-left border-b border-border bg-primary/5 text-primary hover:bg-primary/10 transition-all disabled:opacity-60"
                            >
                                <div>
                                    <p className="text-xs font-bold">{creating ? 'Creando…' : `Crear "${search.trim()}"`}</p>
                                    <p className="text-[9px] uppercase tracking-widest opacity-70 font-black">Empresa nueva</p>
                                </div>
                                <Plus className="w-4 h-4" />
                            </button>
                        )}

                        {/* Sin empresa */}
                        {allowEmpty && !search.trim() && (
                            <button
                                type="button"
                                onClick={clear}
                                className={clsx(
                                    'w-full flex items-center justify-between px-4 py-2.5 text-left border-b border-border hover:bg-muted transition-all',
                                    !value && 'bg-primary/10 text-primary'
                                )}
                            >
                                <div>
                                    <p className="text-xs font-semibold">Sin empresa</p>
                                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Lead independiente</p>
                                </div>
                                {!value && <Check className="w-4 h-4" />}
                            </button>
                        )}

                        {filtered.length > 0 ? (
                            filtered.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => choose(c)}
                                    className={clsx(
                                        'w-full flex items-center justify-between px-4 py-2.5 text-left transition-all hover:bg-muted',
                                        value === c.id ? 'bg-primary/10 text-primary' : 'text-foreground'
                                    )}
                                >
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold truncate">{c.name}</p>
                                        {typeof c.clientCount === 'number' && c.clientCount > 0 && (
                                            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">
                                                {c.clientCount} {c.clientCount === 1 ? 'contacto' : 'contactos'}
                                            </p>
                                        )}
                                    </div>
                                    {value === c.id && <Check className="w-4 h-4 text-primary" />}
                                </button>
                            ))
                        ) : (
                            <div className="px-4 py-8 text-center">
                                <p className="text-xs text-muted-foreground font-bold">
                                    {search.trim() ? 'Sin coincidencias' : 'Aún no hay empresas registradas'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
