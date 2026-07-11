import { NextRequest, NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";
import {
  MERGED_STATE_KEYS,
  TOMBSTONES_KEY,
  mergeStateRecords,
  type MergedStateKey,
  type StateDeletes,
  type StatePatch,
} from "@/lib/state-merge";

type StateMap = Record<string, unknown>;

const DEFAULT_STATE: StateMap = {
  tasks: [],
  quotes: [],
  notifications: [],
  auditLogs: [],
  anomalies: [],
  events: [],
  forms: [],
  products: [],
  productSyncStatus: {
    lastResult: "idle",
    syncedCount: 0,
  },
  // settings vive en crm_state.key='settings' como JSONB. Tiene que aparecer
  // en DEFAULT_STATE para que el GET sin ?keys= lo incluya en `requestedKeys`
  // y por ende lo traiga de la DB. Sin esto, updateSettings persiste bien
  // (PUT funciona) pero el siguiente boot nunca lo lee — cada usuario arranca
  // con los defaults locales del cliente. Era el bug por el que las etapas
  // del pipeline configuradas por Valentina no se veían en otros navegadores.
  // null como default = "no hay settings persistidos" (el AppContext deja
  // los defaults locales sin sobreescribir nada).
  settings: null,
};

export async function GET(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ ...DEFAULT_STATE, persistence: "local" });
  }

  await ensureCrmSchema();
  const pool = getPool();
  const keys = (req.nextUrl.searchParams.get("keys") || "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  const requestedKeys = keys.length > 0 ? keys : Object.keys(DEFAULT_STATE);

  const { rows } = await pool.query(
    `SELECT key, value FROM crm_state WHERE key = ANY($1::text[])`,
    [requestedKeys]
  );

  const rowMap = new Map(rows.map((row) => [row.key, row.value]));
  const payload = requestedKeys.reduce<StateMap>((acc, key) => {
    acc[key] = rowMap.has(key) ? rowMap.get(key) : DEFAULT_STATE[key] ?? null;
    return acc;
  }, {});

  return NextResponse.json({ ...payload, persistence: "postgres" });
}

export async function PUT(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json(
      { error: "Base de datos no configurada." },
      { status: 503 }
    );
  }

  const body = (await req.json()) as StateMap;

  // ── Borrados explícitos ───────────────────────────────────────────────────
  // quotes/tasks se guardan con merge-por-id (ver src/lib/state-merge.ts), así
  // que "mandar el arreglo sin el registro" ya NO borra nada — ese era justo
  // el mecanismo por el que un snapshot stale de otra sesión perdía
  // cotizaciones (caso ART-519-2026). El cliente declara los borrados en
  // `__deletes: { quotes: [ids], tasks: [ids] }` y acá se vuelven tombstones.
  const rawDeletes = body["__deletes"] as Record<string, unknown> | undefined;
  delete body["__deletes"];
  // La clave interna de tombstones jamás es escribible desde el cliente.
  delete body[TOMBSTONES_KEY];

  const deletes: StateDeletes = {};
  if (rawDeletes && typeof rawDeletes === "object") {
    for (const key of MERGED_STATE_KEYS) {
      const ids = rawDeletes[key];
      if (Array.isArray(ids)) {
        const clean = ids.filter(
          (id): id is string => typeof id === "string" && id.length > 0
        );
        if (clean.length > 0) deletes[key] = clean;
      }
    }
  }

  const mergedPatch: StatePatch = {};
  const plainEntries: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    if ((MERGED_STATE_KEYS as readonly string[]).includes(key)) {
      // Un valor no-arreglo en quotes/tasks sería un cliente corrupto: se
      // ignora en vez de dejarlo pisar el arreglo completo.
      if (Array.isArray(value)) {
        mergedPatch[key as MergedStateKey] = value;
      } else {
        console.error(
          `[state] PUT ignoró la clave "${key}": se esperaba un arreglo, llegó ${typeof value}`
        );
      }
      continue;
    }
    plainEntries.push([key, value]);
  }

  const hasMergeWork =
    Object.keys(mergedPatch).length > 0 || Object.keys(deletes).length > 0;
  if (plainEntries.length === 0 && !hasMergeWork) {
    return NextResponse.json({ ok: true });
  }

  await ensureCrmSchema();
  const pool = getPool();

  if (hasMergeWork) {
    await mergeStateRecords(pool, mergedPatch, deletes);
  }

  // Las demás claves (settings, notifications, events, …) conservan el
  // reemplazo total de siempre.
  for (const [key, value] of plainEntries) {
    await pool.query(
      `
        INSERT INTO crm_state (key, value, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            updated_at = NOW()
      `,
      [key, JSON.stringify(value)]
    );
  }

  return NextResponse.json({ ok: true });
}
