import test from "node:test";
import assert from "node:assert/strict";
import { calibratedMarketProbabilities, createCalibratedScoreMatrix } from "../../src/lib/stat-model/calibrated-score-matrix";
import { getTopScorelines, scoreMatrixTotalProbability } from "../../src/lib/stat-model/score-matrix";

test("calibrated matrix has unit probability mass", () => {
  const result = createCalibratedScoreMatrix(1.5, 1.1, 0.8);
  assert.ok(Math.abs(scoreMatrixTotalProbability(result.scoreMatrix) - 1) < 1e-9);
});

test("calibrated 1X2 probabilities sum to one", () => {
  const result = calibratedMarketProbabilities(1.5, 1.1, 0.8);
  const oneXTwo = result.markets.filter((row) => row.market === "1x2");
  assert.ok(Math.abs(oneXTwo.reduce((sum, row) => sum + row.probability, 0) - 1) < 1e-9);
});

test("identical raw xG need not retain a 1-1 mode after scaling", () => {
  const matrix = createCalibratedScoreMatrix(1.2, 1.2, 0.6).scoreMatrix;
  const mode = getTopScorelines(matrix, 1)[0];
  assert.notDeepEqual([mode.homeGoals, mode.awayGoals], [1, 1]);
});
