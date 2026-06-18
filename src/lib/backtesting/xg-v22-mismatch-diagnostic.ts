import { calculateMulticlassMetrics, type BacktestVariant, type MetricDelta, type MulticlassMetrics, type WorldCupBacktestPrediction, type WorldCupBacktestReport } from "./world-cup-backtest";

export const XG_V22_COMPARISON_VARIANTS: BacktestVariant[] = [
  "legacy-neutral",
  "xg-v2.1-prior8",
  "xg-v2.2-mismatch-spread",
];

export type XgV22Conclusion = "PROMOTE" | "CANDIDATE" | "REJECT";

export interface XgV22MetricRow {
  segment: string;
  variant: BacktestVariant;
  metrics: MulticlassMetrics;
  meanAbsXgDiff: number;
  modal11Frequency: number;
}

export interface XgV22CurrentCase {
  matchId: string;
  match: string;
  ratingDiff: number;
  previousXg: string;
  newXg: string;
  previousTopScorelines: string;
  newTopScorelines: string;
  totalGoalsDelta: number;
}

export interface XgV22Diagnostic {
  rows: XgV22MetricRow[];
  currentCases: XgV22CurrentCase[];
  deltaVsPrior8: MetricDelta;
  guardrails: {
    maxBrierRegression: 0.005;
    maxLogLossRegression: 0.01;
    maxAccuracyReduction: 0.01;
    brierFailed: boolean;
    logLossFailed: boolean;
    accuracyFailed: boolean;
  };
  conclusion: XgV22Conclusion;
  reasons: string[];
}

export function diagnoseXgV22Mismatch(report: WorldCupBacktestReport, currentCases: XgV22CurrentCase[]): XgV22Diagnostic {
  const selected = report.predictions.filter((row) => XG_V22_COMPARISON_VARIANTS.includes(row.variant));
  const segments: Array<{ name: string; filter: (row: WorldCupBacktestPrediction) => boolean }> = [
    { name: "GLOBAL", filter: () => true },
    { name: "CLEAR_FAVORITES", filter: (row) => Math.abs(row.homeRating - row.awayRating) >= 10 },
    { name: "UPSETS", filter: isUpset },
    { name: "DRAWS", filter: (row) => row.actual === "draw" },
    { name: "LOW_GOALS_0_2", filter: (row) => row.homeGoals + row.awayGoals <= 2 },
  ];
  const rows = segments.flatMap((segment) => metricRows(segment.name, selected.filter(segment.filter)));
  const prior8 = required(rows, "GLOBAL", "xg-v2.1-prior8");
  const v22 = required(rows, "GLOBAL", "xg-v2.2-mismatch-spread");
  const deltaVsPrior8 = metricDelta(v22.metrics, prior8.metrics);
  const guardrails = {
    maxBrierRegression: 0.005 as const,
    maxLogLossRegression: 0.01 as const,
    maxAccuracyReduction: 0.01 as const,
    brierFailed: deltaVsPrior8.brierScore > 0.005,
    logLossFailed: deltaVsPrior8.logLoss > 0.01,
    accuracyFailed: deltaVsPrior8.accuracy < -0.01,
  };
  const rejected = guardrails.brierFailed || guardrails.logLossFailed || guardrails.accuracyFailed;
  const improvesAll = deltaVsPrior8.brierScore <= 0
    && deltaVsPrior8.logLoss <= 0
    && deltaVsPrior8.rankedProbabilityScore <= 0
    && deltaVsPrior8.accuracy >= 0;
  const compressionImproves = v22.meanAbsXgDiff > prior8.meanAbsXgDiff && v22.modal11Frequency < prior8.modal11Frequency;
  const conclusion: XgV22Conclusion = rejected ? "REJECT" : improvesAll && compressionImproves ? "PROMOTE" : "CANDIDATE";
  const reasons = [
    `Delta Brier vs prior8 ${signed(deltaVsPrior8.brierScore)} (límite +0.005).`,
    `Delta Log Loss vs prior8 ${signed(deltaVsPrior8.logLoss)} (límite +0.010).`,
    `Delta Accuracy vs prior8 ${signedPct(deltaVsPrior8.accuracy)} (límite -1.0 pp).`,
    `abs(xgDiff) ${num(prior8.meanAbsXgDiff)} -> ${num(v22.meanAbsXgDiff)}; modal 1-1 ${pct(prior8.modal11Frequency)} -> ${pct(v22.modal11Frequency)}.`,
  ];
  return { rows, currentCases, deltaVsPrior8, guardrails, conclusion, reasons };
}

export function renderXgV22MismatchMarkdown(diagnostic: XgV22Diagnostic): string {
  return `# Diagnóstico xG v2.2 mismatch spread

## Diseño experimental

\`xg-v2.2-mismatch-spread\` conserva el shrinkage \`prior8\`, pero elimina exclusivamente el segundo blend del componente ya regularizado contra el mismo rating. Después aplica una transferencia de xG underdog → favorito, sin aumentar el total:

- ratingDiff <=10: 0.
- 10-15: +0.012 por punto sobre 10 (hasta 0.06 transferido).
- 15-20: +0.018 por punto adicional (hasta 0.15 acumulado).
- 20+: +0.025 por punto adicional, cap 0.30.
- xG final permanece en [0.2, 4.5].

La comparación histórica usa 1X2 raw derivado de cada score matrix, sin recalibrar Platt. Esto aísla el efecto de lambdas; reutilizar el calibrador entrenado para prior8 contaminaría la comparación.

## Resultado automático: ${diagnostic.conclusion}

${diagnostic.reasons.map((reason) => `- ${reason}`).join("\n")}

El resultado es una recomendación diagnóstica. No cambia defaults ni promueve código productivo automáticamente.

## Métricas históricas

${metricTable(diagnostic.rows)}

Favorito claro = ratingDiff >=10. Upset = victoria del equipo con rating al menos 5 puntos menor. Empates y partidos de 0-2 goles se segmentan por resultado real.

## Casos 2026

${caseTable(diagnostic.currentCases)}

## Guardrails

- Brier no puede empeorar más de 0.005: ${diagnostic.guardrails.brierFailed ? "FAIL" : "PASS"}.
- Log Loss no puede empeorar más de 0.01: ${diagnostic.guardrails.logLossFailed ? "FAIL" : "PASS"}.
- Accuracy no puede caer más de 1 pp: ${diagnostic.guardrails.accuracyFailed ? "FAIL" : "PASS"}.

## Interpretación

La causa confirmada era doble: \`bayesianObservedExpectedGoals\` atraía tasas y lambda derivado al prior de rating, y luego \`estimateExpectedGoals\` volvía a mezclar ese resultado con \`ratingExpectedGoals\`. v2.2 elimina sólo la segunda atracción. El spread posterior es simétrico: aumenta separación, conserva total salvo redondeo y respeta guardrails.
`;
}

function metricRows(segment: string, rows: WorldCupBacktestPrediction[]): XgV22MetricRow[] {
  return XG_V22_COMPARISON_VARIANTS.map((variant) => {
    const variantRows = rows.filter((row) => row.variant === variant);
    return {
      segment,
      variant,
      metrics: calculateMulticlassMetrics(variantRows),
      meanAbsXgDiff: mean(variantRows.map((row) => Math.abs(row.homeExpectedGoals - row.awayExpectedGoals))),
      modal11Frequency: variantRows.length
        ? variantRows.filter((row) => row.predictedHomeGoals === 1 && row.predictedAwayGoals === 1).length / variantRows.length
        : 0,
    };
  });
}

function isUpset(row: WorldCupBacktestPrediction): boolean {
  if (Math.abs(row.homeRating - row.awayRating) < 5 || row.actual === "draw") return false;
  return row.actual === (row.homeRating < row.awayRating ? "home" : "away");
}

function required(rows: XgV22MetricRow[], segment: string, variant: BacktestVariant): XgV22MetricRow {
  const row = rows.find((item) => item.segment === segment && item.variant === variant);
  if (!row) throw new Error(`Missing ${segment}/${variant} diagnostic row.`);
  return row;
}

function metricDelta(metrics: MulticlassMetrics, baseline: MulticlassMetrics): MetricDelta {
  return {
    brierScore: metrics.brierScore - baseline.brierScore,
    logLoss: metrics.logLoss - baseline.logLoss,
    rankedProbabilityScore: metrics.rankedProbabilityScore - baseline.rankedProbabilityScore,
    accuracy: metrics.accuracy - baseline.accuracy,
  };
}

function metricTable(rows: XgV22MetricRow[]): string {
  return [
    "| Segmento | Variante | N | Brier | Log Loss | RPS | Accuracy | abs(xgDiff) | Modal 1-1 |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ...rows.map((row) => `| ${row.segment} | ${row.variant} | ${row.metrics.count} | ${num(row.metrics.brierScore)} | ${num(row.metrics.logLoss)} | ${num(row.metrics.rankedProbabilityScore)} | ${pct(row.metrics.accuracy)} | ${num(row.meanAbsXgDiff)} | ${pct(row.modal11Frequency)} |`),
  ].join("\n");
}

function caseTable(rows: XgV22CurrentCase[]): string {
  return [
    "| Partido | ratingDiff | xG anterior | xG nuevo | Top anterior | Top nuevo | Delta total |",
    "|---|---:|---|---|---|---|---:|",
    ...rows.map((row) => `| ${row.match} | ${num(row.ratingDiff)} | ${row.previousXg} | ${row.newXg} | ${row.previousTopScorelines} | ${row.newTopScorelines} | ${signed(row.totalGoalsDelta)} |`),
  ].join("\n");
}

function mean(values: number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function num(value: number): string { return value.toFixed(4); }
function signed(value: number): string { return `${value >= 0 ? "+" : ""}${num(Math.abs(value) < 0.00005 ? 0 : value)}`; }
function pct(value: number): string { return `${(value * 100).toFixed(1)}%`; }
function signedPct(value: number): string { return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)} pp`; }
