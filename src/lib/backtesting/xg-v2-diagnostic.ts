import {
  brierScore1x2,
  calculateMulticlassMetrics,
  logLoss1x2,
  rankedProbabilityScore1x2,
  type BacktestVariant,
  type MetricDelta,
  type MulticlassMetrics,
  type WorldCupBacktestPrediction,
  type WorldCupBacktestReport,
} from "./world-cup-backtest";

const XG_V2_VARIANTS: BacktestVariant[] = [
  "legacy-neutral", "xg-v2", "xg-v2.1-prior2", "xg-v2.1-prior4", "xg-v2.1-prior6", "xg-v2.1-prior8",
];

export type DiagnosticSegment = "GLOBAL" | "GROUP" | "KNOCKOUT" | "FAVORITES" | "UPSETS" | "LOW_GOALS_0_2";

export interface DiagnosticVariantRow {
  variant: BacktestVariant;
  metrics: MulticlassMetrics;
  deltaVsLegacyNeutral: MetricDelta;
}

export interface DiagnosticSegmentResult {
  segment: DiagnosticSegment;
  variants: DiagnosticVariantRow[];
}

export interface XgV2Diagnostic {
  matches: WorldCupBacktestPrediction[];
  segments: DiagnosticSegmentResult[];
  global: DiagnosticSegmentResult;
  bestExperimental: DiagnosticVariantRow;
  guardrails: {
    probabilityViolations: number;
    nonFiniteValues: number;
    xgRangeViolations: number;
    neutralVenueViolations: number;
    fallbackMetadataViolations: number;
  };
}

export function diagnoseXgV2(report: WorldCupBacktestReport): XgV2Diagnostic {
  const matches = report.predictions.filter((row) => XG_V2_VARIANTS.includes(row.variant));
  const segments: DiagnosticSegmentResult[] = [
    segment("GLOBAL", matches),
    segment("GROUP", matches.filter((row) => row.stageBucket === "GROUP")),
    segment("KNOCKOUT", matches.filter((row) => row.stageBucket === "KNOCKOUT")),
    segment("FAVORITES", matches.filter(isFavoriteMatch)),
    segment("UPSETS", matches.filter(isUpset)),
    segment("LOW_GOALS_0_2", matches.filter((row) => row.homeGoals + row.awayGoals <= 2)),
  ];
  const global = segments[0];
  const bestExperimental = [...global.variants]
    .filter((row) => row.variant !== "legacy-neutral")
    .sort((a, b) => a.metrics.brierScore - b.metrics.brierScore)[0];
  return { matches, segments, global, bestExperimental, guardrails: guardrails(matches) };
}

export function renderXgV2DiagnosticMarkdown(diagnostic: XgV2Diagnostic): string {
  const best = diagnostic.bestExperimental;
  const beatsBaseline = best.deltaVsLegacyNeutral.brierScore < 0
    && best.deltaVsLegacyNeutral.logLoss < 0
    && best.deltaVsLegacyNeutral.rankedProbabilityScore < 0
    && best.deltaVsLegacyNeutral.accuracy >= 0;
  return `# Diagnostico xG v2.1: regularizacion bayesiana

## Resumen ejecutivo

La auditoria reproduce 128 partidos de los Mundiales 2018 y 2022 y mantiene **legacy-neutral** como baseline. xG v2 permanece sin promocionar. Las variantes xG v2.1 aplican shrinkage bayesiano a ataque observado, defensa observada y xG derivado.

El peso observado es \`gamesPlayed / (gamesPlayed + priorStrength)\`; se prueban \`priorStrength\` 2, 4, 6 y 8. Para el xG derivado se usa la muestra compartida conservadora (el minimo de partidos previos de ambos equipos), mientras cada tasa ofensiva/defensiva usa los partidos del equipo correspondiente.

La mejor variante experimental por Brier global es **${best.variant}**. ${beatsBaseline ? "Supera legacy-neutral en las cuatro metricas globales evaluadas." : "No demuestra una superioridad completa sobre legacy-neutral en las cuatro metricas globales; no debe reemplazar el baseline."}

## Resultados globales

${variantTable(diagnostic.global.variants)}

## Fase de grupos

${variantTable(findSegment(diagnostic, "GROUP").variants)}

## Eliminatorias

${variantTable(findSegment(diagnostic, "KNOCKOUT").variants)}

## Partidos con favorito

Favorito se define por una diferencia de rating overall de al menos 5 puntos, con independencia del resultado final.

${variantTable(findSegment(diagnostic, "FAVORITES").variants)}

## Upsets

Upset se define como victoria del equipo con rating overall al menos 5 puntos menor.

${variantTable(findSegment(diagnostic, "UPSETS").variants)}

## Partidos de 0-2 goles

${variantTable(findSegment(diagnostic, "LOW_GOALS_0_2").variants)}

## Guardrails

- Violaciones de suma/rango 1X2: ${diagnostic.guardrails.probabilityViolations}.
- Valores no finitos: ${diagnostic.guardrails.nonFiniteValues}.
- xG fuera de [0.2, 4.5]: ${diagnostic.guardrails.xgRangeViolations}.
- Fixtures sin sede neutral aplicada: ${diagnostic.guardrails.neutralVenueViolations}.
- Ratings sin metadata de seed o fallback neutral explicito: ${diagnostic.guardrails.fallbackMetadataViolations}.

## Recomendacion

Mantener **legacy-neutral** como baseline y todas las variantes xG v2/v2.1 como experimentales. ${beatsBaseline ? `Aunque ${best.variant} gana este corpus, la muestra usa seeds 2026 retrospectivos y solo dos Mundiales; ampliar corpus y ratings historicos antes de cualquier promocion.` : `La regularizacion reduce parte de la inestabilidad, pero ${best.variant} no establece una mejora integral suficiente para promocion.`}
`;
}

function segment(name: DiagnosticSegment, rows: WorldCupBacktestPrediction[]): DiagnosticSegmentResult {
  const baseline = calculateMulticlassMetrics(rows.filter((row) => row.variant === "legacy-neutral"));
  return {
    segment: name,
    variants: XG_V2_VARIANTS.map((variant) => {
      const metrics = calculateMulticlassMetrics(rows.filter((row) => row.variant === variant));
      return { variant, metrics, deltaVsLegacyNeutral: metricDelta(metrics, baseline) };
    }),
  };
}

function metricDelta(metrics: MulticlassMetrics, baseline: MulticlassMetrics): MetricDelta {
  return {
    brierScore: metrics.brierScore - baseline.brierScore,
    logLoss: metrics.logLoss - baseline.logLoss,
    rankedProbabilityScore: metrics.rankedProbabilityScore - baseline.rankedProbabilityScore,
    accuracy: metrics.accuracy - baseline.accuracy,
  };
}

function isFavoriteMatch(row: WorldCupBacktestPrediction): boolean {
  return Math.abs(row.homeRating - row.awayRating) >= 5;
}

function isUpset(row: WorldCupBacktestPrediction): boolean {
  if (Math.abs(row.homeRating - row.awayRating) < 5 || row.actual === "draw") return false;
  return row.actual === (row.homeRating < row.awayRating ? "home" : "away");
}

function guardrails(rows: WorldCupBacktestPrediction[]): XgV2Diagnostic["guardrails"] {
  let probabilityViolations = 0;
  let nonFiniteValues = 0;
  let xgRangeViolations = 0;
  let neutralVenueViolations = 0;
  let fallbackMetadataViolations = 0;
  for (const row of rows) {
    const probabilities = Object.values(row.probabilities);
    if (probabilities.some((value) => value < 0 || value > 1) || Math.abs(probabilities.reduce((a, b) => a + b, 0) - 1) > 1e-9) probabilityViolations++;
    if (![...probabilities, row.homeExpectedGoals, row.awayExpectedGoals].every(Number.isFinite)) nonFiniteValues++;
    if ([row.homeExpectedGoals, row.awayExpectedGoals].some((value) => value < 0.2 || value > 4.5)) xgRangeViolations++;
    if (!row.neutralVenueApplied) neutralVenueViolations++;
    if (![row.homeRatingSource, row.awayRatingSource].every((source) => source === "manual_seed" || source === "neutral_fallback")) fallbackMetadataViolations++;
  }
  return { probabilityViolations, nonFiniteValues, xgRangeViolations, neutralVenueViolations, fallbackMetadataViolations };
}

function variantTable(rows: DiagnosticVariantRow[]): string {
  return [
    "| Variante | N | Brier | Delta | Log Loss | Delta | RPS | Delta | Accuracy | Delta |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...rows.map((row) => `| ${row.variant} | ${row.metrics.count} | ${num(row.metrics.brierScore)} | ${signed(row.deltaVsLegacyNeutral.brierScore)} | ${num(row.metrics.logLoss)} | ${signed(row.deltaVsLegacyNeutral.logLoss)} | ${num(row.metrics.rankedProbabilityScore)} | ${signed(row.deltaVsLegacyNeutral.rankedProbabilityScore)} | ${pct(row.metrics.accuracy)} | ${signedPct(row.deltaVsLegacyNeutral.accuracy)} |`),
  ].join("\n");
}

function findSegment(diagnostic: XgV2Diagnostic, segmentName: DiagnosticSegment): DiagnosticSegmentResult {
  return diagnostic.segments.find((row) => row.segment === segmentName)!;
}

function num(value: number): string { return value.toFixed(4); }
function signed(value: number): string { return `${value >= 0 ? "+" : ""}${num(Math.abs(value) < 0.00005 ? 0 : value)}`; }
function pct(value: number): string { return `${(value * 100).toFixed(1)}%`; }
function signedPct(value: number): string { return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)} pp`; }

// Keep score imports exercised here so diagnostic regressions fail if scoring contracts drift.
export const DIAGNOSTIC_SCORERS = { brierScore1x2, logLoss1x2, rankedProbabilityScore1x2 };
