import {
  applyTemperature,
  type CalibratedLambdas,
} from "./calibrate-lambdas";
import { deriveMarketProbabilities } from "./market-probabilities";
import type { ModelMarketProbability } from "./market-types";
import { createScoreMatrix, type ScoreMatrix } from "./score-matrix";

export interface CalibratedScoreMatrixResult extends CalibratedLambdas {
  scoreMatrix: ScoreMatrix;
  lambdaHomeRaw: number;
  lambdaAwayRaw: number;
  temperature: number;
  calibrated: true;
}

export interface CalibratedMarketProbabilitiesResult extends CalibratedScoreMatrixResult {
  markets: ModelMarketProbability[];
}

export function createCalibratedScoreMatrix(
  lambdaHomeRaw: number,
  lambdaAwayRaw: number,
  temperature: number,
  maxGoals = 12
): CalibratedScoreMatrixResult {
  const calibratedLambdas = applyTemperature(lambdaHomeRaw, lambdaAwayRaw, temperature);
  const scoreMatrix = createScoreMatrix({
    homeExpectedGoals: calibratedLambdas.lambdaHomeCal,
    awayExpectedGoals: calibratedLambdas.lambdaAwayCal,
    maxGoals,
  });

  return {
    scoreMatrix,
    lambdaHomeRaw,
    lambdaAwayRaw,
    ...calibratedLambdas,
    temperature,
    calibrated: true,
  };
}

export function calibratedMarketProbabilities(
  lambdaHomeRaw: number,
  lambdaAwayRaw: number,
  temperature: number,
  maxGoals = 12
): CalibratedMarketProbabilitiesResult {
  const result = createCalibratedScoreMatrix(lambdaHomeRaw, lambdaAwayRaw, temperature, maxGoals);
  return { ...result, markets: deriveMarketProbabilities(result.scoreMatrix) };
}
