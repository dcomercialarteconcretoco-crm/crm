"use client";

/**
 * SectorSelect — dropdown de sector con opción inline "+ Crear nuevo sector".
 *
 * El sector recién creado queda guardado en `settings.sectors` (compartido
 * por todo el equipo vía /api/state). Antes los sectores sólo se editaban
 * en /settings → Categorías; el vendedor en el form Registrar tenía que
 * salir, agregarlo y volver. Ahora lo crea en línea.
 *
 * Normalización:
 *   - trim de espacios
 *   - capitaliza la primera letra ("industrial" → "Industrial")
 *   - chequeo de duplicados case-insensitive sobre el set actual ("INDUSTRIAL"
 *     y " industrial " no se aceptan si ya existe "Industrial")
 */

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';

function normalizeSector(raw: string): string {
    const trimmed = raw.trim().replace(/\s+/g, ' ');
    if (!trimmed) return '';
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

interface SectorSelectProps {
    value: string;
    onChange: (value: string) => void;
    /** className aplicado al `<select>` para que herede el estilo del form host. */
    selectClassName?: string;
}

export default function SectorSelect({ value, onChange, selectClassName }: SectorSelectProps) {
    const { settings, updateSettings, addNotification } = useApp();
    const [creating, setCreating] = useState(false);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);

    const sectors = settings.sectors || [];

    const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (e.target.value === '__new__') {
            setCreating(true);
            return;
        }
        onChange(e.target.value);
    };

    const handleCreate = async () => {
        const normalized = normalizeSector(draft);
        if (!normalized) {
            addNotification({ title: 'Sector inválido', description: 'Escribí un nombre.', type: 'alert' });
            return;
        }
        const exists = sectors.some(s => s.trim().toLowerCase() === normalized.toLowerCase());
        if (exists) {
            const existingMatch = sectors.find(s => s.trim().toLowerCase() === normalized.toLowerCase()) || normalized;
            addNotification({ title: 'Sector ya existe', description: `"${existingMatch}" ya está en la lista.`, type: 'alert' });
            onChange(existingMatch);
            setCreating(false);
            setDraft('');
            return;
        }
        setBusy(true);
        try {
            await updateSettings({ sectors: [...sectors, normalized] });
            onChange(normalized);
            setCreating(false);
            setDraft('');
            addNotification({ title: 'Sector creado', description: `"${normalized}" disponible para todo el equipo.`, type: 'success' });
        } finally {
            setBusy(false);
        }
    };

    if (creating) {
        return (
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleCreate(); }
                        if (e.key === 'Escape') { setCreating(false); setDraft(''); }
                    }}
                    placeholder="Ej: Hospitalario"
                    className={selectClassName || 'flex-1 bg-muted border border-border rounded-xl py-2.5 px-3 text-sm outline-none focus:border-primary focus:bg-white transition-all'}
                />
                <button
                    type="button"
                    onClick={handleCreate}
                    disabled={busy}
                    className="bg-primary text-black font-bold rounded-xl px-3 py-2 text-xs hover:brightness-105 disabled:opacity-50 transition-all"
                >
                    {busy ? '…' : 'Crear'}
                </button>
                <button
                    type="button"
                    onClick={() => { setCreating(false); setDraft(''); }}
                    className="bg-muted text-foreground font-bold rounded-xl px-3 py-2 text-xs border border-border hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 transition-all"
                >
                    ✕
                </button>
            </div>
        );
    }

    return (
        <select
            value={value}
            onChange={handleSelect}
            className={selectClassName || 'w-full bg-muted border border-border rounded-xl py-2.5 px-3 text-sm outline-none focus:border-primary focus:bg-white transition-all appearance-none'}
        >
            {sectors.map(sector => (
                <option key={sector} value={sector}>{sector}</option>
            ))}
            <option value="__new__">+ Crear nuevo sector…</option>
        </select>
    );
}
