import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  diagnoseCalibration,
  renderCalibrationDiagnosticMarkdown,
} from "../src/lib/backtesting/calibration-diagnostic";
import { runWorldCupBacktest } from "../src/lib/backtesting/world-cup-backtest";
import { WORLD_CUP_DATASETS } from "../src/lib/backtesting/world-cup-fixtures";

const outputPath = resolve("reports/calibration-diagnostic.md");
const reliabilityOutputPath = resolve("reports/calibration-reliability.json");
const diagnostic = diagnoseCalibration(runWorldCupBacktest(WORLD_CUP_DATASETS));

if (Object.values(diagnostic.guardrails).some(Boolean)) {
  throw new Error(`Calibration guardrails failed: ${JSON.stringify(diagnostic.guardrails)}`);
}
if (diagnostic.leakageAudit.targetLeakageDetected) {
  throw new Error(`Calibration leakage audit failed: ${JSON.stringify(diagnostic.leakageAudit)}`);
}
if (diagnostic.reliabilityDiagram.some((series) => series.buckets.reduce((sum, bucket) => sum + bucket.count, 0) !== diagnostic.matches * 3)) {
  throw new Error("Reliability buckets must contain exactly three one-vs-rest observations per match.");
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, renderCalibrationDiagnosticMarkdown(diagnostic), "utf8");
writeFileSync(reliabilityOutputPath, `${JSON.stringify({
  generatedBy: "npm run diagnose:calibration",
  evaluation: "leave-one-world-cup-out",
  observationsPerMatch: 3,
  series: diagnostic.reliabilityDiagram,
}, null, 2)}\n`, "utf8");

console.log(`Calibration diagnostic written to ${outputPath}`);
console.log(`Predictions: ${diagnostic.matches}`);
console.log(`Reliability data written to ${reliabilityOutputPath}`);
console.log("Full-corpus fitted parameters:", diagnostic.fullCorpusFits);
console.log("LOOWC aggregate:", diagnostic.leaveOneWorldCupOutAggregate);
