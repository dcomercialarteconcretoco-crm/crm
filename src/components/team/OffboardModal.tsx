"use client";

import React, { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { X, UserMinus, ShieldCheck, ChevronDown } from 'lucide-react';
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
 * "Dar de baja" — la persona se va y todavía no hay quién la reemplace.
 *
 * Es la mitad del relevo: archiva la cuenta (adiós acceso, adiós rotación de
 * leads, adiós desplegables) y opcionalmente le pasa la cartera a alguien del
 * equipo mientras se contrata. Si no se elige destinatario, los clientes quedan
 * a nombre de la persona archivada y se reasignan después — nunca se pierden.
 *
 * Deliberadamente NO borra la fila: borrarla dejaría sin dueño las
 * cotizaciones, la bitácora de contacto y los negocios cerrados que apuntan a
 * su id, que es justo lo que una auditoría necesita poder leer.
 */
export function OffboardModal({
    seller,
    activeSellers,
    onClose,
    onDone,
}: {
    seller: Seller;
    activeSellers: Seller[];
    onClose: () => void;
    onDone: (message: string) => void;
}) {
    const [footprint, setFootprint] = useState<Footprint | null>(null);
    const [loading, setLoading] = useState(true);
    const [transfer, setTransfer] = useState<TransferFlags>({ ...ALL_TRANSFER_ON });
    const [fallbackOwnerId, setFallbackOwnerId] = useState('');
    const [reason, setReason] = useState('');
    /**
     * El correo del cargo se lo lleva quien recibe la cartera.
     * Caso real (ago-2026): sale el asesor 1, y el cliente pide que el asesor 3
     * atienda su cartera Y quede con `asesor1@arteconcreto.co`, porque ese
     * buzón es el que conocen los clientes y el que aparece en las cotizaciones
     * que ya salieron. Sin esto habría que archivar, editar el correo a mano y
     * rezar por que no choque con el UNIQUE.
     */
    const [inheritIdentity, setInheritIdentity] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** Candado sincrónico: ver el comentario de savingRef en /team. */
    const savingRef = useRef(false);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        fetch(`/api/team/${seller.id}/footprint`, { cache: 'no-store' })
            .then((r) => r.json())
            .then((data) => {
                if (!alive) return;
                if (data.movable && data.kept) setFootprint({ movable: data.movable, kept: data.kept });
                else setError(data.error || 'No se pudo leer lo que tiene asignado.');
            })
            .catch((e) => alive && setError(String(e)))
            .finally(() => alive && setLoading(false));
        return () => {
            alive = false;
        };
    }, [seller.id]);

    const receiver = activeSellers.find((s) => s.id === fallbackOwnerId) || null;
    const movingTotal =
        footprint && receiver
            ? TRANSFER_ITEMS.reduce(
                  (acc, item) => acc + (transfer[item.key] ? item.count(footprint) : 0),
                  0
              )
            : 0;

    const submit = async () => {
        if (savingRef.current) return;
        savingRef.current = true;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/team/handover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'offboard',
                    outgoingId: seller.id,
                    fallbackOwnerId: fallbackOwnerId || undefined,
                    inheritIdentity: Boolean(fallbackOwnerId && inheritIdentity),
                    transfer,
                    reason,
                }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                setError(data.error || `HTTP ${res.status}`);
                return;
            }
            const moved = data.moved || {};
            const parts = [
                moved.clients ? `${moved.clients} clientes` : null,
                moved.rawLeads ? `${moved.rawLeads} leads` : null,
                moved.openDeals ? `${moved.openDeals} negocios abiertos` : null,
            ].filter(Boolean);
            const correo = data.identityHandedTo?.email
                ? ` ${receiver?.name} quedó con el correo ${data.identityHandedTo.email}.`
                : '';
            onDone(
                receiver && parts.length
                    ? `${seller.name} quedó archivado. ${parts.join(', ')} pasaron a ${receiver.name}.${correo}`
                    : receiver
                      ? `${seller.name} quedó archivado.${correo}`
                      : `${seller.name} quedó archivado. Su cartera sigue a su nombre — reasignala cuando definas quién la toma.`
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error de red');
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center p-4 z-[120]"
            style={{ background: 'rgba(10,12,20,0.55)', backdropFilter: 'blur(6px)' }}
        >
            <div className="bg-white border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                    <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                        <UserMinus className="w-4 h-4 text-rose-500" />
                        Dar de baja a {seller.name}
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
                        <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-rose-800 leading-relaxed">
                            <strong>{seller.name}</strong> pierde el acceso al CRM en el acto, sale de la rotación
                            de leads y de todos los desplegables. Su ficha queda archivada, no se borra: es lo que
                            permite que sus cotizaciones y su bitácora sigan teniendo nombre en una auditoría. Si
                            fue un error, se puede reactivar desde el historial del equipo.
                        </p>
                    </div>

                    {loading && <FootprintLoading />}
                    {footprint && (
                        <>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">
                                    ¿Quién se queda con su cartera mientras tanto?
                                </label>
                                <div className="relative">
                                    <select
                                        value={fallbackOwnerId}
                                        onChange={(e) => setFallbackOwnerId(e.target.value)}
                                        className="w-full bg-muted border border-border rounded-xl px-3 pr-10 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:bg-white appearance-none transition-all cursor-pointer"
                                    >
                                        <option value="">Nadie por ahora — la dejo a su nombre</option>
                                        {activeSellers
                                            .filter((s) => s.id !== seller.id)
                                            .map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name} — {s.role}
                                                </option>
                                            ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                </div>
                                {!fallbackOwnerId && (
                                    <p className="text-[11px] text-amber-700 mt-1.5 leading-relaxed">
                                        Ojo: {footprint.movable.clients} clientes y {footprint.movable.openDeals}{' '}
                                        negocios abiertos van a quedar sin nadie atendiéndolos. Cuando contrates al
                                        reemplazo, dalo de alta como &ldquo;reemplaza a {seller.name}&rdquo; y la
                                        cartera le pasa completa.
                                    </p>
                                )}
                            </div>

                            {fallbackOwnerId && (
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 mb-2">
                                        Pasa a {receiver?.name}
                                    </p>
                                    <div className="space-y-1.5">
                                        {TRANSFER_ITEMS.map((item) => (
                                            <TransferCheck
                                                key={item.key}
                                                checked={transfer[item.key]}
                                                onToggle={() =>
                                                    setTransfer((t) => ({ ...t, [item.key]: !t[item.key] }))
                                                }
                                                label={item.label}
                                                hint={item.hint}
                                                count={item.count(footprint)}
                                            />
                                        ))}
                                    </div>
                                    {movingTotal > 0 && receiver && (
                                        <div className="mt-2">
                                            <MoveSummary
                                                from={seller.name}
                                                to={receiver.name}
                                                total={movingTotal}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {fallbackOwnerId && seller.email && (
                                <div className="flex items-center justify-between p-3 bg-muted/40 border border-border rounded-xl gap-3">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-foreground break-all">
                                            Pasarle también {seller.email}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                                            {inheritIdentity
                                                ? `El correo es del puesto: ${receiver?.name} entra con él y ${seller.name} queda archivado con una copia sellada. Su correo actual queda libre.`
                                                : `${receiver?.name} conserva su propio correo. El del cargo queda congelado con ${seller.name} y nadie lo puede usar.`}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setInheritIdentity(v => !v)}
                                        aria-pressed={inheritIdentity}
                                        className={clsx(
                                            'w-11 h-6 rounded-full relative transition-all shrink-0',
                                            inheritIdentity ? 'bg-emerald-500' : 'bg-gray-300'
                                        )}
                                    >
                                        <span
                                            className={clsx(
                                                'block w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm',
                                                inheritIdentity ? 'left-6' : 'left-1'
                                            )}
                                        />
                                    </button>
                                </div>
                            )}

                            <KeptNotice footprint={footprint} name={seller.name} />

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">
                                    Motivo de la salida
                                </label>
                                <input
                                    type="text"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Renuncia, fin de contrato, cambio de área…"
                                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:bg-white transition-all placeholder:text-muted-foreground/60"
                                />
                            </div>
                        </>
                    )}

                    {error && (
                        <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                            {error}
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border shrink-0">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="bg-white border border-border text-foreground font-medium rounded-xl px-4 py-2 hover:bg-muted transition-colors text-sm disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={submit}
                        disabled={saving || loading || !footprint}
                        className={clsx(
                            'bg-rose-500 text-white font-bold rounded-xl px-4 py-2 hover:brightness-105 transition-all flex items-center gap-2 text-sm',
                            (saving || loading || !footprint) && 'opacity-60 cursor-not-allowed'
                        )}
                    >
                        <UserMinus className="w-4 h-4" />
                        {saving ? 'Procesando…' : 'Dar de baja'}
                    </button>
                </div>
            </div>
        </div>
    );
}
