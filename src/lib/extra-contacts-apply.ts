// Lado SERVER de los contactos adicionales del ConcreBOT: aplicar a la ficha
// lo que el chat capturó. Vive aparte de extra-contacts.ts porque aquello lo
// importa el widget (bundle de cliente) y esto habla con Postgres — mismo
// patrón que state-merge / server-notifications: reciben el pool como
// argumento (además, un route.ts de Next no puede exportar funciones sueltas,
// y esta necesita test).

import type { Pool } from 'pg';
import { MAX_EXTRA_EMAILS, isRealEmail } from './client-emails';
import { ExtraContact, contactIsNovel, normalizePhoneDigits, samePhone } from './extra-contacts';

/**
 * Aplica los contactos adicionales del chat a la ficha del cliente vinculado:
 *  - correo nuevo → se AGREGA a `emails_extra` (el front lo lee como
 *    `extraEmails` y lo usa de CC en cotización/catálogo);
 *  - además deja una nota en `notes` con el nombre del contacto adicional
 *    (y su teléfono, que no tiene columna propia).
 *
 * REGLAS (las mismas del upsert de /api/conversations — el endpoint es
 * público y no puede robar ni pisar nada):
 *  - JAMÁS toca name/email/phone principales ni assigned_to: solo APPEND en
 *    emails_extra y notes.
 *  - Los appends son ATÓMICOS, en una sola sentencia con `||` de jsonb —
 *    mismo contrato que el addNote de /api/clients/[id] (incidente
 *    20-ago-2026: reescribir el arreglo completo desde una copia leída antes
 *    pisaba lo que otros acababan de escribir). Acá nunca se reescribe ni
 *    notes ni emails_extra completos.
 *  - Lo que coincida con la identidad de la ficha (su correo o su teléfono)
 *    se ignora: no es un contacto adicional.
 *  - Idempotente: correo ya presente no se re-agrega (guarda de contención
 *    `@>` dentro del propio UPDATE); contacto ya anotado (una nota menciona
 *    su correo y su teléfono) no se re-anota. El widget re-manda los
 *    contactos en cada guardado y esto debe poder correr mil veces sin
 *    duplicar nada.
 */
export async function applyExtraContactsToClient(
    pool: Pool,
    clientId: string,
    contacts: ExtraContact[]
): Promise<void> {
    const { rows } = await pool.query(
        `SELECT email, phone, emails_extra, notes FROM crm_clients WHERE id = $1 LIMIT 1`,
        [clientId]
    );
    if (rows.length === 0) return;
    const client = rows[0] as {
        email: string | null;
        phone: string | null;
        emails_extra: unknown;
        notes: unknown;
    };

    const primaryEmail = (client.email || '').trim().toLowerCase();
    const currentExtra: string[] = Array.isArray(client.emails_extra)
        ? (client.emails_extra as unknown[]).filter((e): e is string => typeof e === 'string')
        : [];
    type ClientNote = { text: string; date: string; author: string };
    const currentNotes: ClientNote[] = Array.isArray(client.notes)
        ? (client.notes as ClientNote[])
        : [];

    const newEmails: string[] = [];
    const newNotes: ClientNote[] = [];

    for (const c of contacts) {
        // Contra la FICHA, no solo contra el lead del chat: pueden diferir.
        if (!contactIsNovel(c, { email: client.email, phone: client.phone })) continue;

        const email = (c.email || '').trim();
        const emailLower = email.toLowerCase();
        const emailNovel =
            isRealEmail(email) &&
            emailLower !== primaryEmail &&
            !currentExtra.some(e => e.trim().toLowerCase() === emailLower) &&
            !newEmails.some(e => e.toLowerCase() === emailLower);
        const phoneDigits = normalizePhoneDigits(c.phone);
        const phoneNovel = phoneDigits.length >= 7 && !samePhone(c.phone, client.phone);

        if (emailNovel) newEmails.push(email);

        if (!emailNovel && !phoneNovel) continue;

        // Nota con el nombre del contacto adicional. Dedupe por contenido:
        // el contacto ya está registrado si alguna nota (vieja o recién
        // armada) menciona su correo Y su teléfono — exigir ambos permite que
        // un contacto anotado solo con correo se re-anote completo cuando
        // después aparece su teléfono.
        const alreadyNoted = [...currentNotes, ...newNotes].some(n => {
            const t = (n?.text || '').toLowerCase();
            const emailNoted = !email || t.includes(emailLower);
            const phoneNoted = !phoneDigits || normalizePhoneDigits(n?.text).includes(phoneDigits);
            return emailNoted && phoneNoted;
        });
        if (alreadyNoted) continue;

        const partes = [c.name, email, c.phone ? `tel ${c.phone}` : ''].filter(Boolean);
        newNotes.push({
            text: `Contacto adicional capturado por ConcreBOT en el chat: ${partes.join(' — ')}`,
            date: new Date().toISOString(),
            author: 'ConcreBOT',
        });
    }

    // Cada correo se agrega en su propia sentencia atómica: el `@>` evita
    // duplicarlo si otro guardado simultáneo ya lo metió, y el tope de
    // MAX_EXTRA_EMAILS se respeta contra el valor REAL de la fila (si la
    // lista está llena el correo no entra, pero la nota igual lo conserva).
    // Los ya presentes se filtraron arriba sin importar la caja.
    for (const email of newEmails) {
        await pool.query(
            `UPDATE crm_clients SET
               emails_extra = CASE
                 WHEN jsonb_array_length(COALESCE(emails_extra, '[]'::jsonb)) < $3
                  AND NOT (COALESCE(emails_extra, '[]'::jsonb) @> $2::jsonb)
                 THEN COALESCE(emails_extra, '[]'::jsonb) || $2::jsonb
                 ELSE emails_extra
               END,
               updated_at = NOW()
             WHERE id = $1`,
            [clientId, JSON.stringify([email]), MAX_EXTRA_EMAILS]
        );
    }

    if (newNotes.length > 0) {
        // PREPEND atómico — las nuevas primero, igual que "Guardar Nota".
        await pool.query(
            `UPDATE crm_clients SET
               notes = $2::jsonb || COALESCE(notes, '[]'::jsonb),
               updated_at = NOW()
             WHERE id = $1`,
            [clientId, JSON.stringify(newNotes)]
        );
    }
}
