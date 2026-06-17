import type { ValueTier } from "@/lib/types";

// ─── Cálculo de edge, valor esperado y clasificación ─────────────

/** implied_probability = 1 / decimal_odds (sin ajuste). */
export const impliedProbability = (decimalOdds: number): number =>
  decimalOdds > 1 ? 1 / decimalOdds : 0;

/** edge = probabilidad del modelo - probabilidad implícita. */
export const edge = (modelProb: number, impliedProb: number): number =>
  modelProb - impliedProb;

/** expected_value = model_probability * decimal_odds - 1  (apuesta a 1 unidad). */
export const expectedValue = (modelProb: number, decimalOdds: number): number =>
  modelProb * decimalOdds - 1;

/**
 * Clasifica por valor esperado (EV expresado como fracción).
 *   EV < 0           -> no_bet      (No apostar)
 *   0%  .. 3%        -> no_value    (Sin valor suficiente)
 *   3%  .. 8%        -> low         (Valor bajo)
 *   8%  .. 15%       -> medium      (Valor medio)
 *   > 15%            -> high        (Valor alto, con advertencia)
 */
export function classifyEv(ev: number): ValueTier {
  if (ev < 0) return "no_bet";
  if (ev < 0.03) return "no_value";
  if (ev < 0.08) return "low";
  if (ev < 0.15) return "medium";
  return "high";
}

export const TIER_META: Record<
  ValueTier,
  { label: string; description: string; color: string; warn: boolean }
> = {
  no_bet:   { label: "No apostar",          description: "EV negativo: la cuota no compensa el riesgo.", color: "danger",  warn: false },
  no_value: { label: "Sin valor suficiente", description: "Valor marginal dentro del margen de error.",  color: "muted",   warn: false },
  low:      { label: "Valor bajo",          description: "Ligera ventaja estadística estimada.",         color: "primary", warn: false },
  medium:   { label: "Valor medio",         description: "Ventaja estimada moderada.",                   color: "success", warn: false },
  high:     { label: "Valor alto",          description: "Ventaja alta estimada — posible señal de datos atípicos. Verificar.", color: "warning", warn: true },
};
