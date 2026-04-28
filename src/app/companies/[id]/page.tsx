"use client";

/**
 * /companies/[id] — Detalle de una empresa con sus contactos y cotizaciones.
 *
 * Resume la actividad corporativa de un cliente: lista todos los contactos
 * (Client) que apuntan a esta empresa, y todas las cotizaciones que se le han
 * generado (vía cualquiera de esos contactos). Es la vista que el vendedor
 * abre cuando quiere "ver todo lo que tengo con Constructora Marval".
 */

import React, { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, User, Mail, Phone, MapPin, FileText, Plus, Edit2, Trash2, X, AlertTriangle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PermissionGate } from '@/components/PermissionGate';
import { clsx } from 'clsx';

export default function CompanyDetailPage() {
    const params = useParams();
    const router = useRouter();
    const companyId = params?.id as string;
    const { companies, clients, quotes, updateCompany, deleteCompany, addNotification } = useApp();

    const company = companies.find(c => c.id === companyId);

    // UI state local para edición y borrado
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editError, setEditError] = useState('');
    const [editing_, setEditing_] = useState(false); // submitting flag for edit
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const openEdit = () => {
        setEditName(company?.name || '');
        setEditError('');
        setEditing(true);
    };

    const submitEdit = async () => {
        if (!company || !editName.trim() || editing_) return;
        setEditing_(true);
        setEditError('');
        const result = await updateCompany(company.id, editName);
        setEditing_(false);
        if (result.ok) {
            addNotification({ title: 'Empresa actualizada', description: `Ahora se llama ${editName.trim()}.`, type: 'success' });
            setEditing(false);
        } else {
            setEditError(result.error);
        }
    };

    const submitDelete = async () => {
        if (!company || deleting) return;
        setDeleting(true);
        const result = await deleteCompany(company.id);
        setDeleting(false);
        if (result.ok) {
            addNotification({
                title: 'Empresa eliminada',
                description: `${company.name} se removió. Sus contactos quedaron sin empresa asignada.`,
                type: 'success',
            });
            router.push('/companies');
        } else {
            addNotification({ title: 'No se pudo eliminar', description: result.error, type: 'alert' });
            setConfirmDelete(false);
        }
    };

    // Contactos asociados — fuente de verdad es companyId. Si una cotización
    // legacy apunta a la empresa por string solamente (sin id) NO la
    // agrupamos acá: el detalle se basa estrictamente en la FK.
    const contacts = useMemo(
        () => clients.filter(c => c.companyId === companyId),
        [clients, companyId]
    );

    // Cotizaciones agrupadas — ordenadas más nueva primero.
    const companyQuotes = useMemo(
        () => quotes.filter(q => q.companyId === companyId)
            .sort((a, b) => (b.id || '').localeCompare(a.id || '')),
        [quotes, companyId]
    );

    const totalValue = companyQuotes.reduce((acc, q) => acc + (q.numericTotal || 0), 0);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

    if (!company) {
        return (
            <PermissionGate require="clients.view">
                <div className="space-y-4">
                    <button onClick={() => router.push('/companies')} className="text-sm font-bold text-muted-foreground hover:text-primary flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" /> Volver a empresas
                    </button>
                    <div className="surface-card p-12 text-center">
                        <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm font-bold text-muted-foreground">Empresa no encontrada</p>
                    </div>
                </div>
            </PermissionGate>
        );
    }

    return (
        <PermissionGate require="clients.view">
            <div className="space-y-6">
                {/* Back */}
                <button
                    onClick={() => router.push('/companies')}
                    className="text-sm font-bold text-muted-foreground hover:text-primary flex items-center gap-2"
                >
                    <ArrowLeft className="w-4 h-4" /> Volver a empresas
                </button>

                {/* Header card */}
                <div className="surface-card p-6">
                    <div className="flex flex-col md:flex-row md:items-start gap-6">
                        <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                            <Building2 className="w-10 h-10" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] uppercase tracking-widest text-primary font-black">Cliente corporativo</p>
                            <h1 className="text-2xl font-black text-foreground tracking-tight mt-1">{company.name}</h1>
                            <div className="flex flex-wrap items-center gap-4 mt-3">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <User className="w-3.5 h-3.5" />
                                    <strong className="text-foreground font-bold">{contacts.length}</strong>
                                    {contacts.length === 1 ? 'contacto' : 'contactos'}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <FileText className="w-3.5 h-3.5" />
                                    <strong className="text-foreground font-bold">{companyQuotes.length}</strong>
                                    {companyQuotes.length === 1 ? 'cotización' : 'cotizaciones'}
                                </div>
                                {totalValue > 0 && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span>·</span>
                                        <strong className="text-primary font-bold">{formatCurrency(totalValue)}</strong>
                                        en cotizaciones
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Acciones */}
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={openEdit}
                                className="bg-white border border-border text-foreground font-bold rounded-xl px-3 py-2 hover:bg-muted transition-colors flex items-center gap-2 text-xs"
                            >
                                <Edit2 className="w-3.5 h-3.5" />
                                Editar
                            </button>
                            <button
                                onClick={() => setConfirmDelete(true)}
                                className="bg-white border border-rose-200 text-rose-600 font-bold rounded-xl px-3 py-2 hover:bg-rose-50 transition-colors flex items-center gap-2 text-xs"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>

                {/* Contactos */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Contactos</h2>
                        <Link
                            href="/clients"
                            className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5"
                        >
                            <Plus className="w-3.5 h-3.5" /> Asignar contacto existente
                        </Link>
                    </div>
                    {contacts.length === 0 ? (
                        <div className="surface-card p-8 text-center">
                            <User className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-xs font-bold text-muted-foreground">Esta empresa todavía no tiene contactos asignados</p>
                            <p className="text-[11px] text-muted-foreground/70 mt-1">
                                Andá a un lead existente y editalo para asociarlo a {company.name}, o creá uno nuevo.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {contacts.map(contact => {
                                const contactQuotes = quotes.filter(q => q.clientId === contact.id);
                                return (
                                    <Link
                                        key={contact.id}
                                        href={`/leads/${contact.id}`}
                                        className="block bg-white border border-border rounded-xl px-4 py-3 grid grid-cols-12 items-center gap-3 hover:shadow-md hover:border-primary/40 transition-all group"
                                    >
                                        <div className="col-span-12 md:col-span-4 flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                                                {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">{contact.name}</p>
                                                {contact.position && (
                                                    <p className="text-[11px] text-muted-foreground truncate leading-tight" title={contact.position}>
                                                        {contact.position}
                                                    </p>
                                                )}
                                                <span className={clsx(
                                                    'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide mt-0.5',
                                                    contact.status === 'Active' ? 'bg-emerald-50 text-emerald-700' :
                                                    contact.status === 'Lead' ? 'bg-amber-50 text-amber-700' :
                                                    'bg-slate-100 text-slate-500'
                                                )}>
                                                    {contact.status}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="hidden md:flex md:col-span-3 items-center gap-2 min-w-0">
                                            <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-xs text-foreground truncate">{contact.email || <span className="italic text-muted-foreground/60">sin email</span>}</span>
                                        </div>
                                        <div className="hidden md:flex md:col-span-2 items-center gap-2 min-w-0">
                                            <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-xs text-foreground truncate">{contact.phone || <span className="italic text-muted-foreground/60">—</span>}</span>
                                        </div>
                                        <div className="hidden md:flex md:col-span-2 items-center gap-2 min-w-0">
                                            <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-xs text-foreground truncate">{contact.city || <span className="italic text-muted-foreground/60">—</span>}</span>
                                        </div>
                                        <div className="hidden md:block md:col-span-1 text-right">
                                            <p className="text-xs font-bold text-foreground">{contactQuotes.length}</p>
                                            <p className="text-[9px] uppercase text-muted-foreground">cotiz</p>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Cotizaciones agrupadas */}
                <section className="space-y-3">
                    <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Cotizaciones de la empresa</h2>
                    {companyQuotes.length === 0 ? (
                        <div className="surface-card p-8 text-center">
                            <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-xs font-bold text-muted-foreground">Sin cotizaciones todavía</p>
                            <p className="text-[11px] text-muted-foreground/70 mt-1">
                                Cuando un contacto de esta empresa reciba una cotización, va a aparecer acá.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {companyQuotes.map(q => {
                                const contact = clients.find(c => c.id === q.clientId);
                                return (
                                    <div key={q.id} className="bg-white border border-border rounded-xl px-4 py-3 grid grid-cols-12 items-center gap-3 hover:shadow-md transition-all">
                                        <div className="col-span-12 md:col-span-4 min-w-0">
                                            <p className="text-sm font-bold text-foreground truncate">{q.quoteNumber || q.number || q.id}</p>
                                            <p className="text-[11px] text-muted-foreground truncate">{contact?.name || q.client || '—'}</p>
                                        </div>
                                        <div className="hidden md:block md:col-span-3 text-xs text-muted-foreground truncate">{q.date}</div>
                                        <div className="hidden md:block md:col-span-2 text-xs">
                                            <span className={clsx(
                                                'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                                                q.status === 'Sent' || q.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' :
                                                q.status === 'Rejected' ? 'bg-rose-50 text-rose-700' :
                                                q.status === 'PendingApproval' || q.status === 'PENDING_APPROVAL' ? 'bg-amber-50 text-amber-700' :
                                                'bg-slate-100 text-slate-500'
                                            )}>
                                                {q.status}
                                            </span>
                                        </div>
                                        <div className="col-span-6 md:col-span-2 text-right">
                                            <p className="text-sm font-bold text-primary">{q.total}</p>
                                        </div>
                                        <div className="col-span-6 md:col-span-1 text-right">
                                            <Link href={`/quotes`} className="text-xs font-bold text-primary hover:underline">Ver →</Link>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Modal: editar nombre */}
                {editing && (
                    <div className="fixed inset-0 flex items-center justify-center p-4 z-[200]" style={{ background: 'rgba(10,12,20,0.55)', backdropFilter: 'blur(6px)' }}>
                        <div className="bg-white border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                            <div className="flex items-center justify-between p-6 border-b border-border">
                                <h2 className="text-base font-bold text-foreground">Editar empresa</h2>
                                <button onClick={() => setEditing(false)} className="bg-white border border-border text-foreground rounded-xl p-1.5 hover:bg-muted transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-6 space-y-3">
                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Nombre</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        autoFocus
                                        type="text"
                                        value={editName}
                                        onChange={e => { setEditName(e.target.value); setEditError(''); }}
                                        onKeyDown={e => { if (e.key === 'Enter') submitEdit(); }}
                                        className="w-full bg-muted border border-border rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                    />
                                </div>
                                {editError && (
                                    <p className="text-xs font-bold text-rose-600">{editError}</p>
                                )}
                                <p className="text-[11px] text-muted-foreground">
                                    El nombre nuevo se propaga automáticamente a los {contacts.length} contacto(s) asociados.
                                </p>
                            </div>
                            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
                                <button onClick={() => setEditing(false)} className="bg-white border border-border text-foreground font-medium rounded-xl px-4 py-2 hover:bg-muted transition-colors">
                                    Cancelar
                                </button>
                                <button
                                    onClick={submitEdit}
                                    disabled={!editName.trim() || editing_}
                                    className="bg-primary text-black font-bold rounded-xl px-4 py-2 hover:brightness-105 shadow-[0_2px_8px_rgba(250,181,16,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {editing_ ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Confirmación de borrado */}
                {confirmDelete && (
                    <div className="fixed inset-0 flex items-center justify-center p-4 z-[200]" style={{ background: 'rgba(10,12,20,0.55)', backdropFilter: 'blur(6px)' }}>
                        <div className="bg-white border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                            <div className="p-6 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <h2 className="text-base font-bold text-foreground">Eliminar {company.name}</h2>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Esta acción no se puede deshacer. {contacts.length > 0 ? (
                                        <>Los <strong className="text-foreground">{contacts.length} contacto(s)</strong> asociados van a quedar <strong className="text-foreground">sin empresa asignada</strong> (no se borran).</>
                                    ) : (
                                        <>La empresa no tiene contactos asociados.</>
                                    )} {companyQuotes.length > 0 && (
                                        <>Las <strong className="text-foreground">{companyQuotes.length} cotización(es)</strong> históricas se conservan.</>
                                    )}
                                </p>
                            </div>
                            <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-muted/30">
                                <button onClick={() => setConfirmDelete(false)} className="bg-white border border-border text-foreground font-medium rounded-xl px-4 py-2 hover:bg-muted transition-colors">
                                    Cancelar
                                </button>
                                <button
                                    onClick={submitDelete}
                                    disabled={deleting}
                                    className="bg-rose-600 text-white font-bold rounded-xl px-4 py-2 hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    {deleting ? 'Eliminando...' : 'Eliminar empresa'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PermissionGate>
    );
}
