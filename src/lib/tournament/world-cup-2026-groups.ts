import type { Match, Team } from "../types";
import { inferWorldCupPhase } from "../world-cup";
import { createGroupSimulationPreview } from "./group-simulation-demo";
import { simulateGroupFromSchedule, type GroupSimulationServiceResult } from "./group-simulation-service";

export interface WorldCup2026GroupSchedule {
  groupId: string;
  teams: Team[];
  matches: Match[];
  playedMatches: Match[];
  pendingMatches: Match[];
  source: "repository-current";
  warnings: string[];
}

export interface WorldCup2026GroupSimulationView {
  dataStatus: "current" | "demo";
  groups: WorldCup2026GroupSchedule[];
  selectedGroupId: string;
  result: GroupSimulationServiceResult;
  warnings: string[];
}

const EXPECTED_TEAMS = 4;
const EXPECTED_MATCHUPS = 6;

/** Adapts repository fixtures without reading persistence or external providers directly. */
export function buildWorldCup2026Groups(matches: Match[]): WorldCup2026GroupSchedule[] {
  const groupMatches = matches.filter((match) => inferWorldCupPhase(match) === "GROUP_STAGE");
  const labeled = new Map<string, Match[]>();
  const unlabeled: Match[] = [];

  for (const match of groupMatches) {
    const groupId = explicitGroupId(match);
    if (!groupId) {
      unlabeled.push(match);
      continue;
    }
    const rows = labeled.get(groupId) ?? [];
    rows.push(match);
    labeled.set(groupId, rows);
  }

  const candidates = [
    ...[...labeled.entries()].map(([groupId, rows]) => ({ groupId, matches: rows })),
    ...connectedFixtureGroups(unlabeled).map((rows, index) => ({
      groupId: inferredGroupId(rows, index),
      matches: rows,
    })),
  ];

  return candidates
    .map(({ groupId, matches: rows }) => scheduleFor(groupId, rows))
    .filter((schedule): schedule is WorldCup2026GroupSchedule => schedule != null)
    .sort((a, b) => a.groupId.localeCompare(b.groupId, "en", { numeric: true }));
}

export function createWorldCup2026GroupSimulationView(
  matches: Match[],
  requestedGroupId?: string | null,
  simulations = 5_000
): WorldCup2026GroupSimulationView {
  const groups = buildWorldCup2026Groups(matches);
  const selected = groups.find((group) => group.groupId === requestedGroupId) ?? groups[0];
  if (!selected) {
    const result = createGroupSimulationPreview();
    const warning = "No hay un grupo 2026 completo en el repositorio (4 equipos y 6 cruces); se muestra el demo aislado.";
    return {
      dataStatus: "demo",
      groups: [],
      selectedGroupId: result.groupId,
      result: { ...result, warnings: [warning, ...result.warnings] },
      warnings: [warning],
    };
  }

  const result = simulateGroupFromSchedule({
    groupId: selected.groupId,
    teams: selected.teams,
    matches: selected.matches,
    simulations,
  });
  return {
    dataStatus: "current",
    groups,
    selectedGroupId: selected.groupId,
    result: { ...result, warnings: [...new Set([...selected.warnings, ...result.warnings])] },
    warnings: selected.warnings,
  };
}

function scheduleFor(groupId: string, rows: Match[]): WorldCup2026GroupSchedule | null {
  const warnings: string[] = [];
  const teamsById = new Map<string, Team>();
  for (const match of rows) {
    if (match.home_team) teamsById.set(match.home_team_id, normalizeTeamGroup(match.home_team, groupId));
    if (match.away_team) teamsById.set(match.away_team_id, normalizeTeamGroup(match.away_team, groupId));
  }
  if (teamsById.size !== EXPECTED_TEAMS) return null;

  const teamIds = new Set(teamsById.keys());
  const validRows = rows.filter((match) => teamIds.has(match.home_team_id) && teamIds.has(match.away_team_id));
  const pairs = new Set(validRows.map(pairKey));
  if (pairs.size !== EXPECTED_MATCHUPS) return null;
  if (validRows.length !== EXPECTED_MATCHUPS) {
    warnings.push(`Fixture con ${validRows.length} filas para ${EXPECTED_MATCHUPS} cruces unicos; se usa la primera fila de cada cruce.`);
  }

  const seenPairs = new Set<string>();
  const matches = validRows
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id))
    .filter((match) => {
      const pair = pairKey(match);
      if (seenPairs.has(pair)) return false;
      seenPairs.add(pair);
      return true;
    })
    .map((match) => normalizeMatch(match, teamsById, groupId, warnings));

  const playedMatches = matches.filter((match) => match.status === "finished");
  const pendingMatches = matches.filter((match) => match.status !== "finished");
  if (playedMatches.length === 0) warnings.push("Aun no hay resultados finalizados; la tabla parte en cero.");
  if (pendingMatches.length === 0) warnings.push("El grupo ya no tiene partidos pendientes; la salida es deterministica.");

  return {
    groupId,
    teams: [...teamsById.values()].sort((a, b) => a.code.localeCompare(b.code)),
    matches,
    playedMatches,
    pendingMatches,
    source: "repository-current",
    warnings: [...new Set(warnings)],
  };
}

function normalizeMatch(match: Match, teamsById: ReadonlyMap<string, Team>, groupId: string, warnings: string[]): Match {
  const hasValidFinishedScore = match.status !== "finished"
    || (validScore(match.home_score) && validScore(match.away_score));
  if (!hasValidFinishedScore) {
    warnings.push(`Partido ${match.id} figura finalizado sin marcador valido; se trata como pendiente.`);
  }
  return {
    ...match,
    stage: `Group ${groupId}`,
    status: hasValidFinishedScore ? match.status : "scheduled",
    home_score: hasValidFinishedScore ? match.home_score : null,
    away_score: hasValidFinishedScore ? match.away_score : null,
    home_team: teamsById.get(match.home_team_id),
    away_team: teamsById.get(match.away_team_id),
    neutralVenue: match.neutralVenue ?? true,
  };
}

function explicitGroupId(match: Match): string | null {
  const stageMatch = match.stage.match(/(?:GROUP|GRUPO)(?:_STAGE)?[\s_-]+([A-L])\b/i);
  if (stageMatch) return stageMatch[1].toUpperCase();
  const groups = [match.home_team?.group, match.away_team?.group]
    .filter((value): value is string => Boolean(value))
    .map(normalizeGroupId);
  return groups.length > 0 && groups.every((group) => group === groups[0]) ? groups[0] : null;
}

function connectedFixtureGroups(matches: Match[]): Match[][] {
  const byTeam = new Map<string, Match[]>();
  for (const match of matches) {
    for (const teamId of [match.home_team_id, match.away_team_id]) {
      const rows = byTeam.get(teamId) ?? [];
      rows.push(match);
      byTeam.set(teamId, rows);
    }
  }
  const visited = new Set<string>();
  const groups: Match[][] = [];
  for (const start of byTeam.keys()) {
    if (visited.has(start)) continue;
    const queue = [start];
    const componentMatches = new Map<string, Match>();
    while (queue.length) {
      const teamId = queue.shift()!;
      if (visited.has(teamId)) continue;
      visited.add(teamId);
      for (const match of byTeam.get(teamId) ?? []) {
        componentMatches.set(match.id, match);
        const other = match.home_team_id === teamId ? match.away_team_id : match.home_team_id;
        if (!visited.has(other)) queue.push(other);
      }
    }
    groups.push([...componentMatches.values()]);
  }
  return groups;
}

function inferredGroupId(matches: Match[], index: number): string {
  const codes = [...new Set(matches.flatMap((match) => [match.home_team?.code, match.away_team?.code]).filter(Boolean))].sort();
  return codes.length === EXPECTED_TEAMS ? `Actual ${codes.join("-")}` : `Actual ${index + 1}`;
}

function normalizeTeamGroup(team: Team, groupId: string): Team {
  return { ...team, group: groupId };
}

function normalizeGroupId(value: string): string {
  return value.trim().toUpperCase().replace(/^(GROUP|GRUPO)[\s_-]*/, "");
}

function pairKey(match: Match): string {
  return [match.home_team_id, match.away_team_id].sort().join(":");
}

function validScore(value: number | null): value is number {
  return value != null && Number.isInteger(value) && value >= 0;
}
