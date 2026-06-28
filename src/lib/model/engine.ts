import type { Match, TeamStats, Odd, Prediction, Edge, Market, Outcome } from "../types";
import { buildScoreMatrix, marketsFromMatrix } from "./poisson";
import { expectedGoals } from "./expected-goals";
import { groupByMarket } from "./odds";
import { impliedProbability, classifyEv, blendedProbability, MARKET_WEIGHT } from "./edge";
import { isKnockoutStage } from "../matches/stage";
import type { LineupData } from "../data/providers";

export const MODEL_VERSION = "poisson-v1";

// League average goals per team per game.
// Knockout rounds are more conservative (historically ~2.1 total = 1.05/team)
// vs group stage (~2.7 total = 1.35/team).
const LEAGUE_AVG_GROUP = 1.35;
const LEAGUE_AVG_KNOCKOUT = 1.05;

/**
 * Lineup adjustment factor. When lineups are available, checks how many
 * starters differ from a "full strength" reference (max 11 known starters).
 * - 0-1 missing: factor 1.0 (full strength)
 * - 2-3 missing: factor 0.93 (slight weakness)
 * - 4+  missing: factor 0.85 (significantly weakened)
 */
export function lineupAdjustmentFactor(
  lineups: LineupData | null | undefined,
  referenceXi: string[],  // expected full-strength 11 (from prior matches)
  side: "home" | "away"
): number {
  if (!lineups) return 1.0;
  const actual = side === "home" ? lineups.home : lineups.away;
  if (!actual.length || !referenceXi.length) return 1.0;
  const missing = referenceXi.filter((p) => !actual.some((a) => a.toLowerCase().includes(p.toLowerCase().split(" ").pop() ?? p))).length;
  if (missing <= 1) return 1.0;
  if (missing <= 3) return 0.93;
  return 0.85;
}

/** Probabilidad del modelo por (market, outcome) para un partido. */
export function modelProbabilities(
  homeStats: TeamStats,
  awayStats: TeamStats,
  leagueAvgGoals?: number,
  knockoutDrawBoost = false,
  lineupFactors?: { home: number; away: number }
): Partial<Record<Market, Partial<Record<Outcome, number>>>> {
  const { lambdaHome: rawHome, lambdaAway: rawAway } = expectedGoals({
    home: homeStats,
    away: awayStats,
    leagueAvgGoals,
  });

  // A.2: Apply lineup adjustment factors when available.
  const lambdaHome = rawHome * (lineupFactors?.home ?? 1.0);
  const lambdaAway = rawAway * (lineupFactors?.away ?? 1.0);

  const sm = buildScoreMatrix(lambdaHome, lambdaAway);
  const m = marketsFromMatrix(sm);

  // B.1: Knockout draw boost — teams play more conservatively with extra time available.
  // Historically ~30% of knockout matches go to ET/penalties.
  // Draw probability * 1.12, renormalize home+draw+away.
  let home = m.home, draw = m.draw, away = m.away;
  if (knockoutDrawBoost) {
    draw *= 1.12;
    const sum = home + draw + away;
    home /= sum; draw /= sum; away /= sum;
  }

  const dc1x = home + draw;
  const dcX2 = away + draw;
  const dc12 = home + away;

  return {
    "1x2": { home, draw, away },
    btts: { yes: m.bttsYes, no: m.bttsNo },
    over_under_1_5: { over: m.over1_5, under: m.under1_5 },
    over_under_2_5: { over: m.over2_5, under: m.under2_5 },
    over_under_3_5: { over: m.over3_5, under: m.under3_5 },
    double_chance: { "1x": dc1x, x2: dcX2, "12": dc12 },
  };
}

/** Genera predicciones persistibles para un partido. */
export function buildPredictions(
  match: Match,
  homeStats: TeamStats,
  awayStats: TeamStats,
  leagueAvgGoals?: number,
  lineups?: LineupData | null
): Prediction[] {
  // B.3: Use lower league avg for knockout rounds (historically ~2.1 goals/game).
  const isKnockout = isKnockoutStage(match.stage);
  const effectiveAvg = leagueAvgGoals ?? (isKnockout ? LEAGUE_AVG_KNOCKOUT : LEAGUE_AVG_GROUP);

  // A.2: Lineup factors (no-op when lineups not available).
  const lineupFactors = lineups
    ? { home: lineupAdjustmentFactor(lineups, [], "home"), away: lineupAdjustmentFactor(lineups, [], "away") }
    : undefined;

  const probs = modelProbabilities(homeStats, awayStats, effectiveAvg, isKnockout, lineupFactors);
  const now = new Date().toISOString();
  const out: Prediction[] = [];
  (Object.keys(probs) as Market[]).forEach((market) => {
    const byOutcome = probs[market];
    if (!byOutcome) return;
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
 *
 * Excepción: double_chance tiene selecciones que se solapan (1x, x2, 12 comparten
 * "draw" y "home"/"away"). Normalizar sobre los 3 destroza la probabilidad implícita
 * (el bookmaker cotiza cada una independientemente). En ese caso se devuelve la
 * probabilidad implícita de cada outcome sin normalizar.
 */
function marketConsensus(marketOdds: Odd[], market: string): Record<string, number> {
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
  // double_chance: selecciones superpuestas → no normalizar, usar implied directa.
  if (market === "double_chance") return raw;
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
  odds: Odd[],
  marketWeight?: number
): Edge[] {
  const byMarket = groupByMarket(odds);
  const now = new Date().toISOString();
  const edges: Edge[] = [];

  for (const pred of predictions) {
    const marketOdds = byMarket[pred.market] ?? [];
    const candidates = marketOdds.filter((o) => o.outcome === pred.outcome);
    if (!candidates.length) continue;
    const best = candidates.reduce((a, b) => (b.decimal_odds > a.decimal_odds ? b : a));

    const consensus = marketConsensus(marketOdds, pred.market);
    const pMarket = consensus[pred.outcome] || impliedProbability(best.decimal_odds);
    const weight = marketWeight ?? MARKET_WEIGHT;
    const pFair = weight * pMarket + (1 - weight) * pred.model_probability;
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
