import type { Team, TeamStats } from "../types";
import { expectedGoals as currentExpectedGoals } from "../model/expected-goals";
import type { WorldCupGroupContext } from "../world-cup/group-context";
import { getTeamStrengthRating, neutralTeamStrengthRating, type TeamStrengthRating } from "./team-strength-ratings";

export interface StatExpectedGoalsInput {
  home: TeamStats;
  away: TeamStats;
  homeTeam?: Team;
  awayTeam?: Team;
  leagueAvgGoals?: number;
  groupContext?: WorldCupGroupContext;
}

export interface StatExpectedGoalsResult {
  homeExpectedGoals: number;
  awayExpectedGoals: number;
  source: "rating_stats_blend_v1" | "team_stats_expected_goals_v1";
  homeRating: TeamStrengthRating | null;
  awayRating: TeamStrengthRating | null;
  blend: {
    homeRatingWeight: number;
    awayRatingWeight: number;
    homeStatsWeight: number;
    awayStatsWeight: number;
  };
  assumptions: string[];
}

export function estimateExpectedGoals(input: StatExpectedGoalsInput): StatExpectedGoalsResult {
  const leagueAvg = input.leagueAvgGoals ?? 1.35;
  const { lambdaHome, lambdaAway } = currentExpectedGoals({
    home: input.home,
    away: input.away,
    leagueAvgGoals: leagueAvg,
  });

  const homeRating = resolveRating(input.homeTeam);
  const awayRating = resolveRating(input.awayTeam);
  if (!homeRating || !awayRating) {
    return {
      homeExpectedGoals: lambdaHome,
      awayExpectedGoals: lambdaAway,
      source: "team_stats_expected_goals_v1",
      homeRating,
      awayRating,
      blend: {
        homeRatingWeight: 0,
        awayRatingWeight: 0,
        homeStatsWeight: 1,
        awayStatsWeight: 1,
      },
      assumptions: baseAssumptions([
        "Sin rating base completo para una o ambas selecciones; se usa el estimador por team_stats.",
      ]),
    };
  }

  const ratingHome = ratingExpectedGoals({
    own: homeRating,
    opponent: awayRating,
    leagueAvgGoals: leagueAvg,
    homeAdvantage: 1.04,
  });
  const ratingAway = ratingExpectedGoals({
    own: awayRating,
    opponent: homeRating,
    leagueAvgGoals: leagueAvg,
    homeAdvantage: 1,
  });
  const homeRatingWeight = ratingWeight(input.home.matches_played, homeRating);
  const awayRatingWeight = ratingWeight(input.away.matches_played, awayRating);
  const homeContext = contextModifier("home", input.groupContext);
  const awayContext = contextModifier("away", input.groupContext);

  const homeExpectedGoals = clamp(
    blend(lambdaHome, ratingHome, homeRatingWeight) * homeContext,
    0.2,
    4.5
  );
  const awayExpectedGoals = clamp(
    blend(lambdaAway, ratingAway, awayRatingWeight) * awayContext,
    0.2,
    4.5
  );

  return {
    homeExpectedGoals,
    awayExpectedGoals,
    source: "rating_stats_blend_v1",
    homeRating,
    awayRating,
    blend: {
      homeRatingWeight,
      awayRatingWeight,
      homeStatsWeight: 1 - homeRatingWeight,
      awayStatsWeight: 1 - awayRatingWeight,
    },
    assumptions: baseAssumptions([
      input.home.matches_played < 2 || input.away.matches_played < 2
        ? "Modelo apoyado principalmente en rating base por baja muestra del Mundial."
        : "Stats reales disponibles; rating base usado como ajuste secundario.",
      "Ratings seed manuales con confidence media como máximo; no son precisión absoluta.",
      input.groupContext ? "Contexto de grupo aplicado con modificadores pequeños y transparentes." : "Sin contexto de grupo específico aplicado.",
      homeRating.source === "neutral_fallback" || awayRating.source === "neutral_fallback"
        ? "Sin rating específico para una selección; usando prior neutral."
        : "Rating base específico disponible para ambas selecciones.",
    ]),
  };
}

function resolveRating(team: Team | undefined): TeamStrengthRating | null {
  if (!team) return null;
  return getTeamStrengthRating(team.code) ?? neutralTeamStrengthRating(team.code, team.name);
}

function ratingExpectedGoals(input: {
  own: TeamStrengthRating;
  opponent: TeamStrengthRating;
  leagueAvgGoals: number;
  homeAdvantage: number;
}): number {
  const attackFactor = 0.68 + input.own.attackRating / 100 * 0.64;
  const defenseResistance = 1.32 - input.opponent.defenseRating / 100 * 0.64;
  const overallTilt = 1 + clamp(input.own.overallRating - input.opponent.overallRating, -25, 25) / 180;
  return clamp(input.leagueAvgGoals * attackFactor * defenseResistance * overallTilt * input.homeAdvantage, 0.2, 4.5);
}

function ratingWeight(matchesPlayed: number, rating: TeamStrengthRating): number {
  if (rating.source === "neutral_fallback") return Math.max(0.15, 0.45 - matchesPlayed * 0.12);
  const base = rating.confidence === "medium" ? 0.68 : 0.55;
  return clamp(base - Math.min(matchesPlayed, 5) * 0.13, 0.12, base);
}

function contextModifier(side: "home" | "away", context?: WorldCupGroupContext): number {
  if (!context) return 1;
  const m = context.modifiers;
  const raw = side === "home"
    ? m.urgencyModifierHome + m.goalDifferenceIncentiveHome + m.rotationRiskHome + m.drawUtility
    : m.urgencyModifierAway + m.goalDifferenceIncentiveAway + m.rotationRiskAway + m.drawUtility;
  return clamp(1 + raw, 0.94, 1.06);
}

function blend(statsLambda: number, ratingLambda: number, ratingShare: number): number {
  return statsLambda * (1 - ratingShare) + ratingLambda * ratingShare;
}

function baseAssumptions(extra: string[]): string[] {
  return [
    "Modelo Mundial Edge: combina rating base por selección, team_stats del Mundial y promedio global de goles.",
    "La probabilidad es del modelo; no es edge apostable sin comparación contra cuota real.",
    ...extra,
  ];
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
