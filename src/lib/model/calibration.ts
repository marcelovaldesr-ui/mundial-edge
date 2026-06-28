import { MARKET_WEIGHT } from "./edge";

export interface LiveCalibrationResult {
  matchesEvaluated: number;
  brierScore: number | null;
  effectiveMarketWeight: number;
  decision: "insufficient_data" | "high_error" | "acceptable" | "good_model";
  note: string;
}

const MIN_MATCHES = 15;

/**
 * Computes a dynamic MARKET_WEIGHT based on the Brier Score of the model
 * against WC 2026 finished matches with stored predictions.
 *
 * Returns the effective weight to use for the current sync run.
 * Thresholds:
 *   Brier > 0.65  → model unreliable → increase weight to 0.83 (lean on market)
 *   0.58–0.65     → acceptable       → keep 0.78
 *   < 0.58        → good model       → lower to 0.70 (trust model more)
 */
export async function computeDynamicMarketWeight(sb: any): Promise<LiveCalibrationResult> {
  try {
    // Fetch finished matches with scores
    const { data: finishedMatches } = await sb
      .from("matches")
      .select("id, home_score, away_score")
      .eq("status", "finished")
      .not("home_score", "is", null)
      .not("away_score", "is", null);

    const finished = (finishedMatches ?? []) as { id: string; home_score: number; away_score: number }[];
    if (finished.length < MIN_MATCHES) {
      return {
        matchesEvaluated: finished.length,
        brierScore: null,
        effectiveMarketWeight: MARKET_WEIGHT,
        decision: "insufficient_data",
        note: `Solo ${finished.length}/${MIN_MATCHES} partidos finalizados. Manteniendo MARKET_WEIGHT=${MARKET_WEIGHT}.`,
      };
    }

    const matchIds = finished.map((m) => m.id);
    const { data: predictions } = await sb
      .from("predictions")
      .select("match_id, market, outcome, model_probability")
      .in("match_id", matchIds)
      .eq("market", "1x2");

    const predsByMatch = new Map<string, { home: number; draw: number; away: number }>();
    for (const p of (predictions ?? []) as any[]) {
      const entry = predsByMatch.get(p.match_id) ?? { home: 0, draw: 0, away: 0 };
      if (p.outcome === "home") entry.home = p.model_probability;
      if (p.outcome === "draw") entry.draw = p.model_probability;
      if (p.outcome === "away") entry.away = p.model_probability;
      predsByMatch.set(p.match_id, entry);
    }

    let totalBrier = 0, count = 0;
    for (const m of finished) {
      const pred = predsByMatch.get(m.id);
      if (!pred) continue;
      const actualHome = m.home_score > m.away_score ? 1 : 0;
      const actualDraw = m.home_score === m.away_score ? 1 : 0;
      const actualAway = m.home_score < m.away_score ? 1 : 0;
      // Brier multiclass = sum of (prob - outcome)^2 for each outcome
      totalBrier += (pred.home - actualHome) ** 2 + (pred.draw - actualDraw) ** 2 + (pred.away - actualAway) ** 2;
      count++;
    }

    if (!count) {
      return {
        matchesEvaluated: 0,
        brierScore: null,
        effectiveMarketWeight: MARKET_WEIGHT,
        decision: "insufficient_data",
        note: "No hay predicciones 1x2 para partidos finalizados.",
      };
    }

    const brierScore = totalBrier / count;
    let effectiveMarketWeight: number;
    let decision: LiveCalibrationResult["decision"];
    let note: string;

    if (brierScore > 0.65) {
      effectiveMarketWeight = 0.83;
      decision = "high_error";
      note = `Brier ${brierScore.toFixed(3)} > 0.65 — modelo poco confiable. Aumentando peso de mercado a 0.83.`;
    } else if (brierScore < 0.58) {
      effectiveMarketWeight = 0.70;
      decision = "good_model";
      note = `Brier ${brierScore.toFixed(3)} < 0.58 — modelo preciso. Bajando peso de mercado a 0.70.`;
    } else {
      effectiveMarketWeight = 0.78;
      decision = "acceptable";
      note = `Brier ${brierScore.toFixed(3)} en rango aceptable 0.58-0.65. Manteniendo MARKET_WEIGHT=0.78.`;
    }

    return { matchesEvaluated: count, brierScore, effectiveMarketWeight, decision, note };
  } catch (err) {
    console.error("[calibration] Error computing dynamic MARKET_WEIGHT:", err);
    return {
      matchesEvaluated: 0,
      brierScore: null,
      effectiveMarketWeight: MARKET_WEIGHT,
      decision: "insufficient_data",
      note: "Error al consultar datos — usando MARKET_WEIGHT por defecto.",
    };
  }
}
