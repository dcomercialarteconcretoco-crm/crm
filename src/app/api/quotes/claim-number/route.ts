import { NextRequest, NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";

/**
 * POST /api/quotes/claim-number  { number: "ART-650-2026" }
 *
 * Marca como consumido un número usado por FUERA del consecutivo (override
 * manual al crear o renombrado posterior de una cotización): sube
 * quoteNextNumber a GREATEST(actual, n+1) cuando el número pertenece a la
 * serie vigente (mismo prefijo y año de settings).
 *
 * Por qué existe: si un vendedor fija a mano ART-650 mientras el contador va
 * en 612, el día que el consecutivo llegue a 650 lo entregaría de nuevo — y
 * el dedup de addQuote haría merge sobre la cotización existente, pisando en
 * silencio un registro ya enviado (clase de incidente ART-571, jul-2026).
 *
 * Números fuera de la serie vigente (otro prefijo u otro año) no mueven el
 * contador: responden { claimed: false } y no pasa nada — el consecutivo
 * nunca los va a generar.
 *
 * GREATEST hace la operación idempotente y monótona: llamadas repetidas o
 * tardías jamás bajan el contador.
 */
export async function POST(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ ok: true, claimed: false, status: "no-db" });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const raw = String(body?.number ?? "").trim().toUpperCase();
  if (!raw) {
    return NextResponse.json({ error: "number requerido" }, { status: 400 });
  }

  await ensureCrmSchema();
  const pool = getPool();

  const { rows: settingsRows } = await pool.query(
    `SELECT value FROM crm_state WHERE key = 'settings'`
  );
  const settings = settingsRows[0]?.value || {};
  const prefix = String(settings.quotePrefix || "ART").toUpperCase();
  const year = Number(settings.quoteYear) || new Date().getFullYear();

  // Parse sin regex dinámico: "PREFIX-<n>-<year>" de la serie vigente, o un
  // entero pelado que se interpreta como n directo.
  let n: number | null = null;
  if (/^\d+$/.test(raw)) {
    n = Number(raw);
  } else if (raw.startsWith(`${prefix}-`) && raw.endsWith(`-${year}`)) {
    const middle = raw.slice(prefix.length + 1, raw.length - String(year).length - 1);
    if (/^\d+$/.test(middle)) n = Number(middle);
  }

  if (n === null || !Number.isFinite(n) || n <= 0) {
    return NextResponse.json({ ok: true, claimed: false, reason: "fuera-de-serie" });
  }

  const { rows } = await pool.query(
    `UPDATE crm_state
        SET value = jsonb_set(
              value,
              '{quoteNextNumber}',
              to_jsonb(GREATEST(COALESCE((value->>'quoteNextNumber')::int, 300), $1::int + 1))
            ),
            updated_at = NOW()
      WHERE key = 'settings'
      RETURNING (value->>'quoteNextNumber')::int AS next`,
    [n]
  );

  // Sin fila settings todavía: no hay contador que proteger — la primera
  // reserva la crea (ver reserve-number) y nunca entregará números viejos.
  const next: number | null = rows[0]?.next ?? null;
  return NextResponse.json({ ok: true, claimed: next !== null, nextNumber: next });
}
