import type { Pool } from 'pg';

/**
 * Compatibilidad para el flujo anterior de "liberar" leads crudos al cierre
 * del día. El cliente pidió que los leads asignados NO desaparezcan del listado
 * si no alcanzaron a contactarlos ese día, así que esta operación ya no muta
 * filas. Se conserva para que el cron/botones legacy no fallen.
 */
export async function releaseUnworkedAssignedLeads(pool: Pool, sellerId?: string): Promise<number> {
    void pool;
    void sellerId;
    return 0;
}
