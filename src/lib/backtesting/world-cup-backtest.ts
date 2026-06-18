import { estimateExpectedGoals, type ExpectedGoalsDiagnosticBreakdown, type ExpectedGoalsRatingModel } from "../stat-model/expected-goals";
import { applyDixonColesAdjustment, type DixonColesRho } from "../stat-model/dixon-coles";
import { calculatePredictionConfidence, type PredictionConfidenceLabel } from "../stat-model/confidence-score";
import { probabilityForSelection } from "../stat-model/market-probabilities";
import { createScoreMatrix } from "../stat-model/score-matrix";
import {
  getAttackStrength,
  getDefenseStrength,
  getOverallStrength,
  neutralTeamStrengthRating,
  type TeamStrengthRating,
} from "../stat-model/team-strength-ratings";
import { TEAM_RATING_SNAPSHOTS } from "../stat-model/rating-snapshots";
import { getWorldCupGroupContext } from "../world-cup/group-context";
import type { Match, Team, TeamStats } from "../types";
import type {
  HistoricalWorldCupDataset,
  HistoricalWorldCupFixture,
  HistoricalWorldCupStage,
} from "./world-cup-fixtures";

export type OneXTwoOutcome = "home" | "draw" | "away";
export type BacktestVariant =
  | "legacy-neutral"
  | "xg-v2"
  | "xg-v2.1-prior2"
  | "xg-v2.1-prior4"
  | "xg-v2.1-prior6"
  | "xg-v2.1-prior8"
  | "xg-v2.2-mismatch-spread"
  | "legacy-neutral-dc-rho-0.15"
  | "legacy-neutral-dc-rho-0.10"
  | "legacy-neutral-dc-rho-0.05"
  | "xg-v2.1-prior8-dc-rho-0.15"
  | "xg-v2.1-prior8-dc-rho-0.10"
  | "xg-v2.1-prior8-dc-rho-0.05";
export type BacktestStageBucket = "ALL" | "GROUP" | "KNOCKOUT" | Exclude<HistoricalWorldCupStage, "GROUP">;

export interface OneXTwoProbabilities { home: number; draw: number; away: number }

export interface HistoricalRatingSet {
  id: string;
  snapshotYear: number | null;
  ratings: TeamStrengthRating[];
  source: "current_seed_fallback" | "historical_pre_tournament" | "derived_current_seed_snapshot" | "missing_snapshot_fallback";
  isHistorical: boolean;
}

export interface WorldCupBacktestPrediction {
  fixtureId: string;
  tournament: number;
  homeTeam: { code: string; name: string };
  awayTeam: { code: string; name: string };
  homeGoals: number;
  awayGoals: number;
  stage: HistoricalWorldCupStage;
  round: string;
  stageBucket: Exclude<BacktestStageBucket, "ALL">;
  variant: BacktestVariant;
  probabilities: OneXTwoProbabilities;
  actual: OneXTwoOutcome;
  picked: OneXTwoOutcome;
  groupContextApplied: boolean;
  neutralVenueApplied: boolean;
  ratingModel: ExpectedGoalsRatingModel;
  priorStrength: number | null;
  ratingSnapshotYear: number | null;
  ratingFallbackApplied: boolean;
  dixonColesRho: DixonColesRho | null;
  dixonColesNormalizationFactor: number | null;
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  correctScoreTop1: boolean;
  confidenceScore: number;
  confidenceLabel: PredictionConfidenceLabel;
  homeExpectedGoals: number;
  awayExpectedGoals: number;
  homeRating: number;
  awayRating: number;
  homeAttackRating: number;
  awayAttackRating: number;
  homeDefenseRating: number;
  awayDefenseRating: number;
  homeRatingSource: TeamStrengthRating["source"];
  awayRatingSource: TeamStrengthRating["source"];
  homeMatchesBefore: number;
  awayMatchesBefore: number;
  homeGoalsForBefore: number;
  homeGoalsAgainstBefore: number;
  awayGoalsForBefore: number;
  awayGoalsAgainstBefore: number;
  expectedGoalsDiagnostic?: ExpectedGoalsDiagnosticBreakdown;
}

export interface MulticlassMetrics {
  count: number;
  brierScore: number;
  logLoss: number;
  rankedProbabilityScore: number;
  accuracy: number;
}

export interface MetricDelta {
  brierScore: number;
  logLoss: number;
  rankedProbabilityScore: number;
  accuracy: number;
}

export interface MetricComparison {
  variant: BacktestVariant;
  metrics: MulticlassMetrics;
  deltaVsLegacyNeutral: MetricDelta;
}

export interface RatingCoverage {
  tournament: number;
  ratingSet: string;
  ratingSnapshotYear: number | null;
  teams: number;
  withSpecificSeed: number;
  withExplicitFallback: number;
  matchesWithSnapshot: number;
  matchesWithFallback: number;
  teamsWithoutRating: number;
  snapshotIsHistorical: boolean;
}

export interface WorldCupBacktestReport {
  datasetSize: number;
  tournaments: number[];
  predictions: WorldCupBacktestPrediction[];
  global: MetricComparison[];
  byTournament: Array<{ tournament: number; comparisons: MetricComparison[] }>;
  byStage: Array<{ bucket: BacktestStageBucket; comparisons: MetricComparison[] }>;
  ratingCoverage: RatingCoverage[];
  warnings: string[];
}

export const BACKTEST_VARIANTS: BacktestVariant[] = [
  "legacy-neutral",
  "xg-v2",
  "xg-v2.1-prior2",
  "xg-v2.1-prior4",
  "xg-v2.1-prior6",
  "xg-v2.1-prior8",
  "xg-v2.2-mismatch-spread",
  "legacy-neutral-dc-rho-0.15",
  "legacy-neutral-dc-rho-0.10",
  "legacy-neutral-dc-rho-0.05",
  "xg-v2.1-prior8-dc-rho-0.15",
  "xg-v2.1-prior8-dc-rho-0.10",
  "xg-v2.1-prior8-dc-rho-0.05",
];

export const DEFAULT_HISTORICAL_RATING_SETS: HistoricalRatingSet[] = TEAM_RATING_SNAPSHOTS.map((snapshot) => ({
  id: snapshot.id,
  snapshotYear: snapshot.year,
  ratings: snapshot.ratings,
  source: snapshot.isHistorical ? "historical_pre_tournament" : snapshot.year === 2026 ? "current_seed_fallback" : "derived_current_seed_snapshot",
  isHistorical: snapshot.isHistorical,
}));

export function brierScore1x2(probabilities: OneXTwoProbabilities, actual: OneXTwoOutcome): number {
  return outcomes().reduce((sum, result) => sum + Math.pow(probabilities[result] - (result === actual ? 1 : 0), 2), 0);
}

export function logLoss1x2(probabilities: OneXTwoProbabilities, actual: OneXTwoOutcome): number {
  return -Math.log(clamp(probabilities[actual], 1e-15, 1 - 1e-15));
}

export function rankedProbabilityScore1x2(probabilities: OneXTwoProbabilities, actual: OneXTwoOutcome): number {
  const observed = actual === "home" ? [1, 1] : actual === "draw" ? [0, 1] : [0, 0];
  const forecast = [probabilities.home, probabilities.home + probabilities.draw];
  return (Math.pow(forecast[0] - observed[0], 2) + Math.pow(forecast[1] - observed[1], 2)) / 2;
}

export function calculateMulticlassMetrics(predictions: WorldCupBacktestPrediction[]): MulticlassMetrics {
  if (!predictions.length) return { count: 0, brierScore: 0, logLoss: 0, rankedProbabilityScore: 0, accuracy: 0 };
  return {
    count: predictions.length,
    brierScore: average(predictions.map((row) => brierScore1x2(row.probabilities, row.actual))),
    logLoss: average(predictions.map((row) => logLoss1x2(row.probabilities, row.actual))),
    rankedProbabilityScore: average(predictions.map((row) => rankedProbabilityScore1x2(row.probabilities, row.actual))),
    accuracy: predictions.filter((row) => row.picked === row.actual).length / predictions.length,
  };
}

export function runWorldCupBacktest(
  datasets: HistoricalWorldCupDataset[],
  ratingSets: HistoricalRatingSet[] = DEFAULT_HISTORICAL_RATING_SETS
): WorldCupBacktestReport {
  validateWorldCupDatasets(datasets, ratingSets);
  const predictions: WorldCupBacktestPrediction[] = [];
  const ratingCoverage: RatingCoverage[] = [];
  const ratingSetsByYear = new Map(ratingSets.filter((set) => set.snapshotYear != null).map((set) => [set.snapshotYear!, set]));

  for (const dataset of [...datasets].sort((a, b) => a.year - b.year)) {
    const snapshotYear = dataset.ratingSnapshotYear ?? dataset.year;
    const ratingSet = ratingSetsByYear.get(snapshotYear) ?? missingSnapshotRatingSet(snapshotYear);
    const resolver = createRatingResolver(ratingSet);
    ratingCoverage.push(calculateRatingCoverage(dataset, ratingSet));
    for (const variant of BACKTEST_VARIANTS) {
      predictions.push(...evaluateTournament(dataset, variant, resolver));
    }
  }

  const tournaments = datasets.map((dataset) => dataset.year).sort();
  const global = comparisons(predictions);
  const byTournament = tournaments.map((tournament) => ({
    tournament,
    comparisons: comparisons(predictions.filter((row) => row.tournament === tournament)),
  }));
  const byStage = ([
    "ALL", "GROUP", "KNOCKOUT", "ROUND_OF_16", "QUARTER_FINAL", "SEMI_FINAL", "THIRD_PLACE", "FINAL",
  ] as BacktestStageBucket[]).map((bucket) => ({
    bucket,
    comparisons: comparisons(filterByStageBucket(predictions, bucket)),
  }));

  return {
    datasetSize: datasets.reduce((sum, dataset) => sum + dataset.fixtures.length, 0),
    tournaments,
    predictions,
    global,
    byTournament,
    byStage,
    ratingCoverage,
    warnings: [
      `Corpus completo para ${tournaments.join(", ")}; Mundiales anteriores a 1998 aun no estan incorporados.`,
      "Los snapshots 1998-2022 son estimaciones manuales pseudo-historicas pre-torneo; no son Elo externo ni ratings oficiales.",
      "El 1X2 de eliminatorias usa marcador a 90 minutos; excluye prorroga y penales.",
      "Todas las variantes usan sede neutral; legacy-neutral es la baseline de comparacion.",
      "xG v2.1 y Dixon-Coles son solo experimentales; no reemplazan el modelo productivo.",
      "Stats y standings solo incluyen partidos anteriores para evitar leakage.",
      "No hay cuotas historicas: se evalua calibracion 1X2, no edge, EV ni ROI.",
    ],
  };
}

function filterByStageBucket(
  predictions: WorldCupBacktestPrediction[],
  bucket: BacktestStageBucket
): WorldCupBacktestPrediction[] {
  if (bucket === "ALL") return predictions;
  if (bucket === "GROUP" || bucket === "KNOCKOUT") return predictions.filter((row) => row.stageBucket === bucket);
  return predictions.filter((row) => row.stage === bucket);
}

export function validateWorldCupDatasets(
  datasets: HistoricalWorldCupDataset[],
  ratingSets: HistoricalRatingSet[] = DEFAULT_HISTORICAL_RATING_SETS
): void {
  const ids = new Set<string>();
  for (const dataset of datasets) {
    if (!dataset.fixtures.length) throw new Error(`No fixtures for ${dataset.year}.`);
    const orders = new Set<number>();
    for (const fixture of dataset.fixtures) {
      if (fixture.year !== dataset.year) throw new Error(`Fixture ${fixture.id} has mismatched year.`);
      if (ids.has(fixture.id)) throw new Error(`Duplicate fixture id ${fixture.id}.`);
      if (orders.has(fixture.order)) throw new Error(`Duplicate order ${fixture.order} in ${fixture.year}.`);
      ids.add(fixture.id);
      orders.add(fixture.order);
      if (!validScore(fixture.homeGoals) || !validScore(fixture.awayGoals)) throw new Error(`Invalid result for ${fixture.id}.`);
      if (!fixture.homeTeam.code || !fixture.awayTeam.code || fixture.homeTeam.code === fixture.awayTeam.code) throw new Error(`Invalid teams for ${fixture.id}.`);
      if (!Number.isFinite(Date.parse(fixture.date))) throw new Error(`Invalid date for ${fixture.id}.`);
      if (fixture.neutralVenue !== true) throw new Error(`Fixture ${fixture.id} must be neutral.`);
      if (fixture.stage === "GROUP" && !fixture.group) throw new Error(`Group missing for ${fixture.id}.`);
      if (fixture.stage !== "GROUP" && fixture.group != null) throw new Error(`Unexpected group for ${fixture.id}.`);
      if (!fixture.round.trim()) throw new Error(`Round missing for ${fixture.id}.`);
    }
  }
}

function evaluateTournament(
  dataset: HistoricalWorldCupDataset,
  variant: BacktestVariant,
  ratingResolver: (team: Team) => TeamStrengthRating
): WorldCupBacktestPrediction[] {
  const fixtures = [...dataset.fixtures].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  const stats = new Map<string, TeamStats>();
  const matches = fixtures.map(toScheduledMatch);
  const rows: WorldCupBacktestPrediction[] = [];
  const config = variantConfig(variant);

  for (const fixture of fixtures) {
    const match = matches.find((item) => item.id === fixture.id)!;
    const isGroup = fixture.stage === "GROUP";
    const groupContext = isGroup && config.useGroupContext
      ? getWorldCupGroupContext(match, matches)
      : undefined;
    const homeStats = stats.get(fixture.homeTeam.code) ?? emptyStats(fixture.homeTeam.code);
    const awayStats = stats.get(fixture.awayTeam.code) ?? emptyStats(fixture.awayTeam.code);
    const homeRating = ratingResolver(match.home_team!);
    const awayRating = ratingResolver(match.away_team!);
    const xg = estimateExpectedGoals({
      home: homeStats,
      away: awayStats,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      groupContext,
      ratingResolver,
      neutralVenue: config.useNeutralVenue ? fixture.neutralVenue : false,
      ratingModel: config.ratingModel,
      priorStrength: config.priorStrength ?? undefined,
    });
    assertExpectedGoals(xg.homeExpectedGoals, xg.awayExpectedGoals, fixture.id);
    const poissonMatrix = createScoreMatrix({ homeExpectedGoals: xg.homeExpectedGoals, awayExpectedGoals: xg.awayExpectedGoals, maxGoals: 12 });
    const dcAdjustment = config.dixonColesRho == null ? null : applyDixonColesAdjustment(poissonMatrix, config.dixonColesRho);
    const matrix = dcAdjustment?.matrix ?? poissonMatrix;
    const probabilities = normalizeAndValidateProbabilities({
      home: probabilityForSelection(matrix, "home_win"),
      draw: probabilityForSelection(matrix, "draw"),
      away: probabilityForSelection(matrix, "away_win"),
    }, fixture.id);
    const actual = outcome(fixture.homeGoals, fixture.awayGoals);
    const topScore = matrix.entries.reduce((best, entry) => entry.probability > best.probability ? entry : best);
    const minGames = Math.min(homeStats.matches_played, awayStats.matches_played);
    const priorWeight = config.priorStrength != null
      ? config.priorStrength / (minGames + config.priorStrength)
      : (xg.blend.homeRatingWeight + xg.blend.awayRatingWeight) / 2;
    const confidence = calculatePredictionConfidence({
      probabilities,
      homeGamesPlayed: homeStats.matches_played,
      awayGamesPlayed: awayStats.matches_played,
      priorWeight,
      scoreMatrix: matrix,
      homeRatingFallback: homeRating.source === "neutral_fallback",
      awayRatingFallback: awayRating.source === "neutral_fallback",
      groupContext,
    });
    rows.push({
      fixtureId: fixture.id,
      tournament: fixture.year,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      homeGoals: fixture.homeGoals,
      awayGoals: fixture.awayGoals,
      stage: fixture.stage,
      round: fixture.round,
      stageBucket: isGroup ? "GROUP" : "KNOCKOUT",
      variant,
      probabilities,
      actual,
      picked: primaryPick(probabilities),
      groupContextApplied: Boolean(groupContext),
      neutralVenueApplied: config.useNeutralVenue && fixture.neutralVenue,
      ratingModel: config.ratingModel,
      priorStrength: config.priorStrength,
      ratingSnapshotYear: dataset.ratingSnapshotYear,
      ratingFallbackApplied: homeRating.source === "neutral_fallback" || awayRating.source === "neutral_fallback",
      dixonColesRho: config.dixonColesRho,
      dixonColesNormalizationFactor: dcAdjustment?.metadata.normalizationFactor ?? null,
      predictedHomeGoals: topScore.homeGoals,
      predictedAwayGoals: topScore.awayGoals,
      correctScoreTop1: topScore.homeGoals === fixture.homeGoals && topScore.awayGoals === fixture.awayGoals,
      confidenceScore: confidence.score,
      confidenceLabel: confidence.label,
      homeExpectedGoals: xg.homeExpectedGoals,
      awayExpectedGoals: xg.awayExpectedGoals,
      homeRating: getOverallStrength(homeRating),
      awayRating: getOverallStrength(awayRating),
      homeAttackRating: getAttackStrength(homeRating),
      awayAttackRating: getAttackStrength(awayRating),
      homeDefenseRating: getDefenseStrength(homeRating),
      awayDefenseRating: getDefenseStrength(awayRating),
      homeRatingSource: homeRating.source,
      awayRatingSource: awayRating.source,
      homeMatchesBefore: homeStats.matches_played,
      awayMatchesBefore: awayStats.matches_played,
      homeGoalsForBefore: homeStats.goals_for,
      homeGoalsAgainstBefore: homeStats.goals_against,
      awayGoalsForBefore: awayStats.goals_for,
      awayGoalsAgainstBefore: awayStats.goals_against,
      expectedGoalsDiagnostic: xg.diagnostic,
    });
    updateStats(stats, fixture);
    match.status = "finished";
    match.home_score = fixture.homeGoals;
    match.away_score = fixture.awayGoals;
  }
  return rows;
}

function variantConfig(variant: BacktestVariant): {
  useNeutralVenue: boolean;
  useGroupContext: boolean;
  ratingModel: ExpectedGoalsRatingModel;
  priorStrength: number | null;
  dixonColesRho: DixonColesRho | null;
} {
  const dixonColesRho = dixonColesRhoForVariant(variant);
  if (variant === "legacy-neutral" || variant.startsWith("legacy-neutral-dc")) {
    return { useNeutralVenue: true, useGroupContext: true, ratingModel: "legacy_v1", priorStrength: null, dixonColesRho };
  }
  if (variant === "xg-v2") {
    return { useNeutralVenue: true, useGroupContext: true, ratingModel: "attack_defense_v2", priorStrength: null, dixonColesRho: null };
  }
  if (variant === "xg-v2.2-mismatch-spread") {
    return {
      useNeutralVenue: true,
      useGroupContext: true,
      ratingModel: "attack_defense_v2_mismatch_spread",
      priorStrength: 8,
      dixonColesRho: null,
    };
  }
  const priorStrength = variant.includes("prior8") ? 8 : Number(variant.slice("xg-v2.1-prior".length));
  return { useNeutralVenue: true, useGroupContext: true, ratingModel: "attack_defense_v2", priorStrength, dixonColesRho };
}

function dixonColesRhoForVariant(variant: BacktestVariant): DixonColesRho | null {
  if (variant.endsWith("dc-rho-0.15")) return -0.15;
  if (variant.endsWith("dc-rho-0.10")) return -0.10;
  if (variant.endsWith("dc-rho-0.05")) return -0.05;
  return null;
}

function comparisons(rows: WorldCupBacktestPrediction[]): MetricComparison[] {
  const metricsByVariant = new Map(BACKTEST_VARIANTS.map((variant) => [
    variant,
    calculateMulticlassMetrics(rows.filter((row) => row.variant === variant)),
  ]));
  const baseline = metricsByVariant.get("legacy-neutral")!;
  return BACKTEST_VARIANTS.map((variant) => {
    const metrics = metricsByVariant.get(variant)!;
    return { variant, metrics, deltaVsLegacyNeutral: delta(metrics, baseline) };
  });
}

function delta(metrics: MulticlassMetrics, baseline: MulticlassMetrics): MetricDelta {
  return {
    brierScore: metrics.brierScore - baseline.brierScore,
    logLoss: metrics.logLoss - baseline.logLoss,
    rankedProbabilityScore: metrics.rankedProbabilityScore - baseline.rankedProbabilityScore,
    accuracy: metrics.accuracy - baseline.accuracy,
  };
}

function createRatingResolver(ratingSet: HistoricalRatingSet): (team: Team) => TeamStrengthRating {
  const byCode = new Map(ratingSet.ratings.map((rating) => [rating.teamCode, rating]));
  return (team) => byCode.get(team.code) ?? neutralTeamStrengthRating(team.code, team.name);
}

function missingSnapshotRatingSet(year: number): HistoricalRatingSet {
  return {
    id: `missing-rating-snapshot-${year}`,
    snapshotYear: null,
    ratings: [],
    source: "missing_snapshot_fallback",
    isHistorical: false,
  };
}

function calculateRatingCoverage(dataset: HistoricalWorldCupDataset, ratingSet: HistoricalRatingSet): RatingCoverage {
  const codes = new Map<string, string>();
  for (const fixture of dataset.fixtures) {
    codes.set(fixture.homeTeam.code, fixture.homeTeam.name);
    codes.set(fixture.awayTeam.code, fixture.awayTeam.name);
  }
  const available = new Set(ratingSet.ratings.map((rating) => rating.teamCode));
  const withSpecificSeed = [...codes.keys()].filter((code) => available.has(code)).length;
  const teamsWithoutRating = codes.size - withSpecificSeed;
  const matchesWithFallback = dataset.fixtures.filter((fixture) => !available.has(fixture.homeTeam.code) || !available.has(fixture.awayTeam.code)).length;
  const hasSnapshot = ratingSet.source !== "missing_snapshot_fallback";
  return {
    tournament: dataset.year,
    ratingSet: ratingSet.id,
    ratingSnapshotYear: ratingSet.snapshotYear,
    teams: codes.size,
    withSpecificSeed,
    withExplicitFallback: teamsWithoutRating,
    matchesWithSnapshot: hasSnapshot ? dataset.fixtures.length : 0,
    matchesWithFallback,
    teamsWithoutRating,
    snapshotIsHistorical: ratingSet.isHistorical,
  };
}

function toScheduledMatch(fixture: HistoricalWorldCupFixture): Match {
  const group = fixture.group;
  const home = team(fixture.year, fixture.homeTeam.code, fixture.homeTeam.name, group);
  const away = team(fixture.year, fixture.awayTeam.code, fixture.awayTeam.name, group);
  return {
    id: fixture.id,
    home_team_id: home.id,
    away_team_id: away.id,
    stage: fixture.stage === "GROUP" ? `Group ${group}` : stageLabel(fixture.stage),
    kickoff: `${fixture.date}T12:00:00.000Z`,
    venue: "Neutral",
    status: "scheduled",
    home_score: null,
    away_score: null,
    neutralVenue: fixture.neutralVenue,
    home_team: home,
    away_team: away,
  };
}

function stageLabel(stage: HistoricalWorldCupStage): string {
  const labels: Record<HistoricalWorldCupStage, string> = {
    GROUP: "Group", ROUND_OF_16: "Round of 16", QUARTER_FINAL: "Quarter Final",
    SEMI_FINAL: "Semi Final", THIRD_PLACE: "Third Place", FINAL: "Final",
  };
  return labels[stage];
}

function team(year: number, code: string, name: string, group: string | null): Team {
  return { id: `${year}-${code}`, code, name, group };
}

function emptyStats(teamId: string): TeamStats {
  return { team_id: teamId, matches_played: 0, goals_for: 0, goals_against: 0, goal_diff: 0, recent_form: [], gf_per_game: 0, ga_per_game: 0 };
}

function updateStats(stats: Map<string, TeamStats>, fixture: HistoricalWorldCupFixture): void {
  const home = stats.get(fixture.homeTeam.code) ?? emptyStats(fixture.homeTeam.code);
  const away = stats.get(fixture.awayTeam.code) ?? emptyStats(fixture.awayTeam.code);
  const result = outcome(fixture.homeGoals, fixture.awayGoals);
  stats.set(fixture.homeTeam.code, addResult(home, fixture.homeGoals, fixture.awayGoals, result === "home" ? "W" : result === "away" ? "L" : "D"));
  stats.set(fixture.awayTeam.code, addResult(away, fixture.awayGoals, fixture.homeGoals, result === "home" ? "L" : result === "away" ? "W" : "D"));
}

function addResult(stats: TeamStats, goalsFor: number, goalsAgainst: number, result: "W" | "D" | "L"): TeamStats {
  const matchesPlayed = stats.matches_played + 1;
  const totalFor = stats.goals_for + goalsFor;
  const totalAgainst = stats.goals_against + goalsAgainst;
  return {
    ...stats,
    matches_played: matchesPlayed,
    goals_for: totalFor,
    goals_against: totalAgainst,
    goal_diff: totalFor - totalAgainst,
    recent_form: [result, ...stats.recent_form].slice(0, 5),
    gf_per_game: totalFor / matchesPlayed,
    ga_per_game: totalAgainst / matchesPlayed,
  };
}

function normalizeAndValidateProbabilities(probabilities: OneXTwoProbabilities, fixtureId: string): OneXTwoProbabilities {
  const values = outcomes().map((result) => probabilities[result]);
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) throw new Error(`Invalid 1X2 probability for ${fixtureId}.`);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) throw new Error(`Invalid 1X2 probability mass for ${fixtureId}.`);
  const normalized = { home: probabilities.home / total, draw: probabilities.draw / total, away: probabilities.away / total };
  const normalizedTotal = normalized.home + normalized.draw + normalized.away;
  if (Math.abs(normalizedTotal - 1) > 1e-9) throw new Error(`1X2 probabilities do not sum to 1 for ${fixtureId}.`);
  return normalized;
}

function assertExpectedGoals(home: number, away: number, fixtureId: string): void {
  if (![home, away].every((value) => Number.isFinite(value) && value >= 0.2 && value <= 4.5)) {
    throw new Error(`Expected goals outside guardrails for ${fixtureId}: ${home}/${away}.`);
  }
}

function outcome(homeGoals: number, awayGoals: number): OneXTwoOutcome {
  return homeGoals > awayGoals ? "home" : homeGoals < awayGoals ? "away" : "draw";
}

function primaryPick(probabilities: OneXTwoProbabilities): OneXTwoOutcome {
  return outcomes().reduce((best, current) => probabilities[current] > probabilities[best] ? current : best, "home");
}

function validScore(value: number): boolean { return Number.isInteger(value) && value >= 0 && value <= 20; }
function outcomes(): OneXTwoOutcome[] { return ["home", "draw", "away"]; }
function average(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
