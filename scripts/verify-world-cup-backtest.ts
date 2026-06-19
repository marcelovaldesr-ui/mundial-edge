import assert from "node:assert/strict";
import { WORLD_CUP_DATASETS } from "../src/lib/backtesting/world-cup-fixtures";
import { diagnoseXgV2 } from "../src/lib/backtesting/xg-v2-diagnostic";
import { diagnoseDixonColes } from "../src/lib/backtesting/dixon-coles-diagnostic";
import { diagnosePredictionConfidence } from "../src/lib/backtesting/confidence-diagnostic";
import { diagnoseExpandedWorldCups } from "../src/lib/backtesting/expanded-world-cup-diagnostic";
import {
  BACKTEST_VARIANTS,
  brierScore1x2,
  calculateMulticlassMetrics,
  logLoss1x2,
  rankedProbabilityScore1x2,
  runWorldCupBacktest,
  validateWorldCupDatasets,
  type WorldCupBacktestPrediction,
} from "../src/lib/backtesting/world-cup-backtest";

const perfect = { home: 1, draw: 0, away: 0 };
assert.equal(brierScore1x2(perfect, "home"), 0);
assert(logLoss1x2(perfect, "home") < 1e-12);
assert.equal(rankedProbabilityScore1x2(perfect, "home"), 0);

const rows: WorldCupBacktestPrediction[] = [{
  fixtureId: "test",
  tournament: 2022,
  homeTeam: { code: "HOM", name: "Home" },
  awayTeam: { code: "AWY", name: "Away" },
  homeGoals: 1,
  awayGoals: 0,
  stage: "GROUP",
  round: "Matchday 1",
  stageBucket: "GROUP",
  variant: "legacy-neutral",
  probabilities: perfect,
  actual: "home",
  picked: "home",
  groupContextApplied: true,
  neutralVenueApplied: false,
  ratingModel: "legacy_v1",
  priorStrength: null,
  ratingSnapshotYear: 2022,
  ratingFallbackApplied: true,
  dixonColesRho: null,
  dixonColesNormalizationFactor: null,
  predictedHomeGoals: 1,
  predictedAwayGoals: 0,
  correctScoreTop1: true,
  confidenceScore: 75,
  confidenceLabel: "high",
  homeExpectedGoals: 1.5,
  awayExpectedGoals: 1,
  homeRating: 80,
  awayRating: 75,
  homeAttackRating: 82,
  awayAttackRating: 75,
  homeDefenseRating: 78,
  awayDefenseRating: 75,
  homeRatingSource: "manual_seed",
  awayRatingSource: "neutral_fallback",
  homeMatchesBefore: 1,
  awayMatchesBefore: 1,
  homeGoalsForBefore: 1,
  homeGoalsAgainstBefore: 0,
  awayGoalsForBefore: 0,
  awayGoalsAgainstBefore: 1,
}];
assert.equal(calculateMulticlassMetrics(rows).accuracy, 1);

validateWorldCupDatasets(WORLD_CUP_DATASETS);
const report = runWorldCupBacktest(WORLD_CUP_DATASETS);
assert.equal(report.datasetSize, 448);
assert.deepEqual(report.tournaments, [1998, 2002, 2006, 2010, 2014, 2018, 2022]);
assert.equal(report.predictions.length, 448 * BACKTEST_VARIANTS.length);
assert.equal(report.global.length, BACKTEST_VARIANTS.length);
assert.equal(report.byTournament.length, 7);
assert.deepEqual(report.byTournament.map((row) => row.comparisons[0].metrics.count), [64, 64, 64, 64, 64, 64, 64]);
assert.equal(report.byStage.find((row) => row.bucket === "GROUP")?.comparisons[0].metrics.count, 336);
assert.equal(report.byStage.find((row) => row.bucket === "KNOCKOUT")?.comparisons[0].metrics.count, 112);
assert(report.global.every((row) => Number.isFinite(row.metrics.brierScore)));
assert(report.predictions.every((row) => Math.abs(row.probabilities.home + row.probabilities.draw + row.probabilities.away - 1) < 1e-9));
assert(report.predictions.every((row) => Object.values(row.probabilities).every(Number.isFinite)));
assert(report.predictions.filter((row) => row.stageBucket === "KNOCKOUT").every((row) => !row.groupContextApplied));
assert(report.predictions.every((row) => row.neutralVenueApplied));
assert(report.predictions.every((row) => [row.homeExpectedGoals, row.awayExpectedGoals].every((value) => Number.isFinite(value) && value >= 0.2 && value <= 4.5)));
assert(report.predictions.filter((row) => row.stageBucket === "GROUP").every((row) => row.groupContextApplied));
assert.deepEqual([...new Set(report.predictions.filter((row) => row.priorStrength != null).map((row) => row.priorStrength))], [2, 4, 6, 8]);
assert(report.predictions.filter((row) => row.variant === "xg-v2").every((row) => row.priorStrength == null));
assert.deepEqual([...new Set(report.predictions.filter((row) => row.dixonColesRho != null).map((row) => row.dixonColesRho))], [-0.15, -0.1, -0.05]);
assert(report.predictions.filter((row) => row.dixonColesRho != null).every((row) => row.dixonColesNormalizationFactor != null && row.dixonColesNormalizationFactor > 0));
assert(report.predictions.every((row) => Number.isInteger(row.predictedHomeGoals) && Number.isInteger(row.predictedAwayGoals)));
assert(report.predictions.every((row) => row.confidenceScore >= 0 && row.confidenceScore <= 100));
assert(report.predictions.every((row) => ["low", "medium", "high"].includes(row.confidenceLabel)));

const baseline = report.predictions.find((row) => row.variant === "legacy-neutral")!;
const v2 = report.predictions.find((row) => row.variant === "xg-v2" && row.fixtureId === baseline.fixtureId)!;
assert.notEqual(v2.homeExpectedGoals, baseline.homeExpectedGoals);
assert(report.ratingCoverage.every((coverage) => coverage.withSpecificSeed + coverage.withExplicitFallback === coverage.teams));
assert(report.ratingCoverage.every((coverage) => coverage.withExplicitFallback === 0));
assert(report.ratingCoverage.every((coverage) => coverage.matchesWithSnapshot === 64));
assert(report.ratingCoverage.every((coverage) => coverage.snapshotIsHistorical === true));
assert(report.ratingCoverage.every((coverage) => coverage.matchesWithFallback >= 0 && coverage.teamsWithoutRating === coverage.withExplicitFallback));
assert(report.predictions.every((row) => row.ratingSnapshotYear === row.tournament));
assert(report.predictions.every((row) => row.round.length > 0));
const missingSnapshotReport = runWorldCupBacktest([{ ...WORLD_CUP_DATASETS[0], ratingSnapshotYear: 1994 }]);
assert.equal(missingSnapshotReport.ratingCoverage[0].matchesWithSnapshot, 0);
assert.equal(missingSnapshotReport.ratingCoverage[0].matchesWithFallback, 64);
assert.equal(missingSnapshotReport.ratingCoverage[0].teamsWithoutRating, 32);
assert(missingSnapshotReport.predictions.every((row) => row.ratingFallbackApplied));

const invalidDataset = {
  ...WORLD_CUP_DATASETS[0],
  fixtures: [{ ...WORLD_CUP_DATASETS[0].fixtures[0], homeGoals: Number.NaN }],
};
assert.throws(() => validateWorldCupDatasets([invalidDataset]), /Invalid result/);

const diagnostic = diagnoseXgV2(report);
assert.equal(diagnostic.matches.length, 2688);
assert.equal(diagnostic.segments.length, 6);
assert.equal(diagnostic.global.variants.length, 6);
assert.equal(diagnostic.segments.find((row) => row.segment === "GROUP")!.variants[0].metrics.count, 336);
assert.equal(diagnostic.segments.find((row) => row.segment === "KNOCKOUT")!.variants[0].metrics.count, 112);
assert.equal(diagnostic.segments.find((row) => row.segment === "LOW_GOALS_0_2")!.variants[0].metrics.count > 0, true);
assert.deepEqual(diagnostic.guardrails, {
  probabilityViolations: 0,
  nonFiniteValues: 0,
  xgRangeViolations: 0,
  neutralVenueViolations: 0,
  fallbackMetadataViolations: 0,
});

const dixonColesDiagnostic = diagnoseDixonColes(report);
assert.equal(dixonColesDiagnostic.global.length, 8);
assert(dixonColesDiagnostic.lowGoals[0].metrics.count > 69);
assert(dixonColesDiagnostic.draws[0].metrics.count > 0);
assert.equal(dixonColesDiagnostic.calibrationBuckets.length, 32);
assert(dixonColesDiagnostic.global.every((row) => Number.isFinite(row.correctScoreTop1) && Number.isFinite(row.drawBrier)));

const confidenceDiagnostic = diagnosePredictionConfidence(report);
assert.equal(confidenceDiagnostic.rows.length, 6);
assert(confidenceDiagnostic.rows.filter((row) => row.variant === "legacy-neutral").reduce((sum, row) => sum + row.count, 0) === 448);
assert(confidenceDiagnostic.rows.every((row) => row.coverage >= 0 && row.coverage <= 1));

const expandedDiagnostic = diagnoseExpandedWorldCups(report);
assert.equal(expandedDiagnostic.global.length, 4);
assert.equal(expandedDiagnostic.byTournament.length, 28);
assert.equal(expandedDiagnostic.stability.reduce((sum, row) => sum + row.worldCupsWon, 0), 7);
assert(expandedDiagnostic.byType.every((row) => Number.isFinite(row.metrics.brierScore)));
assert.equal(expandedDiagnostic.priorComparison.matches, 448);
assert.equal(expandedDiagnostic.priorComparison.prior8BeatsLegacyEveryWorldCup, true);
assert.equal(expandedDiagnostic.priorComparison.prior6WorldCupsBetter, 6);
assert.equal(expandedDiagnostic.priorComparison.prior8WorldCupsBetter, 1);
assert.equal(expandedDiagnostic.priorComparison.statisticallyDistinct, false);

console.log("World Cup backtest verification passed");
