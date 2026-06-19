import { WORLD_CUP_DATASETS } from "../src/lib/backtesting/world-cup-fixtures";
import {
  brierScore1x2,
  logLoss1x2,
  rankedProbabilityScore1x2,
  runWorldCupBacktest,
  type OneXTwoOutcome,
  type OneXTwoProbabilities,
} from "../src/lib/backtesting/world-cup-backtest";
import { createCalibratedScoreMatrix } from "../src/lib/stat-model/calibrated-score-matrix";
import { probabilityForSelection } from "../src/lib/stat-model/market-probabilities";
import { getTopScorelines } from "../src/lib/stat-model/score-matrix";
import { applyOneXTwoCalibrationStrategy } from "../src/lib/stat-model/market-calibration";
import { resolveStatModelCalibration } from "../src/lib/stat-model/calibration-presets";

interface TemperatureResult {
  temperature: number;
  brierScore: number;
  logLoss: number;
  rps: number;
  accuracy: number;
  modal11: number;
}

const baseRows = runWorldCupBacktest(WORLD_CUP_DATASETS).predictions
  .filter((row) => row.variant === "xg-v2.2-mismatch-spread");
const temperatures = Array.from({ length: 21 }, (_, index) => Number((0.5 + index * 0.05).toFixed(2)));
const results = temperatures.map(evaluate);
const bestBrier = [...results].sort((a, b) => a.brierScore - b.brierScore)[0];
const eligible = results.filter((row) => row.modal11 < 0.6);
const recommended = [...(eligible.length ? eligible : results)].sort((a, b) => a.brierScore - b.brierScore)[0];
const plattPreset = resolveStatModelCalibration("platt-blend-25");
const plattRows = baseRows.map((row) => {
  const calibrated = applyOneXTwoCalibrationStrategy({
    homeWin: row.probabilities.home,
    draw: row.probabilities.draw,
    awayWin: row.probabilities.away,
  }, plattPreset.calibration, plattPreset.strategy);
  return {
    probabilities: { home: calibrated.homeWin, draw: calibrated.draw, away: calibrated.awayWin },
    actual: row.actual,
  };
});
const plattMetrics = {
  brier: mean(plattRows.map((row) => brierScore1x2(row.probabilities, row.actual))),
  logLoss: mean(plattRows.map((row) => logLoss1x2(row.probabilities, row.actual))),
  rps: mean(plattRows.map((row) => rankedProbabilityScore1x2(row.probabilities, row.actual))),
};

console.log(`Temperature calibration: ${baseRows.length} matches, World Cups 1998-2022, base=xg-v2.2-mismatch-spread`);
console.table(results.map((row) => ({
  T: row.temperature.toFixed(2),
  Brier: row.brierScore.toFixed(6),
  LogLoss: row.logLoss.toFixed(6),
  RPS: row.rps.toFixed(6),
  Accuracy: `${(row.accuracy * 100).toFixed(2)}%`,
  "Modal 1-1": `${(row.modal11 * 100).toFixed(2)}%`,
})));
console.log(`Unconstrained best Brier: T=${bestBrier.temperature.toFixed(2)} (Brier=${bestBrier.brierScore.toFixed(6)}, modal 1-1=${(bestBrier.modal11 * 100).toFixed(2)}%)`);
console.log(`Recommended (<60% modal 1-1): T=${recommended.temperature.toFixed(2)} (Brier=${recommended.brierScore.toFixed(6)}, LogLoss=${recommended.logLoss.toFixed(6)}, RPS=${recommended.rps.toFixed(6)}, Accuracy=${(recommended.accuracy * 100).toFixed(2)}%, modal 1-1=${(recommended.modal11 * 100).toFixed(2)}%)`);
console.log(`platt-blend-25 comparison: Brier=${plattMetrics.brier.toFixed(6)}, LogLoss=${plattMetrics.logLoss.toFixed(6)}, RPS=${plattMetrics.rps.toFixed(6)}; delta temperature=${(recommended.brierScore - plattMetrics.brier).toFixed(6)} Brier.`);

function evaluate(temperature: number): TemperatureResult {
  const evaluated = baseRows.map((row) => {
    const matrix = createCalibratedScoreMatrix(row.homeExpectedGoals, row.awayExpectedGoals, temperature).scoreMatrix;
    const probabilities: OneXTwoProbabilities = {
      home: probabilityForSelection(matrix, "home_win"),
      draw: probabilityForSelection(matrix, "draw"),
      away: probabilityForSelection(matrix, "away_win"),
    };
    const modal = getTopScorelines(matrix, 1)[0];
    return { probabilities, actual: row.actual, picked: pick(probabilities), modal11: modal.homeGoals === 1 && modal.awayGoals === 1 };
  });
  return {
    temperature,
    brierScore: mean(evaluated.map((row) => brierScore1x2(row.probabilities, row.actual))),
    logLoss: mean(evaluated.map((row) => logLoss1x2(row.probabilities, row.actual))),
    rps: mean(evaluated.map((row) => rankedProbabilityScore1x2(row.probabilities, row.actual))),
    accuracy: evaluated.filter((row) => row.picked === row.actual).length / evaluated.length,
    modal11: evaluated.filter((row) => row.modal11).length / evaluated.length,
  };
}

function pick(probabilities: OneXTwoProbabilities): OneXTwoOutcome {
  return (["home", "draw", "away"] as OneXTwoOutcome[])
    .reduce((best, candidate) => probabilities[candidate] > probabilities[best] ? candidate : best, "home");
}

function mean(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
