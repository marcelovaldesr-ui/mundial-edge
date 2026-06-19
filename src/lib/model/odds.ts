import type { Odd, Outcome } from "../types";

// ─── Probabilidad implícita y corrección de overround ────────────

/** Probabilidad implícita "bruta" de una cuota decimal. */
export function impliedProbabilityRaw(decimalOdds: number): number {
  if (!decimalOdds || decimalOdds <= 1) return 0;
  return 1 / decimalOdds;
}

/**
 * Dado un conjunto de cuotas del MISMO mercado (ej. 1x2 home/draw/away),
 * calcula el overround (margen de la casa) y devuelve las probabilidades
 * implícitas normalizadas (suman 1), eliminando el margen.
 *
 * Método: normalización proporcional (simple y robusto para un MVP).
 */
export interface DevigResult {
  overround: number;                       // ej. 1.06 = 6% de margen
  probabilities: Record<string, number>;   // outcome -> prob ajustada
}

export function removeOverround(odds: Odd[]): DevigResult {
  const raw: Record<string, number> = {};
  let sum = 0;
  for (const o of odds) {
    const p = impliedProbabilityRaw(o.decimal_odds);
    raw[o.outcome] = p;
    sum += p;
  }
  const overround = sum;
  const probabilities: Record<string, number> = {};
  for (const k of Object.keys(raw)) {
    probabilities[k] = overround > 0 ? raw[k] / overround : 0;
  }
  return { overround, probabilities };
}

/** Agrupa cuotas por mercado para poder devigar cada mercado por separado. */
export function groupByMarket(odds: Odd[]): Record<string, Odd[]> {
  return odds.reduce<Record<string, Odd[]>>((acc, o) => {
    (acc[o.market] ??= []).push(o);
    return acc;
  }, {});
}

/**
 * Para un mercado dado, devuelve la probabilidad implícita ajustada de un
 * outcome. Si solo hay una cuota disponible (no se puede estimar overround),
 * cae a la implícita bruta.
 */
export function impliedProbabilityForOutcome(
  marketOdds: Odd[],
  outcome: Outcome
): number {
  if (marketOdds.length <= 1) {
    const single = marketOdds.find((o) => o.outcome === outcome);
    return single ? impliedProbabilityRaw(single.decimal_odds) : 0;
  }
  const { probabilities } = removeOverround(marketOdds);
  return probabilities[outcome] ?? 0;
}
