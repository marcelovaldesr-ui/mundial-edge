import type { TeamStats } from "../types";
import { expectedGoals as currentExpectedGoals } from "../model/expected-goals";

export interface StatExpectedGoalsInput {
  home: TeamStats;
  away: TeamStats;
  leagueAvgGoals?: number;
}

export interface StatExpectedGoalsResult {
  homeExpectedGoals: number;
  awayExpectedGoals: number;
  source: "team_stats_expected_goals_v1";
  assumptions: string[];
}

export function estimateExpectedGoals(input: StatExpectedGoalsInput): StatExpectedGoalsResult {
  const { lambdaHome, lambdaAway } = currentExpectedGoals({
    home: input.home,
    away: input.away,
    leagueAvgGoals: input.leagueAvgGoals,
  });
  return {
    homeExpectedGoals: lambdaHome,
    awayExpectedGoals: lambdaAway,
    source: "team_stats_expected_goals_v1",
    assumptions: [
      "Usa team_stats existentes: goles a favor/en contra, diferencia de gol y forma reciente.",
      "No inventa xG externo; la calidad depende de la muestra disponible del torneo.",
      "Modelo pre-partido independiente, sin ajustes live.",
    ],
  };
}
