import assert from "node:assert/strict";
import { simulateGroupFromSchedule } from "../src/lib/tournament/group-simulation-service";
import type { Match, Team } from "../src/lib/types";

const teams: Team[] = [
  { id: "arg", name: "Argentina", code: "ARG", group: "A" },
  { id: "bra", name: "Brasil", code: "BRA", group: "A" },
  { id: "can", name: "Canadá", code: "CAN", group: "A" },
  { id: "nzl", name: "Nueva Zelanda", code: "NZL", group: null },
];

const matches: Match[] = [
  match("m1", "arg", "bra", "finished", 2, 0, "2026-06-11T18:00:00Z"),
  match("m2", "can", "nzl", "finished", 1, 0, "2026-06-11T21:00:00Z"),
  match("m3", "arg", "can", "scheduled", null, null, "2026-06-16T18:00:00Z"),
  match("m4", "bra", "nzl", "scheduled", null, null, "2026-06-16T21:00:00Z"),
  match("m5", "arg", "nzl", "scheduled", null, null, "2026-06-21T18:00:00Z"),
  match("m6", "bra", "can", "scheduled", null, null, "2026-06-21T21:00:00Z"),
];

const input = {
  groupId: "A",
  teams,
  matches,
  simulations: 5_000,
  seed: 424242,
};

const result = simulateGroupFromSchedule(input);
const repeated = simulateGroupFromSchedule(input);
assert.deepEqual(repeated.standings, result.standings, "Seed must reproduce standings/probabilities.");
assert.equal(repeated.seed, result.seed);
assert.equal(result.modelVariant, "xg-v2.1-prior8");
assert.equal(result.calibration, "platt-blend-25");
assert.equal(result.modelSelection, "recommended-simulation-default");
assert.equal(result.usesRecommendedSimulationModel, true);
assert(result.warnings.some((warning) => warning.includes("recommended simulation model")), "Default service model must be explicit in warnings.");
assert(result.warnings.some((warning) => warning.includes("sin metadata de grupo")), "Missing team group metadata should emit a warning.");
assert(result.warnings.some((warning) => warning.includes("sin joins completos")), "Missing match joins should emit a warning.");

const legacyOverride = simulateGroupFromSchedule({
  ...input,
  simulations: 500,
  modelVariant: "legacy-neutral",
  calibration: "none",
});
assert.equal(legacyOverride.modelVariant, "legacy-neutral");
assert.equal(legacyOverride.calibration, "none");
assert.equal(legacyOverride.modelSelection, "explicit-override");
assert.equal(legacyOverride.usesRecommendedSimulationModel, false);
assert(legacyOverride.warnings.some((warning) => warning.includes("override explicito efectivo")), "Explicit override must be visible in warnings.");
assert.throws(() => simulateGroupFromSchedule({ ...input, modelVariant: "experimental-dixon-coles" }), /Dixon-Coles/, "Dixon-Coles must not be used by the service.");

near(result.standings.reduce((sum, row) => sum + row.probabilityAdvance, 0), 2, 1e-12, "advance probability total");
for (const row of result.standings) {
  near(
    row.probabilityWinGroup + row.probabilityFinishSecond + row.probabilityFinishThird + row.probabilityFinishFourth,
    1,
    1e-12,
    `${row.teamCode} finishing positions`
  );
  assert(Object.values(row).filter((value): value is number => typeof value === "number").every(Number.isFinite), `${row.teamCode} contains non-finite output.`);
}

assert.throws(() => simulateGroupFromSchedule({
  ...input,
  matches: [{ ...matches[0], home_score: null }, ...matches.slice(1)],
}), /requires a valid score/, "Finished matches without scores must fail validation.");

console.log(`Group ${result.groupId} service result (${result.simulations.toLocaleString("en-US")} simulations)`);
console.table(result.standings.map((row) => ({
  Team: row.teamCode,
  "Expected pts": row.expectedPoints.toFixed(2),
  Advance: percent(row.probabilityAdvance),
  "Win group": percent(row.probabilityWinGroup),
  Second: percent(row.probabilityFinishSecond),
  Third: percent(row.probabilityFinishThird),
  Fourth: percent(row.probabilityFinishFourth),
})));
console.log(`Warnings: ${result.warnings.length}`);
console.log("Group simulation service verification passed");

function match(
  id: string,
  homeTeamId: string,
  awayTeamId: string,
  status: Match["status"],
  homeScore: number | null,
  awayScore: number | null,
  kickoff: string
): Match {
  return {
    id,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    stage: "Group A",
    kickoff,
    venue: null,
    status,
    home_score: homeScore,
    away_score: awayScore,
    neutralVenue: true,
  };
}

function near(actual: number, expected: number, tolerance: number, label: string): void {
  assert(Math.abs(actual - expected) <= tolerance, `${label}: expected ${actual} near ${expected}.`);
}

function percent(value: number): string { return `${(value * 100).toFixed(1)}%`; }
