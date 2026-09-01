/**
 * Motor de etapas del pipeline v4 — compartido por el kanban de escritorio
 * (src/app/pipeline/page.tsx) y la vista móvil (src/app/m/pipeline/page.tsx).
 *
 * Las etapas activas viven en `settings.pipelineStages` (fallback:
 * DEFAULT_PIPELINE_STAGES en AppContext). Los stageId persistidos pueden
 * venir de versiones anteriores del CRM — resolveStageId los traduce al id
 * vigente para que toda vista los ubique en la misma columna.
 */

export type StageId = string;

/**
 * Mapea stage IDs legacy al modelo actual. Las legacy `lead` y `lost` se
 * convierten en cadena vacía: el código de filtro las descarta y la tarjeta
 * no aparece en el kanban (la cotización Rejected sigue existiendo en la
 * ficha del cliente, pero no como columna).
 *
 * Incluye los ids del CRM v1 (lead/contacted/qualified/…) y los que la vista
 * móvil escribió mientras usó su propia lista hardcodeada (negotiation,
 * closed_won, closed_lost) — sin estas entradas, un negocio movido desde el
 * celular desaparecía de las columnas del escritorio.
 */
export const LEGACY_STAGE_MAP: Record<string, StageId> = {
    lead:        '',          // no aparece en pipeline
    // `stage-1` lo escribía SOLO /api/conversations al capturar un lead del
    // widget ConcreBOT. Nunca existió como columna en ninguna configuración,
    // así que esos negocios nacían fuera del tablero: 36 leads del bot entre
    // abr y ago-2026, cero visibles, y el cliente concluyendo que la pauta no
    // servía. La ruta ya no lo escribe (usa la primera etapa configurada);
    // esta entrada rescata los que quedaron guardados.
    'stage-1':   'cotizado',
    contacted:   'cotizado',
    qualified:   'caliente',
    proposal:    'cotizado',
    sent:        'cotizado',
    opened:      'caliente',
    followup:    'caliente',
    negotiation: 'caliente',
    won:         'facturado',
    closed_won:  'facturado',
    lost:        '',          // no aparece en pipeline
    closed_lost: '',          // no aparece en pipeline
};

/** Convierte un stageId persistido (legacy o nuevo) al equivalente actual. */
export function resolveStageId(raw: string | undefined): StageId {
    if (!raw) return '';
    if (LEGACY_STAGE_MAP[raw] !== undefined) return LEGACY_STAGE_MAP[raw];
    return raw;
}
