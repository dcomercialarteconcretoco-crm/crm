import type { Pool } from 'pg';

/**
 * Devuelve a la bandeja cruda los leads que quedaron ASIGNADOS pero nunca se
 * contactaron (status='assigned'). Es la "limpieza de cierre del día" del flujo
 * de Valentina: cada mañana se reparten ~10 leads por asesor y, al terminar el
 * día, los que el asesor NO alcanzó a trabajar vuelven al pool para que no
 * queden acaparados — al día siguiente se reparten de nuevo.
 *
 * Qué toca y qué NO:
 *   - status='assigned'  → se libera: vuelve a 'new', se borra assigned_to /
 *                          assigned_to_name / assigned_at.
 *   - status='contacted' → NO se toca. El asesor sí tuvo contacto real, conserva
 *                          la asignación para seguir el seguimiento.
 *   - 'approved' / 'discarded' → NO se tocan (ya salieron del flujo activo).
 *
 * Idempotente: si no hay nada en 'assigned', no hace nada. Devuelve cuántos
 * leads liberó.
 *
 * @param sellerId  Si se pasa, libera SOLO los de ese vendedor (botón "devolver
 *                  los de Fulano"). Sin él, libera los de todo el equipo (cierre
 *                  del día global, que es lo que dispara el cron).
 */
export async function releaseUnworkedAssignedLeads(pool: Pool, sellerId?: string): Promise<number> {
    const params: string[] = [];
    let where = `status = 'assigned'`;
    if (sellerId) {
        params.push(sellerId);
        where += ` AND assigned_to = $1`;
    }
    const res = await pool.query(
        `UPDATE crm_raw_leads
            SET status = 'new',
                assigned_to = NULL,
                assigned_to_name = NULL,
                assigned_at = NULL,
                updated_at = NOW()
          WHERE ${where}`,
        params
    );
    return res.rowCount ?? 0;
}
