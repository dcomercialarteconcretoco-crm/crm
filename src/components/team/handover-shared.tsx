"use client";

import React from 'react';
import { clsx } from 'clsx';
import { ArrowRight, Lock, Loader2 } from 'lucide-react';

/**
 * Piezas compartidas entre el alta con reemplazo (/team → Añadir Miembro) y la
 * baja de un integrante (/team → Dar de baja).
 *
 * La idea de toda esta pantalla: que nadie apriete "confirmar" sin ver ANTES
 * qué se mueve y qué NO se mueve. El reclamo original del cliente era que
 * reasignar la cartera a mano es imposible; el riesgo del atajo automático es
 * que también arrastre el historial del que se fue y se lo cuelgue al que
 * entra. Por eso las dos listas van siempre juntas y con los números reales.
 */

export type TransferFlags = {
    clients: boolean;
    rawLeads: boolean;
    openDeals: boolean;
    futureEvents: boolean;
    notifications: boolean;
};

export const ALL_TRANSFER_ON: TransferFlags = {
    clients: true,
    rawLeads: true,
    openDeals: true,
    futureEvents: true,
    notifications: true,
};

export type Footprint = {
    movable: {
        clients: number;
        rawLeads: number;
        openDeals: number;
        futureEvents: number;
        notifications: number;
        biolinksDeactivated: number;
    };
    kept: {
        quotes: number;
        closedDeals: number;
        contactEvents: number;
        attachments: number;
        pastEvents: number;
    };
};

export const TRANSFER_ITEMS: Array<{
    key: keyof TransferFlags;
    label: string;
    hint: string;
    count: (f: Footprint) => number;
}> = [
    {
        key: 'clients',
        label: 'Cartera de clientes',
        hint: 'Contactos y empresas que hoy figuran a su nombre',
        count: (f) => f.movable.clients,
    },
    {
        key: 'rawLeads',
        label: 'Leads crudos pendientes',
        hint: 'Los ya contactados o por contactar, no los descartados',
        count: (f) => f.movable.rawLeads,
    },
    {
        key: 'openDeals',
        label: 'Negocios abiertos del pipeline',
        hint: 'Sólo los que siguen vivos: los facturados y los perdidos no se mueven',
        count: (f) => f.movable.openDeals,
    },
    {
        key: 'futureEvents',
        label: 'Agenda de hoy en adelante',
        hint: 'Visitas y llamadas ya programadas',
        count: (f) => f.movable.futureEvents,
    },
    {
        key: 'notifications',
        label: 'Avisos sin leer',
        hint: 'Pendientes que nadie más está viendo',
        count: (f) => f.movable.notifications,
    },
];

/** Lo que jamás se transfiere, con su número real. Es media pantalla de confianza. */
export function KeptNotice({ footprint, name }: { footprint: Footprint; name: string }) {
    const rows = [
        { n: footprint.kept.quotes, label: 'cotizaciones enviadas' },
        { n: footprint.kept.closedDeals, label: 'negocios ya cerrados (facturados o perdidos)' },
        { n: footprint.kept.contactEvents, label: 'registros de contacto (WhatsApp, llamadas, correos)' },
        { n: footprint.kept.attachments, label: 'archivos que subió' },
        { n: footprint.kept.pastEvents, label: 'eventos de agenda ya pasados' },
    ].filter((r) => r.n > 0);

    return (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-600">
                    Queda a nombre de {name}, para siempre
                </p>
            </div>
            {rows.length === 0 ? (
                <p className="text-[11px] text-slate-500 leading-relaxed">
                    No alcanzó a dejar historial en el sistema.
                </p>
            ) : (
                <ul className="space-y-0.5">
                    {rows.map((r) => (
                        <li key={r.label} className="text-[11px] text-slate-600 leading-relaxed">
                            <strong className="text-slate-800">{r.n}</strong> {r.label}
                        </li>
                    ))}
                </ul>
            )}
            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                Una cotización es un documento que salió firmado a un cliente y la bitácora de contacto
                es la evidencia de cómo se atendió. Cambiarles el dueño sería falsear la auditoría — por
                eso el reemplazo entra con el historial en cero.
            </p>
        </div>
    );
}

/** Fila "de → a" con los totales que se van a mover. */
export function MoveSummary({
    from,
    to,
    total,
}: {
    from: string;
    to: string;
    total: number;
}) {
    return (
        <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <span className="truncate max-w-[38%]">{from}</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[38%]">{to}</span>
            <span className="ml-auto shrink-0 bg-emerald-600 text-white rounded-full px-2 py-0.5">
                {total} registros
            </span>
        </div>
    );
}

export function FootprintLoading() {
    return (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground px-3 py-4">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Contando lo que tiene asignado…
        </div>
    );
}

/** Checkbox cuadrado con contador — el patrón visual del panel de traspaso. */
export function TransferCheck({
    checked,
    onToggle,
    label,
    hint,
    count,
    disabled,
}: {
    checked: boolean;
    onToggle: () => void;
    label: string;
    hint: string;
    count: number;
    disabled?: boolean;
}) {
    const empty = count === 0;
    return (
        <button
            type="button"
            onClick={onToggle}
            disabled={disabled || empty}
            className={clsx(
                'w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
                empty
                    ? 'bg-muted/30 border-border opacity-60 cursor-default'
                    : checked
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-white border-border hover:bg-muted/50'
            )}
        >
            <span
                className={clsx(
                    'mt-0.5 w-4 h-4 rounded-md border shrink-0 flex items-center justify-center text-[10px] font-black',
                    checked && !empty
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'bg-white border-border text-transparent'
                )}
            >
                ✓
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-foreground">
                    {label}
                    <span
                        className={clsx(
                            'ml-2 text-[10px] font-black px-1.5 py-0.5 rounded-full',
                            empty ? 'bg-muted text-muted-foreground' : 'bg-emerald-600 text-white'
                        )}
                    >
                        {count}
                    </span>
                </span>
                <span className="block text-[10px] text-muted-foreground leading-relaxed mt-0.5">
                    {empty ? 'No tiene ninguno.' : hint}
                </span>
            </span>
        </button>
    );
}
