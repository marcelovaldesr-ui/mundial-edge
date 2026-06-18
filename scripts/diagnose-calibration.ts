import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  diagnoseCalibration,
  renderCalibrationDiagnosticMarkdown,
} from "../src/lib/backtesting/calibration-diagnostic";
import { runWorldCupBacktest } from "../src/lib/backtesting/world-cup-backtest";
import { WORLD_CUP_DATASETS } from "../src/lib/backtesting/world-cup-fixtures";

const outputPath = resolve("reports/calibration-diagnostic.md");
const diagnostic = diagnoseCalibration(runWorldCupBacktest(WORLD_CUP_DATASETS));

if (Object.values(diagnostic.guardrails).some(Boolean)) {
  throw new Error(`Calibration guardrails failed: ${JSON.stringify(diagnostic.guardrails)}`);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, renderCalibrationDiagnosticMarkdown(diagnostic), "utf8");

console.log(`Calibration diagnostic written to ${outputPath}`);
console.log(`Predictions: ${diagnostic.matches}`);
console.log("Full-corpus fitted parameters:", diagnostic.fittedCalibration);
console.log("LOOWC aggregate:", diagnostic.leaveOneWorldCupOutAggregate);
