import type { Match, TeamStats } from "../types";
import {
  buildScoreMatricesByMatchId,
  jointProbabilityForSelections,
  probabilityForSelection,
  resolvePredictionConfig,
  type BuildScoreMatricesResult,
  type PredictionConfigInput,
  type PredictionConfigSource,
  type ScoreMatrix,
  type StatModelCalibrationMode,
  type StatModelVariant,
  type StatSelectionKey,
} from "../stat-model";
import type { ParlayPick } from "./parlay-types";

export interface MatrixJointResult {
  jointProbabilityAdjusted: number;
  sameMatchJointProbability?: number;
  correlationRatio?: number;
  isInvalid: boolean;
  reasons: string[];
  usedScoreMatrix: boolean;
}

export interface ParlayStatModelResult extends BuildScoreMatricesResult {
  modelVariantUsed: StatModelVariant;
  calibrationUsed: StatModelCalibrationMode;
  configSource: PredictionConfigSource;
  warnings: string[];
}

/** Builds the stat-model payload consumed by parlays, with auditable configuration metadata. */
export function buildParlayStatModel(
  matches: Match[],
  teamStats: TeamStats[],
  input?: PredictionConfigInput
): ParlayStatModelResult {
  const config = resolvePredictionConfig(input);
  const result = buildScoreMatricesByMatchId(matches, teamStats, {
    predictionConfig: config,
  });
  return {
    ...result,
    modelVariantUsed: config.modelVariant,
    calibrationUsed: config.calibration,
    configSource: config.configSource,
    warnings: [...new Set([
      ...config.warnings,
      ...result.coverage.issues.map((issue) => `${issue.matchId}: ${issue.reason}`),
    ])],
  };
}

export function parlayPickToStatSelection(pick: ParlayPick): StatSelectionKey | null {
  const sel = pick.selection;
  if (pick.market === "1x2") return sel === "home" ? "home_win" : sel === "away" ? "away_win" : sel === "draw" ? "draw" : null;
  if (pick.market === "btts") return sel === "yes" ? "btts_yes" : sel === "no" ? "btts_no" : null;
  if (pick.market === "over_under_2_5") return sel === "over" ? "over_2_5" : sel === "under" ? "under_2_5" : null;
  if (pick.market === "double_chance") return sel === "1x" ? "double_chance_1x" : sel === "x2" ? "double_chance_x2" : sel === "12" ? "double_chance_12" : null;
  // "clasifica" no tiene predicado en la matriz de 90'; se evalúa por probabilidad individual (fallback).
  return null;
}

export function calculateMatrixAwareJointProbability(
  picks: ParlayPick[],
  scoreMatricesByMatchId?: Record<string, ScoreMatrix>
): MatrixJointResult {
  const byMatch = new Map<string, ParlayPick[]>();
  for (const pick of picks) {
    const group = byMatch.get(pick.matchId) ?? [];
    group.push(pick);
    byMatch.set(pick.matchId, group);
  }

  let jointProbabilityAdjusted = 1;
  let sameMatchJointProbability: number | undefined;
  let weightedRatio = 1;
  let ratioGroups = 0;
  const reasons: string[] = [];
  let usedScoreMatrix = false;

  for (const [matchId, group] of byMatch.entries()) {
    const matrix = scoreMatricesByMatchId?.[matchId];
    if (!matrix || group.length === 1) {
      jointProbabilityAdjusted *= group.reduce((product, pick) => product * pick.anchoredProb, 1);
      continue;
    }

    const selections = group.map(parlayPickToStatSelection);
    if (selections.some((selection) => selection == null)) {
      jointProbabilityAdjusted *= group.reduce((product, pick) => product * pick.anchoredProb, 1);
      reasons.push("Matriz disponible, pero alguna selección no tiene predicado soportado; fallback a probabilidad individual.");
      continue;
    }

    const exact = jointProbabilityForSelections(matrix, selections as StatSelectionKey[]);
    if (exact.isInvalid) {
      return {
        jointProbabilityAdjusted: 0,
        sameMatchJointProbability: exact.jointProbability,
        correlationRatio: exact.correlationRatio,
        isInvalid: true,
        reasons: exact.reasons,
        usedScoreMatrix: true,
      };
    }

    usedScoreMatrix = true;
    sameMatchJointProbability = exact.jointProbability;
    weightedRatio *= exact.correlationRatio;
    ratioGroups++;
    jointProbabilityAdjusted *= exact.jointProbability;
    reasons.push(...exact.reasons);
    for (const pick of group) {
      const selection = parlayPickToStatSelection(pick);
      if (selection) {
        reasons.push(`Matriz ${matchId}: ${selection}=${probabilityForSelection(matrix, selection).toFixed(4)}.`);
      }
    }
  }

  return {
    jointProbabilityAdjusted,
    sameMatchJointProbability,
    correlationRatio: ratioGroups > 0 ? weightedRatio : undefined,
    isInvalid: false,
    reasons,
    usedScoreMatrix,
  };
}

