import type { Match, TeamStats, Odd, Prediction, Edge, Market, Outcome } from "@/lib/types";
import { buildScoreMatrix, marketsFromMatrix } from "./poisson";
import { expectedGoals } from "./expected-goals";
import { groupByMarket, impliedProbabilityForOutcome } from "./odds";
import { impliedProbability, edge as calcEdge, expectedValue, classifyEv } from "./edge";

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
 * Cruza predicciones con cuotas y produce edges.
 * - Ajusta overround por mercado (devig).
 * - Toma, por (market, outcome), la MEJOR cuota disponible entre casas.
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
    // mejor cuota (mayor decimal) para este outcome
    const candidates = marketOdds.filter((o) => o.outcome === pred.outcome);
    if (!candidates.length) continue;
    const best = candidates.reduce((a, b) => (b.decimal_odds > a.decimal_odds ? b : a));

    const bookmakerMarketOdds = marketOdds.filter((o) => o.bookmaker === best.bookmaker);
    const impliedAdj = impliedProbabilityForOutcome(bookmakerMarketOdds, pred.outcome);
    const ev = expectedValue(pred.model_probability, best.decimal_odds);
    edges.push({
      id: `${match.id}:${pred.market}:${pred.outcome}`,
      match_id: match.id,
      market: pred.market,
      outcome: pred.outcome,
      decimal_odds: best.decimal_odds,
      implied_probability: impliedAdj || impliedProbability(best.decimal_odds),
      model_probability: pred.model_probability,
      edge: calcEdge(pred.model_probability, impliedAdj || impliedProbability(best.decimal_odds)),
      expected_value: ev,
      tier: classifyEv(ev),
      bookmaker: best.bookmaker,
      source: best.source,
      updated_at: now,
    });
  }
  return edges;
}
