// Dedupe de negocios del pipeline por contacto (email → clientId → id).
//
// Extraído VERBATIM de src/app/pipeline/page.tsx (ago-2026) para que el
// dashboard pueda contar "propuestas activas" con la misma regla con la que
// el tablero pinta tarjetas — antes cada vista deduplicaba (o no) por su
// cuenta y los conteos no cuadraban entre sí.
//
// Semántica: agrupa por la llave del contacto, se queda con la task de mayor
// valor como base y SUMA los montos del resto (por eso el dedupe no cambia el
// total del kanban, solo el número de tarjetas). Las actividades se fusionan
// ordenadas por fecha.

import type { Task } from '@/context/AppContext';

export function dedupPipelineTasks(colTasks: Task[]): Task[] {
    const seen = new Map<string, Task>();
    const sorted = [...colTasks].sort((a, b) => (b.numericValue || 0) - (a.numericValue || 0));
    for (const t of sorted) {
        // email/clientId no están declarados en Task pero las tasks reales los
        // traen — mismo acceso que hacía el tablero, solo que tipado.
        const rec = t as Task & { email?: string; clientId?: string };
        const key = rec.email?.toLowerCase().trim() || rec.clientId || t.id;
        if (!seen.has(key)) {
            seen.set(key, { ...t });
        } else {
            const existing = seen.get(key)!;
            const combined = (existing.numericValue || 0) + (t.numericValue || 0);
            seen.set(key, {
                ...existing,
                numericValue: combined,
                value: `$ ${combined.toLocaleString('es-CO')}`,
                activities: [
                    ...(existing.activities || []),
                    ...(t.activities || []),
                ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
            });
        }
    }
    return Array.from(seen.values());
}
