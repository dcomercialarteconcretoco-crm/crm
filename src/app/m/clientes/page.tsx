"use client";

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Search, Phone, Mail, MapPin, X, Building2, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';

const STATUS_STYLE: Record<string, { pill: string; label: string }> = {
    Active:   { pill: 'bg-emerald-100 text-emerald-700', label: 'Activo'   },
    Lead:     { pill: 'bg-sky-100 text-sky-700',         label: 'Lead'     },
    Inactive: { pill: 'bg-muted text-muted-foreground',  label: 'Inactivo' },
};

export default function MobileClientes() {
    const { clients } = useApp();
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<typeof clients[0] | null>(null);

    const filtered = useMemo(() =>
        clients.filter(c =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.company.toLowerCase().includes(search.toLowerCase()) ||
            c.city.toLowerCase().includes(search.toLowerCase())
        ),
        [clients, search]
    );

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 pb-2 space-y-3">
                <div>
                    <h1 className="text-xl font-black text-foreground">Clientes</h1>
                    <p className="text-xs text-muted-foreground">{clients.length} clientes registrados</p>
                </div>
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, empresa o ciudad..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-white border border-border rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-primary transition-all"
                    />
                    {search && (
                        <button onClick={() => setSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2">
                            <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2.5 pt-2">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Building2 className="w-12 h-12 text-muted-foreground/30 mb-3" />
                        <p className="text-sm font-bold text-muted-foreground">Sin resultados</p>
                        <p className="text-xs text-muted-foreground mt-1">Intenta con otro término</p>
                    </div>
                ) : filtered.map(client => {
                    const s = STATUS_STYLE[client.status] ?? STATUS_STYLE.Inactive;
                    return (
                        <button
                            key={client.id}
                            onClick={() => setSelected(client)}
                            className="w-full text-left bg-white border border-border rounded-2xl p-4 active:bg-muted transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center font-black text-primary text-sm shrink-0">
                                    {client.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-bold text-foreground truncate">{client.name}</p>
                                        <span className={clsx('shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full', s.pill)}>
                                            {s.label}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">{client.company}</p>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                        <MapPin className="w-3 h-3" />{client.city}
                                    </p>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Detail Bottom Sheet */}
            {selected && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end"
                    style={{ background: 'rgba(0,0,0,0.4)' }}
                    onClick={() => setSelected(null)}>
                    <div
                        className="bg-white rounded-t-3xl p-5 space-y-4 max-h-[80vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Handle */}
                        <div className="w-10 h-1 bg-muted rounded-full mx-auto" />

                        {/* Identity */}
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center font-black text-primary text-lg shrink-0">
                                {selected.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h2 className="text-base font-black text-foreground">{selected.name}</h2>
                                <p className="text-sm text-muted-foreground">{selected.company}</p>
                                <span className={clsx(
                                    'text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block',
                                    (STATUS_STYLE[selected.status] ?? STATUS_STYLE.Inactive).pill
                                )}>
                                    {(STATUS_STYLE[selected.status] ?? STATUS_STYLE.Inactive).label}
                                </span>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-2.5">
                            {selected.email && (
                                <a href={`mailto:${selected.email}`}
                                    className="flex items-center gap-3 p-3 bg-muted rounded-xl active:bg-muted/80">
                                    <Mail className="w-4 h-4 text-primary shrink-0" />
                                    <span className="text-sm text-foreground truncate">{selected.email}</span>
                                </a>
                            )}
                            {selected.phone && (
                                <a href={`tel:${selected.phone}`}
                                    className="flex items-center gap-3 p-3 bg-muted rounded-xl active:bg-muted/80">
                                    <Phone className="w-4 h-4 text-primary shrink-0" />
                                    <span className="text-sm text-foreground">{selected.phone}</span>
                                </a>
                            )}
                            <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                                <MapPin className="w-4 h-4 text-primary shrink-0" />
                                <span className="text-sm text-foreground">{selected.city}</span>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                                <TrendingUp className="w-4 h-4 text-primary shrink-0" />
                                <span className="text-sm text-foreground">Valor: {selected.value} · Score {selected.score}/100</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-3 pt-1">
                            {selected.phone && (
                                <a href={`https://wa.me/${selected.phone.replace(/\D/g,'')}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 py-3.5 bg-emerald-500 text-white font-bold rounded-xl text-sm active:scale-95 transition-transform">
                                    WhatsApp
                                </a>
                            )}
                            {selected.email && (
                                <a href={`mailto:${selected.email}`}
                                    className="flex items-center justify-center gap-2 py-3.5 bg-primary text-black font-bold rounded-xl text-sm active:scale-95 transition-transform">
                                    Email
                                </a>
                            )}
                        </div>

                        <button
                            onClick={() => setSelected(null)}
                            className="w-full py-3.5 bg-muted text-muted-foreground font-bold rounded-xl text-sm active:bg-muted/80">
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
