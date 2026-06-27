import type { Match, TeamStats } from "../types";
import { filterPreMatchMatches } from "../matches/pre-match-eligibility";
import { getExpectedGoalsWithComponents } from "./expected-goals";
import type { ExpectedGoalsDiagnosticBreakdown, ExpectedGoalsRatingModel, ExpectedGoalsWithComponentsResult } from "./expected-goals";
import { deriveMarketProbabilities } from "./market-probabilities";
import type { ModelMarketProbability } from "./market-types";
import { createScoreMatrix, type ScoreMatrix } from "./score-matrix";
import { createCalibratedScoreMatrix } from "./calibrated-score-matrix";
import { resolveCalibrationTemperature } from "./calibrate-lambdas";
import { applyDixonColesAdjustment } from "./dixon-coles";
import { calculatePredictionConfidence, type ConfidenceResult } from "./confidence-score";
import { getActiveStatModelVariant, type StatModelVariant, type StatModelVariantStatus } from "./model-variant";
import { getActiveStatModelCalibration, type StatModelCalibrationMode } from "./calibration-presets";
import { applyOneXTwoCalibrationStrategy, type CalibrationMetadata } from "./market-calibration";
import type { TeamStrengthRating } from "./team-strength-ratings";
import { getWorldCupGroupContext, type WorldCupGroupContext } from "../world-cup/group-context";
import {
  resolvePredictionConfig,
  type PredictionConfigInput,
  type PredictionConfigSource,
} from "./prediction-config";
import { calculateMarketProbabilityIntervals, type MarketProbabilityIntervals } from "./probability-intervals";
import { buildPredictionExplanation } from "./prediction-explanation";

export type StatModelConfidence = "none" | "low" | "medium" | "high";

export interface MatchStatModelPrediction {
  matchId: string;
  homeTeam: { id: string; name: string; code: string };
  awayTeam: { id: string; name: string; code: string };
  homeExpectedGoals: number;
  awayExpectedGoals: number;
  scoreMatrix: ScoreMatrix;
  marketProbabilities: ModelMarketProbability[];
  /** Alias with the same matrix-derived values for calibrated and legacy consumers. */
  markets: ModelMarketProbability[];
  confidence: StatModelConfidence;
  confidenceResult: ConfidenceResult;
  warnings: string[];
  generatedAt: string;
  modelVersion: "poisson-score-matrix-v1";
  expectedGoalsSource: string;
  expectedGoalsBlend: {
    homeRatingWeight: number;
    awayRatingWeight: number;
    homeStatsWeight: number;
    awayStatsWeight: number;
  };
  expectedGoalsDiagnostic: ExpectedGoalsDiagnosticBreakdown;
  expectedGoalsComponents: ExpectedGoalsWithComponentsResult["components"];
  expectedGoalsWeightInfo: ExpectedGoalsWithComponentsResult["weightInfo"];
  probabilityIntervals: MarketProbabilityIntervals;
  explanation: string;
  homeRating: TeamStrengthRating | null;
  awayRating: TeamStrengthRating | null;
  groupContext?: WorldCupGroupContext;
  expectedGoalsRatingModel: ExpectedGoalsRatingModel;
  neutralVenue: boolean;
  modelVariant: StatModelVariant;
  modelVariantStatus: StatModelVariantStatus;
  calibrationMode: StatModelCalibrationMode;
  calibrationMetadata?: CalibrationMetadata;
  modelVariantUsed: StatModelVariant;
  calibrationUsed: StatModelCalibrationMode;
  configSource: PredictionConfigSource;
  lambdas: {
    original: { home: number; away: number };
    calibrated: { home: number; away: number };
  };
  temperature: number | null;
  calibrated: boolean;
}

export interface MatrixBuildIssue {
  matchId: string;
  reason: string;
}

export interface StatModelCoverage {
  totalPreMatch: number;
  withSufficientTeamStats: number;
  withScoreMatrix: number;
  withoutScoreMatrix: number;
  issues: MatrixBuildIssue[];
}

export interface EnvironmentModifier {
  homeMultiplier: number;
  awayMultiplier: number;
  notes?: string[];
}

export interface BuildScoreMatrixOptions {
  maxGoals?: number;
  leagueAvgGoals?: number;
  generatedAt?: string;
  groupContext?: WorldCupGroupContext;
  allMatches?: Match[];
  neutralVenue?: boolean;
  ratingModel?: ExpectedGoalsRatingModel;
  /** Feature flag. Defaults to legacy-neutral; ratingModel remains as a compatibility override. */
  modelVariant?: StatModelVariant;
  /** Optional calibration flag. Defaults/fails closed to none. */
  calibration?: StatModelCalibrationMode | string;
  /** Named/default config. Direct modelVariant/calibration fields remain compatible and take precedence. */
  predictionConfig?: PredictionConfigInput;
  /** Explicit override for CALIBRATION_TEMPERATURE when temperature scaling is active. */
  calibrationTemperature?: number;
  /** Per-match lambda multipliers from altitude, weather, and fatigue. */
  environmentModifier?: EnvironmentModifier;
  /** Per-match modifiers indexed by match ID, for buildScoreMatricesByMatchId. */
  environmentModifiersByMatchId?: Map<string, EnvironmentModifier>;
}

export interface BuildScoreMatricesResult {
  predictions: MatchStatModelPrediction[];
  scoreMatricesByMatchId: Record<string, ScoreMatrix>;
  coverage: StatModelCoverage;
}

export function buildScoreMatrixForMatch(
  match: Match,
  homeStats: TeamStats | undefined,
  awayStats: TeamStats | undefined,
  options: BuildScoreMatrixOptions = {}
): MatchStatModelPrediction | MatrixBuildIssue {
  if (!homeStats || !awayStats) {
    return { matchId: match.id, reason: "Faltan team_stats para una o ambas selecciones." };
  }
  if (!match.home_team || !match.away_team) {
    return { matchId: match.id, reason: "Faltan joins de equipos local/visitante." };
  }

  const groupContext = options.groupContext ?? (options.allMatches ? getWorldCupGroupContext(match, options.allMatches) : undefined);
  const environmentOverride = process.env.STAT_MODEL_VARIANT != null || process.env.STAT_MODEL_CALIBRATION != null;
  const config = options.modelVariant != null || options.calibration != null
    ? resolvePredictionConfig({ modelVariant: options.modelVariant, calibration: options.calibration })
    : options.predictionConfig != null
      ? resolvePredictionConfig(options.predictionConfig)
      : environmentOverride
        ? resolvePredictionConfig({
          modelVariant: getActiveStatModelVariant(undefined).id,
          calibration: getActiveStatModelCalibration(undefined).id,
        })
        : resolvePredictionConfig();
  const variant = getActiveStatModelVariant(config.modelVariant, undefined);
  const xgWithComponents = getExpectedGoalsWithComponents({
    home: homeStats,
    away: awayStats,
    homeTeam: match.home_team,
    awayTeam: match.away_team,
    leagueAvgGoals: options.leagueAvgGoals,
    groupContext,
    neutralVenue: options.neutralVenue ?? variant.neutralVenue ?? match.neutralVenue ?? false,
    ratingModel: options.ratingModel ?? variant.expectedGoalsRatingModel,
    priorStrength: options.ratingModel ? undefined : variant.priorStrength ?? undefined,
  });
  const xg = xgWithComponents.details;
  const warnings = [...config.warnings, ...confidenceWarnings(homeStats, awayStats, xg.homeRating, xg.awayRating, groupContext)];
  const envMod = options.environmentModifier;
  const homeXg = envMod
    ? Math.max(0.1, Math.min(4.5, xg.homeExpectedGoals * envMod.homeMultiplier))
    : xg.homeExpectedGoals;
  const awayXg = envMod
    ? Math.max(0.1, Math.min(4.5, xg.awayExpectedGoals * envMod.awayMultiplier))
    : xg.awayExpectedGoals;

  const temperature = variant.temperatureScaling
    ? resolveCalibrationTemperature(options.calibrationTemperature)
    : null;
  const temperatureResult = temperature == null ? null : createCalibratedScoreMatrix(
    homeXg,
    awayXg,
    temperature,
    options.maxGoals ?? 12
  );
  const poissonMatrix = temperatureResult?.scoreMatrix ?? createScoreMatrix({
    homeExpectedGoals: homeXg,
    awayExpectedGoals: awayXg,
    maxGoals: options.maxGoals ?? 12,
  });
  const scoreMatrix = variant.dixonColesRho == null
    ? poissonMatrix
    : applyDixonColesAdjustment(poissonMatrix, variant.dixonColesRho).matrix;
  const rawMarketProbabilities = deriveMarketProbabilities(scoreMatrix);
  const calibrationPreset = getActiveStatModelCalibration(config.calibration, undefined);
  const calibrationEnabled = calibrationPreset.id !== "none" && variant.calibrationEligible;
  const rawOneXTwo = {
    homeWin: rawMarketProbabilities.find((row) => row.selection === "home_win")!.probability,
    draw: rawMarketProbabilities.find((row) => row.selection === "draw")!.probability,
    awayWin: rawMarketProbabilities.find((row) => row.selection === "away_win")!.probability,
  };
  const calibratedOneXTwo = calibrationEnabled
    ? applyOneXTwoCalibrationStrategy(rawOneXTwo, calibrationPreset.calibration, calibrationPreset.strategy)
    : null;
  const marketProbabilities = calibratedOneXTwo
    ? rawMarketProbabilities.map((row) => {
      if (row.selection === "home_win") return { ...row, probability: calibratedOneXTwo.homeWin };
      if (row.selection === "draw") return { ...row, probability: calibratedOneXTwo.draw };
      if (row.selection === "away_win") return { ...row, probability: calibratedOneXTwo.awayWin };
      return row;
    })
    : rawMarketProbabilities;
  const minGames = Math.min(homeStats.matches_played, awayStats.matches_played);
  const priorWeight = variant.priorStrength != null
    ? variant.priorStrength / (minGames + variant.priorStrength)
    : (xg.blend.homeRatingWeight + xg.blend.awayRatingWeight) / 2;
  const confidenceResult = calculatePredictionConfidence({
    probabilities: {
      home: marketProbabilities.find((row) => row.selection === "home_win")!.probability,
      draw: marketProbabilities.find((row) => row.selection === "draw")!.probability,
      away: marketProbabilities.find((row) => row.selection === "away_win")!.probability,
    },
    homeGamesPlayed: homeStats.matches_played,
    awayGamesPlayed: awayStats.matches_played,
    priorWeight,
    scoreMatrix,
    modelWarnings: warnings.filter((warning) => !warning.startsWith("Rating base Mundial Edge")),
    homeRatingFallback: xg.homeRating?.source === "neutral_fallback",
    awayRatingFallback: xg.awayRating?.source === "neutral_fallback",
    groupContext,
  });
  const probabilityIntervals = calculateMarketProbabilityIntervals({
    lambdaHome: temperatureResult?.lambdaHomeCal ?? homeXg,
    lambdaAway: temperatureResult?.lambdaAwayCal ?? awayXg,
    homeGamesPlayed: homeStats.matches_played,
    awayGamesPlayed: awayStats.matches_played,
    priorWeight,
    confidence: confidenceResult.label,
    pointProbabilities: marketProbabilities,
    seed: `${match.id}:${variant.id}:${temperature ?? "none"}`,
    maxGoals: options.maxGoals ?? 12,
    dixonColesRho: variant.dixonColesRho,
  });
  const explanation = buildPredictionExplanation({
    homeName: match.home_team.name,
    awayName: match.away_team.name,
    homeCode: match.home_team.code,
    awayCode: match.away_team.code,
    components: xgWithComponents.components,
    probabilities: marketProbabilities,
    intervals: probabilityIntervals,
    confidence: confidenceResult.label,
  });

  return {
    matchId: match.id,
    homeTeam: { id: match.home_team.id, name: match.home_team.name, code: match.home_team.code },
    awayTeam: { id: match.away_team.id, name: match.away_team.name, code: match.away_team.code },
    homeExpectedGoals: homeXg,
    awayExpectedGoals: awayXg,
    scoreMatrix,
    marketProbabilities,
    markets: marketProbabilities,
    confidence: confidenceResult.label,
    confidenceResult,
    warnings: [...new Set([...warnings, ...confidenceResult.warnings, ...xg.assumptions])],
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    modelVersion: "poisson-score-matrix-v1",
    expectedGoalsSource: xg.source,
    expectedGoalsBlend: xg.blend,
    expectedGoalsDiagnostic: xg.diagnostic,
    expectedGoalsComponents: xgWithComponents.components,
    expectedGoalsWeightInfo: xgWithComponents.weightInfo,
    probabilityIntervals,
    explanation,
    homeRating: xg.homeRating,
    awayRating: xg.awayRating,
    groupContext,
    expectedGoalsRatingModel: xg.ratingModel,
    neutralVenue: xg.neutralVenue,
    modelVariant: variant.id,
    modelVariantStatus: variant.status,
    calibrationMode: calibrationEnabled ? calibrationPreset.id : "none",
    calibrationMetadata: calibratedOneXTwo?.metadata,
    modelVariantUsed: variant.id,
    calibrationUsed: calibrationEnabled ? calibrationPreset.id : "none",
    configSource: config.configSource,
    lambdas: {
      original: { home: xg.homeExpectedGoals, away: xg.awayExpectedGoals },
      calibrated: {
        home: temperatureResult?.lambdaHomeCal ?? homeXg,
        away: temperatureResult?.lambdaAwayCal ?? awayXg,
      },
    },
    temperature,
    calibrated: temperatureResult != null,
  };
}

export function buildScoreMatricesByMatchId(
  matches: Match[],
  teamStats: TeamStats[],
  options: BuildScoreMatrixOptions = {}
): BuildScoreMatricesResult {
  const statMap = new Map(teamStats.map((stats) => [stats.team_id, stats]));
  const preMatch = filterPreMatchMatches(matches, options.generatedAt);
  const predictions: MatchStatModelPrediction[] = [];
  const issues: MatrixBuildIssue[] = [];

  for (const match of preMatch) {
    const environmentModifier = options.environmentModifiersByMatchId?.get(match.id);
    const result = buildScoreMatrixForMatch(
      match,
      statMap.get(match.home_team_id),
      statMap.get(match.away_team_id),
      { ...options, allMatches: matches, groupContext: getWorldCupGroupContext(match, matches), environmentModifier }
    );
    if ("scoreMatrix" in result) predictions.push(result);
    else issues.push(result);
  }

  const scoreMatricesByMatchId = Object.fromEntries(
    predictions.map((prediction) => [prediction.matchId, prediction.scoreMatrix])
  );

  return {
    predictions,
    scoreMatricesByMatchId,
    coverage: {
      totalPreMatch: preMatch.length,
      withSufficientTeamStats: predictions.filter((prediction) => prediction.confidence !== "low").length,
      withScoreMatrix: predictions.length,
      withoutScoreMatrix: preMatch.length - predictions.length,
      issues,
    },
  };
}

export function confidenceFromStats(homeStats: TeamStats, awayStats: TeamStats): StatModelConfidence {
  const minMatches = Math.min(homeStats.matches_played, awayStats.matches_played);
  if (minMatches <= 0) return "low";
  if (minMatches < 2) return "low";
  if (minMatches < 4) return "medium";
  return "high";
}

export function confidenceFromInputs(
  homeStats: TeamStats,
  awayStats: TeamStats,
  homeRating: TeamStrengthRating | null,
  awayRating: TeamStrengthRating | null
): StatModelConfidence {
  const minMatches = Math.min(homeStats.matches_played, awayStats.matches_played);
  const hasSpecificRatings = isSpecificRating(homeRating) && isSpecificRating(awayRating);
  if (minMatches >= 4 && hasSpecificRatings) return "high";
  if (minMatches >= 2 && (homeRating || awayRating)) return "medium";
  if (hasSpecificRatings) return "medium";
  return confidenceFromStats(homeStats, awayStats);
}

function confidenceWarnings(
  homeStats: TeamStats,
  awayStats: TeamStats,
  homeRating: TeamStrengthRating | null,
  awayRating: TeamStrengthRating | null,
  groupContext?: WorldCupGroupContext
): string[] {
  const warnings: string[] = [];
  if (homeStats.matches_played <= 0 || awayStats.matches_played <= 0) {
    warnings.push("Confianza limitada: una o ambas selecciones no tienen partidos finalizados en team_stats del Mundial.");
  } else if (Math.min(homeStats.matches_played, awayStats.matches_played) < 2) {
    warnings.push("Confianza limitada: muestra menor a 2 partidos por selección.");
  } else if (Math.min(homeStats.matches_played, awayStats.matches_played) < 4) {
    warnings.push("Confianza media: muestra todavía corta para un Mundial.");
  }
  if (!homeStats.recent_form.length || !awayStats.recent_form.length) {
    warnings.push("Forma reciente incompleta; se usan priors derivados de goles por partido.");
  }
  if (isSpecificRating(homeRating) && isSpecificRating(awayRating)) {
    warnings.push("Rating base Mundial Edge usado para diferenciar selecciones con baja muestra.");
  }
  if (homeRating?.source === "neutral_fallback" || awayRating?.source === "neutral_fallback") {
    warnings.push("Sin rating específico para una selección; se usa prior neutral prudente.");
  }
  if (groupContext?.warnings.length) warnings.push(...groupContext.warnings);
  if (groupContext && Object.values(groupContext.modifiers).some((value) => value !== 0)) {
    warnings.push("Contexto de grupo aplicado con ajuste pequeño; puede ser especulativo.");
  }
  return warnings;
}

function isSpecificRating(rating: TeamStrengthRating | null): boolean {
  return rating?.source === "manual_seed" || rating?.source === "manual-historical-estimate" || rating?.source === "historical_elo_hybrid";
}
