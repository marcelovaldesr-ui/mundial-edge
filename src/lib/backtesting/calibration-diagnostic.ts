import {
  calibrateOneXTwoProbabilities,
  probabilityLogit,
  sigmoid,
  type MarketCalibrationParams,
  type MarketCalibrationSet,
} from "../stat-model/market-calibration";
import {
  XG_V21_PRIOR8_EXPERIMENTAL_PLATT_PRESET,
} from "../stat-model/calibration-presets";
import {
  brierScore1x2,
  logLoss1x2,
  rankedProbabilityScore1x2,
  type MulticlassMetrics,
  type OneXTwoOutcome,
  type OneXTwoProbabilities,
  type WorldCupBacktestPrediction,
  type WorldCupBacktestReport,
} from "./world-cup-backtest";

export type CalibrationDiagnosticVariant = "legacy-neutral raw" | "xg-v2.1-prior8 raw" | "xg-v2.1-prior8 calibrated";

export interface CalibrationBucketDiagnostic {
  label: string;
  count: number;
  averageProbability: number | null;
  actualRate: number | null;
}

export interface CalibrationDiagnosticMetrics extends MulticlassMetrics {
  drawPredictedRate: number;
  realDrawRate: number;
  favoritePredictedRate: number;
  favoriteActualRate: number;
}

export interface CalibrationDiagnosticRow {
  variant: CalibrationDiagnosticVariant;
  metrics: CalibrationDiagnosticMetrics;
  buckets: CalibrationBucketDiagnostic[];
}

export interface LeaveOneWorldCupOutResult {
  tournament: number;
  trainingMatches: number;
  testMatches: number;
  calibration: MarketCalibrationSet;
  raw: MulticlassMetrics;
  calibrated: MulticlassMetrics;
}

export interface CalibrationDiagnostic {
  matches: number;
  tournaments: number[];
  presetStatus: "experimental/manual-full-corpus-fit";
  fittedCalibration: MarketCalibrationSet;
  variants: CalibrationDiagnosticRow[];
  leaveOneWorldCupOut: LeaveOneWorldCupOutResult[];
  leaveOneWorldCupOutAggregate: { raw: MulticlassMetrics; calibrated: MulticlassMetrics };
  guardrails: {
    nonFiniteValues: number;
    rangeViolations: number;
    sumViolations: number;
  };
}

interface DiagnosticPrediction {
  probabilities: OneXTwoProbabilities;
  actual: OneXTwoOutcome;
  homeRating: number;
  awayRating: number;
}

const OUTCOMES: OneXTwoOutcome[] = ["home", "draw", "away"];

export function fitOneXTwoPlattCalibration(rows: WorldCupBacktestPrediction[]): MarketCalibrationSet {
  if (!rows.length) throw new RangeError("At least one prediction is required to fit calibration.");
  return {
    homeWin: fitBinaryPlatt(rows, "home"),
    draw: fitBinaryPlatt(rows, "draw"),
    awayWin: fitBinaryPlatt(rows, "away"),
  };
}

export function diagnoseCalibration(report: WorldCupBacktestReport): CalibrationDiagnostic {
  const legacy = report.predictions.filter((row) => row.variant === "legacy-neutral");
  const prior8 = report.predictions.filter((row) => row.variant === "xg-v2.1-prior8");
  if (!legacy.length || !prior8.length) throw new Error("Calibration diagnostic requires Legacy and prior8 predictions.");

  const fittedCalibration = fitOneXTwoPlattCalibration(prior8);
  const calibrated = prior8.map((row) => calibratePrediction(
    row,
    XG_V21_PRIOR8_EXPERIMENTAL_PLATT_PRESET.calibration
  ));
  const leaveOneWorldCupOut = report.tournaments.map((tournament) => {
    const training = prior8.filter((row) => row.tournament !== tournament);
    const test = prior8.filter((row) => row.tournament === tournament);
    const calibration = fitOneXTwoPlattCalibration(training);
    return {
      tournament,
      trainingMatches: training.length,
      testMatches: test.length,
      calibration,
      raw: metrics(test),
      calibrated: metrics(test.map((row) => calibratePrediction(row, calibration))),
    };
  });
  const loocvRaw = prior8.map((row) => toDiagnosticPrediction(row));
  const loocvCalibrated = prior8.map((row) => {
    const fold = leaveOneWorldCupOut.find((item) => item.tournament === row.tournament)!;
    return calibratePrediction(row, fold.calibration);
  });
  const variants: CalibrationDiagnosticRow[] = [
    diagnosticRow("legacy-neutral raw", legacy),
    diagnosticRow("xg-v2.1-prior8 raw", prior8),
    diagnosticRow("xg-v2.1-prior8 calibrated", calibrated),
  ];
  const guardrails = calibrationGuardrails(calibrated);
  return {
    matches: prior8.length,
    tournaments: report.tournaments,
    presetStatus: "experimental/manual-full-corpus-fit",
    fittedCalibration,
    variants,
    leaveOneWorldCupOut,
    leaveOneWorldCupOutAggregate: { raw: metrics(loocvRaw), calibrated: metrics(loocvCalibrated) },
    guardrails,
  };
}

export function renderCalibrationDiagnosticMarkdown(diagnostic: CalibrationDiagnostic): string {
  const preset = XG_V21_PRIOR8_EXPERIMENTAL_PLATT_PRESET;
  return `# Diagnostico de calibracion Platt 1X2

Corpus: ${diagnostic.matches} partidos, Mundiales ${diagnostic.tournaments.join(", ")}. El ajuste es binario uno-contra-resto por mercado y luego renormaliza home/draw/away a 1.

## Comparacion global (ajuste descriptivo sobre corpus completo)

${metricTable(diagnostic.variants)}

## Parametros ajustados

| Mercado | a | b |
|---|---:|---:|
| homeWin | ${num(diagnostic.fittedCalibration.homeWin.a)} | ${num(diagnostic.fittedCalibration.homeWin.b)} |
| draw | ${num(diagnostic.fittedCalibration.draw.a)} | ${num(diagnostic.fittedCalibration.draw.b)} |
| awayWin | ${num(diagnostic.fittedCalibration.awayWin.a)} | ${num(diagnostic.fittedCalibration.awayWin.b)} |

El preset \`${preset.id}\` esta marcado **experimental/manual**. No se activa por defecto y no constituye una estimacion fuera de muestra.

## Leave-one-world-cup-out

Cada fila ajusta los parametros con los otros seis Mundiales y evalua exclusivamente el torneo excluido.

${loocvTable(diagnostic.leaveOneWorldCupOut)}

Agregado fuera de muestra: Brier ${num(diagnostic.leaveOneWorldCupOutAggregate.raw.brierScore)} -> ${num(diagnostic.leaveOneWorldCupOutAggregate.calibrated.brierScore)}, Log Loss ${num(diagnostic.leaveOneWorldCupOutAggregate.raw.logLoss)} -> ${num(diagnostic.leaveOneWorldCupOutAggregate.calibrated.logLoss)}, RPS ${num(diagnostic.leaveOneWorldCupOutAggregate.raw.rankedProbabilityScore)} -> ${num(diagnostic.leaveOneWorldCupOutAggregate.calibrated.rankedProbabilityScore)}, Accuracy ${pct(diagnostic.leaveOneWorldCupOutAggregate.raw.accuracy)} -> ${pct(diagnostic.leaveOneWorldCupOutAggregate.calibrated.accuracy)}.

## Buckets de calibracion

Cada partido aporta tres observaciones binarias (home/draw/away).

${bucketTable(diagnostic.variants)}

## Guardrails

- Valores no finitos: ${diagnostic.guardrails.nonFiniteValues}
- Probabilidades fuera de [0, 1]: ${diagnostic.guardrails.rangeViolations}
- Sumas 1X2 fuera de tolerancia: ${diagnostic.guardrails.sumViolations}

## Recomendacion

Mantener \`STAT_MODEL_CALIBRATION=none\` y \`legacy-neutral\` como defaults productivos. El preset Platt solo debe usarse con \`xg-v2.1-prior8\` para experimentacion. Antes de promocion: versionar el entrenamiento, ampliar/validar ratings historicos, evaluar estabilidad temporal y decidir usando el resultado LOOWC, no la mejora in-sample. Monte Carlo sigue como paso posterior y separado; no es necesario para calibrar 1X2.
`;
}

function fitBinaryPlatt(rows: WorldCupBacktestPrediction[], outcome: OneXTwoOutcome): MarketCalibrationParams {
  let a = 1;
  let b = 0;
  for (let iteration = 0; iteration < 100; iteration++) {
    let gradientA = 0;
    let gradientB = 0;
    let hAA = 0;
    let hAB = 0;
    let hBB = 0;
    for (const row of rows) {
      const x = probabilityLogit(row.probabilities[outcome], 1e-10);
      const y = row.actual === outcome ? 1 : 0;
      const q = sigmoid(a * x + b);
      const residual = q - y;
      const weight = Math.max(q * (1 - q), 1e-12);
      gradientA += residual * x;
      gradientB += residual;
      hAA += weight * x * x;
      hAB += weight * x;
      hBB += weight;
    }
    const determinant = hAA * hBB - hAB * hAB;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) break;
    const deltaA = (hBB * gradientA - hAB * gradientB) / determinant;
    const deltaB = (-hAB * gradientA + hAA * gradientB) / determinant;
    a -= deltaA;
    b -= deltaB;
    if (![a, b].every(Number.isFinite)) throw new Error("Platt fit diverged.");
    if (Math.max(Math.abs(deltaA), Math.abs(deltaB)) < 1e-9) break;
  }
  return { a, b, epsilon: 1e-10 };
}

function calibratePrediction(row: WorldCupBacktestPrediction, calibration: MarketCalibrationSet): DiagnosticPrediction {
  const calibrated = calibrateOneXTwoProbabilities({
    homeWin: row.probabilities.home,
    draw: row.probabilities.draw,
    awayWin: row.probabilities.away,
  }, calibration);
  return {
    probabilities: { home: calibrated.homeWin, draw: calibrated.draw, away: calibrated.awayWin },
    actual: row.actual,
    homeRating: row.homeRating,
    awayRating: row.awayRating,
  };
}

function toDiagnosticPrediction(row: WorldCupBacktestPrediction): DiagnosticPrediction {
  return { probabilities: row.probabilities, actual: row.actual, homeRating: row.homeRating, awayRating: row.awayRating };
}

function diagnosticRow(variant: CalibrationDiagnosticVariant, rows: Array<WorldCupBacktestPrediction | DiagnosticPrediction>): CalibrationDiagnosticRow {
  const normalized = rows.map(toGenericPrediction);
  return { variant, metrics: diagnosticMetrics(normalized), buckets: calibrationBuckets(normalized) };
}

function toGenericPrediction(row: WorldCupBacktestPrediction | DiagnosticPrediction): DiagnosticPrediction {
  return { probabilities: row.probabilities, actual: row.actual, homeRating: row.homeRating, awayRating: row.awayRating };
}

function metrics(rows: Array<WorldCupBacktestPrediction | DiagnosticPrediction>): MulticlassMetrics {
  const normalized = rows.map(toGenericPrediction);
  if (!normalized.length) return { count: 0, brierScore: 0, logLoss: 0, rankedProbabilityScore: 0, accuracy: 0 };
  return {
    count: normalized.length,
    brierScore: average(normalized.map((row) => brierScore1x2(row.probabilities, row.actual))),
    logLoss: average(normalized.map((row) => logLoss1x2(row.probabilities, row.actual))),
    rankedProbabilityScore: average(normalized.map((row) => rankedProbabilityScore1x2(row.probabilities, row.actual))),
    accuracy: average(normalized.map((row) => pick(row.probabilities) === row.actual ? 1 : 0)),
  };
}

function diagnosticMetrics(rows: DiagnosticPrediction[]): CalibrationDiagnosticMetrics {
  const base = metrics(rows);
  const favorites = rows.filter((row) => row.homeRating !== row.awayRating);
  return {
    ...base,
    drawPredictedRate: average(rows.map((row) => row.probabilities.draw)),
    realDrawRate: average(rows.map((row) => row.actual === "draw" ? 1 : 0)),
    favoritePredictedRate: average(favorites.map((row) => row.homeRating > row.awayRating ? row.probabilities.home : row.probabilities.away)),
    favoriteActualRate: average(favorites.map((row) => row.actual === (row.homeRating > row.awayRating ? "home" : "away") ? 1 : 0)),
  };
}

function calibrationBuckets(rows: DiagnosticPrediction[]): CalibrationBucketDiagnostic[] {
  return Array.from({ length: 10 }, (_, index) => {
    const min = index / 10;
    const max = (index + 1) / 10;
    const observations = rows.flatMap((row) => OUTCOMES.map((outcome) => ({
      probability: row.probabilities[outcome], actual: row.actual === outcome ? 1 : 0,
    }))).filter((row) => row.probability >= min && (index === 9 ? row.probability <= max : row.probability < max));
    return {
      label: `${index * 10}-${(index + 1) * 10}%`,
      count: observations.length,
      averageProbability: observations.length ? average(observations.map((row) => row.probability)) : null,
      actualRate: observations.length ? average(observations.map((row) => row.actual)) : null,
    };
  });
}

function calibrationGuardrails(rows: DiagnosticPrediction[]): CalibrationDiagnostic["guardrails"] {
  let nonFiniteValues = 0;
  let rangeViolations = 0;
  let sumViolations = 0;
  for (const row of rows) {
    const values = Object.values(row.probabilities);
    if (values.some((value) => !Number.isFinite(value))) nonFiniteValues++;
    if (values.some((value) => value < 0 || value > 1)) rangeViolations++;
    if (Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 1e-9) sumViolations++;
  }
  return { nonFiniteValues, rangeViolations, sumViolations };
}

function pick(probabilities: OneXTwoProbabilities): OneXTwoOutcome {
  return OUTCOMES.reduce((best, outcome) => probabilities[outcome] > probabilities[best] ? outcome : best, "home");
}

function metricTable(rows: CalibrationDiagnosticRow[]): string {
  return [
    "| Variante | N | Brier | Log Loss | RPS | Accuracy | Empate pred. | Empate real | Favorito pred. | Favorito real |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...rows.map((row) => `| ${row.variant} | ${row.metrics.count} | ${num(row.metrics.brierScore)} | ${num(row.metrics.logLoss)} | ${num(row.metrics.rankedProbabilityScore)} | ${pct(row.metrics.accuracy)} | ${pct(row.metrics.drawPredictedRate)} | ${pct(row.metrics.realDrawRate)} | ${pct(row.metrics.favoritePredictedRate)} | ${pct(row.metrics.favoriteActualRate)} |`),
  ].join("\n");
}

function loocvTable(rows: LeaveOneWorldCupOutResult[]): string {
  return [
    "| Mundial fuera | Train/Test | Brier raw | Brier cal. | LogLoss raw | LogLoss cal. | RPS raw | RPS cal. | Acc raw | Acc cal. |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...rows.map((row) => `| ${row.tournament} | ${row.trainingMatches}/${row.testMatches} | ${num(row.raw.brierScore)} | ${num(row.calibrated.brierScore)} | ${num(row.raw.logLoss)} | ${num(row.calibrated.logLoss)} | ${num(row.raw.rankedProbabilityScore)} | ${num(row.calibrated.rankedProbabilityScore)} | ${pct(row.raw.accuracy)} | ${pct(row.calibrated.accuracy)} |`),
  ].join("\n");
}

function bucketTable(rows: CalibrationDiagnosticRow[]): string {
  return [
    "| Variante | Bucket | N | Prob. media | Frecuencia real |",
    "|---|---|---:|---:|---:|",
    ...rows.flatMap((row) => row.buckets.map((bucket) => `| ${row.variant} | ${bucket.label} | ${bucket.count} | ${nullablePct(bucket.averageProbability)} | ${nullablePct(bucket.actualRate)} |`)),
  ].join("\n");
}

function average(values: number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function num(value: number): string { return value.toFixed(4); }
function pct(value: number): string { return `${(value * 100).toFixed(1)}%`; }
function nullablePct(value: number | null): string { return value == null ? "-" : pct(value); }
