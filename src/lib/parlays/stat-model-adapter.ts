import type { Outcome } from "../types";
import { jointProbabilityForSelections, probabilityForSelection, type ScoreMatrix, type StatSelectionKey } from "../stat-model";
import type { ParlayPick } from "./parlay-types";

export interface MatrixJointResult {
  jointProbabilityAdjusted: number;
  sameMatchJointProbability?: number;
  correlationRatio?: number;
  isInvalid: boolean;
  reasons: string[];
  usedScoreMatrix: boolean;
}

export function parlayPickToStatSelection(pick: ParlayPick): StatSelectionKey | null {
  if (pick.market === "1x2") {
    return outcomeMap(pick.selection, {
      home: "home_win",
      draw: "draw",
      away: "away_win",
    });
  }
  if (pick.market === "btts") {
    return outcomeMap(pick.selection, {
      yes: "btts_yes",
      no: "btts_no",
    });
  }
  if (pick.market === "over_under_2_5") {
    return outcomeMap(pick.selection, {
      over: "over_2_5",
      under: "under_2_5",
    });
  }
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

function outcomeMap<T extends Partial<Record<Outcome, StatSelectionKey>>>(
  outcome: Outcome,
  map: T
): StatSelectionKey | null {
  return map[outcome] ?? null;
}
