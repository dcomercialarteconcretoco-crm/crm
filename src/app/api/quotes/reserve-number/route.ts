import { NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";

/**
 * POST /api/quotes/reserve-number
 *
 * Atomically reads + increments `quoteNextNumber` en crm_state.settings y
 * devuelve el número reservado como string ART-XXX-YYYY. Es la fix DEFINITIVA
 * al race condition reportado el 13-may-2026 donde dos sesiones (Juan en
 * QuoteEngine + Lisseth en pipeline) leyeron el contador stale al mismo
 * tiempo, ambas auto-generaron ART-353, ambas guardaron, y el dedup-at-
 * hydration acabó tirando una de las dos a la basura.
 *
 * Lógica: una sola sentencia UPDATE con jsonb_set + RETURNING que cumple
 * propiedades ACID de Postgres por fila. Dos llamadas concurrentes se
 * serializan vía row-level lock implícito del UPDATE y reciben números
 * distintos garantizado.
 *
 * Fallback graceful: si la DB no está configurada o la fila settings no
 * existe, devolvemos un número basado en timestamp + status: 'fallback'.
 * El front debe igual proceder — perder la atomicidad en un edge case
 * es mejor que bloquear al vendedor de generar la cotización.
 */
export async function POST() {
  if (!hasDatabase()) {
    const fallback = Math.floor(Date.now() / 1000) % 100000;
    return NextResponse.json({
      quoteNumber: `ART-${fallback}-${new Date().getFullYear()}`,
      number: fallback,
      prefix: "ART",
      year: new Date().getFullYear(),
      status: "fallback-no-db",
    });
  }

  await ensureCrmSchema();
  const pool = getPool();

  // Atomic increment con RETURNING del nuevo valor. Si la fila settings
  // no existe todavía, la inicializamos con quoteNextNumber=300 + 1 = 301
  // y reservamos 300. Para filas existentes: jsonb_set incrementa en sitio.
  //
  // Coalesce sobre el valor numérico para casos donde quoteNextNumber sea
  // null/missing en el JSONB (settings nuevos sin esa key).
  const { rows } = await pool.query(`
    INSERT INTO crm_state (key, value, updated_at)
    VALUES ('settings', jsonb_build_object(
      'quotePrefix', 'ART',
      'quoteYear', ${new Date().getFullYear()},
      'quoteNextNumber', 301
    ), NOW())
    ON CONFLICT (key) DO UPDATE SET
      value = jsonb_set(
        crm_state.value,
        '{quoteNextNumber}',
        to_jsonb(COALESCE((crm_state.value->>'quoteNextNumber')::int, 300) + 1)
      ),
      updated_at = NOW()
    RETURNING
      COALESCE((value->>'quoteNextNumber')::int, 301) - 1 AS reserved,
      COALESCE(value->>'quotePrefix', 'ART') AS prefix,
      COALESCE((value->>'quoteYear')::int, EXTRACT(YEAR FROM NOW())::int) AS year
  `);

  const reserved: number = rows[0]?.reserved ?? 300;
  const prefix: string = rows[0]?.prefix ?? "ART";
  const year: number = rows[0]?.year ?? new Date().getFullYear();

  return NextResponse.json({
    quoteNumber: `${prefix}-${reserved}-${year}`,
    number: reserved,
    prefix,
    year,
    status: "ok",
  });
}
