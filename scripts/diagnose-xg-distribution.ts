import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  currentPredictionDiagnosticRow,
  diagnoseXgDistribution,
  historicalPredictionDiagnosticRow,
  renderXgDistributionDiagnosticMarkdown,
} from "../src/lib/backtesting/xg-distribution-diagnostic";
import { runWorldCupBacktest } from "../src/lib/backtesting/world-cup-backtest";
import { WORLD_CUP_DATASETS } from "../src/lib/backtesting/world-cup-fixtures";
import * as mock from "../src/lib/data/mock";
import { buildScoreMatricesByMatchId } from "../src/lib/stat-model/match-prediction";
import { getRecommendedPredictionConfig, resolvePredictionConfig } from "../src/lib/stat-model/prediction-config";
import type { BacktestVariant } from "../src/lib/backtesting/world-cup-backtest";
import type { Match, TeamStats } from "../src/lib/types";

async function main(): Promise<void> {
  loadLocalEnvironment();
  const current = await loadCurrentDataset();
  const explicitConfig = process.env.STAT_MODEL_VARIANT != null || process.env.STAT_MODEL_CALIBRATION != null;
  const config = explicitConfig
    ? resolvePredictionConfig({ modelVariant: process.env.STAT_MODEL_VARIANT, calibration: process.env.STAT_MODEL_CALIBRATION })
    : getRecommendedPredictionConfig();
  const currentModel = buildScoreMatricesByMatchId(current.matches, current.teamStats, {
    predictionConfig: config,
    generatedAt: new Date().toISOString(),
  });
  const historicalReport = runWorldCupBacktest(WORLD_CUP_DATASETS);
  const historicalVariant = backtestVariant(config.modelVariant);
  const historical = historicalReport.predictions.filter((row) => row.variant === historicalVariant);
  const diagnostic = diagnoseXgDistribution([
    ...currentModel.predictions.map(currentPredictionDiagnosticRow),
    ...historical.map((row) => historicalPredictionDiagnosticRow(row, config.calibration)),
  ]);
  const outputPath = resolve("reports/xg-distribution-diagnostic.md");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, renderXgDistributionDiagnosticMarkdown(diagnostic), "utf8");

  console.log(`xG distribution diagnostic written to ${outputPath}`);
  console.log(`2026 source: ${current.source}; matches=${current.matches.length}; matrices=${currentModel.predictions.length}; issues=${currentModel.coverage.issues.length}`);
  console.log(`Historical matches: ${historical.length}`);
  console.log(`Configuration: ${config.modelVariant} + ${config.calibration}`);
  console.log(`Warnings: ${JSON.stringify(diagnostic.warningCounts)}`);
}

function backtestVariant(variant: string): BacktestVariant {
  if (variant === "legacy-neutral") return "legacy-neutral";
  if (variant === "xg-v2.2-mismatch-spread") return "xg-v2.2-mismatch-spread";
  if (variant === "experimental-dixon-coles") return "xg-v2.1-prior8-dc-rho-0.15";
  return "xg-v2.1-prior8";
}

async function loadCurrentDataset(): Promise<{ matches: Match[]; teamStats: TeamStats[]; source: "supabase-live" | "mock" }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.DATA_MODE !== "live" || !url || !key) {
    return { matches: mock.matches, teamStats: mock.teamStats, source: "mock" };
  }
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const [matchesResult, statsResult] = await Promise.all([
    client.from("matches")
      .select("*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)")
      .order("kickoff", { ascending: true }),
    client.from("team_stats").select("*"),
  ]);
  if (matchesResult.error) throw new Error(`Could not load live 2026 matches: ${matchesResult.error.message}`);
  if (statsResult.error) throw new Error(`Could not load live 2026 team_stats: ${statsResult.error.message}`);
  return {
    matches: (matchesResult.data as Match[] | null) ?? [],
    teamStats: (statsResult.data as TeamStats[] | null) ?? [],
    source: "supabase-live",
  };
}

function loadLocalEnvironment(): void {
  const path = resolve(".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] != null) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    process.env[match[1]] = value;
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
