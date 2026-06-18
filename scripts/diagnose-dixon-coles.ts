import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { diagnoseDixonColes, renderDixonColesDiagnosticMarkdown } from "../src/lib/backtesting/dixon-coles-diagnostic";
import { runWorldCupBacktest } from "../src/lib/backtesting/world-cup-backtest";
import { WORLD_CUP_DATASETS } from "../src/lib/backtesting/world-cup-fixtures";

const outputPath = resolve("reports/dixon-coles-diagnostic.md");
const diagnostic = diagnoseDixonColes(runWorldCupBacktest(WORLD_CUP_DATASETS));
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, renderDixonColesDiagnosticMarkdown(diagnostic), "utf8");
console.log(`Dixon-Coles diagnostic written to ${outputPath}`);
