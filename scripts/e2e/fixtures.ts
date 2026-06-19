import type { Edge, Market, Match, Odd, Outcome, Prediction, Team, TeamStats } from "../../src/lib/types";
import { TEAM_STRENGTH_RATINGS } from "../../src/lib/stat-model/team-strength-ratings";
import { buildScoreMatrixForMatch, type MatchStatModelPrediction, type StatSelectionKey } from "../../src/lib/stat-model";
import { buildEdges } from "../../src/lib/model/engine";
import { isQualityPick } from "../../src/lib/model/edge";
import { removeOverround } from "../../src/lib/model/odds";
import { WORLD_CUP_2026_GROUP_IDS, type WorldCup2026GroupId } from "../../src/lib/tournament/world-cup-2026-groups";

export const LAUNCH_REHEARSAL_DATASET = "rated-pool-synthetic-groups-v1";
export const LAUNCH_MODEL_CONFIG = { modelVariant: "calibrated-matrix" as const, calibration: "none" as const, temperature: 0.65 as const };

export interface LaunchRehearsalFixtureSet {
  dataset: typeof LAUNCH_REHEARSAL_DATASET;
  groups: Array<{ groupId: WorldCup2026GroupId; teams: Team[]; matches: Match[] }>;
  teams: Team[];
  matches: Match[];
  teamStats: TeamStats[];
  warnings: string[];
}

export function createLaunchRehearsalFixtures(): LaunchRehearsalFixtureSet {
  const selected = TEAM_STRENGTH_RATINGS.slice(0, 48);
  if (selected.length !== 48) throw new Error("Launch rehearsal requires at least 48 rated teams.");
  const groups = WORLD_CUP_2026_GROUP_IDS.map((groupId, groupIndex) => {
    const teams = [0, 1, 2, 3].map((pot) => {
      const rating = selected[pot * 12 + groupIndex];
      return {
        id: `wc26-${rating.teamCode.toLowerCase()}`,
        name: rating.teamName,
        code: rating.teamCode,
        group: groupId,
      } satisfies Team;
    });
    return { groupId, teams, matches: groupMatches(groupId, teams) };
  });
  const teams = groups.flatMap((group) => group.teams);
  const matches = groups.flatMap((group) => group.matches);
  return {
    dataset: LAUNCH_REHEARSAL_DATASET,
    groups,
    teams,
    matches,
    teamStats: teams.map(emptyStats),
    warnings: [
      "Dataset de ensayo: usa 48 selecciones del pool de ratings local, distribuidas por bombos para balance competitivo.",
      "No representa el sorteo oficial mientras el repositorio mantenga plazas/equipos por confirmar.",
    ],
  };
}

export function buildLaunchPredictions(fixtures: LaunchRehearsalFixtureSet): MatchStatModelPrediction[] {
  const stats = new Map(fixtures.teamStats.map((row) => [row.team_id, row]));
  return fixtures.matches.map((match) => buildLaunchPrediction(match, stats, fixtures.matches));
}

export function buildLaunchPrediction(
  match: Match,
  stats: ReadonlyMap<string, TeamStats>,
  allMatches: Match[]
): MatchStatModelPrediction {
    const result = buildScoreMatrixForMatch(match, stats.get(match.home_team_id), stats.get(match.away_team_id), {
      allMatches,
      modelVariant: LAUNCH_MODEL_CONFIG.modelVariant,
      calibration: LAUNCH_MODEL_CONFIG.calibration,
      calibrationTemperature: LAUNCH_MODEL_CONFIG.temperature,
      neutralVenue: true,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    if (!("scoreMatrix" in result)) throw new Error(`Prediction failed for ${match.id}: ${result.reason}`);
    return result;
}

export function createSyntheticMarketIntegration(
  fixtures: LaunchRehearsalFixtureSet,
  modelPredictions: MatchStatModelPrediction[]
): { predictions: Prediction[]; odds: Odd[]; edges: Edge[]; overrounds: number[] } {
  const predictions: Prediction[] = [];
  const odds: Odd[] = [];
  const edges: Edge[] = [];
  const overrounds: number[] = [];
  const byMatch = new Map(modelPredictions.map((row) => [row.matchId, row]));
  for (const match of fixtures.matches) {
    const model = byMatch.get(match.id)!;
    const matchPredictions = toDomainPredictions(model);
    const matchOdds = syntheticOdds(match, model);
    predictions.push(...matchPredictions);
    odds.push(...matchOdds);
    for (const market of ["1x2", "over_under_2_5", "btts"] as Market[]) {
      overrounds.push(removeOverround(matchOdds.filter((row) => row.market === market)).overround);
    }
    edges.push(...buildEdges(match, matchPredictions, matchOdds).map((edge) => ({
      ...edge,
      match,
      qualifies: isQualityPick(edge),
    })));
  }
  return { predictions, odds, edges, overrounds };
}

function groupMatches(groupId: WorldCup2026GroupId, teams: Team[]): Match[] {
  const pairings = [[0, 1], [2, 3], [0, 2], [3, 1], [3, 0], [1, 2]] as const;
  return pairings.map(([homeIndex, awayIndex], index) => {
    const home = teams[homeIndex];
    const away = teams[awayIndex];
    const matchday = Math.floor(index / 2);
    return {
      id: `wc26-group-${groupId.toLowerCase()}-${index + 1}`,
      home_team_id: home.id,
      away_team_id: away.id,
      home_team: home,
      away_team: away,
      stage: `Group ${groupId}`,
      kickoff: new Date(Date.UTC(2026, 5, 11 + matchday * 5, 18 + (index % 2) * 3)).toISOString(),
      venue: null,
      status: "scheduled",
      home_score: null,
      away_score: null,
      neutralVenue: true,
    } satisfies Match;
  });
}

function emptyStats(team: Team): TeamStats {
  return { team_id: team.id, matches_played: 0, goals_for: 0, goals_against: 0, goal_diff: 0, recent_form: [], gf_per_game: 0, ga_per_game: 0 };
}

const DOMAIN_MARKETS: Array<{ market: Market; selections: Array<{ key: StatSelectionKey; outcome: Outcome }> }> = [
  { market: "1x2", selections: [{ key: "home_win", outcome: "home" }, { key: "draw", outcome: "draw" }, { key: "away_win", outcome: "away" }] },
  { market: "over_under_2_5", selections: [{ key: "over_2_5", outcome: "over" }, { key: "under_2_5", outcome: "under" }] },
  { market: "btts", selections: [{ key: "btts_yes", outcome: "yes" }, { key: "btts_no", outcome: "no" }] },
];

function toDomainPredictions(model: MatchStatModelPrediction): Prediction[] {
  return DOMAIN_MARKETS.flatMap(({ market, selections }) => selections.map(({ key, outcome }) => ({
    id: `${model.matchId}:${market}:${outcome}`,
    match_id: model.matchId,
    market,
    outcome,
    model_probability: probability(model, key),
    model_version: model.modelVariantUsed,
    source: "launch-rehearsal-calibrated-matrix",
    created_at: model.generatedAt,
  })));
}

function syntheticOdds(match: Match, model: MatchStatModelPrediction): Odd[] {
  const rows: Odd[] = [];
  for (const { market, selections } of DOMAIN_MARKETS) {
    const modelRows = selections.map((selection) => ({ ...selection, probability: probability(model, selection.key) }));
    const leader = [...modelRows].sort((a, b) => b.probability - a.probability)[0];
    const shift = Math.min(0.18, leader.probability - 0.08);
    const remaining = modelRows.filter((row) => row.outcome !== leader.outcome);
    const marketProbabilities = new Map<Outcome, number>();
    marketProbabilities.set(leader.outcome, leader.probability - shift);
    const remainingTotal = remaining.reduce((sum, row) => sum + row.probability, 0);
    for (const row of remaining) marketProbabilities.set(row.outcome, row.probability + shift * row.probability / remainingTotal);
    for (const row of modelRows) {
      const fair = marketProbabilities.get(row.outcome)!;
      rows.push({
        id: `${match.id}:launch-book:${market}:${row.outcome}`,
        match_id: match.id,
        bookmaker: "LaunchBook Synthetic",
        market,
        outcome: row.outcome,
        decimal_odds: 1 / (fair * 1.06),
        source: "synthetic-overround-1.06",
        fetched_at: "2026-06-01T00:00:00.000Z",
      });
    }
  }
  return rows;
}

function probability(prediction: MatchStatModelPrediction, selection: StatSelectionKey): number {
  const value = prediction.marketProbabilities.find((row) => row.selection === selection)?.probability;
  if (value == null) throw new Error(`Missing ${selection} for ${prediction.matchId}.`);
  return value;
}
