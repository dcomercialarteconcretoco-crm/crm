"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, FileText, Image as ImageIcon, Trash2, Download, Loader2 } from 'lucide-react';
import type { Seller } from '@/context/AppContext';
import { canSeeAll } from '@/lib/scope';

export interface ClientAttachment {
    id: string;
    name: string;
    filename: string;
    mimetype: string;
    size: number;
    kind: string;
    uploaded_by_id: string | null;
    uploaded_by_name: string | null;
    uploaded_at: string;
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function iconForMime(mimetype: string) {
    if (mimetype.startsWith('image/')) return ImageIcon;
    return FileText;
}

export function ClientAttachments({
    clientId,
    currentUser,
}: {
    clientId: string;
    currentUser: Seller | null;
}) {
    const [items, setItems] = useState<ClientAttachment[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const canManage = Boolean(currentUser); // any authenticated user can upload to clients they can see
    const canDeleteAny = canSeeAll(currentUser);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/clients/${clientId}/attachments`, { cache: 'no-store' });
            const data = await res.json();
            setItems(Array.isArray(data) ? data : []);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        load();
    }, [load]);

    const handlePick = () => fileInputRef.current?.click();

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setError(null);
        try {
            const form = new FormData();
            form.append('file', file);
            form.append('name', file.name.replace(/\.[^/.]+$/, ''));
            if (currentUser?.id) form.append('uploaded_by_id', currentUser.id);
            if (currentUser?.name) form.append('uploaded_by_name', currentUser.name);
            const res = await fetch(`/api/clients/${clientId}/attachments`, {
                method: 'POST',
                body: form,
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Error al subir');
            } else {
                await load();
            }
        } catch {
            setError('Error de red al subir el archivo');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (att: ClientAttachment) => {
        if (!confirm(`¿Eliminar "${att.name}"?`)) return;
        const res = await fetch(`/api/clients/${clientId}/attachments/${att.id}`, { method: 'DELETE' });
        if (res.ok) {
            setItems(prev => prev.filter(a => a.id !== att.id));
        }
    };

    const canDelete = (att: ClientAttachment) =>
        canDeleteAny || (currentUser && att.uploaded_by_id === currentUser.id);

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Archivos del cliente</h3>
                    <p className="text-xs text-muted-foreground mt-1">Cotizaciones viejas, fotos, PDFs, contratos, etc. Máx 10 MB.</p>
                </div>
                {canManage && (
                    <>
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept="application/pdf,.doc,.docx,.xls,.xlsx,image/*"
                            onChange={handleUpload}
                        />
                        <button
                            onClick={handlePick}
                            disabled={uploading}
                            className="bg-primary text-black font-bold rounded-xl px-4 py-2 hover:brightness-105 transition-all shadow-[0_2px_8px_rgba(250,181,16,0.3)] flex items-center gap-2 text-xs disabled:opacity-60"
                        >
                            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                            {uploading ? 'Subiendo...' : 'Subir archivo'}
                        </button>
                    </>
                )}
            </div>

            {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">{error}</div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-10 bg-muted/30 border border-dashed border-border rounded-xl">
                    <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Sin archivos aún</p>
                    <p className="text-xs text-muted-foreground mt-1">Sube PDFs, Word, Excel o imágenes.</p>
                </div>
            ) : (
                <ul className="space-y-2">
                    {items.map(att => {
                        const Icon = iconForMime(att.mimetype);
                        const canDel = canDelete(att);
                        return (
                            <li key={att.id} className="flex items-center gap-3 p-3 bg-white border border-border rounded-xl hover:border-primary/30 transition-colors">
                                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                    <Icon className="w-4 h-4 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-foreground truncate">{att.name}</p>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                        {att.filename} · {formatSize(att.size)}
                                        {att.uploaded_by_name ? ` · ${att.uploaded_by_name}` : ''}
                                        {' · '}{new Date(att.uploaded_at).toLocaleDateString('es-CO')}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <a
                                        href={`/api/clients/${clientId}/attachments/${att.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Ver"
                                        className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                                    >
                                        <FileText className="w-4 h-4" />
                                    </a>
                                    <a
                                        href={`/api/clients/${clientId}/attachments/${att.id}?download=1`}
                                        title="Descargar"
                                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <Download className="w-4 h-4" />
                                    </a>
                                    {canDel && (
                                        <button
                                            onClick={() => handleDelete(att)}
                                            title="Eliminar"
                                            className="p-2 rounded-lg hover:bg-rose-50 text-rose-500 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
