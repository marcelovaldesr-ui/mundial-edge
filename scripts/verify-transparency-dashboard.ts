import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertTransparencyReport, type TransparencyReport } from "../src/lib/transparency/report";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const report = JSON.parse(readFileSync(resolve("data/calibration-report.json"), "utf8")) as TransparencyReport;
assertTransparencyReport(report);

assert(report.model.temperature === 0.65, "Public report must use calibrated-matrix T=0.65.");
assert(report.global.count === 448, "Global metrics must contain all 448 matches.");
assert(Math.abs(report.global.brierScore - 0.591955044864371) < 1e-12, "Published Brier must match the calibrated backtest.");
assert(report.byTournament.every((row) => row.metrics.count === 64), "Each World Cup must contain 64 matches.");
assert(report.byStage.reduce((sum, row) => sum + row.metrics.count, 0) === 448, "Stage breakdown must reconcile with the corpus.");
assert(report.byMarket.map((row) => row.market).join(",") === "1x2,over_2_5,btts", "All requested markets must be published.");

const uniform = report.baselines.find((baseline) => baseline.id === "uniform-1x2");
assert(uniform != null, "Uniform baseline is required.");
assert(Math.abs(uniform.metrics.brierScore - 2 / 3) < 1e-12, "Uniform baseline Brier must be 2/3.");
assert(uniform.improvement.brierScore > 0, "Model must report its measured improvement over the uniform baseline.");

for (const series of report.reliability) {
  assert(series.bins.every((bin, index) => bin.bin === index && bin.lower === index / 10), `Bins must be contiguous for ${series.market}.`);
  assert(series.expectedCalibrationError >= 0 && series.expectedCalibrationError <= 1, `ECE must be bounded for ${series.market}.`);
}

for (const page of ["src/app/transparencia/page.tsx", "src/app/metodologia/page.tsx"]) {
  const source = readFileSync(resolve(page), "utf8");
  assert(source.includes("export default function"), `${page} must export a public page.`);
}
const chartSource = readFileSync(resolve("src/components/reliability-chart.tsx"), "utf8");
assert(chartSource.includes("role=\"img\"") && chartSource.includes("role=\"tablist\""), "Reliability chart must expose accessible chart and tabs.");

console.log("Transparency dashboard verification passed");
