import {
  calculateMulticlassMetrics,
  type BacktestVariant,
  type MulticlassMetrics,
  type WorldCupBacktestPrediction,
  type WorldCupBacktestReport,
} from "./world-cup-backtest";

export const DIXON_COLES_DIAGNOSTIC_VARIANTS: BacktestVariant[] = [
  "legacy-neutral",
  "legacy-neutral-dc-rho-0.15",
  "legacy-neutral-dc-rho-0.10",
  "legacy-neutral-dc-rho-0.05",
  "xg-v2.1-prior8",
  "xg-v2.1-prior8-dc-rho-0.15",
  "xg-v2.1-prior8-dc-rho-0.10",
  "xg-v2.1-prior8-dc-rho-0.05",
];

export interface DixonColesMetricRow {
  variant: BacktestVariant;
  metrics: MulticlassMetrics;
  correctScoreTop1: number;
  avgDrawProbability: number;
  actualDrawRate: number;
  drawCalibrationGap: number;
  drawBrier: number;
  deltaVsLegacy: DixonColesMetricDelta;
  deltaVsPrior8: DixonColesMetricDelta;
}

export interface DixonColesMetricDelta {
  brierScore: number;
  logLoss: number;
  rankedProbabilityScore: number;
  accuracy: number;
  correctScoreTop1: number;
  drawCalibrationGap: number;
  drawBrier: number;
}

export interface DixonColesDiagnostic {
  global: DixonColesMetricRow[];
  lowGoals: DixonColesMetricRow[];
  draws: DixonColesMetricRow[];
  calibrationBuckets: Array<{
    variant: BacktestVariant;
    bucket: string;
    count: number;
    avgDrawProbability: number;
    actualDrawRate: number;
    gap: number;
  }>;
}

export function diagnoseDixonColes(report: WorldCupBacktestReport): DixonColesDiagnostic {
  const selected = report.predictions.filter((row) => DIXON_COLES_DIAGNOSTIC_VARIANTS.includes(row.variant));
  return {
    global: metricRows(selected),
    lowGoals: metricRows(selected.filter((row) => row.homeGoals + row.awayGoals <= 2)),
    draws: metricRows(selected.filter((row) => row.actual === "draw")),
    calibrationBuckets: drawCalibrationBuckets(selected),
  };
}

export function renderDixonColesDiagnosticMarkdown(diagnostic: DixonColesDiagnostic): string {
  const bestLegacyDc = bestBrier(diagnostic.global.filter((row) => row.variant.startsWith("legacy-neutral-dc")));
  const bestPrior8Dc = bestBrier(diagnostic.global.filter((row) => row.variant.includes("prior8-dc")));
  const legacy = required(diagnostic.global, "legacy-neutral");
  const prior8 = required(diagnostic.global, "xg-v2.1-prior8");
  return `# Diagnostico experimental Dixon-Coles

## Resumen ejecutivo

La correccion Dixon-Coles se aplica solo a 0-0, 1-0, 0-1 y 1-1, seguida de renormalizacion. Este experimento compara rho -0.15, -0.10 y -0.05 sobre **legacy-neutral** y **xg-v2.1-prior8**. Rho 0.00 queda cubierto como identidad por tests y 0.05 permanece disponible en la funcion pura, pero no forma parte de las ocho variantes solicitadas.

La mejor variante DC sobre Legacy por Brier global es **${bestLegacyDc.variant}** (${signed(bestLegacyDc.deltaVsLegacy.brierScore)}). La mejor sobre prior8 es **${bestPrior8Dc.variant}** (${signed(bestPrior8Dc.deltaVsPrior8.brierScore)} contra prior8). ${conclusion(bestLegacyDc, bestPrior8Dc)}

## Global

${metricTable(diagnostic.global)}

## Partidos de 0-2 goles

${metricTable(diagnostic.lowGoals)}

## Empates

${metricTable(diagnostic.draws)}

## Calibracion de probabilidad de empate

En el corpus completo, la tasa real de empate es ${pct(legacy.actualDrawRate)}. Legacy neutral predice ${pct(legacy.avgDrawProbability)} y prior8 ${pct(prior8.avgDrawProbability)}.

${drawCalibrationTable(diagnostic.global)}

### Buckets de calibracion de draw

${bucketTable(diagnostic.calibrationBuckets)}

## Lectura y recomendacion

- Delta negativo mejora Brier, Log Loss, RPS, error de calibracion draw y draw Brier; delta positivo mejora Accuracy y correct score top-1.
- La comparacion contra legacy-neutral permite medir el resultado total; la comparacion contra prior8 aísla el aporte marginal de Dixon-Coles sobre el mejor xG previo.
- Mantener Dixon-Coles como experimento. Incluso una mejora en empates o marcadores bajos no justifica promocion con solo 128 partidos y ratings retrospectivos.
`;
}

function metricRows(rows: WorldCupBacktestPrediction[]): DixonColesMetricRow[] {
  const raw = new Map(DIXON_COLES_DIAGNOSTIC_VARIANTS.map((variant) => [variant, rawMetrics(rows.filter((row) => row.variant === variant))]));
  const legacy = raw.get("legacy-neutral")!;
  const prior8 = raw.get("xg-v2.1-prior8")!;
  return DIXON_COLES_DIAGNOSTIC_VARIANTS.map((variant) => {
    const current = raw.get(variant)!;
    return { ...current, variant, deltaVsLegacy: delta(current, legacy), deltaVsPrior8: delta(current, prior8) };
  });
}

function rawMetrics(rows: WorldCupBacktestPrediction[]) {
  const metrics = calculateMulticlassMetrics(rows);
  const correctScoreTop1 = average(rows.map((row) => row.correctScoreTop1 ? 1 : 0));
  const avgDrawProbability = average(rows.map((row) => row.probabilities.draw));
  const actualDrawRate = average(rows.map((row) => row.actual === "draw" ? 1 : 0));
  const drawCalibrationGap = Math.abs(avgDrawProbability - actualDrawRate);
  const drawBrier = average(rows.map((row) => Math.pow(row.probabilities.draw - (row.actual === "draw" ? 1 : 0), 2)));
  return { metrics, correctScoreTop1, avgDrawProbability, actualDrawRate, drawCalibrationGap, drawBrier };
}

function delta(current: ReturnType<typeof rawMetrics>, baseline: ReturnType<typeof rawMetrics>): DixonColesMetricDelta {
  return {
    brierScore: current.metrics.brierScore - baseline.metrics.brierScore,
    logLoss: current.metrics.logLoss - baseline.metrics.logLoss,
    rankedProbabilityScore: current.metrics.rankedProbabilityScore - baseline.metrics.rankedProbabilityScore,
    accuracy: current.metrics.accuracy - baseline.metrics.accuracy,
    correctScoreTop1: current.correctScoreTop1 - baseline.correctScoreTop1,
    drawCalibrationGap: current.drawCalibrationGap - baseline.drawCalibrationGap,
    drawBrier: current.drawBrier - baseline.drawBrier,
  };
}

function drawCalibrationBuckets(rows: WorldCupBacktestPrediction[]): DixonColesDiagnostic["calibrationBuckets"] {
  const bounds: Array<[number, number, string]> = [[0, 0.2, "0-20%"], [0.2, 0.25, "20-25%"], [0.25, 0.3, "25-30%"], [0.3, 1.01, "30%+"]];
  return DIXON_COLES_DIAGNOSTIC_VARIANTS.flatMap((variant) => bounds.map(([low, high, bucket]) => {
    const selected = rows.filter((row) => row.variant === variant && row.probabilities.draw >= low && row.probabilities.draw < high);
    const avgDrawProbability = average(selected.map((row) => row.probabilities.draw));
    const actualDrawRate = average(selected.map((row) => row.actual === "draw" ? 1 : 0));
    return { variant, bucket, count: selected.length, avgDrawProbability, actualDrawRate, gap: avgDrawProbability - actualDrawRate };
  }));
}

function metricTable(rows: DixonColesMetricRow[]): string {
  return [
    "| Variante | N | Brier | Δ Legacy | Δ prior8 | LogLoss | Δ Legacy | Δ prior8 | RPS | Δ Legacy | Δ prior8 | Accuracy | Δ Legacy | Δ prior8 | CS top-1 | Δ Legacy | Δ prior8 |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...rows.map((row) => `| ${row.variant} | ${row.metrics.count} | ${num(row.metrics.brierScore)} | ${signed(row.deltaVsLegacy.brierScore)} | ${signed(row.deltaVsPrior8.brierScore)} | ${num(row.metrics.logLoss)} | ${signed(row.deltaVsLegacy.logLoss)} | ${signed(row.deltaVsPrior8.logLoss)} | ${num(row.metrics.rankedProbabilityScore)} | ${signed(row.deltaVsLegacy.rankedProbabilityScore)} | ${signed(row.deltaVsPrior8.rankedProbabilityScore)} | ${pct(row.metrics.accuracy)} | ${signedPct(row.deltaVsLegacy.accuracy)} | ${signedPct(row.deltaVsPrior8.accuracy)} | ${pct(row.correctScoreTop1)} | ${signedPct(row.deltaVsLegacy.correctScoreTop1)} | ${signedPct(row.deltaVsPrior8.correctScoreTop1)} |`),
  ].join("\n");
}

function drawCalibrationTable(rows: DixonColesMetricRow[]): string {
  return [
    "| Variante | Draw predicho | Draw real | Gap absoluto | Δ gap Legacy | Δ gap prior8 | Draw Brier | Δ Legacy | Δ prior8 |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...rows.map((row) => `| ${row.variant} | ${pct(row.avgDrawProbability)} | ${pct(row.actualDrawRate)} | ${pct(row.drawCalibrationGap)} | ${signedPct(row.deltaVsLegacy.drawCalibrationGap)} | ${signedPct(row.deltaVsPrior8.drawCalibrationGap)} | ${num(row.drawBrier)} | ${signed(row.deltaVsLegacy.drawBrier)} | ${signed(row.deltaVsPrior8.drawBrier)} |`),
  ].join("\n");
}

function bucketTable(rows: DixonColesDiagnostic["calibrationBuckets"]): string {
  return [
    "| Variante | Bucket | N | Draw medio | Draw real | Gap |",
    "|---|---|---:|---:|---:|---:|",
    ...rows.map((row) => `| ${row.variant} | ${row.bucket} | ${row.count} | ${pct(row.avgDrawProbability)} | ${pct(row.actualDrawRate)} | ${signedPct(row.gap)} |`),
  ].join("\n");
}

function conclusion(legacyDc: DixonColesMetricRow, prior8Dc: DixonColesMetricRow): string {
  const lowScoreImproves = legacyDc.deltaVsLegacy.brierScore < 0 || prior8Dc.deltaVsPrior8.brierScore < 0;
  return lowScoreImproves
    ? "Hay mejora Brier marginal en al menos una familia; debe contrastarse con draw calibration y desempeño global antes de cualquier avance."
    : "No aparece mejora Brier marginal; Dixon-Coles no justifica avanzar con estos rho en este corpus.";
}

function bestBrier(rows: DixonColesMetricRow[]): DixonColesMetricRow {
  return [...rows].sort((a, b) => a.metrics.brierScore - b.metrics.brierScore)[0];
}

function required(rows: DixonColesMetricRow[], variant: BacktestVariant): DixonColesMetricRow {
  return rows.find((row) => row.variant === variant)!;
}

function average(values: number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function num(value: number): string { return value.toFixed(4); }
function signed(value: number): string { const v = Math.abs(value) < 0.00005 ? 0 : value; return `${v >= 0 ? "+" : ""}${v.toFixed(4)}`; }
function pct(value: number): string { return `${(value * 100).toFixed(1)}%`; }
function signedPct(value: number): string { const v = Math.abs(value) < 0.00005 ? 0 : value; return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)} pp`; }
