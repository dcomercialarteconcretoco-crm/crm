"use client";

// Editor de correos adicionales del cliente (chips + input). Compartido por
// el alta (/clients) y el modal de edición (/leads/[id]) para no duplicar
// markup ni reglas. La validación vive en @/lib/client-emails — acá solo se
// decide cuándo agregar (Enter, coma o blur) y cómo se ve.

import React, { useState } from 'react';
import { X, Mail } from 'lucide-react';
import { isRealEmail, MAX_EXTRA_EMAILS } from '@/lib/client-emails';

interface Props {
    value: string[];
    onChange: (emails: string[]) => void;
    /** Correo principal — para rechazar duplicarlo como adicional. */
    primaryEmail?: string;
}

export default function ExtraEmailsEditor({ value, onChange, primaryEmail }: Props) {
    const [draft, setDraft] = useState('');
    const [error, setError] = useState('');

    const tryAdd = () => {
        const email = draft.trim().replace(/[,;]+$/, '');
        if (!email) return;
        if (!isRealEmail(email)) {
            setError('Ese correo no parece válido.');
            return;
        }
        const lower = email.toLowerCase();
        if ((primaryEmail || '').trim().toLowerCase() === lower) {
            setError('Ese ya es el correo principal.');
            return;
        }
        if (value.some(e => e.toLowerCase() === lower)) {
            setError('Ese correo ya está en la lista.');
            return;
        }
        if (value.length >= MAX_EXTRA_EMAILS) {
            setError(`Máximo ${MAX_EXTRA_EMAILS} correos adicionales.`);
            return;
        }
        onChange([...value, email]);
        setDraft('');
        setError('');
    };

    return (
        <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">
                Correos adicionales <span className="text-muted-foreground font-medium normal-case">(reciben copia de cotizaciones)</span>
            </label>
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {value.map(email => (
                        <span key={email} className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-foreground text-xs font-semibold rounded-lg pl-2.5 pr-1.5 py-1">
                            {email}
                            <button
                                type="button"
                                title={`Quitar ${email}`}
                                onClick={() => onChange(value.filter(e => e !== email))}
                                className="rounded-md p-0.5 hover:bg-primary/20 transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="email"
                    placeholder="asistente@empresa.com — Enter para agregar"
                    value={draft}
                    onChange={e => { setDraft(e.target.value); setError(''); }}
                    onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault(); // no enviar el form del modal
                            tryAdd();
                        }
                    }}
                    onBlur={tryAdd}
                    className="w-full bg-muted border border-border rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                />
            </div>
            {error && <p className="text-[11px] text-rose-600 mt-1.5 font-medium">{error}</p>}
        </div>
    );
}
