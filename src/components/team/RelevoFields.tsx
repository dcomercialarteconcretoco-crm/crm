"use client";

import React from 'react';
import { clsx } from 'clsx';
import { UserPlus, Repeat, AlertTriangle, ChevronDown } from 'lucide-react';
import type { Seller } from '@/context/AppContext';
import {
    ALL_TRANSFER_ON,
    FootprintLoading,
    KeptNotice,
    MoveSummary,
    TRANSFER_ITEMS,
    TransferCheck,
    type Footprint,
    type TransferFlags,
} from './handover-shared';

/**
 * Bloque "¿es alguien nuevo o reemplaza a alguien?" del alta de un integrante.
 *
 * Nace del problema real: en ArteConcreto la rotación es alta y hasta ahora la
 * salida de un asesor se resolvía renombrando su cuenta, porque reasignar 344
 * clientes a mano no lo hace nadie. Renombrar es cómodo y es exactamente lo que
 * no se puede hacer: el que entra queda como autor de las cotizaciones, los
 * tiempos de respuesta y los errores del que salió.
 *
 * Acá se separan las dos cosas de una vez: la CARTERA se traspasa completa con
 * un clic, y el HISTORIAL se queda donde estaba.
 */

export type RelevoState = {
    entryMode: 'new' | 'replace';
    outgoingId: string;
    transfer: TransferFlags;
    inheritIdentity: boolean;
    clonePermissions: boolean;
    reason: string;
};

export const BLANK_RELEVO: RelevoState = {
    entryMode: 'new',
    outgoingId: '',
    transfer: { ...ALL_TRANSFER_ON },
    inheritIdentity: true,
    clonePermissions: true,
    reason: '',
};

export function RelevoFields({
    candidates,
    value,
    onChange,
    footprint,
    footprintLoading,
    incomingName,
    lockedOutgoing,
}: {
    /** Integrantes activos que pueden ser relevados. */
    candidates: Seller[];
    value: RelevoState;
    onChange: (patch: Partial<RelevoState>) => void;
    footprint: Footprint | null;
    footprintLoading: boolean;
    incomingName: string;
    /**
     * "Entrego mi puesto": la persona que sale ya está decidida (es quien está
     * usando el CRM) y no se puede cambiar. Es el caso que pidió el cliente
     * para mercadeo — el buzón del cargo lo administra quien lo ocupa, y al
     * irse tiene que poder pasárselo al siguiente sin depender de nadie.
     */
    lockedOutgoing?: Seller | null;
}) {
    const outgoing = lockedOutgoing || candidates.find((s) => s.id === value.outgoingId) || null;
    const movingTotal = footprint
        ? TRANSFER_ITEMS.reduce(
              (acc, item) => acc + (value.transfer[item.key] ? item.count(footprint) : 0),
              0
          )
        : 0;

    return (
        <div className="border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-muted/60 border-b border-border">
                <span className="text-xs font-bold uppercase tracking-widest text-foreground">
                    {lockedOutgoing ? 'Entrega del puesto' : 'Tipo de ingreso'}
                </span>
            </div>

            <div className="p-4 space-y-4">
                {/* Nuevo vs reemplazo */}
                {!lockedOutgoing && (
                <div className="grid grid-cols-2 gap-3">
                    {([
                        {
                            mode: 'new' as const,
                            icon: UserPlus,
                            title: 'Integrante nuevo',
                            desc: 'Suma al equipo. Arranca sin cartera.',
                        },
                        {
                            mode: 'replace' as const,
                            icon: Repeat,
                            title: 'Reemplaza a alguien',
                            desc: 'Entra en el puesto de quien se fue y hereda su cartera.',
                        },
                    ]).map(({ mode, icon: Icon, title, desc }) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => onChange({ entryMode: mode })}
                            className={clsx(
                                'text-left p-3 rounded-xl border transition-all',
                                value.entryMode === mode
                                    ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/30'
                                    : 'bg-white border-border hover:bg-muted/50'
                            )}
                        >
                            <Icon
                                className={clsx(
                                    'w-4 h-4 mb-1.5',
                                    value.entryMode === mode ? 'text-primary' : 'text-muted-foreground'
                                )}
                            />
                            <span className="block text-xs font-bold text-foreground">{title}</span>
                            <span className="block text-[10px] text-muted-foreground leading-relaxed mt-0.5">
                                {desc}
                            </span>
                        </button>
                    ))}
                </div>
                )}

                {value.entryMode === 'replace' && (
                    <div className="space-y-4">
                        {lockedOutgoing ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                                <p className="text-xs font-bold text-amber-900">
                                    Estás entregando TU puesto ({lockedOutgoing.name})
                                </p>
                                <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                                    Al guardar perdés el acceso al CRM en el acto y la sesión se cierra. La
                                    persona que registres abajo entra con tu mismo rol y tus mismos permisos,
                                    pero con el historial en cero. Tu ficha queda archivada, no se borra.
                                </p>
                            </div>
                        ) : (
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">
                                ¿A quién reemplaza?
                            </label>
                            {/* `appearance-none` mata la flecha nativa: sin el chevron dibujado
                                a mano el campo se lee como un texto de solo lectura y nadie
                                descubre que despliega. */}
                            <div className="relative">
                                <select
                                    value={value.outgoingId}
                                    onChange={(e) => onChange({ outgoingId: e.target.value })}
                                    className="w-full bg-muted border border-border rounded-xl px-3 pr-10 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:bg-white appearance-none transition-all cursor-pointer"
                                >
                                    <option value="">Seleccioná a la persona que sale…</option>
                                    {candidates.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} — {s.role} ({s.email})
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                                Al guardar, esa persona queda <strong>archivada</strong>: pierde el acceso al CRM,
                                sale de la rotación de leads y desaparece de los desplegables. Su ficha NO se borra —
                                es lo que permite que una auditoría sepa quién hizo qué.
                            </p>
                        </div>
                        )}

                        {outgoing && footprintLoading && <FootprintLoading />}

                        {outgoing && footprint && (
                            <>
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 mb-2">
                                        Pasa a {incomingName.trim() || 'el reemplazo'}
                                    </p>
                                    <div className="space-y-1.5">
                                        {TRANSFER_ITEMS.map((item) => (
                                            <TransferCheck
                                                key={item.key}
                                                checked={value.transfer[item.key]}
                                                onToggle={() =>
                                                    onChange({
                                                        transfer: {
                                                            ...value.transfer,
                                                            [item.key]: !value.transfer[item.key],
                                                        },
                                                    })
                                                }
                                                label={item.label}
                                                hint={item.hint}
                                                count={item.count(footprint)}
                                            />
                                        ))}
                                    </div>
                                    {movingTotal > 0 && (
                                        <div className="mt-2">
                                            <MoveSummary
                                                from={outgoing.name}
                                                to={incomingName.trim() || 'el reemplazo'}
                                                total={movingTotal}
                                            />
                                        </div>
                                    )}
                                </div>

                                <KeptNotice footprint={footprint} name={outgoing.name} />

                                {footprint.movable.biolinksDeactivated > 0 && (
                                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-amber-800 leading-relaxed">
                                            La tarjeta digital pública de {outgoing.name} se apaga y el reemplazo
                                            recibe una propia. Si hay QR impresos con la tarjeta vieja, van a dejar
                                            de funcionar — es lo correcto: hoy siguen mostrando la foto y el WhatsApp
                                            de alguien que ya no atiende.
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <ToggleRow
                                        on={value.inheritIdentity}
                                        onToggle={() => onChange({ inheritIdentity: !value.inheritIdentity })}
                                        title={`Quedarse con ${outgoing.email || 'el correo del cargo'}`}
                                        desc={
                                            value.inheritIdentity
                                                ? `El correo es del puesto, no de la persona. ${outgoing.name} pasa a ${archivedPreview(outgoing.email)} y el reemplazo entra con el original.`
                                                : 'El reemplazo usa el correo que escribas abajo. El del que sale queda congelado con él.'
                                        }
                                    />
                                    {lockedOutgoing ? (
                                        <div className="p-3 bg-muted/40 border border-border rounded-xl">
                                            <p className="text-xs font-bold text-foreground">
                                                Entra con tu mismo rol y tus mismos permisos
                                            </p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                                                No es opcional: entregando tu propio puesto no podés fabricarle al
                                                sucesor más poder del que vos tenés.
                                            </p>
                                        </div>
                                    ) : (
                                    <ToggleRow
                                        on={value.clonePermissions}
                                        onToggle={() => onChange({ clonePermissions: !value.clonePermissions })}
                                        title="Copiar sus permisos exactos"
                                        desc={
                                            value.clonePermissions
                                                ? 'Mismas responsabilidades, cero historial. Es lo que se quiere en un relevo de puesto.'
                                                : 'Los permisos salen del rol que elijas más abajo.'
                                        }
                                    />
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">
                                        Motivo de la salida
                                    </label>
                                    <input
                                        type="text"
                                        value={value.reason}
                                        onChange={(e) => onChange({ reason: e.target.value })}
                                        placeholder="Renuncia, fin de contrato, cambio de área…"
                                        className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:bg-white transition-all placeholder:text-muted-foreground/60"
                                    />
                                    <p className="text-[11px] text-muted-foreground mt-1.5">
                                        Queda en el acta de relevo junto con quién lo hizo y qué se movió.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/** `asesor2@arteconcreto.co` → `asesor2+ex-AAAAMMDD@arteconcreto.co` (sólo para mostrar). */
function archivedPreview(email?: string | null): string {
    if (!email) return 'un correo archivado';
    const stamp = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).replace(/-/g, '');
    const at = email.lastIndexOf('@');
    if (at <= 0) return `${email}.ex-${stamp}`;
    return `${email.slice(0, at)}+ex-${stamp}${email.slice(at)}`;
}

export function ToggleRow({
    on,
    onToggle,
    title,
    desc,
}: {
    on: boolean;
    onToggle: () => void;
    title: string;
    desc: string;
}) {
    return (
        <div className="flex items-center justify-between p-3 bg-muted/40 border border-border rounded-xl gap-3">
            <div className="min-w-0">
                <p className="text-xs font-bold text-foreground break-all">{title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
            </div>
            <button
                type="button"
                onClick={onToggle}
                aria-pressed={on}
                className={clsx(
                    'w-11 h-6 rounded-full relative transition-all shrink-0',
                    on ? 'bg-emerald-500' : 'bg-gray-300'
                )}
            >
                <span
                    className={clsx(
                        'block w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm',
                        on ? 'left-6' : 'left-1'
                    )}
                />
            </button>
        </div>
    );
}
