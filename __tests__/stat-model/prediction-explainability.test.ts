import test from "node:test";
import assert from "node:assert/strict";
import { getExpectedGoalsWithComponents } from "../../src/lib/stat-model/expected-goals";
import { deriveMarketProbabilities } from "../../src/lib/stat-model/market-probabilities";
import { calculateMarketProbabilityIntervals } from "../../src/lib/stat-model/probability-intervals";
import { createScoreMatrix } from "../../src/lib/stat-model/score-matrix";
import type { Team, TeamStats } from "../../src/lib/types";

const homeTeam: Team = { id: "arg", name: "Argentina", code: "ARG", group: "J" };
const awayTeam: Team = { id: "fra", name: "Francia", code: "FRA", group: "I" };
const homeStats: TeamStats = { team_id: "arg", matches_played: 3, goals_for: 6, goals_against: 2, goal_diff: 4, recent_form: ["W", "W", "D"], gf_per_game: 2, ga_per_game: 0.67 };
const awayStats: TeamStats = { team_id: "fra", matches_played: 3, goals_for: 5, goals_against: 3, goal_diff: 2, recent_form: ["W", "D", "W"], gf_per_game: 1.67, ga_per_game: 1 };

test("the xG components reconcile exactly with each final lambda", () => {
  const result = getExpectedGoalsWithComponents({
    home: homeStats,
    away: awayStats,
    homeTeam,
    awayTeam,
    neutralVenue: true,
    ratingModel: "attack_defense_v2_mismatch_spread",
    priorStrength: 8,
  });
  for (const side of ["home", "away"] as const) {
    const components = result.components[side];
    const total = components.tournamentAvg + components.priorRating + components.recentForm + components.context;
    assert.ok(Math.abs(total - result[side]) < 1e-10);
  }
  const weightTotal = Object.values(result.weightInfo.blendWeights).reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(weightTotal - 1) < 1e-10);
});

test("lambda bootstrap is deterministic, ordered and contains the point estimate", () => {
  const matrix = createScoreMatrix({ homeExpectedGoals: 1.65, awayExpectedGoals: 1.08, maxGoals: 12 });
  const input = {
    lambdaHome: 1.65,
    lambdaAway: 1.08,
    homeGamesPlayed: 3,
    awayGamesPlayed: 3,
    priorWeight: 0.6,
    confidence: "medium" as const,
    pointProbabilities: deriveMarketProbabilities(matrix),
    seed: "fixture-arg-fra",
    samples: 300,
  };
  const first = calculateMarketProbabilityIntervals(input);
  const second = calculateMarketProbabilityIntervals(input);
  assert.deepEqual(first, second);
  assert.equal(first.intervals.length, 7);
  for (const interval of first.intervals) {
    assert.ok(interval.p10 <= interval.p50 && interval.p50 <= interval.p90);
    assert.ok(interval.p10 <= interval.point && interval.point <= interval.p90);
    assert.ok(interval.p10 >= 0 && interval.p90 <= 1);
  }
});
