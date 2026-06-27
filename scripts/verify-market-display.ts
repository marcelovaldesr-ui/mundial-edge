import assert from "node:assert/strict";
import {
  formatMarketName,
  formatMarketWithLine,
  formatSelectionName,
  getMarketCategoryLabel,
  marketDistributionKey,
} from "../src/lib/markets/market-display";
import { scoreParlay } from "../src/lib/parlays/parlay-scoring";
import type { ParlayPick } from "../src/lib/parlays";

assert.equal(formatMarketName("1x2"), "Ganador del partido");
assert.equal(formatMarketName("over_under_2_5"), "Total de goles");
assert.equal(formatMarketWithLine("over_under_2_5"), "Total de goles 2.5");
assert.equal(formatSelectionName({ market: "over_under_2_5", outcome: "over" }), "Más de 2.5 goles");
assert.equal(formatSelectionName({ market: "over_under_2_5", outcome: "under" }), "Menos de 2.5 goles");
assert.equal(formatSelectionName({ market: "btts", outcome: "yes" }), "Ambos equipos anotan: Sí");
assert.equal(formatSelectionName({ market: "btts", outcome: "no" }), "Ambos equipos anotan: No");
assert.equal(formatSelectionName({ market: "corners_total_8_5", outcome: "over" }), "Más de 8.5 corners");
assert.equal(formatSelectionName({ market: "cards_total_4_5", outcome: "under" }), "Menos de 4.5 tarjetas");
assert.equal(formatSelectionName({ market: "double_chance", selection: "1x" }), "Doble oportunidad: 1X");
assert.equal(getMarketCategoryLabel("over_under_2_5"), "Total de goles");
assert.equal(marketDistributionKey({ market: "over_under_2_5", outcome: "over" }), "goals_total_2.5");

function pick(id: string, market: ParlayPick["market"], selection: ParlayPick["selection"]): ParlayPick {
  return {
    id,
    matchId: id,
    market,
    selection,
    odds: 1.8,
    oddsType: "real",
    marketProb: 0.52,
    anchoredProb: 0.58,
    probability: 0.58,
    pick: selection,
    probabilitySource: "edge.model_probability_blended",
    edge: 0.04,
    confidence: "medium",
    ev: 0.08,
    riskLevel: "low",
    isQualityPick: true,
    startsAt: "2026-06-20T12:00:00Z",
    matchStatus: "scheduled",
  };
}

const repeatedTotalsScore = scoreParlay({
  profile: "balanced",
  picks: [
    pick("a", "over_under_2_5", "over"),
    pick("b", "over_under_2_5", "under"),
    pick("c", "over_under_2_5", "over"),
  ],
  totalOdds: 5.8,
  jointProbabilityAdjusted: 0.2,
  ev: 0.16,
  riskScore: 35,
  correlationLevel: "low",
});

const diverseScore = scoreParlay({
  profile: "balanced",
  picks: [
    pick("a", "over_under_2_5", "over"),
    pick("b", "1x2", "home"),
    pick("c", "btts", "yes"),
  ],
  totalOdds: 5.8,
  jointProbabilityAdjusted: 0.2,
  ev: 0.16,
  riskScore: 35,
  correlationLevel: "low",
});

assert(diverseScore > repeatedTotalsScore, "Expected soft market diversity to improve comparable parlay score.");

console.log("Market display verification passed");
