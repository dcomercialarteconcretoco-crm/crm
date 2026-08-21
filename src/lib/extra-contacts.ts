// Contactos ADICIONALES capturados por el ConcreBOT en pleno chat: helpers
// compartidos entre el widget, /api/assistant y /api/conversations (sin
// "use client" para que los routes puedan importarlos).
//
// Caso real (12-ago-2026, PRANA C&G): la titular del chat dictó el nombre y
// el correo de una SEGUNDA persona cuando el bot pidió datos para escalar a
// un asesor. Esos datos quedaron enterrados en el texto de los mensajes y la
// ficha del cliente nunca se enteró. Desde entonces el flujo los mueve
// ESTRUCTURADOS: /api/assistant los extrae del chat, el widget los acumula en
// `conversation.extraContacts` y POST /api/conversations los aplica a la
// ficha (emails_extra + nota) sin tocar jamás la identidad principal.

import { isRealEmail } from './client-emails';

export interface ExtraContact {
    /** Nombre de la persona, si el cliente lo dijo. Puede venir vacío. */
    name?: string;
    email?: string;
    phone?: string;
    /** ISO del mensaje/momento en que se capturó. */
    capturedAt?: string;
}

/** Tope de contactos adicionales por conversación — el endpoint es público
 *  (el id de sesión hace de credencial) y esto acota cualquier abuso. */
export const MAX_EXTRA_CONTACTS = 10;

/** Correo dentro de texto libre (sin anclas — para barrer mensajes). */
const EMAIL_IN_TEXT_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Algo con pinta de teléfono: 7+ dígitos aunque traigan separadores. */
const PHONE_IN_TEXT_RE = /(?:\d[\s.()-]*){7,}/;

/**
 * Filtro barato para decidir si vale la pena correr el extractor de Gemini
 * sobre un mensaje: ¿trae un correo o algo con pinta de teléfono? (El nombre
 * solo no dispara nada — sin correo ni teléfono no hay contacto accionable.)
 */
export function looksLikeContactData(text: string): boolean {
    if (!text) return false;
    EMAIL_IN_TEXT_RE.lastIndex = 0;
    return EMAIL_IN_TEXT_RE.test(text) || PHONE_IN_TEXT_RE.test(text);
}

/** Correos reales encontrados en texto libre, deduplicados sin importar caja. */
export function extractEmailsFromText(text: string): string[] {
    if (!text) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    EMAIL_IN_TEXT_RE.lastIndex = 0;
    for (const match of text.match(EMAIL_IN_TEXT_RE) || []) {
        const email = match.trim();
        const lower = email.toLowerCase();
        if (!isRealEmail(email) || seen.has(lower)) continue;
        seen.add(lower);
        out.push(email);
    }
    return out;
}

export function normalizePhoneDigits(value?: string | null): string {
    return (value || '').replace(/\D/g, '');
}

/**
 * Mismo teléfono aunque uno lleve indicativo (+57 300… vs 300…): compara por
 * sufijo con mínimo 7 dígitos en ambos lados.
 */
export function samePhone(a?: string | null, b?: string | null): boolean {
    const da = normalizePhoneDigits(a);
    const db = normalizePhoneDigits(b);
    if (da.length < 7 || db.length < 7) return false;
    return da === db || da.endsWith(db) || db.endsWith(da);
}

/**
 * Normaliza un contacto crudo (viene de Gemini o de un caller externo del
 * endpoint público): solo strings, largos capados, correo real o nada,
 * teléfono con 7+ dígitos o nada. Devuelve null si no queda ni correo ni
 * teléfono — un nombre suelto no es un contacto accionable.
 */
export function coerceExtraContact(raw: unknown): ExtraContact | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim().slice(0, 120) : '';
    let email = typeof r.email === 'string' ? r.email.trim().slice(0, 160) : '';
    let phone = typeof r.phone === 'string' ? r.phone.trim().slice(0, 40) : '';
    if (!isRealEmail(email)) email = '';
    if (normalizePhoneDigits(phone).length < 7) phone = '';
    if (!email && !phone) return null;
    const capturedAt = typeof r.capturedAt === 'string' ? r.capturedAt.slice(0, 40) : undefined;
    return { name, email, phone, capturedAt };
}

/**
 * Une varias listas de contactos sin duplicar: dos entradas son la misma
 * persona si comparten correo (sin caja) o teléfono (samePhone). El duplicado
 * no se descarta del todo — rellena los campos que le falten al que ya está
 * (así "LUIS GUILLERMO" dicho en un mensaje y su correo dicho en otro
 * terminan en un solo contacto). Capado a MAX_EXTRA_CONTACTS.
 */
export function mergeExtraContacts(
    ...lists: (ExtraContact[] | undefined | null)[]
): ExtraContact[] {
    const out: ExtraContact[] = [];
    for (const list of lists) {
        if (!Array.isArray(list)) continue;
        for (const raw of list) {
            const c = coerceExtraContact(raw);
            if (!c) continue;
            const dup = out.find(o =>
                (c.email && o.email && o.email.toLowerCase() === c.email.toLowerCase()) ||
                (c.phone && o.phone && samePhone(o.phone, c.phone))
            );
            if (dup) {
                if (!dup.name && c.name) dup.name = c.name;
                if (!dup.email && c.email) dup.email = c.email;
                if (!dup.phone && c.phone) dup.phone = c.phone;
                continue;
            }
            if (out.length >= MAX_EXTRA_CONTACTS) continue;
            out.push(c);
        }
    }
    return out;
}

/**
 * ¿El contacto aporta algo DISTINTO a la identidad dada (el lead del chat o
 * la ficha)? Si su correo es el mismo y su teléfono es el mismo (o no trae),
 * es la persona repitiendo sus propios datos y no hay nada que registrar.
 */
export function contactIsNovel(
    c: ExtraContact,
    identity: { email?: string | null; phone?: string | null }
): boolean {
    const email = (c.email || '').trim();
    const emailNovel =
        isRealEmail(email) &&
        email.toLowerCase() !== (identity.email || '').trim().toLowerCase();
    const phoneNovel =
        normalizePhoneDigits(c.phone).length >= 7 && !samePhone(c.phone, identity.phone);
    return emailNovel || phoneNovel;
}
