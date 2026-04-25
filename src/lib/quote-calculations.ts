/**
 * quote-calculations.ts
 *
 * Único lugar donde se calcula el desglose económico de una cotización en el
 * modelo NUEVO (abril 2026). Tanto el formulario en pantalla como el PDF y
 * cualquier otro consumidor deben llamar `calculateQuoteTotals` para que los
 * números coincidan en todos lados — si esto se duplica, en una de las dos
 * copias eventualmente se va a colar un bug y los vendedores van a ver un
 * total en el formulario y otro distinto en el PDF que recibe el cliente.
 *
 * Reglas de negocio (de la conversación con Juan, 24 abr 2026):
 *
 *  - Los precios que vienen de WooCommerce YA INCLUYEN IVA del 19%. La
 *    columna del PDF dice "VALOR UNITARIO ANTES DE IVA", así que para
 *    mostrarlos hay que dividir entre 1.19 — pero el TOTAL final que paga el
 *    cliente sigue siendo el mismo, porque luego se vuelve a sumar el IVA.
 *
 *  - El monto del transporte que el vendedor escribe TAMBIÉN ya tiene IVA
 *    incluido. Misma división por 1.19 para mostrarlo en la tabla.
 *
 *  - Modo SIMPLE:
 *      VALOR TOTAL (antes IVA) = Σ(precio_woo / 1.19 × cant) + transporte/1.19
 *      IVA 19%                 = (anterior) × 0.19
 *      VALOR TOTAL final       = (anterior) + IVA
 *
 *  - Modo AIU (Administración + Utilidad):
 *      Subtotal               = Σ(precio_woo / 1.19 × cant)         (sin IVA)
 *      Administración X%      = Subtotal × X%
 *      Utilidad Y%            = Subtotal × Y%
 *      Subtotal acumulado     = Subtotal + Administración + Utilidad
 *      IVA 19%                = Utilidad × 0.19      ← SÓLO sobre utilidad
 *      VALOR TOTAL            = Subtotal acumulado + IVA
 *
 *    En AIU NO hay líneas de transporte/descargue/instalación — esos costos
 *    los absorbe el vendedor dentro del % de Administración cuando lo
 *    negocia con el cliente.
 */

export const VAT_RATE = 0.19;
export const VAT_DIVISOR = 1 + VAT_RATE; // 1.19

export type QuoteMode = "simple" | "aiu";

export interface QuoteCalcInput {
  mode: QuoteMode;
  /** Líneas de producto. Cada `unitPrice` viene de WooCommerce y trae IVA dentro. */
  items: Array<{ unitPrice: number; quantity: number }>;
  /** (simple) ¿La oferta cubre transporte? */
  includesTransport?: boolean;
  /** (simple) Monto del transporte escrito por el vendedor — ya con IVA. */
  transportAmount?: number;
  /** (aiu) Porcentaje 0–100. */
  adminPercent?: number;
  /** (aiu) Porcentaje 0–100. */
  utilityPercent?: number;
}

export interface QuoteCalcResult {
  mode: QuoteMode;
  /** Cada producto desglosado: precio unitario y total ANTES de IVA, listo para tabla. */
  items: Array<{
    unitPriceBeforeTax: number;
    quantity: number;
    lineTotalBeforeTax: number;
  }>;
  /** Línea de transporte (sólo modo simple, sólo si includesTransport=true). */
  transportBeforeTax?: number;
  /** Σ productos antes de IVA (no incluye transporte). */
  productsSubtotal: number;
  /** Productos + transporte (modo simple) ó productos + admin + util (modo aiu). */
  subtotalLine1: number;
  /** Sólo modo AIU: monto de la línea Administración. */
  adminAmount?: number;
  /** Sólo modo AIU: monto de la línea Utilidad. */
  utilityAmount?: number;
  /** Sólo modo AIU: subtotal acumulado (productos + admin + util) que va antes del IVA. */
  subtotalAfterAiu?: number;
  /** Línea de IVA. En modo simple es 19% de subtotalLine1. En AIU es 19% sólo de utilidad. */
  taxAmount: number;
  /** Total final que paga el cliente. */
  total: number;
}

const round = (n: number) => Math.round(n);

/** Quita el IVA del 19% que viene incluido en un precio de Woo o de transporte. */
export function stripTax(amountWithTax: number): number {
  return amountWithTax / VAT_DIVISOR;
}

export function calculateQuoteTotals(input: QuoteCalcInput): QuoteCalcResult {
  const items = (input.items || []).map((it) => {
    const unitBefore = stripTax(Number(it.unitPrice) || 0);
    const qty = Number(it.quantity) || 0;
    return {
      unitPriceBeforeTax: round(unitBefore),
      quantity: qty,
      lineTotalBeforeTax: round(unitBefore * qty),
    };
  });

  const productsSubtotal = items.reduce((acc, it) => acc + it.lineTotalBeforeTax, 0);

  if (input.mode === "aiu") {
    const adminPct = Math.max(0, Number(input.adminPercent) || 0) / 100;
    const utilPct = Math.max(0, Number(input.utilityPercent) || 0) / 100;
    const adminAmount = round(productsSubtotal * adminPct);
    const utilityAmount = round(productsSubtotal * utilPct);
    const subtotalAfterAiu = productsSubtotal + adminAmount + utilityAmount;
    // En AIU el IVA aplica SÓLO sobre la utilidad (régimen contractos asimilados
    // a obra — Estatuto Tributario). Eso es exactamente lo que hace que la
    // cotización resulte más barata para el cliente final que la sencilla.
    const taxAmount = round(utilityAmount * VAT_RATE);
    return {
      mode: "aiu",
      items,
      productsSubtotal,
      subtotalLine1: productsSubtotal,
      adminAmount,
      utilityAmount,
      subtotalAfterAiu,
      taxAmount,
      total: subtotalAfterAiu + taxAmount,
    };
  }

  // Modo simple
  const transportBeforeTax = input.includesTransport && input.transportAmount
    ? round(stripTax(Number(input.transportAmount) || 0))
    : undefined;

  const subtotalLine1 = productsSubtotal + (transportBeforeTax || 0);
  const taxAmount = round(subtotalLine1 * VAT_RATE);

  return {
    mode: "simple",
    items,
    transportBeforeTax,
    productsSubtotal,
    subtotalLine1,
    taxAmount,
    total: subtotalLine1 + taxAmount,
  };
}

/** Días por defecto de vigencia de una cotización nueva. */
export const DEFAULT_VALIDITY_DAYS = 30;

/** Suma `days` días a una fecha base (en formato ISO o Date) y devuelve fecha en es-CO. */
export function computeValidUntil(baseDate: string | Date, days: number): Date {
  const d = typeof baseDate === "string" ? new Date(baseDate) : new Date(baseDate);
  const out = new Date(d.getTime());
  out.setDate(out.getDate() + (days || DEFAULT_VALIDITY_DAYS));
  return out;
}

const SPANISH_MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Formato "24 de Mayo de 2026" — el que usa el PDF de referencia. */
export function formatSpanishLongDate(d: Date): string {
  return `${d.getDate()} de ${SPANISH_MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}

/**
 * Texto auto-generado para la fila de transporte de la cotización sencilla.
 * Origen siempre es Floridablanca (la fábrica de Arte Concreto).
 */
export function transportItemDescription(destinationCity: string): string {
  const dest = (destinationCity || "").trim().toUpperCase() || "DESTINO";
  return `TRANSPORTE DESDE FLORIDABLANCA HASTA ${dest} SIN DESCARGUE`;
}
