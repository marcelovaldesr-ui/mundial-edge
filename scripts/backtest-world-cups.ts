import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { WORLD_CUP_DATASETS } from "../src/lib/backtesting/world-cup-fixtures";
import { diagnoseExpandedWorldCups, renderExpandedWorldCupBacktestMarkdown } from "../src/lib/backtesting/expanded-world-cup-diagnostic";
import {
  runWorldCupBacktest,
  type BacktestVariant,
  type MetricComparison,
} from "../src/lib/backtesting/world-cup-backtest";

const report = runWorldCupBacktest(WORLD_CUP_DATASETS);
const outputPath = resolve("reports/world-cup-backtest-expanded.md");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, renderExpandedWorldCupBacktestMarkdown(report, diagnoseExpandedWorldCups(report)), "utf8");

console.log("\nMUNDIAL EDGE - BACKTEST HISTORICO 1X2");
console.log(`Partidos: ${report.datasetSize} | Mundiales: ${report.tournaments.join(", ")} | Marcador: 90 minutos`);
console.log("Menor es mejor: Brier, Log Loss y RPS. Mayor es mejor: Accuracy.");
console.log("Delta vs legacy-neutral: negativo mejora las metricas de error; positivo mejora Accuracy.\n");

console.log("RESUMEN GLOBAL POR VARIANTE");
console.table(report.global.map((row) => formatRow("GLOBAL", row)));

console.log("METRICAS POR MUNDIAL");
console.table(report.byTournament.flatMap((bucket) => bucket.comparisons.map((row) => formatRow(bucket.tournament, row))));

console.log("METRICAS POR STAGE");
console.table(report.byStage.flatMap((bucket) => bucket.comparisons.map((row) => formatRow(bucket.bucket, row))));

console.log("COBERTURA DE RATINGS");
console.table(report.ratingCoverage.map((coverage) => ({
  Mundial: coverage.tournament,
  RatingSet: coverage.ratingSet,
  Snapshot: coverage.ratingSnapshotYear ?? "NO HISTORICO",
  Equipos: coverage.teams,
  "Seed especifico": coverage.withSpecificSeed,
  "Fallback neutral": coverage.withExplicitFallback,
  "Partidos snapshot": coverage.matchesWithSnapshot,
  "Partidos fallback": coverage.matchesWithFallback,
  "Snapshot historico": coverage.snapshotIsHistorical ? "SI" : "NO",
})));

console.log("LIMITACIONES / ADVERTENCIAS");
for (const warning of report.warnings) console.log(`- ${warning}`);
console.log(`Expanded report written to ${outputPath}`);

function formatRow(bucket: number | string, comparison: MetricComparison) {
  const metrics = comparison.metrics;
  const delta = comparison.deltaVsLegacyNeutral;
  return {
    Bucket: bucket,
    Variante: label(comparison.variant),
    N: metrics.count,
    Brier: metrics.brierScore.toFixed(4),
    "Delta Brier": signed(delta.brierScore),
    "Log Loss": metrics.logLoss.toFixed(4),
    "Delta LogLoss": signed(delta.logLoss),
    RPS: metrics.rankedProbabilityScore.toFixed(4),
    "Delta RPS": signed(delta.rankedProbabilityScore),
    Accuracy: `${(metrics.accuracy * 100).toFixed(1)}%`,
    "Delta Acc": `${signed(delta.accuracy * 100)} pp`,
  };
}

function signed(value: number): string {
  const rounded = Math.abs(value) < 0.00005 ? 0 : value;
  return `${rounded >= 0 ? "+" : ""}${rounded.toFixed(4)}`;
}

function label(variant: BacktestVariant): string {
  return variant;
}
