import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { diagnoseXgV2, renderXgV2DiagnosticMarkdown } from "../src/lib/backtesting/xg-v2-diagnostic";
import { diagnoseDixonColes, renderDixonColesDiagnosticMarkdown } from "../src/lib/backtesting/dixon-coles-diagnostic";
import { diagnosePredictionConfidence, renderConfidenceDiagnosticMarkdown } from "../src/lib/backtesting/confidence-diagnostic";
import { runWorldCupBacktest } from "../src/lib/backtesting/world-cup-backtest";
import { WORLD_CUP_DATASETS } from "../src/lib/backtesting/world-cup-fixtures";

const outputPath = resolve("reports/xg-v2-diagnostic.md");
const dixonColesOutputPath = resolve("reports/dixon-coles-diagnostic.md");
const confidenceOutputPath = resolve("reports/confidence-diagnostic.md");
const report = runWorldCupBacktest(WORLD_CUP_DATASETS.filter((dataset) => dataset.year >= 2018));
const diagnostic = diagnoseXgV2(report);
const dixonColesDiagnostic = diagnoseDixonColes(report);
const confidenceDiagnostic = diagnosePredictionConfidence(report);

if (Object.values(diagnostic.guardrails).some(Boolean)) {
  throw new Error(`Diagnostic guardrails failed: ${JSON.stringify(diagnostic.guardrails)}`);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, renderXgV2DiagnosticMarkdown(diagnostic), "utf8");
writeFileSync(dixonColesOutputPath, renderDixonColesDiagnosticMarkdown(dixonColesDiagnostic), "utf8");
writeFileSync(confidenceOutputPath, renderConfidenceDiagnosticMarkdown(confidenceDiagnostic), "utf8");

console.log(`xG v2 diagnostic written to ${outputPath}`);
console.log(`Predictions: ${diagnostic.matches.length}`);
console.log(`Best experimental: ${diagnostic.bestExperimental.variant}`);
console.log(`Brier delta: ${diagnostic.bestExperimental.deltaVsLegacyNeutral.brierScore.toFixed(4)}`);
console.log(`Dixon-Coles diagnostic written to ${dixonColesOutputPath}`);
console.log(`Confidence diagnostic written to ${confidenceOutputPath}`);
