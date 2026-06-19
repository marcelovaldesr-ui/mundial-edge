import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  calculateMulticlassMetrics,
  runWorldCupBacktest,
  type MulticlassMetrics,
  type OneXTwoOutcome,
  type OneXTwoProbabilities,
  type WorldCupBacktestPrediction,
} from "../src/lib/backtesting/world-cup-backtest";
import { WORLD_CUP_DATASETS } from "../src/lib/backtesting/world-cup-fixtures";
import { createCalibratedScoreMatrix } from "../src/lib/stat-model/calibrated-score-matrix";
import { deriveMarketProbabilities } from "../src/lib/stat-model/market-probabilities";
import {
  assertTransparencyReport,
  type PublicMetrics,
  type ReliabilityBin,
  type TransparencyMarketId,
  type TransparencyReport,
} from "../src/lib/transparency/report";

const TEMPERATURE = 0.65 as const;
const SOURCE_VARIANT = "xg-v2.2-mismatch-spread" as const;
const outputPath = resolve("data/calibration-report.json");
const rawReport = runWorldCupBacktest(WORLD_CUP_DATASETS);
const sourceRows = rawReport.predictions.filter((row) => row.variant === SOURCE_VARIANT);
const evaluated = sourceRows.map(calibratedRow);
const modelRows = evaluated.map((row) => row.prediction);
const global = publicMulticlass(calculateMulticlassMetrics(modelRows));

const groupRows = modelRows.filter((row) => row.stageBucket === "GROUP");
const historicalProbabilities = observedFrequencies(groupRows);
const baselineDefinitions = [
  { id: "uniform-1x2" as const, label: "Sin información: 33,3% por resultado", probabilities: { home: 1 / 3, draw: 1 / 3, away: 1 / 3 } },
  { id: "historical-frequency" as const, label: "Frecuencias históricas de fase de grupos", probabilities: historicalProbabilities },
];

const report: TransparencyReport = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  corpus: {
    firstWorldCup: 1998,
    lastWorldCup: 2022,
    tournaments: rawReport.tournaments,
    matches: rawReport.datasetSize,
    evaluation: "Predicciones secuenciales sin usar partidos futuros; resultados de eliminatorias a 90 minutos.",
  },
  model: {
    id: "xg-v2.2-mismatch-spread-calibrated-matrix",
    label: "xG v2.2 mismatch-spread + calibrated-matrix T=0.65",
    temperature: TEMPERATURE,
  },
  global,
  baselines: baselineDefinitions.map((baseline) => {
    const metrics = publicMulticlass(calculateMulticlassMetrics(modelRows.map((row) => baselineRow(row, baseline.probabilities))));
    return {
      ...baseline,
      metrics,
      improvement: {
        brierScore: relativeErrorImprovement(global.brierScore, metrics.brierScore),
        logLoss: relativeErrorImprovement(global.logLoss, metrics.logLoss),
        rankedProbabilityScore: relativeErrorImprovement(global.rankedProbabilityScore!, metrics.rankedProbabilityScore!),
      },
    };
  }),
  byTournament: rawReport.tournaments.map((tournament) => ({
    tournament,
    metrics: publicMulticlass(calculateMulticlassMetrics(modelRows.filter((row) => row.tournament === tournament))),
  })),
  byStage: ([
    { stage: "GROUP" as const, label: "Fase de grupos" },
    { stage: "KNOCKOUT" as const, label: "Eliminatorias (90 min)" },
  ]).map((bucket) => ({
    ...bucket,
    metrics: publicMulticlass(calculateMulticlassMetrics(modelRows.filter((row) => row.stageBucket === bucket.stage))),
  })),
  byMarket: [
    { market: "1x2", label: "1X2", metrics: global, metricNote: "Brier multiclase; RPS disponible." },
    { market: "over_2_5", label: "Más de 2.5 goles", metrics: binaryMetrics(evaluated.map((row) => ({ probability: row.over25, actual: row.prediction.homeGoals + row.prediction.awayGoals >= 3 }))), metricNote: "Brier binario; RPS no aplica." },
    { market: "btts", label: "Ambos marcan", metrics: binaryMetrics(evaluated.map((row) => ({ probability: row.btts, actual: row.prediction.homeGoals > 0 && row.prediction.awayGoals > 0 }))), metricNote: "Brier binario; RPS no aplica." },
  ],
  reliability: [
    reliabilitySeries("home_win", "Victoria local", evaluated.map((row) => ({ probability: row.prediction.probabilities.home, actual: row.prediction.actual === "home" }))),
    reliabilitySeries("over_2_5", "Más de 2.5", evaluated.map((row) => ({ probability: row.over25, actual: row.prediction.homeGoals + row.prediction.awayGoals >= 3 }))),
    reliabilitySeries("btts_yes", "Ambos marcan", evaluated.map((row) => ({ probability: row.btts, actual: row.prediction.homeGoals > 0 && row.prediction.awayGoals > 0 }))),
  ],
  limitations: [
    "Siete Mundiales son una muestra útil pero pequeña frente a deportes con temporadas anuales extensas.",
    "Lesiones de última hora, arbitraje, clima y alineaciones confirmadas no forman parte de este backtest.",
    "El 1X2 de eliminatorias se evalúa al minuto 90: prórroga y penales no cuentan como victoria.",
    "No se usaron cuotas históricas; el informe mide calidad probabilística, no rentabilidad de apuestas.",
  ],
  sources: [
    { name: "OpenFootball worldcup.json", role: "Resultados históricos 1998–2022 (CC0), normalizados localmente", url: "https://github.com/openfootball/worldcup.json" },
    { name: "World Football Elo Ratings", role: "Snapshots Elo pre-torneo, con peso conservador del 10%", url: "https://www.eloratings.net/" },
    { name: "Football Data API", role: "Fixtures y estadísticas operativas del Mundial 2026", url: null },
    { name: "Mundial Edge", role: "Perfiles históricos propios de ataque y defensa", url: null },
  ],
};

assertTransparencyReport(report);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Calibration report generated: ${outputPath} (${report.corpus.matches} matches, ${report.reliability.length} markets)`);

function calibratedRow(row: WorldCupBacktestPrediction) {
  const calibrated = createCalibratedScoreMatrix(row.homeExpectedGoals, row.awayExpectedGoals, TEMPERATURE, 12);
  const markets = deriveMarketProbabilities(calibrated.scoreMatrix);
  const probabilities: OneXTwoProbabilities = {
    home: requiredProbability(markets, "home_win"),
    draw: requiredProbability(markets, "draw"),
    away: requiredProbability(markets, "away_win"),
  };
  const prediction: WorldCupBacktestPrediction = {
    ...row,
    probabilities,
    picked: bestOutcome(probabilities),
    predictedHomeGoals: calibrated.lambdaHomeCal,
    predictedAwayGoals: calibrated.lambdaAwayCal,
  };
  return {
    prediction,
    over25: requiredProbability(markets, "over_2_5"),
    btts: requiredProbability(markets, "btts_yes"),
  };
}

function requiredProbability(rows: ReturnType<typeof deriveMarketProbabilities>, selection: string): number {
  const probability = rows.find((row) => row.selection === selection)?.probability;
  if (probability == null) throw new Error(`Missing market probability: ${selection}`);
  return probability;
}

function bestOutcome(probabilities: OneXTwoProbabilities): OneXTwoOutcome {
  return (["home", "draw", "away"] as OneXTwoOutcome[]).reduce((best, outcome) => probabilities[outcome] > probabilities[best] ? outcome : best, "home");
}

function baselineRow(row: WorldCupBacktestPrediction, probabilities: OneXTwoProbabilities): WorldCupBacktestPrediction {
  return { ...row, probabilities, picked: bestOutcome(probabilities) };
}

function observedFrequencies(rows: WorldCupBacktestPrediction[]): OneXTwoProbabilities {
  return {
    home: rows.filter((row) => row.actual === "home").length / rows.length,
    draw: rows.filter((row) => row.actual === "draw").length / rows.length,
    away: rows.filter((row) => row.actual === "away").length / rows.length,
  };
}

function publicMulticlass(metrics: MulticlassMetrics): PublicMetrics {
  return { ...metrics };
}

function binaryMetrics(rows: Array<{ probability: number; actual: boolean }>): PublicMetrics {
  return {
    count: rows.length,
    brierScore: average(rows.map((row) => Math.pow(row.probability - Number(row.actual), 2))),
    logLoss: average(rows.map((row) => -(Number(row.actual) * Math.log(clamp(row.probability)) + Number(!row.actual) * Math.log(clamp(1 - row.probability))))),
    rankedProbabilityScore: null,
    accuracy: rows.filter((row) => (row.probability >= 0.5) === row.actual).length / rows.length,
  };
}

function reliabilitySeries(market: TransparencyMarketId, label: string, rows: Array<{ probability: number; actual: boolean }>) {
  const bins: ReliabilityBin[] = Array.from({ length: 10 }, (_, bin) => {
    const selected = rows.filter((row) => Math.min(9, Math.floor(row.probability * 10)) === bin);
    return {
      bin,
      lower: bin / 10,
      upper: (bin + 1) / 10,
      meanPredicted: selected.length ? average(selected.map((row) => row.probability)) : null,
      actualFrequency: selected.length ? average(selected.map((row) => Number(row.actual))) : null,
      count: selected.length,
    };
  });
  return {
    market,
    label,
    expectedCalibrationError: bins.reduce((sum, bin) => sum + bin.count / rows.length * Math.abs((bin.meanPredicted ?? 0) - (bin.actualFrequency ?? 0)), 0),
    bins,
  };
}

function relativeErrorImprovement(model: number, baseline: number): number {
  return (baseline - model) / baseline;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number): number {
  return Math.max(1e-15, Math.min(1 - 1e-15, value));
}
