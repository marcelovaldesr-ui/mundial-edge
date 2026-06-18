import { anchorProbability } from "../src/lib/stat-model/calibration";
import { buildScoreMatricesByMatchId, buildScoreMatrixForMatch } from "../src/lib/stat-model/match-prediction";
import {
  deriveMarketProbabilities,
  jointProbabilityForSelections,
  probabilityForSelection,
  selectionToScorePredicate,
} from "../src/lib/stat-model/market-probabilities";
import { createScoreMatrix, poissonProbability, scoreMatrixTotalProbability } from "../src/lib/stat-model/score-matrix";
import { applyDixonColesAdjustment } from "../src/lib/stat-model/dixon-coles";
import { calculatePredictionConfidence, labelForScore } from "../src/lib/stat-model/confidence-score";
import { getActiveStatModelVariant, resolveStatModelVariant } from "../src/lib/stat-model/model-variant";
import {
  calibrateMarketProbability,
  calibrateOneXTwoProbabilities,
  applyOneXTwoCalibrationStrategy,
  probabilityLogit,
  sigmoid,
} from "../src/lib/stat-model/market-calibration";
import {
  IDENTITY_CALIBRATION_PRESET,
  resolveStatModelCalibration,
} from "../src/lib/stat-model/calibration-presets";
import type { Match, TeamStats } from "../src/lib/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function near(actual: number, expected: number, tolerance = 0.000001) {
  assert(Math.abs(actual - expected) <= tolerance, `Expected ${actual} to be near ${expected}`);
}

function poisson() {
  near(poissonProbability(2, 0), Math.exp(-2));
  near(poissonProbability(2, 1), 2 * Math.exp(-2));
  assert(poissonProbability(1.4, -1) === 0, "Negative goals should have zero probability");
}

function matrixAndMarkets() {
  const matrix = createScoreMatrix({ homeExpectedGoals: 1.5, awayExpectedGoals: 1.1, maxGoals: 12 });
  near(scoreMatrixTotalProbability(matrix), 1, 0.000001);
  assert(matrix.tailProbability < 0.001, "Expected small tail probability with maxGoals 12");

  const probabilities = deriveMarketProbabilities(matrix);
  const home = probabilities.find((x) => x.selection === "home_win")!.probability;
  const draw = probabilities.find((x) => x.selection === "draw")!.probability;
  const away = probabilities.find((x) => x.selection === "away_win")!.probability;
  near(home + draw + away, 1, 0.000001);

  near(probabilityForSelection(matrix, "over_2_5") + probabilityForSelection(matrix, "under_2_5"), 1, 0.000001);
  near(probabilityForSelection(matrix, "btts_yes") + probabilityForSelection(matrix, "btts_no"), 1, 0.000001);
  near(probabilityForSelection(matrix, "home_over_1_5") + probabilityForSelection(matrix, "home_under_1_5"), 1, 0.000001);
  near(probabilityForSelection(matrix, "away_over_0_5") + probabilityForSelection(matrix, "away_under_0_5"), 1, 0.000001);
  near(
    probabilityForSelection(matrix, "double_chance_1x"),
    probabilityForSelection(matrix, "home_win") + probabilityForSelection(matrix, "draw"),
    0.000001
  );
}

function dixonColes() {
  const matrix = createScoreMatrix({ homeExpectedGoals: 1.5, awayExpectedGoals: 1.1, maxGoals: 12 });
  const identity = applyDixonColesAdjustment(matrix, 0);
  assert(identity.matrix.entries.every((entry, index) => entry.probability === matrix.entries[index].probability), "rho 0 must preserve every matrix probability.");
  assert(identity.metadata.adjustedCells.length === 4, "Exactly four cells must receive Dixon-Coles tau metadata.");
  assert(identity.matrix.entries.length === matrix.entries.length, "Adjusted matrix must preserve dimensions.");

  const adjusted = applyDixonColesAdjustment(matrix, -0.15);
  near(scoreMatrixTotalProbability(adjusted.matrix), 1, 0.000000001);
  assert(adjusted.matrix.entries.every((entry) => entry.probability >= 0), "Adjusted probabilities must be non-negative.");
  assert(adjusted.matrix.entries.length === matrix.entries.length, "Adjusted matrix must preserve dimensions.");
  assert(adjusted.metadata.adjustedCells.map((cell) => `${cell.homeGoals}-${cell.awayGoals}`).sort().join(",") === "0-0,0-1,1-0,1-1", "Only four low-score cells may be adjusted.");
  const ordinaryBefore = matrix.entries.find((entry) => entry.homeGoals === 2 && entry.awayGoals === 2)!;
  const ordinaryAfter = adjusted.matrix.entries.find((entry) => entry.homeGoals === 2 && entry.awayGoals === 2)!;
  near(ordinaryAfter.probability / ordinaryBefore.probability, adjusted.metadata.normalizationFactor, 0.000000001);
  assert(adjusted.metadata.adjustedCells.every((cell) => Math.abs(cell.probabilityAfter / cell.probabilityBefore - adjusted.metadata.normalizationFactor) > 0.000001), "Only low-score cells may receive a tau beyond global normalization.");
  const positiveRho = applyDixonColesAdjustment(createScoreMatrix({ homeExpectedGoals: 4.5, awayExpectedGoals: 4.5, maxGoals: 12 }), 0.05);
  assert(positiveRho.matrix.entries.every((entry) => entry.probability >= 0), "Positive configured rho must also remain non-negative at xG guardrails.");
  near(scoreMatrixTotalProbability(positiveRho.matrix), 1, 0.000000001);
}

function predicatesAndJoint() {
  const homeWin = selectionToScorePredicate("home_win");
  const over25 = selectionToScorePredicate("over_2_5");
  assert(homeWin(2, 1), "Expected 2-1 to satisfy home win");
  assert(over25(2, 1), "Expected 2-1 to satisfy over 2.5");
  assert(!over25(1, 1), "Expected 1-1 not to satisfy over 2.5");

  const matrix = createScoreMatrix({ homeExpectedGoals: 1.7, awayExpectedGoals: 1.2, maxGoals: 12 });
  const impossibleResult = jointProbabilityForSelections(matrix, ["home_win", "away_win"]);
  assert(impossibleResult.isInvalid, "home win + away win should be impossible");
  near(impossibleResult.jointProbability, 0);

  const impossibleTotals = jointProbabilityForSelections(matrix, ["over_2_5", "under_2_5"]);
  assert(impossibleTotals.isInvalid, "over 2.5 + under 2.5 should be impossible");
  near(impossibleTotals.jointProbability, 0);

  const correlated = jointProbabilityForSelections(matrix, ["home_win", "over_2_5"]);
  assert(correlated.jointProbability > 0, "home win + over 2.5 should have positive probability");
  assert(
    Math.abs(correlated.jointProbability - correlated.independentProbability) > 0.01,
    "Same-match joint probability should differ from independent product"
  );
}

function calibration() {
  const anchored = anchorProbability({ modelProbPoisson: 0.4, marketProbNoVig: 0.5, marketWeight: 0.78 });
  near(anchored.anchoredProb, 0.478);

  for (const probability of [0.01, 0.2, 0.5, 0.8, 0.99]) {
    near(sigmoid(probabilityLogit(probability)), probability, 0.000000001);
  }
  assert(Number.isFinite(calibrateMarketProbability(0, { a: 1, b: 0 })), "p=0 must remain numerically safe.");
  assert(Number.isFinite(calibrateMarketProbability(1, { a: 1, b: 0 })), "p=1 must remain numerically safe.");
  assert(calibrateMarketProbability(0.7, { a: 1.5, b: 0 }) > 0.7, "a > 1 must sharpen a probability above 0.5.");
  assert(calibrateMarketProbability(0.7, { a: 0.5, b: 0 }) < 0.7, "a < 1 must soften a probability above 0.5.");

  const raw = { homeWin: 0.51, draw: 0.27, awayWin: 0.22 };
  const identity = calibrateOneXTwoProbabilities(raw, IDENTITY_CALIBRATION_PRESET.calibration);
  near(identity.homeWin, raw.homeWin, 0.000000001);
  near(identity.draw, raw.draw, 0.000000001);
  near(identity.awayWin, raw.awayWin, 0.000000001);
  near(identity.homeWin + identity.draw + identity.awayWin, 1, 0.000000001);
  assert(Object.values(identity.metadata.calibratedBeforeNormalization).every(Number.isFinite), "Calibration metadata must be finite.");
  assert(resolveStatModelCalibration().id === "none", "Calibration must default to none.");
  assert(resolveStatModelCalibration("invalid").id === "none", "Invalid calibration flags must fail closed to none.");
  assert(resolveStatModelCalibration("experimental-platt").status === "experimental", "Experimental Platt flag must resolve explicitly.");
  for (const mode of ["platt-blend-25", "platt-blend-50", "platt-blend-75", "favorite-cap-65", "favorite-max-boost-08"]) {
    assert(resolveStatModelCalibration(mode).id === mode, `Expected ${mode} calibration preset.`);
  }
  assert(resolveStatModelCalibration("platt-blend-25").candidate, "Blend 25 must be marked as the conservative candidate.");

  const fitted = { homeWin: { a: 2, b: 0 }, draw: { a: 2, b: 0 }, awayWin: { a: 2, b: 0 } };
  const full = calibrateOneXTwoProbabilities(raw, fitted);
  const blend25 = applyOneXTwoCalibrationStrategy(raw, fitted, { type: "blend", blend: 0.25 });
  near(blend25.homeWin, 0.25 * full.homeWin + 0.75 * raw.homeWin, 0.000000001);
  near(blend25.homeWin + blend25.draw + blend25.awayWin, 1, 0.000000001);
  const cappedByThreshold = applyOneXTwoCalibrationStrategy(
    { homeWin: 0.7, draw: 0.2, awayWin: 0.1 }, fitted, { type: "raw-top-threshold", threshold: 0.65 }
  );
  near(cappedByThreshold.homeWin, 0.7, 0.000000001);
  const maxBoost = applyOneXTwoCalibrationStrategy(raw, fitted, { type: "favorite-max-boost", maxBoost: 0.08 });
  assert(maxBoost.homeWin <= raw.homeWin + 0.08 + 0.000000001, "Favorite boost must respect its cap.");
  near(maxBoost.homeWin + maxBoost.draw + maxBoost.awayWin, 1, 0.000000001);
}

function confidenceScore() {
  const matrix = createScoreMatrix({ homeExpectedGoals: 1.5, awayExpectedGoals: 1.1, maxGoals: 12 });
  const base = {
    homeGamesPlayed: 4, awayGamesPlayed: 4, priorWeight: 0.25, scoreMatrix: matrix,
    homeRatingFallback: false, awayRatingFallback: false,
  };
  const uncertain = calculatePredictionConfidence({ ...base, probabilities: { home: 0.35, draw: 0.33, away: 0.32 } });
  const concentrated = calculatePredictionConfidence({ ...base, probabilities: { home: 0.72, draw: 0.18, away: 0.10 } });
  assert([uncertain.score, concentrated.score].every((score) => score >= 0 && score <= 100), "Confidence must remain between 0 and 100.");
  assert(concentrated.score > uncertain.score, "Concentrated probabilities must increase confidence.");
  const fallback = calculatePredictionConfidence({ ...base, probabilities: { home: 0.72, draw: 0.18, away: 0.10 }, homeRatingFallback: true });
  assert(fallback.score < concentrated.score, "Fallback ratings must reduce confidence.");
  const smallSample = calculatePredictionConfidence({ ...base, probabilities: { home: 0.72, draw: 0.18, away: 0.10 }, homeGamesPlayed: 0, awayGamesPlayed: 1, priorWeight: 0.9 });
  assert(smallSample.score < concentrated.score, "Small samples must reduce confidence.");
  const warned = calculatePredictionConfidence({ ...base, probabilities: { home: 0.72, draw: 0.18, away: 0.10 }, modelWarnings: ["warning one", "warning two"] });
  assert(warned.score < concentrated.score, "Warnings must reduce confidence.");
  assert(labelForScore(20) === "low" && labelForScore(55) === "medium" && labelForScore(80) === "high", "Confidence labels must follow thresholds.");
  assert(resolveStatModelVariant().id === "legacy-neutral", "Feature flag must fail closed to Legacy.");
  assert(resolveStatModelVariant("xg-v2.1-prior8").status === "candidate", "prior8 must be a candidate model.");
  assert(resolveStatModelVariant("experimental-dixon-coles").notRecommended, "Dixon-Coles must be marked not recommended.");
  assert(getActiveStatModelVariant(undefined, "xg-v2.1-prior8").id === "xg-v2.1-prior8", "Environment feature flag must select the candidate.");
  assert(getActiveStatModelVariant(undefined, "invalid").id === "legacy-neutral", "Invalid feature flags must fail closed to Legacy.");
}

function matchPrediction() {
  const match: Match = {
    id: "m1",
    home_team_id: "home",
    away_team_id: "away",
    stage: "Group",
    kickoff: "2026-06-20T20:00:00Z",
    venue: null,
    status: "scheduled",
    home_score: null,
    away_score: null,
    home_team: { id: "home", name: "Home", code: "HOM", group: null },
    away_team: { id: "away", name: "Away", code: "AWY", group: null },
  };
  const homeStats: TeamStats = {
    team_id: "home",
    matches_played: 3,
    goals_for: 5,
    goals_against: 2,
    goal_diff: 3,
    recent_form: ["W", "W", "D"],
    gf_per_game: 1.667,
    ga_per_game: 0.667,
  };
  const awayStats: TeamStats = {
    team_id: "away",
    matches_played: 3,
    goals_for: 4,
    goals_against: 3,
    goal_diff: 1,
    recent_form: ["W", "L", "D"],
    gf_per_game: 1.333,
    ga_per_game: 1,
  };
  const prediction = buildScoreMatrixForMatch(match, homeStats, awayStats, { generatedAt: "2026-06-17T00:00:00Z" });
  assert("scoreMatrix" in prediction, "Expected prediction with complete stats");
  assert(prediction.matchId === "m1", "Expected match id to be preserved");
  assert(prediction.marketProbabilities.length > 10, "Expected market probabilities");
  assert(prediction.confidenceResult.score >= 0 && prediction.confidenceResult.score <= 100, "Expected bounded confidence score");
  assert(prediction.modelVariant === "legacy-neutral", "Production default must remain Legacy neutral.");
  assert(prediction.calibrationMode === "none" && prediction.calibrationMetadata == null, "Calibration must remain disabled by default.");
  assert(!("anchoredProb" in prediction), "Stat-model prediction must not apply market anchoring");

  const low = buildScoreMatrixForMatch(match, { ...homeStats, matches_played: 0, recent_form: [] }, awayStats);
  assert("scoreMatrix" in low && low.confidence === "low", "Expected low confidence with missing sample");
  assert("scoreMatrix" in low && low.warnings.some((warning) => warning.includes("Confianza limitada")), "Expected low-confidence warning");

  const missing = buildScoreMatrixForMatch(match, undefined, awayStats);
  assert(!("scoreMatrix" in missing), "Expected controlled issue for missing stats");

  const calibrated = buildScoreMatrixForMatch(match, homeStats, awayStats, {
    modelVariant: "xg-v2.1-prior8",
    calibration: "experimental-platt",
  });
  assert("scoreMatrix" in calibrated && calibrated.calibrationMode === "experimental-platt", "Explicit flag must enable calibration for prior8.");
  assert("scoreMatrix" in calibrated && calibrated.calibrationMetadata != null, "Enabled calibration must expose metadata.");
  assert("scoreMatrix" in calibrated && Math.abs(
    calibrated.marketProbabilities.filter((row) => row.market === "1x2").reduce((sum, row) => sum + row.probability, 0) - 1
  ) < 0.000000001, "Calibrated prediction 1X2 must sum to one.");
  const invalidCalibration = buildScoreMatrixForMatch(match, homeStats, awayStats, {
    modelVariant: "xg-v2.1-prior8",
    calibration: "invalid",
  });
  assert("scoreMatrix" in invalidCalibration && invalidCalibration.calibrationMode === "none", "Invalid calibration flag must fail closed.");
  const conservativeCalibration = buildScoreMatrixForMatch(match, homeStats, awayStats, {
    modelVariant: "xg-v2.1-prior8",
    calibration: "platt-blend-25",
  });
  assert("scoreMatrix" in conservativeCalibration && conservativeCalibration.calibrationMode === "platt-blend-25", "Conservative calibration must be selectable explicitly.");

  const matrices = buildScoreMatricesByMatchId([match], [homeStats, awayStats]);
  assert(matrices.scoreMatricesByMatchId.m1, "Expected score matrix keyed by match id");
  assert(matrices.coverage.totalPreMatch === 1 && matrices.coverage.withScoreMatrix === 1, "Expected coverage counts");
}

poisson();
matrixAndMarkets();
dixonColes();
predicatesAndJoint();
calibration();
confidenceScore();
matchPrediction();

console.log("Stat model verification passed");
