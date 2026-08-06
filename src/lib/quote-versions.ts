// Versionado de cotizaciones: helpers puros para agrupar V1/V2/AIU de una
// misma negociación. SIN "use client" a propósito — lo consumen tanto páginas
// client (dashboard, /quotes, asistente) como routes server (auditoría).
//
// El único enlace entre versiones es la raíz del número (`baseNumber`, con
// fallback al número mismo): no existe parentId. `formatQuoteNumber` mete el
// sufijo -V{n} ANTES del año (ART-250-V1-2026) y el -AIU al final, y una
// cotización vieja sin baseNumber pudo heredar "ART-250-V1-2026" como base —
// por eso la raíz se normaliza quitando esos sufijos.

export interface VersionedQuoteLike {
    id?: string;
    baseNumber?: string;
    quoteNumber?: string;
    number?: string;
    version?: number;
}

/** Raíz de la negociación: baseNumber → quoteNumber → number → id. */
export function quoteRootKey(q: VersionedQuoteLike): string {
    const raw = (q.baseNumber || q.quoteNumber || q.number || '').trim().toUpperCase();
    if (!raw) return q.id || '';
    return raw
        .replace(/-AIU$/i, '')
        .replace(/-V\d+(?=-\d{4}$)/i, '')   // "ART-250-V1-2026" → "ART-250-2026"
        .replace(/-V\d+$/i, '');            // sin año: "ART-250-V1" → "ART-250"
}

/** ¿b es una versión más nueva que a? version mayor gana; empate → id mayor
 *  (los ids embeben epoch `q-<ms>`, así que "mayor" ≈ "más reciente"). */
function isNewer(a: VersionedQuoteLike, b: VersionedQuoteLike): boolean {
    const va = a.version || 1;
    const vb = b.version || 1;
    if (vb !== va) return vb > va;
    return String(b.id || '') > String(a.id || '');
}

/**
 * Colapsa el arreglo a la última versión de cada raíz, conservando el orden
 * de aparición de la primera versión vista. Números custom que no matchean
 * los sufijos quedan cada uno como su propia raíz (no agrupa lo que no debe).
 */
export function latestVersionOnly<T extends VersionedQuoteLike>(quotes: T[]): T[] {
    const byRoot = new Map<string, T>();
    const order: string[] = [];
    for (const q of quotes) {
        const key = quoteRootKey(q);
        const prev = byRoot.get(key);
        if (!prev) {
            byRoot.set(key, q);
            order.push(key);
        } else if (isNewer(prev, q)) {
            byRoot.set(key, q);
        }
    }
    return order.map(k => byRoot.get(k)!);
}

/** Grupos por raíz para la vista expandible de /quotes:
 *  latest + anteriores (desc por versión). */
export function groupQuoteVersions<T extends VersionedQuoteLike>(
    quotes: T[]
): Map<string, { root: string; latest: T; older: T[] }> {
    const groups = new Map<string, { root: string; latest: T; older: T[] }>();
    for (const q of quotes) {
        const key = quoteRootKey(q);
        const g = groups.get(key);
        if (!g) {
            groups.set(key, { root: key, latest: q, older: [] });
        } else if (isNewer(g.latest, q)) {
            g.older.push(g.latest);
            g.latest = q;
        } else {
            g.older.push(q);
        }
    }
    for (const g of groups.values()) {
        g.older.sort((a, b) => (isNewer(a, b) ? 1 : -1));
    }
    return groups;
}
