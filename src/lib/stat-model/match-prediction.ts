import type { Match, TeamStats } from "../types";
import { filterPreMatchMatches } from "../matches/pre-match-eligibility";
import { estimateExpectedGoals } from "./expected-goals";
import { deriveMarketProbabilities } from "./market-probabilities";
import type { ModelMarketProbability } from "./market-types";
import { createScoreMatrix, type ScoreMatrix } from "./score-matrix";
import type { TeamStrengthRating } from "./team-strength-ratings";
import { getWorldCupGroupContext, type WorldCupGroupContext } from "../world-cup/group-context";

export type StatModelConfidence = "none" | "low" | "medium" | "high";

export interface MatchStatModelPrediction {
  matchId: string;
  homeTeam: { id: string; name: string; code: string };
  awayTeam: { id: string; name: string; code: string };
  homeExpectedGoals: number;
  awayExpectedGoals: number;
  scoreMatrix: ScoreMatrix;
  marketProbabilities: ModelMarketProbability[];
  confidence: StatModelConfidence;
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
  homeRating: TeamStrengthRating | null;
  awayRating: TeamStrengthRating | null;
  groupContext?: WorldCupGroupContext;
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

export interface BuildScoreMatrixOptions {
  maxGoals?: number;
  leagueAvgGoals?: number;
  generatedAt?: string;
  groupContext?: WorldCupGroupContext;
  allMatches?: Match[];
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
  const xg = estimateExpectedGoals({
    home: homeStats,
    away: awayStats,
    homeTeam: match.home_team,
    awayTeam: match.away_team,
    leagueAvgGoals: options.leagueAvgGoals,
    groupContext,
  });
  const warnings = confidenceWarnings(homeStats, awayStats, xg.homeRating, xg.awayRating, groupContext);
  const confidence = confidenceFromInputs(homeStats, awayStats, xg.homeRating, xg.awayRating);
  const scoreMatrix = createScoreMatrix({
    homeExpectedGoals: xg.homeExpectedGoals,
    awayExpectedGoals: xg.awayExpectedGoals,
    maxGoals: options.maxGoals ?? 12,
  });

  return {
    matchId: match.id,
    homeTeam: { id: match.home_team.id, name: match.home_team.name, code: match.home_team.code },
    awayTeam: { id: match.away_team.id, name: match.away_team.name, code: match.away_team.code },
    homeExpectedGoals: xg.homeExpectedGoals,
    awayExpectedGoals: xg.awayExpectedGoals,
    scoreMatrix,
    marketProbabilities: deriveMarketProbabilities(scoreMatrix),
    confidence,
    warnings: [...warnings, ...xg.assumptions],
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    modelVersion: "poisson-score-matrix-v1",
    expectedGoalsSource: xg.source,
    expectedGoalsBlend: xg.blend,
    homeRating: xg.homeRating,
    awayRating: xg.awayRating,
    groupContext,
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
    const result = buildScoreMatrixForMatch(
      match,
      statMap.get(match.home_team_id),
      statMap.get(match.away_team_id),
      { ...options, allMatches: matches, groupContext: getWorldCupGroupContext(match, matches) }
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
  const hasSpecificRatings = homeRating?.source === "manual_seed" && awayRating?.source === "manual_seed";
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
  if (homeRating?.source === "manual_seed" && awayRating?.source === "manual_seed") {
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
