import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getTopScorelines } from "../../src/lib/stat-model";
import { edgeToParlayPick, generateParlays } from "../../src/lib/parlays";
import { simulateWorldCup2026FromSchedules } from "../../src/lib/tournament/group-simulation-service";
import { createLaunchRehearsalFixtures, buildLaunchPredictions, createSyntheticMarketIntegration, LAUNCH_MODEL_CONFIG } from "./fixtures";

const fixtures = createLaunchRehearsalFixtures();
assert(fixtures.teams.length === 48, "Expected 48 launch-rehearsal teams.");
assert(fixtures.matches.length === 72, "Expected 72 group-stage matches.");

const predictions = buildLaunchPredictions(fixtures);
assert(predictions.length === 72, "Every group-stage match must have a prediction.");
const predictionArtifact = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  dataset: fixtures.dataset,
  model: LAUNCH_MODEL_CONFIG,
  warnings: fixtures.warnings,
  teams: fixtures.teams.length,
  matches: predictions.map((prediction) => ({
    matchId: prediction.matchId,
    homeTeam: prediction.homeTeam,
    awayTeam: prediction.awayTeam,
    homeExpectedGoals: prediction.homeExpectedGoals,
    awayExpectedGoals: prediction.awayExpectedGoals,
    lambdas: prediction.lambdas,
    markets: prediction.marketProbabilities,
    confidence: prediction.confidence,
    confidenceScore: prediction.confidenceResult.score,
    probabilityIntervals: prediction.probabilityIntervals,
    explanation: prediction.explanation,
    topScorelines: getTopScorelines(prediction.scoreMatrix, 3),
  })),
};

const simulation = simulateWorldCup2026FromSchedules({
  groups: fixtures.groups,
  simulations: 10_000,
  seed: 20260618,
  modelVariant: LAUNCH_MODEL_CONFIG.modelVariant,
  calibration: LAUNCH_MODEL_CONFIG.calibration,
});
const advanceSum = simulation.groups.flatMap((group) => group.standings).reduce((sum, team) => sum + team.probabilityAdvance, 0);
assert(Math.abs(advanceSum - 32) <= 0.01, `Expected total advancement probability 32.0; received ${advanceSum}.`);
const simulationArtifact = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  dataset: fixtures.dataset,
  model: LAUNCH_MODEL_CONFIG,
  simulations: simulation.simulations,
  qualifiersPerSimulation: simulation.qualifiersPerSimulation,
  probabilityAdvanceSum: advanceSum,
  groups: simulation.groups.map((group) => ({ groupId: group.groupId, teams: group.standings })),
  thirdPlaceQualificationByPoints: simulation.thirdPlaceQualificationByPoints,
  warnings: [...fixtures.warnings, ...simulation.warnings],
};

const integration = createSyntheticMarketIntegration(fixtures, predictions);
assert(integration.overrounds.every((value) => Math.abs(value - 1.06) < 1e-10), "Synthetic market overround must be exactly 1.06.");
const picks = integration.edges.map(edgeToParlayPick);
const parlays = generateParlays(picks, {
  profile: "balanced",
  minEdge: 0.02,
  minConfidence: "low",
  allowLowConfidence: true,
  maxResults: 50,
  maxLegs: 3,
  maxTotalOdds: 12,
  now: "2026-06-01T00:00:00.000Z",
  scoreMatricesByMatchId: Object.fromEntries(predictions.map((row) => [row.matchId, row.scoreMatrix])),
});
assert(parlays.length >= 20, `Expected at least 20 parlays; received ${parlays.length}.`);
assert(parlays.every((parlay) => noContradictorySelections(parlay.picks)), "Parlays must not contain contradictory same-match selections.");

writeJson("data/e2e/group-stage-predictions.json", predictionArtifact);
writeJson("data/e2e/simulation-results.json", simulationArtifact);
for (const path of ["data/e2e/group-stage-predictions.json", "data/e2e/simulation-results.json"]) JSON.parse(readFileSync(resolve(path), "utf8"));

console.log(`E2E launch rehearsal passed | teams=${fixtures.teams.length} matches=${predictions.length} simulations=${simulation.simulations} advanceSum=${advanceSum.toFixed(4)} parlays=${parlays.length}`);

function noContradictorySelections(picks: Array<{ matchId: string; market: string; selection: string }>): boolean {
  const seen = new Set<string>();
  for (const pick of picks) {
    const key = `${pick.matchId}:${pick.market}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

function writeJson(path: string, value: unknown): void {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
