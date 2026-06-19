import type { Match, Team } from "../types";
import { inferWorldCupPhase } from "../world-cup";
import {
  simulateWorldCup2026FromSchedules,
  type GroupSimulationServiceResult,
} from "./group-simulation-service";
import { selectBestThirdPlacedTeams, type GroupStandings } from "./best-third-places";

export const WORLD_CUP_2026_GROUP_IDS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;
export type WorldCup2026GroupId = typeof WORLD_CUP_2026_GROUP_IDS[number];
export type WorldCup2026GroupDataStatus = "current" | "preview" | "demo";

export interface WorldCup2026CurrentStanding {
  teamId: string;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface WorldCup2026GroupSourceMetadata {
  dataStatus: WorldCup2026GroupDataStatus;
  source: "repository-current" | "repository-plus-local-preview" | "local-fallback";
  expectedTeams: 4;
  expectedMatches: 6;
  availableRepositoryMatches: number;
  inferredGroupLabel: boolean;
}

export interface WorldCup2026GroupSchedule {
  groupId: WorldCup2026GroupId;
  teams: Team[];
  matches: Match[];
  playedMatches: Match[];
  pendingMatches: Match[];
  standings: WorldCup2026CurrentStanding[];
  metadata: WorldCup2026GroupSourceMetadata;
  warnings: string[];
}

export interface WorldCup2026GroupUiEntry {
  schedule: WorldCup2026GroupSchedule;
  simulation: GroupSimulationServiceResult;
  currentThirdQualifies: boolean;
}

export interface WorldCup2026GroupsUiData {
  groups: WorldCup2026GroupUiEntry[];
  hasCurrentData: boolean;
  warnings: string[];
}

export interface WorldCup2026GroupSimulationView {
  dataStatus: WorldCup2026GroupDataStatus;
  groups: WorldCup2026GroupSchedule[];
  selectedGroupId: WorldCup2026GroupId;
  result: GroupSimulationServiceResult;
  warnings: string[];
}

const EXPECTED_TEAMS = 4 as const;
const EXPECTED_MATCHUPS = 6 as const;

/** Always returns the twelve 2026 group slots; repository rows replace local fallbacks when sufficient. */
export function buildWorldCup2026Groups(matches: Match[]): WorldCup2026GroupSchedule[] {
  const groupMatches = matches.filter((match) => inferWorldCupPhase(match) === "GROUP_STAGE");
  const labeled = new Map<WorldCup2026GroupId, Match[]>();
  const unlabeled: Match[] = [];
  for (const match of groupMatches) {
    const groupId = explicitGroupId(match);
    if (!groupId) unlabeled.push(match);
    else labeled.set(groupId, [...(labeled.get(groupId) ?? []), match]);
  }

  const unusedIds = WORLD_CUP_2026_GROUP_IDS.filter((groupId) => !labeled.has(groupId));
  const inferred = connectedFixtureGroups(unlabeled)
    .filter((rows) => uniqueTeamIds(rows).size === EXPECTED_TEAMS)
    .sort((a, b) => earliestKickoff(a).localeCompare(earliestKickoff(b)));
  inferred.forEach((rows, index) => {
    const groupId = unusedIds[index];
    if (groupId) labeled.set(groupId, rows);
  });

  const anyRepositoryGroupData = groupMatches.length > 0;
  return WORLD_CUP_2026_GROUP_IDS.map((groupId) => {
    const rows = labeled.get(groupId) ?? [];
    const inferredLabel = rows.length > 0 && rows.every((match) => explicitGroupId(match) == null);
    return scheduleFor(groupId, rows, inferredLabel, anyRepositoryGroupData);
  });
}

export function createWorldCup2026GroupsUiData(matches: Match[], simulations = 3_000): WorldCup2026GroupsUiData {
  const schedules = buildWorldCup2026Groups(matches);
  const tournament = simulateWorldCup2026FromSchedules({
    groups: schedules.map((schedule) => ({ groupId: schedule.groupId, teams: schedule.teams, matches: schedule.matches })),
    simulations,
  });
  const currentThirdQualifiers = new Set(selectBestThirdPlacedTeams(schedules.map(toGroupStandings)));
  const groups = schedules.map((schedule, index) => ({
    schedule,
    currentThirdQualifies: currentThirdQualifiers.has(schedule.standings[2].teamId),
    simulation: {
      ...tournament.groups[index],
      warnings: [...new Set([...schedule.warnings, ...tournament.groups[index].warnings, ...tournament.warnings])],
    },
  }));
  return {
    groups,
    hasCurrentData: schedules.some((schedule) => schedule.metadata.dataStatus === "current"),
    warnings: [...new Set(schedules.flatMap((schedule) => schedule.warnings))],
  };
}

function toGroupStandings(schedule: WorldCup2026GroupSchedule): GroupStandings {
  return {
    groupId: schedule.groupId,
    teams: schedule.standings.map((row, index) => ({
      teamId: row.teamId,
      teamCode: row.team.code,
      teamName: row.team.name,
      points: row.points,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference,
      position: (index + 1) as 1 | 2 | 3 | 4,
    })),
  };
}

/** Backwards-compatible single-group view used by earlier integrations and checks. */
export function createWorldCup2026GroupSimulationView(
  matches: Match[],
  requestedGroupId?: string | null,
  simulations = 5_000
): WorldCup2026GroupSimulationView {
  const groups = buildWorldCup2026Groups(matches);
  const selected = groups.find((group) => group.groupId === requestedGroupId) ?? groups[0];
  const uiData = createWorldCup2026GroupsUiData(matches, simulations);
  const selectedResult = uiData.groups.find((entry) => entry.schedule.groupId === selected.groupId)!;
  return {
    dataStatus: selected.metadata.dataStatus,
    groups,
    selectedGroupId: selected.groupId,
    result: selectedResult.simulation,
    warnings: selected.warnings,
  };
}

function scheduleFor(
  groupId: WorldCup2026GroupId,
  rows: Match[],
  inferredGroupLabel: boolean,
  anyRepositoryGroupData: boolean
): WorldCup2026GroupSchedule {
  const warnings: string[] = [];
  const repositoryTeams = teamsFromRows(rows, groupId);
  const hasFourRepositoryTeams = repositoryTeams.size === EXPECTED_TEAMS;
  const repositoryPairs = new Set(rows.map(pairKey));
  let teams: Team[];
  let normalizedMatches: Match[];
  let dataStatus: WorldCup2026GroupDataStatus;
  let source: WorldCup2026GroupSourceMetadata["source"];

  if (hasFourRepositoryTeams) {
    teams = [...repositoryTeams.values()].sort((a, b) => a.code.localeCompare(b.code));
    normalizedMatches = normalizeRepositoryMatches(rows, repositoryTeams, groupId, warnings);
    if (normalizedMatches.length < EXPECTED_MATCHUPS) {
      const missing = completeMissingMatchups(groupId, teams, normalizedMatches);
      normalizedMatches.push(...missing);
      warnings.push(`Fixture actual incompleto: ${repositoryPairs.size}/${EXPECTED_MATCHUPS} cruces; ${missing.length} partidos se completan como preview local.`);
      dataStatus = "preview";
      source = "repository-plus-local-preview";
    } else {
      dataStatus = "current";
      source = "repository-current";
    }
    if (inferredGroupLabel) warnings.push(`La etiqueta Grupo ${groupId} fue inferida por conectividad/orden del fixture; el proveedor no la entrego.`);
  } else {
    teams = fallbackTeams(groupId);
    normalizedMatches = fallbackMatches(groupId, teams);
    dataStatus = anyRepositoryGroupData ? "preview" : "demo";
    source = "local-fallback";
    const detail = rows.length
      ? `${repositoryTeams.size}/${EXPECTED_TEAMS} equipos y ${repositoryPairs.size}/${EXPECTED_MATCHUPS} cruces disponibles`
      : "sin fixture de repositorio";
    warnings.push(`Grupo ${groupId} ${detail}; se usa fixture local con equipos por confirmar.`);
  }

  normalizedMatches.sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id));
  const playedMatches = normalizedMatches.filter((match) => match.status === "finished");
  const pendingMatches = normalizedMatches.filter((match) => match.status !== "finished");
  if (playedMatches.length === 0) warnings.push("Aun no hay resultados finalizados; los standings parten en cero.");
  if (pendingMatches.length === 0) warnings.push("El grupo ya no tiene partidos pendientes; la simulacion es deterministica.");

  return {
    groupId,
    teams,
    matches: normalizedMatches,
    playedMatches,
    pendingMatches,
    standings: calculateWorldCup2026Standings(teams, playedMatches),
    metadata: {
      dataStatus,
      source,
      expectedTeams: EXPECTED_TEAMS,
      expectedMatches: EXPECTED_MATCHUPS,
      availableRepositoryMatches: rows.length,
      inferredGroupLabel,
    },
    warnings: [...new Set(warnings)],
  };
}

export function calculateWorldCup2026Standings(teams: Team[], playedMatches: Match[]): WorldCup2026CurrentStanding[] {
  const table = new Map(teams.map((team) => [team.id, emptyStanding(team)]));
  for (const match of playedMatches) {
    if (!validScore(match.home_score) || !validScore(match.away_score)) continue;
    const home = table.get(match.home_team_id);
    const away = table.get(match.away_team_id);
    if (!home || !away) continue;
    home.played++;
    away.played++;
    home.goalsFor += match.home_score;
    home.goalsAgainst += match.away_score;
    away.goalsFor += match.away_score;
    away.goalsAgainst += match.home_score;
    if (match.home_score > match.away_score) {
      home.won++;
      away.lost++;
      home.points += 3;
    } else if (match.home_score < match.away_score) {
      away.won++;
      home.lost++;
      away.points += 3;
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
    }
  }
  const standings = [...table.values()];
  standings.forEach((row) => { row.goalDifference = row.goalsFor - row.goalsAgainst; });
  return standings.sort((a, b) =>
    b.points - a.points
    || b.goalDifference - a.goalDifference
    || b.goalsFor - a.goalsFor
    || a.team.code.localeCompare(b.team.code)
  );
}

export function selectWorldCup2026Group(
  groups: WorldCup2026GroupUiEntry[],
  groupId: WorldCup2026GroupId
): WorldCup2026GroupUiEntry | undefined {
  return groups.find((entry) => entry.schedule.groupId === groupId);
}

function normalizeRepositoryMatches(
  rows: Match[],
  teamsById: ReadonlyMap<string, Team>,
  groupId: WorldCup2026GroupId,
  warnings: string[]
): Match[] {
  const seenPairs = new Set<string>();
  return [...rows]
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id))
    .filter((match) => {
      const pair = pairKey(match);
      if (seenPairs.has(pair)) return false;
      seenPairs.add(pair);
      return teamsById.has(match.home_team_id) && teamsById.has(match.away_team_id);
    })
    .map((match) => normalizeMatch(match, teamsById, groupId, warnings));
}

function normalizeMatch(
  match: Match,
  teamsById: ReadonlyMap<string, Team>,
  groupId: WorldCup2026GroupId,
  warnings: string[]
): Match {
  const validFinished = match.status !== "finished" || (validScore(match.home_score) && validScore(match.away_score));
  if (!validFinished) warnings.push(`Partido ${match.id} figura finalizado sin marcador valido; se trata como pendiente.`);
  return {
    ...match,
    stage: `Group ${groupId}`,
    status: validFinished ? match.status : "scheduled",
    home_score: validFinished ? match.home_score : null,
    away_score: validFinished ? match.away_score : null,
    home_team: teamsById.get(match.home_team_id),
    away_team: teamsById.get(match.away_team_id),
    neutralVenue: match.neutralVenue ?? true,
  };
}

function completeMissingMatchups(groupId: WorldCup2026GroupId, teams: Team[], matches: Match[]): Match[] {
  const existing = new Set(matches.map(pairKey));
  const missing: Match[] = [];
  let index = 0;
  for (let home = 0; home < teams.length; home++) {
    for (let away = home + 1; away < teams.length; away++) {
      const pair = [teams[home].id, teams[away].id].sort().join(":");
      if (existing.has(pair)) continue;
      missing.push(localMatch(groupId, teams[home], teams[away], index++, "preview"));
    }
  }
  return missing;
}

function fallbackTeams(groupId: WorldCup2026GroupId): Team[] {
  return Array.from({ length: EXPECTED_TEAMS }, (_, index) => ({
    id: `group-${groupId.toLowerCase()}-preview-${index + 1}`,
    name: `Equipo ${index + 1} por confirmar`,
    code: `${groupId}${index + 1}`,
    group: groupId,
  }));
}

function fallbackMatches(groupId: WorldCup2026GroupId, teams: Team[]): Match[] {
  const matches: Match[] = [];
  let index = 0;
  for (let home = 0; home < teams.length; home++) {
    for (let away = home + 1; away < teams.length; away++) {
      matches.push(localMatch(groupId, teams[home], teams[away], index++, "fallback"));
    }
  }
  return matches;
}

function localMatch(groupId: WorldCup2026GroupId, home: Team, away: Team, index: number, kind: string): Match {
  return {
    id: `group-${groupId.toLowerCase()}-${kind}-${index + 1}`,
    home_team_id: home.id,
    away_team_id: away.id,
    home_team: home,
    away_team: away,
    stage: `Group ${groupId}`,
    kickoff: new Date(Date.UTC(2026, 5, 11 + index, 18)).toISOString(),
    venue: null,
    status: "scheduled",
    home_score: null,
    away_score: null,
    neutralVenue: true,
  };
}

function teamsFromRows(rows: Match[], groupId: WorldCup2026GroupId): Map<string, Team> {
  const teams = new Map<string, Team>();
  for (const match of rows) {
    if (match.home_team) teams.set(match.home_team_id, { ...match.home_team, group: groupId });
    if (match.away_team) teams.set(match.away_team_id, { ...match.away_team, group: groupId });
  }
  return teams;
}

function explicitGroupId(match: Match): WorldCup2026GroupId | null {
  const stageMatch = match.stage.match(/(?:GROUP|GRUPO)(?:_STAGE)?[\s_-]+([A-L])\b/i)?.[1]?.toUpperCase();
  if (stageMatch && isGroupId(stageMatch)) return stageMatch;
  const groups = [match.home_team?.group, match.away_team?.group]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().toUpperCase().replace(/^(GROUP|GRUPO)[\s_-]*/, ""));
  return groups.length > 0 && groups.every((group) => group === groups[0]) && isGroupId(groups[0]) ? groups[0] : null;
}

function connectedFixtureGroups(matches: Match[]): Match[][] {
  const byTeam = new Map<string, Match[]>();
  for (const match of matches) {
    for (const teamId of [match.home_team_id, match.away_team_id]) {
      byTeam.set(teamId, [...(byTeam.get(teamId) ?? []), match]);
    }
  }
  const visited = new Set<string>();
  const groups: Match[][] = [];
  for (const start of byTeam.keys()) {
    if (visited.has(start)) continue;
    const queue = [start];
    const component = new Map<string, Match>();
    while (queue.length) {
      const teamId = queue.shift()!;
      if (visited.has(teamId)) continue;
      visited.add(teamId);
      for (const match of byTeam.get(teamId) ?? []) {
        component.set(match.id, match);
        const other = match.home_team_id === teamId ? match.away_team_id : match.home_team_id;
        if (!visited.has(other)) queue.push(other);
      }
    }
    groups.push([...component.values()]);
  }
  return groups;
}

function emptyStanding(team: Team): WorldCup2026CurrentStanding {
  return { teamId: team.id, team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 };
}

function uniqueTeamIds(matches: Match[]): Set<string> {
  return new Set(matches.flatMap((match) => [match.home_team_id, match.away_team_id]));
}

function earliestKickoff(matches: Match[]): string {
  return matches.map((match) => match.kickoff).sort()[0] ?? "";
}

function pairKey(match: Match): string {
  return [match.home_team_id, match.away_team_id].sort().join(":");
}

function validScore(value: number | null): value is number {
  return value != null && Number.isInteger(value) && value >= 0;
}

function isGroupId(value: string): value is WorldCup2026GroupId {
  return (WORLD_CUP_2026_GROUP_IDS as readonly string[]).includes(value);
}
