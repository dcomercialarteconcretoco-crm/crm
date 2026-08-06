// Correos de cliente: helpers compartidos entre UI y API (sin "use client"
// para que los routes puedan importarlos).
//
// Desde ago-2026 un cliente puede tener correos ADICIONALES al principal
// (reunión 6-ago-2026: "se necesita agregar más de un correo electrónico").
// El principal (`Client.email`) sigue siendo la identidad del contacto — es
// la llave de matching del bot, del dedupe del pipeline y de la ficha — y por
// eso los adicionales viven aparte (`Client.extraEmails` / columna
// `emails_extra`) y solo participan como CC en los envíos.

/**
 * Correos sintéticos de importación masiva (`algo@placeholder.local`).
 * Se inventaron para importar contactos sin correo real; jamás deben
 * recibir un envío ni contar como correo adicional.
 */
export function isPlaceholderEmail(email?: string | null): boolean {
    return /@placeholder\.local$/i.test((email || '').trim());
}

/** Correo con pinta de real: pasa el regex mínimo y no es placeholder. */
export function isRealEmail(email?: string | null): boolean {
    const e = (email || '').trim();
    return /.+@.+\..+/.test(e) && !isPlaceholderEmail(e);
}

/** Tope de correos adicionales por cliente — suficiente para comprador +
 *  asistente + jefe; evita que un import masivo meta listas enteras. */
export const MAX_EXTRA_EMAILS = 5;

/**
 * Sanea la lista de correos adicionales para persistir o para armar el CC:
 * trim, filtra los que no son reales, dedupe case-insensitive, excluye el
 * principal y corta en MAX_EXTRA_EMAILS. Acepta `unknown` porque el payload
 * puede venir de cualquier caller (form, import, API externa).
 */
export function sanitizeExtraEmails(raw: unknown, primary?: string | null): string[] {
    if (!Array.isArray(raw)) return [];
    const primaryLower = (primary || '').trim().toLowerCase();
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of raw) {
        if (typeof item !== 'string') continue;
        const email = item.trim();
        if (!isRealEmail(email)) continue;
        const lower = email.toLowerCase();
        if (lower === primaryLower || seen.has(lower)) continue;
        seen.add(lower);
        out.push(email);
        if (out.length >= MAX_EXTRA_EMAILS) break;
    }
    return out;
}
