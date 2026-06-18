import assert from "node:assert/strict";
import { simulateGroupStage, type GroupSimulationInput } from "../src/lib/tournament/group-simulation";
import type { Match, Team } from "../src/lib/types";

const teams: Team[] = [
  { id: "arg", name: "Argentina", code: "ARG", group: "A" },
  { id: "bra", name: "Brasil", code: "BRA", group: "A" },
  { id: "can", name: "Canadá", code: "CAN", group: "A" },
  { id: "nzl", name: "Nueva Zelanda", code: "NZL", group: "A" },
];

const playedMatches: Match[] = [
  finished("m1", "arg", "bra", 2, 0, "2026-06-11T18:00:00Z"),
  finished("m2", "can", "nzl", 1, 0, "2026-06-11T21:00:00Z"),
  finished("m3", "arg", "can", 2, 0, "2026-06-16T18:00:00Z"),
  finished("m4", "bra", "nzl", 2, 0, "2026-06-16T21:00:00Z"),
];

const remainingMatches: Match[] = [
  scheduled("m5", "arg", "nzl", "2026-06-21T18:00:00Z"),
  scheduled("m6", "bra", "can", "2026-06-21T21:00:00Z"),
];

const input: GroupSimulationInput = {
  groupId: "A",
  teams,
  playedMatches,
  remainingMatches,
  simulations: 10_000,
  modelVariant: "xg-v2.1-prior8",
  calibration: "platt-blend-25",
  seed: 20260618,
};

const result = simulateGroupStage(input);
const repeated = simulateGroupStage(input);
assert.deepEqual(repeated, result, "The same seed and input must reproduce the exact result.");

for (const team of result.teams) {
  const finishTotal = team.probabilityWinGroup + team.probabilityFinishSecond
    + team.probabilityFinishThird + team.probabilityFinishFourth;
  near(finishTotal, 1, 1e-12, `${team.teamCode} finish probabilities`);
  assert(Object.values(team).filter((value): value is number => typeof value === "number").every(Number.isFinite), `${team.teamCode} must not contain NaN/Infinity.`);
}
near(result.teams.reduce((sum, team) => sum + team.probabilityAdvance, 0), 2, 1e-12, "group advancement sum");
assert(result.teams.find((team) => team.teamCode === "ARG")!.probabilityAdvance > 0.95, "A team already on six points should have a high advancement probability.");

const completedMatches = [
  ...playedMatches,
  finished("m5", "arg", "nzl", 1, 0, "2026-06-21T18:00:00Z"),
  finished("m6", "bra", "can", 1, 1, "2026-06-21T21:00:00Z"),
];
const completed = simulateGroupStage({
  groupId: "A", teams, playedMatches: completedMatches, remainingMatches: [], simulations: 200, seed: 99,
});
const completedAgain = simulateGroupStage({
  groupId: "A", teams, playedMatches: completedMatches, remainingMatches: [], simulations: 1, seed: 99,
});
for (const team of completed.teams) {
  const once = completedAgain.teams.find((row) => row.teamId === team.teamId)!;
  assert.deepEqual(team, once, "A completed group must be deterministic regardless of simulation count.");
  assert([team.probabilityWinGroup, team.probabilityFinishSecond, team.probabilityFinishThird, team.probabilityFinishFourth].filter((value) => value === 1).length === 1, "Completed teams must have one deterministic finishing position.");
}

console.log(`Group ${result.groupId} Monte Carlo (${result.simulations.toLocaleString("en-US")} simulations, seed ${result.seed})`);
console.table([...result.teams]
  .sort((a, b) => b.probabilityAdvance - a.probabilityAdvance)
  .map((team) => ({
    Team: team.teamCode,
    "Expected pts": team.expectedPoints.toFixed(2),
    "Advance": percent(team.probabilityAdvance),
    "Win group": percent(team.probabilityWinGroup),
    "2nd": percent(team.probabilityFinishSecond),
    "3rd": percent(team.probabilityFinishThird),
    "4th": percent(team.probabilityFinishFourth),
    "Avg GD": team.averageGoalDifference.toFixed(2),
  })));
console.log("Group simulation verification passed");

function finished(id: string, home: string, away: string, homeScore: number, awayScore: number, kickoff: string): Match {
  return { id, home_team_id: home, away_team_id: away, stage: "Group A", kickoff, venue: null, status: "finished", home_score: homeScore, away_score: awayScore, neutralVenue: true };
}

function scheduled(id: string, home: string, away: string, kickoff: string): Match {
  return { id, home_team_id: home, away_team_id: away, stage: "Group A", kickoff, venue: null, status: "scheduled", home_score: null, away_score: null, neutralVenue: true };
}

function near(actual: number, expected: number, tolerance: number, label: string): void {
  assert(Math.abs(actual - expected) <= tolerance, `${label}: expected ${actual} to be near ${expected}.`);
}

function percent(value: number): string { return `${(value * 100).toFixed(1)}%`; }
