import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { diagnoseXgV22Mismatch, renderXgV22MismatchMarkdown, type XgV22CurrentCase } from "../src/lib/backtesting/xg-v22-mismatch-diagnostic";
import { runWorldCupBacktest } from "../src/lib/backtesting/world-cup-backtest";
import { WORLD_CUP_DATASETS } from "../src/lib/backtesting/world-cup-fixtures";
import * as mock from "../src/lib/data/mock";
import { filterPreMatchMatches } from "../src/lib/matches/pre-match-eligibility";
import { estimateExpectedGoals } from "../src/lib/stat-model/expected-goals";
import { createScoreMatrix, getTopScorelines } from "../src/lib/stat-model/score-matrix";
import { getOverallStrength } from "../src/lib/stat-model/team-strength-ratings";
import type { Match, Team, TeamStats } from "../src/lib/types";
import { getWorldCupGroupContext } from "../src/lib/world-cup/group-context";

async function main(): Promise<void> {
  loadLocalEnvironment();
  const current = await loadCurrentDataset();
  const cases = buildCurrentCases(current.matches, current.teamStats);
  const diagnostic = diagnoseXgV22Mismatch(runWorldCupBacktest(WORLD_CUP_DATASETS), cases);
  const outputPath = resolve("reports/xg-v2.2-mismatch-diagnostic.md");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, renderXgV22MismatchMarkdown(diagnostic), "utf8");
  console.log(`xG v2.2 mismatch diagnostic written to ${outputPath}`);
  console.log(`2026 source: ${current.source}; cases=${cases.length}`);
  console.log(`Conclusion: ${diagnostic.conclusion}`);
  for (const reason of diagnostic.reasons) console.log(`- ${reason}`);
}

function buildCurrentCases(matches: Match[], teamStats: TeamStats[]): XgV22CurrentCase[] {
  const stats = new Map(teamStats.map((row) => [row.team_id, row]));
  const evaluate = (match: Match, label?: string) => {
    const homeStats = stats.get(match.home_team_id);
    const awayStats = stats.get(match.away_team_id);
    if (!homeStats || !awayStats || !match.home_team || !match.away_team) return [];
    const common = {
      home: homeStats,
      away: awayStats,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      groupContext: getWorldCupGroupContext(match, matches),
      neutralVenue: true,
      priorStrength: 8,
    } as const;
    const previous = estimateExpectedGoals({ ...common, ratingModel: "attack_defense_v2" });
    const next = estimateExpectedGoals({ ...common, ratingModel: "attack_defense_v2_mismatch_spread" });
    if (!previous.homeRating || !previous.awayRating) return [];
    const ratingDiff = Math.abs(getOverallStrength(previous.homeRating) - getOverallStrength(previous.awayRating));
    return [{
      match,
      ratingDiff,
      row: {
        matchId: match.id,
        match: label ?? `${match.home_team.code}–${match.away_team.code} (${match.home_team.name} – ${match.away_team.name})`,
        ratingDiff,
        previousXg: xg(previous.homeExpectedGoals, previous.awayExpectedGoals),
        newXg: xg(next.homeExpectedGoals, next.awayExpectedGoals),
        previousTopScorelines: top(previous.homeExpectedGoals, previous.awayExpectedGoals),
        newTopScorelines: top(next.homeExpectedGoals, next.awayExpectedGoals),
        totalGoalsDelta: (next.homeExpectedGoals + next.awayExpectedGoals) - (previous.homeExpectedGoals + previous.awayExpectedGoals),
      } satisfies XgV22CurrentCase,
    }];
  };
  const candidates = filterPreMatchMatches(matches, new Date().toISOString()).flatMap((match) => evaluate(match));
  const selected: typeof candidates = [];
  const take = (predicate: (match: Match) => boolean) => {
    const found = candidates.filter((item) => predicate(item.match)).sort((a, b) => b.ratingDiff - a.ratingDiff)[0];
    if (found && !selected.some((item) => item.match.id === found.match.id)) selected.push(found);
  };
  take((match) => pair(match, "BRA", "HAI"));
  take((match) => pair(match, "ARG", "NZL"));
  // FRA-UND means France against its clearest available underdog in the live fixture.
  take((match) => codes(match).includes("FRA"));
  const teams = new Map<string, Team>();
  for (const match of matches) {
    if (match.home_team) teams.set(match.home_team.code, match.home_team);
    if (match.away_team) teams.set(match.away_team.code, match.away_team);
  }
  if (!selected.some((item) => pair(item.match, "ARG", "NZL"))) {
    const synthetic = syntheticMatch(teams.get("ARG"), teams.get("NZL"), "arg-nzl");
    if (synthetic) selected.push(...evaluate(synthetic, "ARG–NZL (escenario control sin fixture pre-match)"));
  }
  const france = teams.get("FRA");
  const controlUnderdog = teams.get("JOR") ?? teams.get("HAI") ?? teams.get("NZL");
  const franceControl = syntheticMatch(france, controlUnderdog, "fra-und");
  if (franceControl) selected.push(...evaluate(franceControl, `FRA–UND (control: ${france?.name} – ${controlUnderdog?.name})`));
  for (const item of [...candidates].sort((a, b) => b.ratingDiff - a.ratingDiff)) {
    if (selected.length >= 8) break;
    if (!selected.some((selectedItem) => selectedItem.match.id === item.match.id) && item.ratingDiff >= 15) selected.push(item);
  }
  return selected.map((item) => item.row);
}

function syntheticMatch(home: Team | undefined, away: Team | undefined, suffix: string): Match | null {
  if (!home || !away) return null;
  return {
    id: `diagnostic-${suffix}`,
    home_team_id: home.id,
    away_team_id: away.id,
    home_team: home,
    away_team: away,
    stage: "Diagnostic control",
    kickoff: "2026-12-31T12:00:00.000Z",
    venue: "Neutral",
    status: "scheduled",
    home_score: null,
    away_score: null,
    neutralVenue: true,
  };
}

function top(homeXg: number, awayXg: number): string {
  return getTopScorelines(createScoreMatrix({ homeExpectedGoals: homeXg, awayExpectedGoals: awayXg, maxGoals: 12 }), 5)
    .map((row) => `${row.homeGoals}-${row.awayGoals} ${(row.probability * 100).toFixed(1)}%`)
    .join(", ");
}

function xg(home: number, away: number): string { return `${home.toFixed(3)}–${away.toFixed(3)} (Δ ${Math.abs(home - away).toFixed(3)}, T ${(home + away).toFixed(3)})`; }
function codes(match: Match): string[] { return [match.home_team?.code ?? "", match.away_team?.code ?? ""]; }
function pair(match: Match, first: string, second: string): boolean { const set = new Set(codes(match)); return set.has(first) && set.has(second); }

async function loadCurrentDataset(): Promise<{ matches: Match[]; teamStats: TeamStats[]; source: "supabase-live" | "mock" }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.DATA_MODE !== "live" || !url || !key) return { matches: mock.matches, teamStats: mock.teamStats, source: "mock" };
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const [matchesResult, statsResult] = await Promise.all([
    client.from("matches").select("*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)").order("kickoff", { ascending: true }),
    client.from("team_stats").select("*"),
  ]);
  if (matchesResult.error) throw new Error(`Could not load live matches: ${matchesResult.error.message}`);
  if (statsResult.error) throw new Error(`Could not load live team_stats: ${statsResult.error.message}`);
  return { matches: (matchesResult.data as Match[] | null) ?? [], teamStats: (statsResult.data as TeamStats[] | null) ?? [], source: "supabase-live" };
}

function loadLocalEnvironment(): void {
  const path = resolve(".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] != null) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
