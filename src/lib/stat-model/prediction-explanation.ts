import type { ExpectedGoalsComponents } from "./expected-goals";
import type { ModelMarketProbability } from "./market-types";
import type { MarketProbabilityIntervals } from "./probability-intervals";

export interface PredictionExplanationInput {
  homeName: string;
  awayName: string;
  homeCode: string;
  awayCode: string;
  components: { home: ExpectedGoalsComponents; away: ExpectedGoalsComponents };
  probabilities: ModelMarketProbability[];
  intervals: MarketProbabilityIntervals;
  confidence: "low" | "medium" | "high";
}

export function buildPredictionExplanation(input: PredictionExplanationInput): string {
  const oneXTwo = input.probabilities.filter((row) => ["home_win", "draw", "away_win"].includes(row.selection));
  const leader = [...oneXTwo].sort((a, b) => b.probability - a.probability)[0];
  const leaderLabel = leader.selection === "home_win"
    ? `triunfo de ${input.homeName}`
    : leader.selection === "away_win"
      ? `triunfo de ${input.awayName}`
      : "empate";
  const effects = (["home", "away"] as const).flatMap((side) => ([
    { side, key: "priorRating" as const, value: input.components[side].priorRating },
    { side, key: "recentForm" as const, value: input.components[side].recentForm },
    { side, key: "context" as const, value: input.components[side].context },
  ]));
  const strongest = effects.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
  const teamCode = strongest.side === "home" ? input.homeCode : input.awayCode;
  const source = strongest.key === "priorRating" ? "rating histórico" : strongest.key === "recentForm" ? "forma reciente" : "contexto del grupo";
  const direction = strongest.value >= 0 ? "eleva" : "reduce";
  const leaderInterval = input.intervals.intervals.find((row) => row.selection === leader.selection);
  const range = leaderInterval ? `${Math.round(leaderInterval.p10 * 100)}–${Math.round(leaderInterval.p90 * 100)}%` : "sin rango disponible";
  const confidence = input.confidence === "high" ? "alta" : input.confidence === "medium" ? "media" : "baja";

  return `El escenario central favorece el ${leaderLabel} (${Math.round(leader.probability * 100)}%). El ${source} ${direction} principalmente el xG de ${teamCode}. La confianza es ${confidence}: el bootstrap sitúa ese mercado entre ${range} (P10–P90).`;
}
