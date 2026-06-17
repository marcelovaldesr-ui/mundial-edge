import type { FinalProbabilityConfidence } from "../model/final-probability";
import type { Market, MatchStatus, Outcome } from "../types";

export type PredictionOutcomeResult = "win" | "loss" | "push" | "unknown";

export interface PredictionSnapshot {
  matchId: string;
  market: Market;
  selection: Outcome;
  odds: number | null;
  impliedProbability: number | null;
  poissonProbability: number | null;
  marketProbability: number | null;
  finalProbability: number;
  confidence: FinalProbabilityConfidence;
  edge: number | null;
  expectedValue: number | null;
  timestamp: string;
  matchStatusAtPrediction: MatchStatus;
  resultStatus: MatchStatus | "unknown";
  outcomeResult: PredictionOutcomeResult;
  profitLoss: number | null;
  source: "mundial-edge-final-probability-v1";
  version: "final-probability-v1";
}

export function createPredictionSnapshot(input: Omit<PredictionSnapshot, "source" | "version" | "profitLoss"> & {
  stakeUnits?: number;
}): PredictionSnapshot {
  return {
    ...input,
    profitLoss: calculateProfitLoss(input.outcomeResult, input.odds, input.stakeUnits ?? 1),
    source: "mundial-edge-final-probability-v1",
    version: "final-probability-v1",
  };
}

export function calculateProfitLoss(
  result: PredictionOutcomeResult,
  odds: number | null,
  stakeUnits = 1
): number | null {
  if (result === "unknown" || odds == null || !Number.isFinite(odds) || odds <= 1) return null;
  if (result === "push") return 0;
  if (result === "win") return +(stakeUnits * (odds - 1)).toFixed(4);
  return -stakeUnits;
}
