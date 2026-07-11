import type { Pool } from "pg";

/**
 * Merge-por-id para las claves de crm_state que guardan arreglos de registros
 * de negocio ({ id: string, ... }): hoy `quotes` y `tasks`.
 *
 * POR QUÉ EXISTE (caso ART-519-2026, 10-jul-2026): el PUT de /api/state
 * reemplazaba el arreglo COMPLETO de cada clave con el snapshot que mandara el
 * navegador (last-writer-wins), y 7 rutas server-side hacían el mismo
 * lee-modifica-reescribe sin transacción. Con dos sesiones trabajando a la
 * vez, la que tuviera el arreglo desactualizado pisaba y borraba cotizaciones
 * recién creadas por la otra — la task del pipeline sobrevivía (vive en otra
 * clave) pero la cotización desaparecía: negocio visible en el kanban,
 * imposible de editar en /quotes.
 *
 * SEMÁNTICA:
 *  - Registro entrante con id  → upsert (el entrante gana, por registro).
 *  - Registro del server ausente del snapshot entrante → SE CONSERVA. Nada se
 *    borra por omisión; borrar exige un delete explícito (tombstone).
 *  - Tombstones: cada id borrado queda anotado en la clave interna
 *    `__tombstones` con fecha. Un snapshot stale que todavía traiga ese
 *    registro NO lo resucita. TTL de 90 días para que la clave no crezca sin
 *    límite (los ids embeben epoch ms y jamás se reutilizan, así que expirar
 *    el tombstone es seguro).
 *  - Registros legacy sin id: no son identificables — se conservan solo los
 *    que traiga el snapshot entrante (mismo efecto neto que el replace viejo).
 *  - Todo corre en UNA transacción que lockea (FOR UPDATE) la fila de
 *    tombstones PRIMERO y las claves después, siempre en el mismo orden:
 *    serializa a los escritores concurrentes entre sí y evita deadlocks.
 */

export const MERGED_STATE_KEYS = ["quotes", "tasks"] as const;
export type MergedStateKey = (typeof MERGED_STATE_KEYS)[number];

export const TOMBSTONES_KEY = "__tombstones";
const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type StatePatch = Partial<Record<MergedStateKey, unknown[]>>;
export type StateDeletes = Partial<Record<MergedStateKey, string[]>>;

type TombstoneMap = Record<string, Record<string, string>>;

function hasId(rec: unknown): rec is { id: string } {
  return (
    typeof rec === "object" &&
    rec !== null &&
    typeof (rec as { id?: unknown }).id === "string" &&
    (rec as { id: string }).id.length > 0
  );
}

export function mergeRecordsById(
  serverArr: unknown[],
  incomingArr: unknown[],
  tombstoned: Set<string>
): unknown[] {
  const out: unknown[] = [];
  const indexById = new Map<string, number>();

  for (const rec of serverArr) {
    if (!hasId(rec)) continue; // sin id no es identificable; los aporta el snapshot entrante
    if (tombstoned.has(rec.id) || indexById.has(rec.id)) continue;
    indexById.set(rec.id, out.length);
    out.push(rec);
  }

  for (const rec of incomingArr) {
    if (hasId(rec)) {
      if (tombstoned.has(rec.id)) continue; // el borrado explícito le gana al snapshot stale
      const at = indexById.get(rec.id);
      if (at !== undefined) {
        // El entrante gana por registro — misma política last-writer-wins de
        // antes, pero al nivel del registro y ya no del arreglo entero.
        out[at] = rec;
      } else {
        indexById.set(rec.id, out.length);
        out.push(rec);
      }
    } else if (rec !== null && rec !== undefined) {
      out.push(rec); // legacy sin id: passthrough del snapshot
    }
  }

  return out;
}

function pruneTombstones(tombstones: TombstoneMap): TombstoneMap {
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  const next: TombstoneMap = {};
  for (const [key, ids] of Object.entries(tombstones || {})) {
    for (const [id, iso] of Object.entries(ids || {})) {
      const t = Date.parse(iso);
      if (!Number.isNaN(t) && t < cutoff) continue; // fecha ilegible = conservar
      (next[key] ??= {})[id] = iso;
    }
  }
  return next;
}

const UPSERT_SQL = `
  INSERT INTO crm_state (key, value, updated_at)
  VALUES ($1, $2::jsonb, NOW())
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = NOW()
`;

/**
 * Upsert transaccional de registros en quotes/tasks + borrados explícitos.
 *
 * `patch` puede traer UN registro o el snapshot completo del cliente — da
 * igual: cada registro entrante se upsertea por id y el resto del arreglo del
 * server queda intacto. `deletes` anota tombstones y remueve esos ids.
 */
export async function mergeStateRecords(
  pool: Pool,
  patch: StatePatch,
  deletes: StateDeletes = {}
): Promise<void> {
  const keys = MERGED_STATE_KEYS.filter(
    (key) => Array.isArray(patch[key]) || (deletes[key]?.length ?? 0) > 0
  );
  if (keys.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock de la fila de tombstones PRIMERO, siempre — orden de locks fijo.
    await client.query(
      `INSERT INTO crm_state (key, value) VALUES ($1, '{}'::jsonb) ON CONFLICT (key) DO NOTHING`,
      [TOMBSTONES_KEY]
    );
    const tRes = await client.query(
      `SELECT value FROM crm_state WHERE key = $1 FOR UPDATE`,
      [TOMBSTONES_KEY]
    );
    const tombstones = pruneTombstones((tRes.rows[0]?.value ?? {}) as TombstoneMap);

    const nowIso = new Date().toISOString();
    for (const key of keys) {
      for (const id of deletes[key] ?? []) {
        if (typeof id !== "string" || !id) continue;
        (tombstones[key] ??= {})[id] = nowIso;
      }
    }

    // MERGED_STATE_KEYS ya está en orden fijo → mismo orden de lock siempre.
    for (const key of keys) {
      const cur = await client.query(
        `SELECT value FROM crm_state WHERE key = $1 FOR UPDATE`,
        [key]
      );
      const serverArr: unknown[] = Array.isArray(cur.rows[0]?.value) ? cur.rows[0].value : [];
      const incoming = Array.isArray(patch[key]) ? (patch[key] as unknown[]) : [];
      const dead = new Set(Object.keys(tombstones[key] ?? {}));
      const merged = mergeRecordsById(serverArr, incoming, dead);
      await client.query(UPSERT_SQL, [key, JSON.stringify(merged)]);
    }

    await client.query(UPSERT_SQL, [TOMBSTONES_KEY, JSON.stringify(tombstones)]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Tombstonea TODOS los ids presentes hoy en las claves indicadas (paso previo
 * de los wipes admin). Después de esto ningún snapshot stale puede resucitar
 * los registros barridos; los creados después del wipe no se ven afectados.
 */
export async function tombstoneAllCurrentIds(
  pool: Pool,
  keys: MergedStateKey[]
): Promise<void> {
  const { rows } = await pool.query(
    `SELECT key, value FROM crm_state WHERE key = ANY($1::text[])`,
    [keys]
  );
  const deletes: StateDeletes = {};
  for (const row of rows) {
    if (!Array.isArray(row.value)) continue;
    const ids = (row.value as unknown[])
      .map((rec) => (hasId(rec) ? rec.id : null))
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    if (ids.length > 0) deletes[row.key as MergedStateKey] = ids;
  }
  await mergeStateRecords(pool, {}, deletes);
}
