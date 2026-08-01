/**
 * Estados de una cotización — definición ÚNICA para todo el CRM.
 *
 * Incidente 31-jul-2026 (ART-571-2026): el flujo de aprobación reutilizaba
 * `Approved` para dos cosas distintas —"el SuperAdmin autorizó pero el correo
 * al cliente rebotó" y "el cliente aceptó, negocio ganado"—. Como todos los
 * tableros miden ventas cerradas con `status === 'Approved'`, una cotización
 * que NUNCA salió apareció en el historial como "Aprobada (ganada)" y sumó
 * $22.755.500 al total ganado del mes.
 *
 * Desde entonces:
 *   - `Approved`             = cierre comercial. El cliente aceptó. Es GANADA.
 *   - `ApprovedPendingSend`  = autorizada por el SuperAdmin, pero el correo no
 *                              salió. No es venta: no suma a ganado, no mueve
 *                              el negocio a la etapa ganadora del pipeline.
 *
 * Cualquier métrica de "ganado" debe pasar por `isWonQuote` — nunca comparar
 * contra el string suelto.
 */

export type QuoteStatus =
    | 'Draft'
    | 'PendingApproval'
    | 'PENDING_APPROVAL'
    | 'ChangesRequested'
    | 'ApprovedPendingSend'
    | 'Approved'
    | 'Sent'
    | 'Rejected'
    | 'Expired';

/** Etiqueta en español para mostrar al usuario. */
export const QUOTE_STATUS_LABEL: Record<string, string> = {
    Draft:              'Borrador',
    PendingApproval:    'Por aprobar',
    PENDING_APPROVAL:   'Por aprobar',
    ChangesRequested:   'Cambios pedidos',
    ApprovedPendingSend:'Aprobada · falta enviar',
    Approved:           'Ganada',
    Sent:               'Enviada',
    Rejected:           'Perdida',
    Expired:            'Vencida',
};

export function quoteStatusLabel(status: string | undefined): string {
    if (!status) return 'Borrador';
    return QUOTE_STATUS_LABEL[status] || status;
}

type QuoteLike = { status?: string; deliveryFailed?: boolean };

/** ¿Esta cotización cuenta como venta ganada? */
export function isWonQuote(q: QuoteLike | undefined | null): boolean {
    return !!q && q.status === 'Approved';
}

/** ¿Quedó autorizada pero sin llegarle al cliente? */
export function isPendingSendQuote(q: QuoteLike | undefined | null): boolean {
    return !!q && q.status === 'ApprovedPendingSend';
}

/**
 * Reinterpreta las cotizaciones guardadas ANTES de que existiera
 * `ApprovedPendingSend`: las que quedaron en `Approved` con el envío fallido
 * eran, en realidad, aprobaciones sin enviar. Se aplica al hidratar para que
 * los tableros dejen de contarlas como ganadas sin necesidad de migrar la
 * base; el registro se corrige solo en el siguiente guardado.
 */
export function normalizeQuoteStatus<T extends QuoteLike>(quote: T): T {
    if (quote.status === 'Approved' && quote.deliveryFailed === true) {
        return { ...quote, status: 'ApprovedPendingSend' };
    }
    return quote;
}
