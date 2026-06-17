import assert from "node:assert/strict";
import {
  calculateFinalProbability,
  calculateMarketProbability,
  calculateProbabilityBlendWeights,
  clampProbability,
  normalizeMarketProbability,
} from "../src/lib/model/final-probability";

function near(a: number, b: number, eps = 0.000001) {
  assert(Math.abs(a - b) <= eps, `Expected ${a} near ${b}`);
}

near(calculateMarketProbability(2), 0.5);
assert.equal(clampProbability(Number.NaN), 0.5);
const normalized = normalizeMarketProbability([0.6, 0.3, 0.1]);
near(normalized.reduce((sum, value) => sum + value, 0), 1);

const weights = calculateProbabilityBlendWeights({
  marketProbability: 0.58,
  poissonProbability: 0.64,
  ratingProbability: 0.64,
  realStatsProbability: 0.64,
  worldCupContextProbability: 0.64,
  realStatsMatches: 1,
  ratingSource: "manual_seed",
  poissonConfidence: "medium",
});
near(Object.values(weights).reduce((sum, value) => sum + value, 0), 1);
assert(weights.market > weights.poisson, "Market should be the strongest baseline when odds exist.");

const finalWithOdds = calculateFinalProbability({
  marketProbability: 0.58,
  poissonProbability: 0.64,
  ratingProbability: 0.64,
  realStatsProbability: 0.64,
  worldCupContextProbability: 0.62,
  decimalOdds: 1.8,
  bookmakerCount: 2,
  vigRemoved: true,
  preMatchEligible: true,
  poissonConfidence: "medium",
  realStatsMatches: 2,
  ratingSource: "manual_seed",
});
assert(finalWithOdds.finalProbability > 0 && finalWithOdds.finalProbability < 1);
assert(Number.isFinite(finalWithOdds.finalProbability));
assert(finalWithOdds.finalProbability < 0.7, "Final probability should stay prudently anchored to market.");

const noOdds = calculateFinalProbability({
  marketProbability: null,
  poissonProbability: 0.62,
  ratingProbability: 0.61,
  realStatsProbability: null,
  worldCupContextProbability: 0.6,
  preMatchEligible: true,
  poissonConfidence: "medium",
  realStatsMatches: 0,
  ratingSource: "manual_seed",
});
assert.equal(noOdds.components.marketProbability, null);
assert(noOdds.confidence !== "high", "No odds should not produce high confidence.");
assert(noOdds.warnings.some((warning) => warning.includes("Sin cuota real")));

const notEligible = calculateFinalProbability({
  marketProbability: 0.5,
  poissonProbability: 0.52,
  preMatchEligible: false,
});
assert(notEligible.warnings.some((warning) => warning.includes("no elegible")));

console.log("Final probability verification passed");
