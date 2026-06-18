import type { Match, Team, TeamStats } from "../types";
import {
  buildScoreMatrixForMatch,
  type MatchStatModelPrediction,
} from "../stat-model/match-prediction";
import {
  DEFAULT_STAT_MODEL_VARIANT,
  resolveStatModelVariant,
  type StatModelVariant,
} from "../stat-model/model-variant";
import {
  DEFAULT_STAT_MODEL_CALIBRATION,
  resolveStatModelCalibration,
  type StatModelCalibrationMode,
} from "../stat-model/calibration-presets";
import type { ScoreMatrixEntry } from "../stat-model/score-matrix";

export interface GroupSimulationInput {
  groupId: string;
  teams: Team[];
  playedMatches: Match[];
  remainingMatches: Match[];
  simulations: number;
  modelVariant?: StatModelVariant;
  calibration?: StatModelCalibrationMode;
  seed?: number;
}

export interface SimulatedGroupTeamResult {
  teamId: string;
  teamCode: string;
  teamName: string;
  expectedPoints: number;
  probabilityAdvance: number;
  probabilityWinGroup: number;
  probabilityFinishSecond: number;
  probabilityFinishThird: number;
  probabilityFinishFourth: number;
  averageGoalDifference: number;
  averageGoalsFor: number;
  averageGoalsAgainst: number;
}

export interface GroupSimulationResult {
  groupId: string;
  simulations: number;
  modelVariant: StatModelVariant;
  calibration: StatModelCalibrationMode;
  seed: number;
  teams: SimulatedGroupTeamResult[];
  warnings: string[];
  version: "group-monte-carlo-v1";
}

interface GroupTableRow {
  team: Team;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  wins: number;
  draws: number;
  losses: number;
}

interface PreparedMatch {
  match: Match;
  prediction: MatchStatModelPrediction;
  probabilities: { home: number; draw: number; away: number };
}

interface TeamAccumulator {
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  finishes: [number, number, number, number];
}

const DEFAULT_SEED = 20260611;
const MAX_SIMULATIONS = 1_000_000;

export function simulateGroupStage(input: GroupSimulationInput): GroupSimulationResult {
  validateInput(input);
  const variant = resolveStatModelVariant(input.modelVariant ?? DEFAULT_STAT_MODEL_VARIANT);
  const requestedCalibration = resolveStatModelCalibration(input.calibration ?? DEFAULT_STAT_MODEL_CALIBRATION);
  const effectiveCalibration = variant.id === "xg-v2.1-prior8"
    ? requestedCalibration
    : resolveStatModelCalibration("none");
  const seed = normalizeSeed(input.seed ?? DEFAULT_SEED);
  const teamsById = new Map(input.teams.map((team) => [team.id, team]));
  const playedMatches = input.playedMatches.map((match) => attachTeams(match, teamsById));
  const remainingMatches = input.remainingMatches.map((match) => attachTeams(match, teamsById));
  const currentStats = buildTeamStats(input.teams, playedMatches);
  const allMatches = [...playedMatches, ...remainingMatches];
  const warnings = new Set<string>([
    "Desempate simplificado: puntos, diferencia de gol, goles a favor y fallback deterministico; no incluye enfrentamiento directo ni fair play FIFA.",
    "Las matrices de partidos restantes se calculan una vez desde el estado actual; los resultados simulados no recalibran partidos posteriores.",
  ]);
  if (requestedCalibration.id !== effectiveCalibration.id) {
    warnings.add(`La calibracion ${requestedCalibration.id} solo aplica a xg-v2.1-prior8; se uso none.`);
  }
  const prepared = remainingMatches.map((match) => {
    const result = buildScoreMatrixForMatch(
      match,
      currentStats.get(match.home_team_id),
      currentStats.get(match.away_team_id),
      {
        allMatches,
        modelVariant: variant.id,
        calibration: effectiveCalibration.id,
        neutralVenue: match.neutralVenue ?? true,
      }
    );
    if (!("scoreMatrix" in result)) throw new Error(`Could not build matrix for ${match.id}: ${result.reason}`);
    result.warnings.forEach((warning) => warnings.add(warning));
    return {
      match,
      prediction: result,
      probabilities: {
        home: marketProbability(result, "home_win"),
        draw: marketProbability(result, "draw"),
        away: marketProbability(result, "away_win"),
      },
    };
  });

  const accumulator = new Map(input.teams.map((team) => [team.id, emptyAccumulator()]));
  const random = createSeededRandom(seed);
  const fallback = tieBreakValues(input.teams, seed);
  for (let simulation = 0; simulation < input.simulations; simulation++) {
    const table = initialTable(input.teams, playedMatches);
    for (const item of prepared) {
      const score = sampleCalibratedScore(item, random);
      applyResult(table, item.match.home_team_id, item.match.away_team_id, score.homeGoals, score.awayGoals);
    }
    const ordered = orderTable([...table.values()], fallback);
    ordered.forEach((row, index) => {
      const totals = accumulator.get(row.team.id)!;
      totals.points += row.points;
      totals.goalsFor += row.goalsFor;
      totals.goalsAgainst += row.goalsAgainst;
      totals.goalDifference += row.goalDifference;
      totals.finishes[index]++;
    });
  }

  const teams = input.teams.map((team) => summarize(team, accumulator.get(team.id)!, input.simulations));
  return {
    groupId: input.groupId,
    simulations: input.simulations,
    modelVariant: variant.id,
    calibration: effectiveCalibration.id,
    seed,
    teams,
    warnings: [...warnings],
    version: "group-monte-carlo-v1",
  };
}

function validateInput(input: GroupSimulationInput): void {
  if (!input.groupId.trim()) throw new RangeError("groupId is required.");
  if (input.teams.length !== 4) throw new RangeError("Group simulation v1 requires exactly four teams.");
  if (!Number.isInteger(input.simulations) || input.simulations < 1 || input.simulations > MAX_SIMULATIONS) {
    throw new RangeError(`simulations must be an integer between 1 and ${MAX_SIMULATIONS}.`);
  }
  const teamIds = new Set(input.teams.map((team) => team.id));
  if (teamIds.size !== input.teams.length) throw new RangeError("Team ids must be unique.");
  const matchIds = new Set<string>();
  for (const match of [...input.playedMatches, ...input.remainingMatches]) {
    if (matchIds.has(match.id)) throw new RangeError(`Duplicate match id ${match.id}.`);
    matchIds.add(match.id);
    if (!teamIds.has(match.home_team_id) || !teamIds.has(match.away_team_id) || match.home_team_id === match.away_team_id) {
      throw new RangeError(`Match ${match.id} contains invalid group teams.`);
    }
  }
  for (const match of input.playedMatches) {
    if (match.status !== "finished" || !validScore(match.home_score) || !validScore(match.away_score)) {
      throw new RangeError(`Played match ${match.id} requires a finished non-negative integer score.`);
    }
  }
  for (const match of input.remainingMatches) {
    if (match.status === "finished") throw new RangeError(`Remaining match ${match.id} must not be finished.`);
  }
}

function buildTeamStats(teams: Team[], playedMatches: Match[]): Map<string, TeamStats> {
  const stats = new Map(teams.map((team) => [team.id, emptyStats(team.id)]));
  const chronological = [...playedMatches].sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id));
  for (const match of chronological) {
    const homeScore = match.home_score!;
    const awayScore = match.away_score!;
    updateTeamStats(stats.get(match.home_team_id)!, homeScore, awayScore);
    updateTeamStats(stats.get(match.away_team_id)!, awayScore, homeScore);
  }
  return stats;
}

function updateTeamStats(stats: TeamStats, goalsFor: number, goalsAgainst: number): void {
  stats.matches_played++;
  stats.goals_for += goalsFor;
  stats.goals_against += goalsAgainst;
  stats.goal_diff = stats.goals_for - stats.goals_against;
  stats.gf_per_game = stats.goals_for / stats.matches_played;
  stats.ga_per_game = stats.goals_against / stats.matches_played;
  stats.recent_form.unshift(goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D");
  stats.recent_form = stats.recent_form.slice(0, 5);
}

function initialTable(teams: Team[], playedMatches: Match[]): Map<string, GroupTableRow> {
  const table = new Map(teams.map((team) => [team.id, emptyTableRow(team)]));
  for (const match of playedMatches) {
    applyResult(table, match.home_team_id, match.away_team_id, match.home_score!, match.away_score!);
  }
  return table;
}

function applyResult(
  table: Map<string, GroupTableRow>,
  homeTeamId: string,
  awayTeamId: string,
  homeGoals: number,
  awayGoals: number
): void {
  const home = table.get(homeTeamId)!;
  const away = table.get(awayTeamId)!;
  home.goalsFor += homeGoals; home.goalsAgainst += awayGoals;
  away.goalsFor += awayGoals; away.goalsAgainst += homeGoals;
  home.goalDifference = home.goalsFor - home.goalsAgainst;
  away.goalDifference = away.goalsFor - away.goalsAgainst;
  if (homeGoals > awayGoals) {
    home.points += 3; home.wins++; away.losses++;
  } else if (homeGoals < awayGoals) {
    away.points += 3; away.wins++; home.losses++;
  } else {
    home.points++; away.points++; home.draws++; away.draws++;
  }
}

function sampleCalibratedScore(item: PreparedMatch, random: () => number): { homeGoals: number; awayGoals: number } {
  const drawBoundary = item.probabilities.home + item.probabilities.draw;
  const roll = random();
  const outcome = roll < item.probabilities.home ? "home" : roll < drawBoundary ? "draw" : "away";
  const eligible = item.prediction.scoreMatrix.entries.filter((entry) => scoreOutcome(entry) === outcome);
  return sampleWeightedEntry(eligible, random);
}

function sampleWeightedEntry(entries: ScoreMatrixEntry[], random: () => number): ScoreMatrixEntry {
  const total = entries.reduce((sum, entry) => sum + entry.probability, 0);
  let target = random() * total;
  for (const entry of entries) {
    target -= entry.probability;
    if (target <= 0) return entry;
  }
  return entries[entries.length - 1];
}

function scoreOutcome(entry: ScoreMatrixEntry): "home" | "draw" | "away" {
  return entry.homeGoals > entry.awayGoals ? "home" : entry.homeGoals < entry.awayGoals ? "away" : "draw";
}

function orderTable(rows: GroupTableRow[], fallback: Map<string, number>): GroupTableRow[] {
  return rows.sort((a, b) =>
    b.points - a.points
    || b.goalDifference - a.goalDifference
    || b.goalsFor - a.goalsFor
    || fallback.get(a.team.id)! - fallback.get(b.team.id)!
    || a.team.id.localeCompare(b.team.id)
  );
}

function tieBreakValues(teams: Team[], seed: number): Map<string, number> {
  return new Map(teams.map((team) => [team.id, hashString(`${seed}:${team.id}`)]));
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) throw new RangeError("seed must be finite.");
  return Math.trunc(seed) >>> 0;
}

function summarize(team: Team, total: TeamAccumulator, simulations: number): SimulatedGroupTeamResult {
  return {
    teamId: team.id,
    teamCode: team.code,
    teamName: team.name,
    expectedPoints: total.points / simulations,
    probabilityAdvance: (total.finishes[0] + total.finishes[1]) / simulations,
    probabilityWinGroup: total.finishes[0] / simulations,
    probabilityFinishSecond: total.finishes[1] / simulations,
    probabilityFinishThird: total.finishes[2] / simulations,
    probabilityFinishFourth: total.finishes[3] / simulations,
    averageGoalDifference: total.goalDifference / simulations,
    averageGoalsFor: total.goalsFor / simulations,
    averageGoalsAgainst: total.goalsAgainst / simulations,
  };
}

function marketProbability(prediction: MatchStatModelPrediction, selection: "home_win" | "draw" | "away_win"): number {
  return prediction.marketProbabilities.find((row) => row.selection === selection)!.probability;
}

function attachTeams(match: Match, teamsById: Map<string, Team>): Match {
  return {
    ...match,
    home_team: match.home_team ?? teamsById.get(match.home_team_id),
    away_team: match.away_team ?? teamsById.get(match.away_team_id),
  };
}

function validScore(score: number | null): score is number {
  return score != null && Number.isInteger(score) && score >= 0;
}

function emptyStats(teamId: string): TeamStats {
  return { team_id: teamId, matches_played: 0, goals_for: 0, goals_against: 0, goal_diff: 0, recent_form: [], gf_per_game: 0, ga_per_game: 0 };
}

function emptyTableRow(team: Team): GroupTableRow {
  return { team, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, wins: 0, draws: 0, losses: 0 };
}

function emptyAccumulator(): TeamAccumulator {
  return { points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, finishes: [0, 0, 0, 0] };
}
