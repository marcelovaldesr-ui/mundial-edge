import { WORLD_CUP_DATASETS } from "../src/lib/backtesting/world-cup-fixtures";
import {
  DEFAULT_HISTORICAL_RATING_SETS,
  brierScore1x2,
  logLoss1x2,
  rankedProbabilityScore1x2,
  runWorldCupBacktest,
  type HistoricalRatingSet,
  type OneXTwoOutcome,
  type OneXTwoProbabilities,
  type WorldCupBacktestPrediction,
} from "../src/lib/backtesting/world-cup-backtest";
import { RECOMMENDED_CALIBRATION_TEMPERATURE } from "../src/lib/stat-model/calibrate-lambdas";
import { createCalibratedScoreMatrix } from "../src/lib/stat-model/calibrated-score-matrix";
import { ELO_PRIOR_WEIGHT, calibrateEloToMundialEdgeScale, getHistoricalElo, getTeamRatingsForWorldCup } from "../src/lib/stat-model/elo-adapter";
import { applyOneXTwoCalibrationStrategy } from "../src/lib/stat-model/market-calibration";
import { resolveStatModelCalibration } from "../src/lib/stat-model/calibration-presets";
import { probabilityForSelection } from "../src/lib/stat-model/market-probabilities";
import { getTopScorelines } from "../src/lib/stat-model/score-matrix";

const adoptedSets = DEFAULT_HISTORICAL_RATING_SETS.filter((set) => set.snapshotYear != null && set.snapshotYear < 2026);
const manualSets = adoptedSets.map((set): HistoricalRatingSet => ({
  ...set,
  id: `${set.id}-reconstructed-manual-v2`,
  source: "historical_pre_tournament",
  ratings: set.ratings.map((rating) => {
    const elo = getHistoricalElo(set.snapshotYear!, rating.teamCode);
    if (!elo) return rating;
    const external = calibrateEloToMundialEdgeScale(elo.elo);
    const reverse = (value: number) => Math.round(((value - ELO_PRIOR_WEIGHT * external) / (1 - ELO_PRIOR_WEIGHT)) * 100) / 100;
    return {
      ...rating,
      overall: reverse(rating.overall), attack: reverse(rating.attack), defense: reverse(rating.defense),
      overallRating: reverse(rating.overall), attackRating: reverse(rating.attack), defenseRating: reverse(rating.defense),
      source: "manual-historical-estimate" as const,
    };
  }),
}));
const manualRows = baseRows(runWorldCupBacktest(WORLD_CUP_DATASETS, manualSets).predictions);
const weights = [0.1, 0.2, 0.3, 0.5, 0.7];
const hybridRows = weights.map((weight) => ({
  weight,
  rows: baseRows(runWorldCupBacktest(WORLD_CUP_DATASETS, hybridSets(weight)).predictions),
}));
const rows = [
  evaluateTemperature("Manual + Temperature", manualRows),
  ...hybridRows.map(({ weight, rows }) => evaluateTemperature(`Elo${weight * 100}/Own${100 - weight * 100} + Temperature`, rows)),
  evaluatePlatt("Manual + Platt25", manualRows),
  ...hybridRows.map(({ weight, rows }) => evaluatePlatt(`Elo${weight * 100}/Own${100 - weight * 100} + Platt25`, rows)),
];

console.log(`BACKTEST RATINGS EXTERNOS | ${manualRows.length} partidos | T=${RECOMMENDED_CALIBRATION_TEMPERATURE}`);
console.table(rows.map((row) => ({
  Estrategia: row.label, N: row.count, Brier: row.brier.toFixed(6), LogLoss: row.logLoss.toFixed(6),
  RPS: row.rps.toFixed(6), Accuracy: percent(row.accuracy), "Modal 1-1": row.modal11 == null ? "n/a" : percent(row.modal11),
})));

function baseRows(rows: WorldCupBacktestPrediction[]): WorldCupBacktestPrediction[] {
  return rows.filter((row) => row.variant === "xg-v2.2-mismatch-spread");
}

function hybridSets(weight: number): HistoricalRatingSet[] {
  return manualSets.map((set) => ({
    ...set,
    id: `${set.id}-elo${weight * 100}`,
    source: "external_elo_hybrid",
    ratings: set.ratings.map((rating) => getTeamRatingsForWorldCup(set.snapshotYear!, rating.teamCode, rating, weight) ?? rating),
  }));
}

function evaluateTemperature(label: string, rows: WorldCupBacktestPrediction[]) {
  return evaluate(label, rows.map((row) => {
    const matrix = createCalibratedScoreMatrix(row.homeExpectedGoals, row.awayExpectedGoals, RECOMMENDED_CALIBRATION_TEMPERATURE).scoreMatrix;
    const probabilities = {
      home: probabilityForSelection(matrix, "home_win"), draw: probabilityForSelection(matrix, "draw"), away: probabilityForSelection(matrix, "away_win"),
    };
    const mode = getTopScorelines(matrix, 1)[0];
    return { row, probabilities, modal11: mode.homeGoals === 1 && mode.awayGoals === 1 };
  }));
}

function evaluatePlatt(label: string, rows: WorldCupBacktestPrediction[]) {
  const preset = resolveStatModelCalibration("platt-blend-25");
  return evaluate(label, rows.map((row) => {
    const calibrated = applyOneXTwoCalibrationStrategy({
      homeWin: row.probabilities.home, draw: row.probabilities.draw, awayWin: row.probabilities.away,
    }, preset.calibration, preset.strategy);
    return { row, probabilities: { home: calibrated.homeWin, draw: calibrated.draw, away: calibrated.awayWin }, modal11: null };
  }));
}

function evaluate(label: string, items: Array<{ row: WorldCupBacktestPrediction; probabilities: OneXTwoProbabilities; modal11: boolean | null }>) {
  const picked = (probabilities: OneXTwoProbabilities): OneXTwoOutcome =>
    (["home", "draw", "away"] as OneXTwoOutcome[]).reduce((best, candidate) => probabilities[candidate] > probabilities[best] ? candidate : best, "home");
  const modalRows = items.filter((item): item is typeof item & { modal11: boolean } => item.modal11 != null);
  return {
    label, count: items.length,
    brier: mean(items.map((item) => brierScore1x2(item.probabilities, item.row.actual))),
    logLoss: mean(items.map((item) => logLoss1x2(item.probabilities, item.row.actual))),
    rps: mean(items.map((item) => rankedProbabilityScore1x2(item.probabilities, item.row.actual))),
    accuracy: items.filter((item) => picked(item.probabilities) === item.row.actual).length / items.length,
    modal11: modalRows.length ? modalRows.filter((item) => item.modal11).length / modalRows.length : null,
  };
}

function mean(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function percent(value: number): string { return `${(value * 100).toFixed(2)}%`; }
