import { applyOneXTwoCalibrationStrategy } from "../../src/lib/stat-model/market-calibration";
import { resolveStatModelCalibration } from "../../src/lib/stat-model/calibration-presets";
import { createCalibratedScoreMatrix } from "../../src/lib/stat-model/calibrated-score-matrix";
import { resolveCalibrationTemperature } from "../../src/lib/stat-model/calibrate-lambdas";
import { createScoreMatrix, getTopScorelines, type ScoreMatrix } from "../../src/lib/stat-model/score-matrix";
import { deriveMarketProbabilities, probabilityForSelection } from "../../src/lib/stat-model/market-probabilities";
import { runWorldCupBacktest } from "../../src/lib/backtesting/world-cup-backtest";
import { WORLD_CUP_DATASETS } from "../../src/lib/backtesting/world-cup-fixtures";
import { buildScoreMatricesByMatchId } from "../../src/lib/stat-model/match-prediction";
import * as mock from "../../src/lib/data/mock";

const temperature = resolveCalibrationTemperature();
const history = runWorldCupBacktest(WORLD_CUP_DATASETS).predictions.filter((row) => row.variant === "xg-v2.2-mismatch-spread");
const historicalRows = history.map((row) => compare(row.homeExpectedGoals, row.awayExpectedGoals));
const currentRaw = buildScoreMatricesByMatchId(mock.matches, mock.teamStats, {
  modelVariant: "xg-v2.2-mismatch-spread",
  calibration: "none",
  generatedAt: "2026-06-18T00:00:00.000Z",
});
const currentRows = currentRaw.predictions.map((row) => compare(row.homeExpectedGoals, row.awayExpectedGoals));

console.log(`Calibrated matrix diagnostic | T=${temperature}`);
console.table([
  summarize("Backtest 1998-2022", historicalRows),
  summarize("2026 available (mock)", currentRows),
]);

function compare(home: number, away: number) {
  const raw = createScoreMatrix({ homeExpectedGoals: home, awayExpectedGoals: away, maxGoals: 12 });
  const calibrated = createCalibratedScoreMatrix(home, away, temperature).scoreMatrix;
  const rawMode = getTopScorelines(raw, 1)[0];
  const calibratedMode = getTopScorelines(calibrated, 1)[0];
  const raw1x2 = oneXTwo(raw);
  const preset = resolveStatModelCalibration("platt-blend-25");
  const platt = applyOneXTwoCalibrationStrategy(raw1x2, preset.calibration, preset.strategy);
  const markets = deriveMarketProbabilities(calibrated);
  const calibrated1x2 = {
    homeWin: markets.find((row) => row.selection === "home_win")!.probability,
    draw: markets.find((row) => row.selection === "draw")!.probability,
    awayWin: markets.find((row) => row.selection === "away_win")!.probability,
  };
  return {
    raw11: rawMode.homeGoals === 1 && rawMode.awayGoals === 1,
    calibrated11: calibratedMode.homeGoals === 1 && calibratedMode.awayGoals === 1,
    marketMad: (Math.abs(calibrated1x2.homeWin - platt.homeWin) + Math.abs(calibrated1x2.draw - platt.draw) + Math.abs(calibrated1x2.awayWin - platt.awayWin)) / 3,
  };
}

function oneXTwo(matrix: ScoreMatrix) {
  return {
    homeWin: probabilityForSelection(matrix, "home_win"),
    draw: probabilityForSelection(matrix, "draw"),
    awayWin: probabilityForSelection(matrix, "away_win"),
  };
}

function summarize(corpus: string, rows: ReturnType<typeof compare>[]) {
  return {
    Corpus: corpus,
    N: rows.length,
    "1-1 raw": `${percent(rows.filter((row) => row.raw11).length / rows.length)}%`,
    "1-1 calibrated": `${percent(rows.filter((row) => row.calibrated11).length / rows.length)}%`,
    "MAD vs Platt 1X2": mean(rows.map((row) => row.marketMad)).toFixed(6),
  };
}

function mean(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function percent(value: number) { return (value * 100).toFixed(2); }
