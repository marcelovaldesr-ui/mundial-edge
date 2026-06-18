import type { Match, Team } from "../types";
import { simulateGroupFromSchedule, type GroupSimulationServiceResult } from "./group-simulation-service";

/** Isolated preview fixture. Never merge these rows with repository/live data. */
export function createGroupSimulationPreview(): GroupSimulationServiceResult {
  const teams: Team[] = [
    { id: "preview-arg", name: "Argentina", code: "ARG", group: "Preview A", flag: "🇦🇷" },
    { id: "preview-bra", name: "Brasil", code: "BRA", group: "Preview A", flag: "🇧🇷" },
    { id: "preview-can", name: "Canadá", code: "CAN", group: "Preview A", flag: "🇨🇦" },
    { id: "preview-nzl", name: "Nueva Zelanda", code: "NZL", group: "Preview A", flag: "🇳🇿" },
  ];
  const matches: Match[] = [
    previewMatch("1", teams[0], teams[1], "finished", 2, 0, "2026-06-11T18:00:00Z"),
    previewMatch("2", teams[2], teams[3], "finished", 1, 0, "2026-06-11T21:00:00Z"),
    previewMatch("3", teams[0], teams[2], "scheduled", null, null, "2026-06-16T18:00:00Z"),
    previewMatch("4", teams[1], teams[3], "scheduled", null, null, "2026-06-16T21:00:00Z"),
    previewMatch("5", teams[0], teams[3], "scheduled", null, null, "2026-06-21T18:00:00Z"),
    previewMatch("6", teams[1], teams[2], "scheduled", null, null, "2026-06-21T21:00:00Z"),
  ];
  return simulateGroupFromSchedule({
    groupId: "Preview A",
    teams,
    matches,
    simulations: 5_000,
    seed: 20260618,
  });
}

function previewMatch(
  id: string,
  home: Team,
  away: Team,
  status: Match["status"],
  homeScore: number | null,
  awayScore: number | null,
  kickoff: string
): Match {
  return {
    id: `group-preview-${id}`,
    home_team_id: home.id,
    away_team_id: away.id,
    home_team: home,
    away_team: away,
    stage: "Group Preview A",
    kickoff,
    venue: null,
    status,
    home_score: homeScore,
    away_score: awayScore,
    neutralVenue: true,
  };
}
