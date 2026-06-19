import {
  brierScore1x2,
  calculateMulticlassMetrics,
  type BacktestVariant,
  type MetricDelta,
  type MulticlassMetrics,
  type WorldCupBacktestPrediction,
  type WorldCupBacktestReport,
} from "./world-cup-backtest";

export const EXPANDED_BACKTEST_VARIANTS: BacktestVariant[] = [
  "legacy-neutral",
  "xg-v2.1-prior8",
  "xg-v2.1-prior8-dc-rho-0.15",
  "xg-v2.1-prior6",
];

export interface ExpandedMetricRow {
  bucket: string;
  variant: BacktestVariant;
  metrics: MulticlassMetrics;
  deltaVsLegacy: MetricDelta;
}

export interface ModelStabilityRow {
  variant: BacktestVariant;
  worldCupsWon: number;
  avgBrierDeltaVsLegacy: number;
  bestWorldCup: number;
  bestWorldCupDelta: number;
  worstWorldCup: number;
  worstWorldCupDelta: number;
}

export interface ExpandedWorldCupDiagnostic {
  global: ExpandedMetricRow[];
  byTournament: ExpandedMetricRow[];
  byPhase: ExpandedMetricRow[];
  byRound: ExpandedMetricRow[];
  byType: ExpandedMetricRow[];
  stability: ModelStabilityRow[];
  priorComparison: {
    matches: number;
    meanBrierDeltaPrior6MinusPrior8: number;
    standardError: number;
    ci95Low: number;
    ci95High: number;
    prior6WorldCupsBetter: number;
    prior8WorldCupsBetter: number;
    prior8BeatsLegacyEveryWorldCup: boolean;
    statisticallyDistinct: boolean;
  };
}

export function diagnoseExpandedWorldCups(report: WorldCupBacktestReport): ExpandedWorldCupDiagnostic {
  const selected = report.predictions.filter((row) => EXPANDED_BACKTEST_VARIANTS.includes(row.variant));
  const tournaments = report.tournaments;
  const byTournament = tournaments.flatMap((year) => metricRows(String(year), selected.filter((row) => row.tournament === year)));
  const roundBuckets = [...new Set(selected.map(roundBucket))].sort();
  const diagnostic = {
    global: metricRows("GLOBAL", selected),
    byTournament,
    byPhase: [
      ...metricRows("GROUP", selected.filter((row) => row.stageBucket === "GROUP")),
      ...metricRows("KNOCKOUT", selected.filter((row) => row.stageBucket === "KNOCKOUT")),
    ],
    byRound: roundBuckets.flatMap((bucket) => metricRows(bucket, selected.filter((row) => roundBucket(row) === bucket))),
    byType: [
      ...metricRows("CLEAR_FAVORITES", selected.filter((row) => Math.abs(row.homeRating - row.awayRating) >= 9)),
      ...metricRows("UPSETS", selected.filter(isUpset)),
      ...metricRows("LOW_GOALS_0_2", selected.filter((row) => row.homeGoals + row.awayGoals <= 2)),
      ...metricRows("DRAWS", selected.filter((row) => row.actual === "draw")),
    ],
    stability: stabilityRows(byTournament, tournaments),
    priorComparison: comparePriors(selected, byTournament),
  };
  return diagnostic;
}

export function renderExpandedWorldCupBacktestMarkdown(
  report: WorldCupBacktestReport,
  diagnostic: ExpandedWorldCupDiagnostic
): string {
  const prior8 = diagnostic.global.find((row) => row.variant === "xg-v2.1-prior8")!;
  const promote = prior8.deltaVsLegacy.brierScore < 0
    && prior8.deltaVsLegacy.logLoss < 0
    && prior8.deltaVsLegacy.rankedProbabilityScore < 0
    && prior8.deltaVsLegacy.accuracy >= 0;
  return `# Backtest ampliado de Mundiales

## Resumen

Corpus completo de **${report.datasetSize} partidos** en ${report.tournaments.length} Mundiales (${report.tournaments.join(", ")}); ${report.byStage.find((row) => row.bucket === "GROUP")?.comparisons[0].metrics.count ?? 0} de grupos y ${report.byStage.find((row) => row.bucket === "KNOCKOUT")?.comparisons[0].metrics.count ?? 0} eliminatorios. Los resultados de knockout usan \`score.ft\` a 90 minutos; prorroga y penales quedan fuera del 1X2.

Los fixtures provienen de openfootball/worldcup.json, CC0, commit \`6d4a1b67e09ced583ecc02f5e900c69dd5ec5a2b\`.

## Ratings y cobertura

${coverageTable(report)}

**Limitacion principal:** los snapshots 1998-2022 combinan 10% Elo externo pre-torneo y 90% perfil histórico propio. Cubren los 32 equipos de cada edición, pero el peso Elo se mantuvo bajo porque pesos mayores empeoraron el backtest.

## Metricas globales

${metricTable(diagnostic.global)}

## Por Mundial

${metricTable(diagnostic.byTournament)}

## Por fase

${metricTable(diagnostic.byPhase)}

## Por ronda

${metricTable(diagnostic.byRound)}

## Favoritos claros, upsets, pocos goles y empates

Favorito claro = diferencia de rating >=9; upset = victoria del equipo con rating al menos 5 puntos menor.

${metricTable(diagnostic.byType)}

## Estabilidad

${stabilityTable(diagnostic.stability)}

Los Mundiales ganados se cuentan por menor Brier entre las cuatro variantes. Mejor/peor Mundial se define por delta Brier contra legacy-neutral.

## prior6 vs prior8

${priorComparisonText(diagnostic)}

## Recomendacion

${promote
  ? "prior8 mantiene una mejora agregada en las cuatro metricas del corpus ampliado, pero debe seguir como **candidate**, no default: los snapshots incorporan validación Elo externa con peso conservador y prior6 conserva una ventaja Brier marginal."
  : "prior8 no conserva una mejora completa en las cuatro metricas del corpus ampliado y debe seguir como **candidate**. Legacy neutral permanece como default productivo."}

Dixon-Coles continúa experimental/notRecommended. No se implementa Monte Carlo en esta fase.
`;
}

function comparePriors(rows: WorldCupBacktestPrediction[], byTournament: ExpandedMetricRow[]): ExpandedWorldCupDiagnostic["priorComparison"] {
  const prior8ByFixture = new Map(rows.filter((row) => row.variant === "xg-v2.1-prior8").map((row) => [row.fixtureId, row]));
  const differences = rows.filter((row) => row.variant === "xg-v2.1-prior6").map((prior6) => {
    const prior8 = prior8ByFixture.get(prior6.fixtureId);
    if (!prior8) throw new Error(`Missing prior8 prediction for ${prior6.fixtureId}.`);
    return brierScore1x2(prior6.probabilities, prior6.actual) - brierScore1x2(prior8.probabilities, prior8.actual);
  });
  const mean = average(differences);
  const variance = differences.length > 1
    ? differences.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / (differences.length - 1)
    : 0;
  const standardError = Math.sqrt(variance / differences.length);
  const margin = 1.96 * standardError;
  const years = [...new Set(byTournament.map((row) => row.bucket))];
  let prior6WorldCupsBetter = 0;
  let prior8WorldCupsBetter = 0;
  for (const year of years) {
    const prior6 = byTournament.find((row) => row.bucket === year && row.variant === "xg-v2.1-prior6")!;
    const prior8 = byTournament.find((row) => row.bucket === year && row.variant === "xg-v2.1-prior8")!;
    if (prior6.metrics.brierScore < prior8.metrics.brierScore) prior6WorldCupsBetter++;
    else if (prior8.metrics.brierScore < prior6.metrics.brierScore) prior8WorldCupsBetter++;
  }
  return {
    matches: differences.length,
    meanBrierDeltaPrior6MinusPrior8: mean,
    standardError,
    ci95Low: mean - margin,
    ci95High: mean + margin,
    prior6WorldCupsBetter,
    prior8WorldCupsBetter,
    prior8BeatsLegacyEveryWorldCup: byTournament.filter((row) => row.variant === "xg-v2.1-prior8").every((row) => row.deltaVsLegacy.brierScore < 0),
    statisticallyDistinct: mean - margin > 0 || mean + margin < 0,
  };
}

function priorComparisonText(diagnostic: ExpandedWorldCupDiagnostic): string {
  const row = diagnostic.priorComparison;
  const leader = row.meanBrierDeltaPrior6MinusPrior8 < 0 ? "prior6" : "prior8";
  return `En ${row.matches} comparaciones pareadas, el delta Brier medio prior6 - prior8 es ${signed(row.meanBrierDeltaPrior6MinusPrior8)} (EE ${num(row.standardError)}, IC95% [${signed(row.ci95Low)}, ${signed(row.ci95High)}]). **${leader}** lidera el promedio, pero la diferencia ${row.statisticallyDistinct ? "no incluye cero y es distinguible bajo esta aproximacion normal" : "incluye cero y debe considerarse marginal/no distinguible"}. prior6 gana ${row.prior6WorldCupsBetter} Mundiales frente a prior8 y prior8 gana ${row.prior8WorldCupsBetter}. prior8 ${row.prior8BeatsLegacyEveryWorldCup ? "sigue mejorando Brier frente a Legacy en todos los Mundiales" : "ya no mejora Brier frente a Legacy en todos los Mundiales"}.`;
}

function metricRows(bucket: string, rows: WorldCupBacktestPrediction[]): ExpandedMetricRow[] {
  const baseline = calculateMulticlassMetrics(rows.filter((row) => row.variant === "legacy-neutral"));
  return EXPANDED_BACKTEST_VARIANTS.map((variant) => {
    const metrics = calculateMulticlassMetrics(rows.filter((row) => row.variant === variant));
    return { bucket, variant, metrics, deltaVsLegacy: delta(metrics, baseline) };
  });
}

function stabilityRows(rows: ExpandedMetricRow[], tournaments: number[]): ModelStabilityRow[] {
  const winners = new Map<BacktestVariant, number>(EXPANDED_BACKTEST_VARIANTS.map((variant) => [variant, 0]));
  for (const year of tournaments) {
    const yearly = rows.filter((row) => row.bucket === String(year));
    const winner = [...yearly].sort((a, b) => a.metrics.brierScore - b.metrics.brierScore)[0];
    winners.set(winner.variant, (winners.get(winner.variant) ?? 0) + 1);
  }
  return EXPANDED_BACKTEST_VARIANTS.map((variant) => {
    const yearly = rows.filter((row) => row.variant === variant);
    const sorted = [...yearly].sort((a, b) => a.deltaVsLegacy.brierScore - b.deltaVsLegacy.brierScore);
    return {
      variant,
      worldCupsWon: winners.get(variant) ?? 0,
      avgBrierDeltaVsLegacy: average(yearly.map((row) => row.deltaVsLegacy.brierScore)),
      bestWorldCup: Number(sorted[0].bucket),
      bestWorldCupDelta: sorted[0].deltaVsLegacy.brierScore,
      worstWorldCup: Number(sorted[sorted.length - 1].bucket),
      worstWorldCupDelta: sorted[sorted.length - 1].deltaVsLegacy.brierScore,
    };
  });
}

function roundBucket(row: WorldCupBacktestPrediction): string {
  return row.stage === "GROUP" ? "GROUP_STAGE" : row.stage;
}

function isUpset(row: WorldCupBacktestPrediction): boolean {
  if (Math.abs(row.homeRating - row.awayRating) < 5 || row.actual === "draw") return false;
  return row.actual === (row.homeRating < row.awayRating ? "home" : "away");
}

function delta(metrics: MulticlassMetrics, baseline: MulticlassMetrics): MetricDelta {
  return {
    brierScore: metrics.brierScore - baseline.brierScore,
    logLoss: metrics.logLoss - baseline.logLoss,
    rankedProbabilityScore: metrics.rankedProbabilityScore - baseline.rankedProbabilityScore,
    accuracy: metrics.accuracy - baseline.accuracy,
  };
}

function metricTable(rows: ExpandedMetricRow[]): string {
  return [
    "| Bucket | Variante | N | Brier | Delta | Log Loss | Delta | RPS | Delta | Accuracy | Delta |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...rows.map((row) => `| ${row.bucket} | ${label(row.variant)} | ${row.metrics.count} | ${num(row.metrics.brierScore)} | ${signed(row.deltaVsLegacy.brierScore)} | ${num(row.metrics.logLoss)} | ${signed(row.deltaVsLegacy.logLoss)} | ${num(row.metrics.rankedProbabilityScore)} | ${signed(row.deltaVsLegacy.rankedProbabilityScore)} | ${pct(row.metrics.accuracy)} | ${signedPct(row.deltaVsLegacy.accuracy)} |`),
  ].join("\n");
}

function coverageTable(report: WorldCupBacktestReport): string {
  return [
    "| Mundial | Snapshot | Pseudo-historico | Partidos con snapshot | Partidos con fallback | Equipos | Equipos sin rating |",
    "|---:|---|---|---:|---:|---:|---:|",
    ...report.ratingCoverage.map((row) => `| ${row.tournament} | ${row.ratingSnapshotYear ?? "ninguno"} | ${row.snapshotIsHistorical ? "si" : "no"} | ${row.matchesWithSnapshot} | ${row.matchesWithFallback} | ${row.teams} | ${row.teamsWithoutRating} |`),
  ].join("\n");
}

function stabilityTable(rows: ModelStabilityRow[]): string {
  return [
    "| Variante | Mundiales ganados | Delta Brier medio | Mejor Mundial | Delta | Peor Mundial | Delta |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...rows.map((row) => `| ${label(row.variant)} | ${row.worldCupsWon} | ${signed(row.avgBrierDeltaVsLegacy)} | ${row.bestWorldCup} | ${signed(row.bestWorldCupDelta)} | ${row.worstWorldCup} | ${signed(row.worstWorldCupDelta)} |`),
  ].join("\n");
}

function label(variant: BacktestVariant): string {
  if (variant === "xg-v2.1-prior8-dc-rho-0.15") return "experimental-dixon-coles";
  return variant;
}

function average(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function num(value: number): string { return value.toFixed(4); }
function signed(value: number): string { const v = Math.abs(value) < 0.00005 ? 0 : value; return `${v >= 0 ? "+" : ""}${v.toFixed(4)}`; }
function pct(value: number): string { return `${(value * 100).toFixed(1)}%`; }
function signedPct(value: number): string { const v = Math.abs(value) < 0.00005 ? 0 : value; return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)} pp`; }
