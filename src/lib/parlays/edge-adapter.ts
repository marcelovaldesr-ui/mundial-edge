import type { Edge } from "../types";
import type { ParlayPick } from "./parlay-types";

/**
 * Contract from the tipster engine:
 * `edges.model_probability` is not the raw Poisson probability anymore.
 * `buildEdges()` stores `pFair = blendedProbability(marketConsensus, rawModel)`,
 * so parlays must read it as the anchored probability and never as raw model
 * probability. The raw Poisson value lives only in `predictions`.
 */
export function edgeToParlayPick(edge: Edge): ParlayPick {
  return {
    id: edge.id,
    matchId: edge.match_id,
    market: edge.market,
    selection: edge.outcome,
    odds: edge.decimal_odds,
    marketProb: edge.implied_probability,
    anchoredProb: edge.final_probability ?? edge.model_probability,
    probabilitySource: edge.final_probability != null ? "edge.final_probability_ensemble" : "edge.model_probability_blended",
    edge: edge.final_edge ?? edge.edge,
    ev: edge.final_expected_value ?? edge.expected_value,
    riskLevel: edge.tier,
    isQualityPick: edge.qualifies === true,
    startsAt: edge.match?.kickoff ?? edge.updated_at,
    matchStatus: edge.match?.status,
    bookmaker: edge.bookmaker,
    match: edge.match,
    finalProbabilityBreakdown: edge.final_probability_breakdown,
  };
}
