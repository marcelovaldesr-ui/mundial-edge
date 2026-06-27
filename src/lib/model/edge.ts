import type { ValueTier } from "../types";

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

// ─── Modo tipster: anclaje al mercado y filtros de calidad ───────
// El mercado del Mundial es muy eficiente y el modelo aún tiene poca
// muestra, así que la probabilidad "justa" se ancla fuerte al mercado
// (de-vig) y solo se desvía un poco según el modelo. Esto evita el
// clásico falso "valor" en longshots (p. ej. Argelia vs Argentina).
export const MARKET_WEIGHT = 0.78; // peso del mercado; (1 - peso) = modelo

/** Probabilidad "justa" = mezcla de mercado (de-vig) y modelo. */
export const blendedProbability = (marketProb: number, modelProb: number): number =>
  MARKET_WEIGHT * marketProb + (1 - MARKET_WEIGHT) * modelProb;

// Guardarraíles de un pick "publicable" (lo que mostraría un tipster).
export const PICK_RULES = {
  minOdds: 1.4,        // evita favoritos sin recorrido
  maxOdds: 6.0,        // evita longshots donde el modelo es poco fiable
  minEv: 0.02,         // 2% mínimo para considerar valor
  maxEv: 0.2,          // > 20% casi siempre es error de modelo, no valor real
  minMarketProb: 0.08, // descarta probabilidades implícitas ínfimas
};

// ─── Filtro de realismo ──────────────────────────────────────────
export type RealismLabel = "ok" | "low_prob" | "artificial";
export type RealismProfile = "aggressive" | "balanced" | "conservative";

/** Probabilidad mínima recomendada por perfil de apuesta. */
export const REALISM_THRESHOLDS: Record<RealismProfile, number> = {
  aggressive:   0.15,
  balanced:     0.30,
  conservative: 0.50,
};

export const MIN_REALISTIC_PROB = REALISM_THRESHOLDS.aggressive;

/**
 * Etiqueta de realismo de un pick.
 * - "artificial": edge grande pero probabilidad ínfima → artefacto del modelo.
 * - "low_prob": probabilidad baja sin edge que lo justifique.
 * - "ok": pick con probabilidad razonable.
 */
export function realismLabel(probability: number, edgeValue: number): RealismLabel {
  if (probability < MIN_REALISTIC_PROB && edgeValue > 0.03) return "artificial";
  if (probability < MIN_REALISTIC_PROB) return "low_prob";
  return "ok";
}

/** ¿Pasa el umbral para un perfil concreto? */
export function passesRealismProfile(probability: number, profile: RealismProfile): boolean {
  return probability >= REALISM_THRESHOLDS[profile];
}

/**
 * Score combinado edge + probabilidad para ranking de recomendaciones.
 * Devuelve -1 si la probabilidad no supera el umbral mínimo (agresivo).
 */
export function realismScore(probability: number, edgeValue: number): number {
  if (probability < MIN_REALISTIC_PROB) return -1;
  return probability * 0.6 + Math.min(edgeValue, 0.15) / 0.15 * 0.4;
}

/** ¿Es un pick de calidad y no un artefacto del modelo? */
export function isQualityPick(e: {
  decimal_odds: number;
  expected_value: number;
  implied_probability: number;
}): boolean {
  const r = PICK_RULES;
  return (
    e.decimal_odds >= r.minOdds &&
    e.decimal_odds <= r.maxOdds &&
    e.expected_value >= r.minEv &&
    e.expected_value <= r.maxEv &&
    e.implied_probability >= r.minMarketProb
  );
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
