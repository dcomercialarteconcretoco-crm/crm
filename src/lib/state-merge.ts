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
 *  - Registro entrante con id NUEVO → se agrega AL INICIO del arreglo (los
 *    consumidores renderizan el orden crudo y esperan lo nuevo arriba — las
 *    rutas públicas siempre habían prependeado).
 *  - Registro entrante con id conocido → upsert en su posición (el entrante
 *    gana, por registro).
 *  - Registro del server ausente del snapshot entrante → SE CONSERVA. Nada se
 *    borra por omisión; borrar exige un delete explícito (tombstone).
 *  - Al borrar una cotización, sus duplicados ocultos con el mismo
 *    quoteNumber (ids distintos, legado de dobles-creaciones) se tombstonean
 *    también — si no, el "borrado" resucitaría como su gemelo en el próximo
 *    GET (el cliente los colapsa por quoteNumber y solo ve uno).
 *  - Tombstones: cada id borrado queda anotado en la clave interna
 *    `__tombstones` con fecha. Un snapshot stale que todavía traiga ese
 *    registro NO lo resucita. TTL de 90 días para que la clave no crezca sin
 *    límite (los ids embeben epoch ms y jamás se reutilizan, así que expirar
 *    el tombstone es seguro).
 *  - Registros legacy sin id: si el snapshot entrante trae registros sin id
 *    (PUT del cliente con snapshot completo), gobiernan los del entrante; si
 *    el patch entrante NO trae ninguno (rutas server-side que upsertean un
 *    solo registro), los del server se conservan — así track-open y compañía
 *    no barren los registros legacy.
 *
 * LOCKS (orden fijo, sin mutex global):
 *  - Escrituras SIN deletes: bootstrap + FOR UPDATE de cada fila de clave en
 *    el orden de MERGED_STATE_KEYS; los tombstones se leen con SELECT plano
 *    DESPUÉS de tener los locks de clave (cualquier delete commiteado antes
 *    de nuestro lock es visible; uno posterior sobre la misma clave espera
 *    nuestro lock). Escritores de claves distintas corren en paralelo.
 *  - Escrituras CON deletes: FOR UPDATE de __tombstones PRIMERO (serializa a
 *    los deleters entre sí — dos deleters concurrentes no se pisan el mapa) y
 *    luego las claves en el mismo orden fijo. Un no-deleter nunca pide el
 *    lock de tombstones → no hay ciclo → no hay deadlock.
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
  // Los registros sin id del server solo se conservan cuando el entrante no
  // trae ninguno (patch de un solo registro de una ruta server-side). Si el
  // entrante SÍ trae (snapshot completo del cliente), gobiernan los suyos —
  // mantener ambos lados duplicaría los legacy en cada PUT.
  const incomingHasNoId = incomingArr.some((rec) => rec != null && !hasId(rec));

  const base: unknown[] = [];
  const indexById = new Map<string, number>();

  for (const rec of serverArr) {
    if (hasId(rec)) {
      if (tombstoned.has(rec.id) || indexById.has(rec.id)) continue;
      indexById.set(rec.id, base.length);
      base.push(rec);
    } else if (rec != null && !incomingHasNoId) {
      base.push(rec); // legacy sin id: preservado ante patches de un registro
    }
  }

  const fresh: unknown[] = [];
  for (const rec of incomingArr) {
    if (hasId(rec)) {
      if (tombstoned.has(rec.id)) continue; // el borrado explícito le gana al snapshot stale
      const at = indexById.get(rec.id);
      if (at !== undefined) {
        // El entrante gana por registro — misma política last-writer-wins de
        // antes, pero al nivel del registro y ya no del arreglo entero.
        base[at] = rec;
      } else {
        fresh.push(rec); // id nuevo → arriba, como prependeaban las rutas públicas
      }
    } else if (rec != null) {
      fresh.push(rec); // legacy sin id del snapshot entrante: passthrough
    }
  }

  return [...fresh, ...base];
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

const BOOTSTRAP_ROW_SQL = `
  INSERT INTO crm_state (key, value) VALUES ($1, $2::jsonb)
  ON CONFLICT (key) DO NOTHING
`;

const LOCK_ROW_SQL = `SELECT value FROM crm_state WHERE key = $1 FOR UPDATE`;

/** quoteNumber efectivo de un registro de cotización (para matar duplicados). */
function quoteNumberOf(rec: unknown): string {
  if (typeof rec !== "object" || rec === null) return "";
  const r = rec as { quoteNumber?: unknown; number?: unknown };
  const qn = (typeof r.quoteNumber === "string" && r.quoteNumber) ||
    (typeof r.number === "string" && r.number) || "";
  return qn.trim().toLowerCase();
}

/**
 * Upsert transaccional de registros en quotes/tasks + borrados explícitos.
 *
 * `patch` puede traer UN registro o el snapshot completo del cliente — da
 * igual: cada registro entrante se upsertea por id y el resto del arreglo del
 * server queda intacto. `deletes` anota tombstones y remueve esos ids (y para
 * quotes, también sus duplicados ocultos por quoteNumber).
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
  const hasDeletes = MERGED_STATE_KEYS.some((key) => (deletes[key]?.length ?? 0) > 0);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let tombstones: TombstoneMap | null = null;
    if (hasDeletes) {
      // Deleters: lock de __tombstones PRIMERO — dos deleters concurrentes no
      // pueden pisarse el mapa entre sí (last-write-wins perdería un borrado).
      await client.query(BOOTSTRAP_ROW_SQL, [TOMBSTONES_KEY, "{}"]);
      const tRes = await client.query(LOCK_ROW_SQL, [TOMBSTONES_KEY]);
      tombstones = pruneTombstones((tRes.rows[0]?.value ?? {}) as TombstoneMap);
      const nowIso = new Date().toISOString();
      for (const key of keys) {
        for (const id of deletes[key] ?? []) {
          if (typeof id !== "string" || !id) continue;
          (tombstones[key] ??= {})[id] = nowIso;
        }
      }
    }

    // Locks de clave en orden fijo (MERGED_STATE_KEYS) — bootstrap para que la
    // fila exista y el FOR UPDATE serialice de verdad a los escritores de la
    // misma clave (sobre fila inexistente no hay nada que lockear).
    const serverArrs: Partial<Record<MergedStateKey, unknown[]>> = {};
    for (const key of keys) {
      await client.query(BOOTSTRAP_ROW_SQL, [key, "[]"]);
      const cur = await client.query(LOCK_ROW_SQL, [key]);
      serverArrs[key] = Array.isArray(cur.rows[0]?.value) ? cur.rows[0].value : [];
    }

    if (!hasDeletes) {
      // No-deleters: lectura plana DESPUÉS de tener los locks de clave. Todo
      // delete commiteado antes de nuestro lock es visible acá; uno posterior
      // sobre nuestras claves espera a que commiteemos. No escribimos la fila
      // de tombstones → jamás pedimos su lock → sin deadlock con deleters.
      const tRes = await client.query(`SELECT value FROM crm_state WHERE key = $1`, [TOMBSTONES_KEY]);
      tombstones = pruneTombstones((tRes.rows[0]?.value ?? {}) as TombstoneMap);
    }

    // Duplicados ocultos de cotización: si borran un quote, tombstonear también
    // los registros con el MISMO quoteNumber e id distinto. El cliente colapsa
    // duplicados por quoteNumber y solo muestra uno — sin esto, borrar el
    // visible haría reaparecer al gemelo en el próximo GET.
    if (hasDeletes && (deletes.quotes?.length ?? 0) > 0 && serverArrs.quotes) {
      const nowIso = new Date().toISOString();
      const deletedIds = new Set(deletes.quotes);
      const numbers = new Set<string>();
      for (const rec of serverArrs.quotes) {
        if (hasId(rec) && deletedIds.has(rec.id)) {
          const qn = quoteNumberOf(rec);
          if (qn) numbers.add(qn);
        }
      }
      if (numbers.size > 0) {
        for (const rec of serverArrs.quotes) {
          if (hasId(rec) && !deletedIds.has(rec.id) && numbers.has(quoteNumberOf(rec))) {
            (tombstones!["quotes"] ??= {})[rec.id] = nowIso;
          }
        }
      }
    }

    for (const key of keys) {
      const incoming = Array.isArray(patch[key]) ? (patch[key] as unknown[]) : [];
      const dead = new Set(Object.keys(tombstones?.[key] ?? {}));
      const merged = mergeRecordsById(serverArrs[key] as unknown[], incoming, dead);
      await client.query(UPSERT_SQL, [key, JSON.stringify(merged)]);
    }

    if (hasDeletes) {
      await client.query(UPSERT_SQL, [TOMBSTONES_KEY, JSON.stringify(tombstones)]);
    }
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
 * Lanza si falla — los wipes deben ABORTAR sin este paso (sin tombstones, el
 * snapshot de cualquier sesión abierta desharía el wipe en su próximo save).
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
