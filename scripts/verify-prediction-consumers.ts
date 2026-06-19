import assert from "node:assert/strict";
import { buildParlayStatModel } from "../src/lib/parlays/stat-model-adapter";
import {
  buildScoreMatrixForMatch,
  getDefaultPredictionConfig,
  getRecommendedPredictionConfig,
  resolvePredictionConfig,
  STAT_MODEL_VARIANTS,
  type MatchStatModelPrediction,
} from "../src/lib/stat-model";
import type { Match, TeamStats } from "../src/lib/types";

const match: Match = {
  id: "consumer-check",
  home_team_id: "home",
  away_team_id: "away",
  stage: "Group A",
  kickoff: "2026-07-01T20:00:00Z",
  venue: null,
  status: "scheduled",
  home_score: null,
  away_score: null,
  home_team: { id: "home", name: "Home", code: "HOM", group: "A" },
  away_team: { id: "away", name: "Away", code: "AWY", group: "A" },
};

const homeStats: TeamStats = {
  team_id: "home", matches_played: 3, goals_for: 5, goals_against: 2, goal_diff: 3,
  recent_form: ["W", "W", "D"], gf_per_game: 5 / 3, ga_per_game: 2 / 3,
};
const awayStats: TeamStats = {
  team_id: "away", matches_played: 3, goals_for: 3, goals_against: 4, goal_diff: -1,
  recent_form: ["L", "W", "D"], gf_per_game: 1, ga_per_game: 4 / 3,
};

const defaultConfig = getDefaultPredictionConfig();
assert.deepEqual(
  { modelVariant: defaultConfig.modelVariant, calibration: defaultConfig.calibration },
  { modelVariant: "legacy-neutral", calibration: "none" }
);

const recommendedConfig = getRecommendedPredictionConfig();
assert.deepEqual(
  { modelVariant: recommendedConfig.modelVariant, calibration: recommendedConfig.calibration },
  { modelVariant: "calibrated-matrix", calibration: "none" }
);
assert.notEqual(recommendedConfig.modelVariant, "experimental-dixon-coles");
assert.equal(STAT_MODEL_VARIANTS[recommendedConfig.modelVariant].recommended, true);
assert.equal(STAT_MODEL_VARIANTS["experimental-dixon-coles"].notRecommended, true);

const defaultPrediction = prediction(buildScoreMatrixForMatch(match, homeStats, awayStats));
assert.equal(defaultPrediction.modelVariantUsed, "legacy-neutral");
assert.equal(defaultPrediction.calibrationUsed, "none");
assert.equal(defaultPrediction.configSource, "default");
validatePrediction(defaultPrediction);

const recommendedPrediction = prediction(buildScoreMatrixForMatch(match, homeStats, awayStats, {
  predictionConfig: "recommended",
}));
assert.equal(recommendedPrediction.modelVariantUsed, "calibrated-matrix");
assert.equal(recommendedPrediction.calibrationUsed, "none");
assert.equal(recommendedPrediction.configSource, "recommended");
validatePrediction(recommendedPrediction);

const defaultParlayModel = buildParlayStatModel([match], [homeStats, awayStats]);
assert.equal(defaultParlayModel.modelVariantUsed, "legacy-neutral");
assert.equal(defaultParlayModel.calibrationUsed, "none");
assert.equal(defaultParlayModel.configSource, "default");
validatePrediction(defaultParlayModel.predictions[0]);

const recommendedParlayModel = buildParlayStatModel([match], [homeStats, awayStats], "recommended");
assert.equal(recommendedParlayModel.modelVariantUsed, "calibrated-matrix");
assert.equal(recommendedParlayModel.calibrationUsed, "none");
assert.equal(recommendedParlayModel.configSource, "recommended");
validatePrediction(recommendedParlayModel.predictions[0]);

const override = resolvePredictionConfig({ modelVariant: "xg-v2.1-prior8", calibration: "experimental-platt" });
assert.equal(override.configSource, "explicit-override");
const overriddenPrediction = prediction(buildScoreMatrixForMatch(match, homeStats, awayStats, {
  modelVariant: override.modelVariant,
  calibration: override.calibration,
}));
assert.equal(overriddenPrediction.modelVariantUsed, "xg-v2.1-prior8");
assert.equal(overriddenPrediction.calibrationUsed, "experimental-platt");
assert.equal(overriddenPrediction.configSource, "explicit-override");
validatePrediction(overriddenPrediction);

const overriddenParlayModel = buildParlayStatModel([match], [homeStats, awayStats], {
  modelVariant: "xg-v2.1-prior8",
  calibration: "experimental-platt",
});
assert.equal(overriddenParlayModel.configSource, "explicit-override");
assert.equal(overriddenParlayModel.modelVariantUsed, "xg-v2.1-prior8");
assert.equal(overriddenParlayModel.calibrationUsed, "experimental-platt");
validatePrediction(overriddenParlayModel.predictions[0]);

console.log("Prediction consumer verification passed");

function prediction(result: ReturnType<typeof buildScoreMatrixForMatch>): MatchStatModelPrediction {
  assert("scoreMatrix" in result, `Expected prediction, got issue: ${"reason" in result ? result.reason : "unknown"}`);
  return result;
}

function validatePrediction(result: MatchStatModelPrediction | undefined): void {
  assert(result, "Expected a prediction result");
  const oneXTwo = result.marketProbabilities.filter((row) => row.market === "1x2").map((row) => row.probability);
  assert.equal(oneXTwo.length, 3);
  assert(oneXTwo.every(Number.isFinite), "1X2 probabilities must not contain NaN/Infinity");
  assert(Math.abs(oneXTwo.reduce((sum, value) => sum + value, 0) - 1) < 1e-9, "1X2 probabilities must sum to one");
  assert([
    result.homeExpectedGoals,
    result.awayExpectedGoals,
    ...result.scoreMatrix.entries.map((entry) => entry.probability),
    ...result.marketProbabilities.map((row) => row.probability),
  ].every(Number.isFinite), "Prediction output must not contain NaN/Infinity");
}
