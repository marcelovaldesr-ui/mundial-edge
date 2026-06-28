import type { Edge, Match } from "../types";
import type { MatchStatModelPrediction } from "../stat-model";
import { calculateAdvanceProbability } from "../stat-model";
import { isKnockoutStage } from "../matches/stage";
import { edgeToParlayPick } from "./edge-adapter";
import type { ParlayConfidence, ParlayMarket, ParlayPick, ParlaySelection } from "./parlay-types";

// ─── Universo de picks candidatos (P0.1) ────────────────────────
// El pool ya no nace solo de los edges existentes: se construye desde el
// modelo + libro de cuotas. Los mercados con cuota real entran como picks
// reales; los mercados conservadores sin cuota (doble oportunidad, clasifica)
// entran como picks de CUOTA ESTIMADA (cuota justa = 1/prob, edge 0, EV 0),
// para dar volumen sin inventar value.

export interface BuildCandidatePicksOptions {
  /** Incluir picks de cuota estimada derivados del modelo. Default: true. */
  includeEstimated?: boolean;
  /** Probabilidad mínima para admitir un pick estimado (evita avances débiles). */
  minEstimatedProbability?: number;
}

export function buildCandidatePicks(
  edges: Edge[],
  predictions: MatchStatModelPrediction[],
  matches: Match[],
  options: BuildCandidatePicksOptions = {}
): ParlayPick[] {
  const realPicks = edges.map(edgeToParlayPick);
  if (options.includeEstimated === false) return realPicks;

  const minProb = options.minEstimatedProbability ?? 0.5;
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const covered = new Set(realPicks.map((pick) => `${pick.matchId}:${pick.market}:${pick.selection}`));
  const estimated: ParlayPick[] = [];

  for (const prediction of predictions) {
    const match = matchById.get(prediction.matchId);
    if (!match) continue;

    // Doble oportunidad estimada (mercado conservador sin cuota real).
    const doubleChance: Array<[ParlaySelection, string]> = [
      ["1x", "double_chance_1x"],
      ["x2", "double_chance_x2"],
    ];
    for (const [selection, statKey] of doubleChance) {
      const prob = prediction.marketProbabilities.find((row) => row.selection === statKey)?.probability;
      if (prob == null) continue;
      pushEstimated(estimated, covered, match, "double_chance", selection, prob, prediction.confidence, minProb);
    }

    // "Clasifica" estimado, solo en eliminatorias, derivado de la matriz de 90'.
    if (isKnockoutStage(match.stage)) {
      const advance = calculateAdvanceProbability(prediction.scoreMatrix, {
        homeRating: prediction.homeRating?.overallRating,
        awayRating: prediction.awayRating?.overallRating,
      });
      // Top-8 FIFA-rank teams receive a +5% probability boost (elite squads historically
      // outperform Poisson baseline in knockout rounds via superior depth and experience).
      const homeRank = match.home_team?.fifa_rank ?? 999;
      const awayRank = match.away_team?.fifa_rank ?? 999;
      const homeBoost = homeRank <= 8 ? 0.05 : 0;
      const awayBoost = awayRank <= 8 ? 0.05 : 0;
      pushEstimated(estimated, covered, match, "clasifica", "home_adv", Math.min(advance.homeAdvance + homeBoost, 0.97), prediction.confidence, minProb);
      pushEstimated(estimated, covered, match, "clasifica", "away_adv", Math.min(advance.awayAdvance + awayBoost, 0.97), prediction.confidence, minProb);
    }
  }

  return [...realPicks, ...estimated];
}

function toParlayConfidence(confidence: string): ParlayConfidence {
  return confidence === "high" ? "high" : confidence === "medium" ? "medium" : "low";
}

function pushEstimated(
  out: ParlayPick[],
  covered: Set<string>,
  match: Match,
  market: ParlayMarket,
  selection: ParlaySelection,
  prob: number,
  confidence: string,
  minProb: number
): void {
  if (!(prob >= minProb && prob < 0.98)) return; // descarta extremos y picks débiles
  const key = `${match.id}:${market}:${selection}`;
  if (covered.has(key)) return;
  covered.add(key);
  out.push({
    id: `${match.id}:${market}:${selection}:est`,
    matchId: match.id,
    market,
    selection,
    odds: 1 / prob, // cuota justa estimada -> edge 0, EV 0
    oddsType: "estimated",
    marketProb: prob,
    anchoredProb: prob,
    probability: prob,
    pick: selection,
    probabilitySource: "edge.model_probability_blended",
    edge: 0,
    confidence: toParlayConfidence(confidence),
    ev: 0,
    riskLevel: "no_value",
    isQualityPick: false,
    startsAt: match.kickoff,
    matchStatus: match.status,
    bookmaker: undefined,
    match,
  });
}
