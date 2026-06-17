import type { Match, TeamStats, Odd, Prediction, Edge, Market, Outcome } from "@/lib/types";
import { buildScoreMatrix, marketsFromMatrix } from "./poisson";
import { expectedGoals } from "./expected-goals";
import { groupByMarket } from "./odds";
import { impliedProbability, classifyEv, blendedProbability } from "./edge";

export const MODEL_VERSION = "poisson-v1";

/** Probabilidad del modelo por (market, outcome) para un partido. */
export function modelProbabilities(
  homeStats: TeamStats,
  awayStats: TeamStats,
  leagueAvgGoals?: number
): Record<Market, Partial<Record<Outcome, number>>> {
  const { lambdaHome, lambdaAway } = expectedGoals({
    home: homeStats,
    away: awayStats,
    leagueAvgGoals,
  });
  const sm = buildScoreMatrix(lambdaHome, lambdaAway);
  const m = marketsFromMatrix(sm);
  return {
    "1x2": { home: m.home, draw: m.draw, away: m.away },
    btts: { yes: m.bttsYes, no: m.bttsNo },
    over_under_2_5: { over: m.over2_5, under: m.under2_5 },
  };
}

/** Genera predicciones persistibles para un partido. */
export function buildPredictions(
  match: Match,
  homeStats: TeamStats,
  awayStats: TeamStats,
  leagueAvgGoals?: number
): Prediction[] {
  const probs = modelProbabilities(homeStats, awayStats, leagueAvgGoals);
  const now = new Date().toISOString();
  const out: Prediction[] = [];
  (Object.keys(probs) as Market[]).forEach((market) => {
    const byOutcome = probs[market];
    (Object.keys(byOutcome) as Outcome[]).forEach((outcome) => {
      out.push({
        id: `${match.id}:${market}:${outcome}`,
        match_id: match.id,
        market,
        outcome,
        model_probability: byOutcome[outcome] ?? 0,
        model_version: MODEL_VERSION,
        source: MODEL_VERSION,
        created_at: now,
      });
    });
  });
  return out;
}

/**
 * Consenso de mercado de-vig por outcome: promedia las cuotas entre casas
 * y elimina el margen (overround) normalizando sobre los outcomes del mercado.
 */
function marketConsensus(marketOdds: Odd[]): Record<string, number> {
  const byOutcome: Record<string, number[]> = {};
  for (const o of marketOdds) (byOutcome[o.outcome] ??= []).push(o.decimal_odds);
  const raw: Record<string, number> = {};
  let sum = 0;
  for (const oc of Object.keys(byOutcome)) {
    const list = byOutcome[oc];
    const avgOdds = list.reduce((a, b) => a + b, 0) / list.length;
    const p = avgOdds > 1 ? 1 / avgOdds : 0;
    raw[oc] = p;
    sum += p;
  }
  const out: Record<string, number> = {};
  for (const oc of Object.keys(raw)) out[oc] = sum > 0 ? raw[oc] / sum : 0;
  return out;
}

/**
 * Cruza predicciones con cuotas y produce edges, en modo "tipster":
 * - Calcula el consenso de mercado de-vig por mercado.
 * - Ancla la probabilidad del modelo al mercado (blendedProbability).
 * - Toma la MEJOR cuota disponible entre casas para el EV.
 * El edge resultante es la discrepancia *moderada* frente al consenso,
 * no el delirio del modelo crudo sobre longshots.
 */
export function buildEdges(
  match: Match,
  predictions: Prediction[],
  odds: Odd[]
): Edge[] {
  const byMarket = groupByMarket(odds);
  const now = new Date().toISOString();
  const edges: Edge[] = [];

  for (const pred of predictions) {
    const marketOdds = byMarket[pred.market] ?? [];
    const candidates = marketOdds.filter((o) => o.outcome === pred.outcome);
    if (!candidates.length) continue;
    const best = candidates.reduce((a, b) => (b.decimal_odds > a.decimal_odds ? b : a));

    const consensus = marketConsensus(marketOdds);
    const pMarket = consensus[pred.outcome] || impliedProbability(best.decimal_odds);
    const pFair = blendedProbability(pMarket, pred.model_probability);
    const ev = pFair * best.decimal_odds - 1;

    edges.push({
      id: `${match.id}:${pred.market}:${pred.outcome}`,
      match_id: match.id,
      market: pred.market,
      outcome: pred.outcome,
      decimal_odds: best.decimal_odds,
      implied_probability: pMarket,        // consenso de-vig (lo que dice el mercado)
      model_probability: pFair,            // estimación final anclada
      edge: pFair - pMarket,               // discrepancia frente al consenso
      expected_value: ev,
      tier: classifyEv(ev),
      bookmaker: best.bookmaker,
      source: best.source,
      updated_at: now,
    });
  }
  return edges;
}
