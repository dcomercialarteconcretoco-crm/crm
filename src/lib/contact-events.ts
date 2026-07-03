// Registro fire-and-forget de contactos reales con clientes.
//
// Cada vez que un asesor hace click en WhatsApp/llamar/correo o guarda una
// anotación, esto inserta una fila en crm_contact_events (tabla append-only
// en Postgres). Es la fuente de verdad para medir tiempo de 1ª/2ª/3ª
// respuesta en la Auditoría de Gestión — a diferencia del auditLog en
// crm_state, que no retiene historial.
//
// Fire-and-forget a propósito: registrar el contacto nunca debe bloquear ni
// romper la acción del usuario (abrir WhatsApp, marcar, etc.).

export type ContactEventType = 'whatsapp' | 'call' | 'email' | 'note';

export function logContactEvent(clientId: string, type: ContactEventType, detail?: string) {
    if (!clientId) return;
    try {
        fetch('/api/contact-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, type, detail }),
            keepalive: true,
        }).catch(() => { /* sin conexión: la acción del usuario sigue */ });
    } catch {
        /* SSR o entorno sin fetch: ignorar */
    }
}
