import type { Match, Team } from "../types";

export type WorldCupPhase =
  | "GROUP_STAGE"
  | "ROUND_OF_32"
  | "ROUND_OF_16"
  | "QUARTER_FINAL"
  | "SEMI_FINAL"
  | "THIRD_PLACE"
  | "FINAL"
  | "UNKNOWN";

export interface GroupStanding {
  teamId: string;
  team?: Team;
  group: string;
  played: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  position: number;
  remainingMatches: number;
}

export interface WorldCupGroupContext {
  phase: WorldCupPhase;
  group: string | null;
  homeStanding: GroupStanding | null;
  awayStanding: GroupStanding | null;
  groupMatchNumber: 1 | 2 | 3 | null;
  summary: string;
  modifiers: {
    urgencyModifierHome: number;
    urgencyModifierAway: number;
    drawUtility: number;
    goalDifferenceIncentiveHome: number;
    goalDifferenceIncentiveAway: number;
    rotationRiskHome: number;
    rotationRiskAway: number;
  };
  warnings: string[];
}

export function inferWorldCupPhase(match: Match): WorldCupPhase {
  const stage = (match.stage ?? "").toUpperCase().replace(/[-\s]+/g, "_");
  if (stage.includes("GROUP")) return "GROUP_STAGE";
  if (stage.includes("ROUND_OF_32") || stage.includes("LAST_32")) return "ROUND_OF_32";
  if (stage.includes("ROUND_OF_16") || stage.includes("LAST_16")) return "ROUND_OF_16";
  if (stage.includes("QUARTER")) return "QUARTER_FINAL";
  if (stage.includes("SEMI")) return "SEMI_FINAL";
  if (stage.includes("THIRD")) return "THIRD_PLACE";
  if (stage.includes("FINAL")) return "FINAL";
  return "UNKNOWN";
}

export function phaseLabel(phase: WorldCupPhase): string {
  if (phase === "GROUP_STAGE") return "Fase de grupos";
  if (phase === "ROUND_OF_32") return "Dieciseisavos";
  if (phase === "ROUND_OF_16") return "Octavos";
  if (phase === "QUARTER_FINAL") return "Cuartos";
  if (phase === "SEMI_FINAL") return "Semifinal";
  if (phase === "THIRD_PLACE") return "Tercer puesto";
  if (phase === "FINAL") return "Final";
  return "Fase por confirmar";
}

export function getMatchGroupLabel(match: Match): string | null {
  const stageGroup = (match.stage ?? "").match(/Group\s+([A-H])/i)?.[1];
  const teamGroup = match.home_team?.group ?? match.away_team?.group ?? null;
  const group = stageGroup ? `Grupo ${stageGroup.toUpperCase()}` : teamGroup ? `Grupo ${teamGroup}` : null;
  return group;
}

export function buildGroupStandings(matches: Match[]): Map<string, GroupStanding[]> {
  const byGroup = new Map<string, Map<string, GroupStanding>>();

  for (const match of matches) {
    const group = getMatchGroupLabel(match);
    if (!group || inferWorldCupPhase(match) !== "GROUP_STAGE") continue;
    const groupMap = byGroup.get(group) ?? new Map<string, GroupStanding>();
    byGroup.set(group, groupMap);
    ensureStanding(groupMap, match.home_team_id, match.home_team, group);
    ensureStanding(groupMap, match.away_team_id, match.away_team, group);

    if (match.status === "finished" && match.home_score != null && match.away_score != null) {
      applyResult(groupMap.get(match.home_team_id)!, groupMap.get(match.away_team_id)!, match.home_score, match.away_score);
    }
  }

  const out = new Map<string, GroupStanding[]>();
  for (const [group, groupMap] of byGroup.entries()) {
    const rows = Array.from(groupMap.values());
    for (const standing of rows) {
      standing.remainingMatches = matches.filter((match) => {
        const sameGroup = getMatchGroupLabel(match) === group;
        return sameGroup && match.status !== "finished" && (match.home_team_id === standing.teamId || match.away_team_id === standing.teamId);
      }).length;
    }
    rows.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || teamName(a).localeCompare(teamName(b)));
    rows.forEach((standing, index) => { standing.position = index + 1; });
    out.set(group, rows);
  }
  return out;
}

export function getWorldCupGroupContext(match: Match, matches: Match[]): WorldCupGroupContext {
  const phase = inferWorldCupPhase(match);
  const group = getMatchGroupLabel(match);
  if (phase !== "GROUP_STAGE" || !group) {
    return {
      phase,
      group,
      homeStanding: null,
      awayStanding: null,
      groupMatchNumber: null,
      summary: `${phaseLabel(phase)}: contexto de grupo no aplica para este partido del Mundial 2026.`,
      modifiers: neutralModifiers(),
      warnings: [],
    };
  }

  const standings = buildGroupStandings(matches).get(group) ?? [];
  const homeStanding = standings.find((item) => item.teamId === match.home_team_id) ?? null;
  const awayStanding = standings.find((item) => item.teamId === match.away_team_id) ?? null;
  const groupMatchNumber = inferGroupMatchNumber(match, matches);
  const modifiers = calculateGroupModifiers(homeStanding, awayStanding, groupMatchNumber);
  const summary = buildSummary(group, homeStanding, awayStanding, groupMatchNumber);
  const warnings = standings.length ? [] : ["Contexto de grupo limitado por falta de tabla actualizada."];

  return { phase, group, homeStanding, awayStanding, groupMatchNumber, summary, modifiers, warnings };
}

function ensureStanding(groupMap: Map<string, GroupStanding>, teamId: string, team: Team | undefined, group: string) {
  if (groupMap.has(teamId)) return;
  groupMap.set(teamId, {
    teamId,
    team,
    group,
    played: 0,
    points: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    position: 0,
    remainingMatches: 0,
  });
}

function applyResult(home: GroupStanding, away: GroupStanding, homeGoals: number, awayGoals: number) {
  home.played++;
  away.played++;
  home.goalsFor += homeGoals;
  home.goalsAgainst += awayGoals;
  away.goalsFor += awayGoals;
  away.goalsAgainst += homeGoals;
  home.goalDifference = home.goalsFor - home.goalsAgainst;
  away.goalDifference = away.goalsFor - away.goalsAgainst;
  if (homeGoals > awayGoals) home.points += 3;
  else if (homeGoals < awayGoals) away.points += 3;
  else {
    home.points += 1;
    away.points += 1;
  }
}

function inferGroupMatchNumber(match: Match, matches: Match[]): 1 | 2 | 3 | null {
  const group = getMatchGroupLabel(match);
  if (!group) return null;
  const teamMatches = matches
    .filter((item) => getMatchGroupLabel(item) === group && (item.home_team_id === match.home_team_id || item.away_team_id === match.home_team_id))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const index = teamMatches.findIndex((item) => item.id === match.id);
  if (index < 0) return null;
  return Math.min(3, index + 1) as 1 | 2 | 3;
}

function calculateGroupModifiers(home: GroupStanding | null, away: GroupStanding | null, groupMatchNumber: 1 | 2 | 3 | null) {
  const base = neutralModifiers();
  if (!home || !away) return base;
  const late = groupMatchNumber === 3;
  const homeNeeds = home.points <= 1 && late;
  const awayNeeds = away.points <= 1 && late;
  const bothComfortable = home.points >= 4 && away.points >= 4 && late;
  return {
    urgencyModifierHome: homeNeeds ? 0.035 : home.points === 0 ? 0.018 : 0,
    urgencyModifierAway: awayNeeds ? 0.035 : away.points === 0 ? 0.018 : 0,
    drawUtility: bothComfortable ? -0.035 : 0,
    goalDifferenceIncentiveHome: late && home.goalDifference < away.goalDifference ? 0.015 : 0,
    goalDifferenceIncentiveAway: late && away.goalDifference < home.goalDifference ? 0.015 : 0,
    rotationRiskHome: late && home.points >= 6 ? -0.025 : 0,
    rotationRiskAway: late && away.points >= 6 ? -0.025 : 0,
  };
}

function neutralModifiers() {
  return {
    urgencyModifierHome: 0,
    urgencyModifierAway: 0,
    drawUtility: 0,
    goalDifferenceIncentiveHome: 0,
    goalDifferenceIncentiveAway: 0,
    rotationRiskHome: 0,
    rotationRiskAway: 0,
  };
}

function buildSummary(group: string, home: GroupStanding | null, away: GroupStanding | null, groupMatchNumber: 1 | 2 | 3 | null): string {
  if (!home || !away) return `${group}: contexto de grupo limitado por falta de tabla actualizada.`;
  const matchdayText = groupMatchNumber ? `partido ${groupMatchNumber} de grupo` : "partido de grupo";
  if (groupMatchNumber === 3) {
    return `${group}: ${matchdayText}; posible impacto directo en clasificación y diferencia de gol. ${teamName(home)} llega con ${home.points} pts, ${teamName(away)} con ${away.points} pts.`;
  }
  if (home.points === 0 && away.points === 0) {
    return `${group}: ${matchdayText}; ambos equipos necesitan sus primeros puntos para encaminar el camino a octavos.`;
  }
  return `${group}: ${matchdayText}; ${teamName(home)} llega con ${home.points} pts y ${teamName(away)} con ${away.points} pts.`;
}

function teamName(standing: GroupStanding): string {
  return standing.team?.name ?? standing.teamId;
}
