import { anchorProbability } from "../src/lib/stat-model/calibration";
import { buildScoreMatricesByMatchId, buildScoreMatrixForMatch } from "../src/lib/stat-model/match-prediction";
import {
  deriveMarketProbabilities,
  jointProbabilityForSelections,
  probabilityForSelection,
  selectionToScorePredicate,
} from "../src/lib/stat-model/market-probabilities";
import { createScoreMatrix, poissonProbability, scoreMatrixTotalProbability } from "../src/lib/stat-model/score-matrix";
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
  assert(prediction.confidence === "medium", "Expected medium confidence for 3-match sample");
  assert(!("anchoredProb" in prediction), "Stat-model prediction must not apply market anchoring");

  const low = buildScoreMatrixForMatch(match, { ...homeStats, matches_played: 0, recent_form: [] }, awayStats);
  assert("scoreMatrix" in low && low.confidence === "low", "Expected low confidence with missing sample");
  assert("scoreMatrix" in low && low.warnings.some((warning) => warning.includes("Confianza limitada")), "Expected low-confidence warning");

  const missing = buildScoreMatrixForMatch(match, undefined, awayStats);
  assert(!("scoreMatrix" in missing), "Expected controlled issue for missing stats");

  const matrices = buildScoreMatricesByMatchId([match], [homeStats, awayStats]);
  assert(matrices.scoreMatricesByMatchId.m1, "Expected score matrix keyed by match id");
  assert(matrices.coverage.totalPreMatch === 1 && matrices.coverage.withScoreMatrix === 1, "Expected coverage counts");
}

poisson();
matrixAndMarkets();
predicatesAndJoint();
calibration();
matchPrediction();

console.log("Stat model verification passed");
