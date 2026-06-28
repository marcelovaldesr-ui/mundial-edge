import type { CorrelationLevel, ParlayPick, ParlayProfile, ParlayRiskLevel } from "./parlay-types";
import { marketDistributionKey } from "../markets/market-display";
import { isKnockoutStage } from "../matches/stage";

const correlationPenalty: Record<CorrelationLevel, number> = {
  low: 0,
  medium: 8,
  high: 18,
  invalid: 100,
};

export function calculateRiskScore(input: {
  picks: ParlayPick[];
  totalOdds: number;
  jointProbabilityAdjusted: number;
  correlationLevel: CorrelationLevel;
}): number {
  const legRisk = Math.max(0, input.picks.length - 1) * 8;
  const oddsRisk = Math.min(35, Math.max(0, Math.log(input.totalOdds) - 1.2) * 12);
  const probabilityRisk = Math.min(30, Math.max(0, 0.18 - input.jointProbabilityAdjusted) * 120);
  const pickTierRisk = input.picks.reduce((sum, pick) => {
    if (pick.riskLevel === "high") return sum + 5;
    if (pick.riskLevel === "medium") return sum + 3;
    return sum + 1;
  }, 0);

  // P1.5: varianza extra en eliminatorias (prórroga/penaltis, planteamientos
  // más cerrados, fatiga acumulada) que el Poisson de 90' no captura.
  const knockoutRisk = input.picks.some((pick) => isKnockoutStage(pick.match?.stage)) ? 6 : 0;

  return Math.min(
    100,
    Math.round(legRisk + oddsRisk + probabilityRisk + pickTierRisk + knockoutRisk + correlationPenalty[input.correlationLevel])
  );
}

export function riskLabel(score: number): ParlayRiskLevel {
  if (score < 30) return "low";
  if (score < 55) return "medium";
  if (score < 78) return "high";
  return "very_high";
}

export function scoreParlay(input: {
  profile?: ParlayProfile;
  picks: ParlayPick[];
  totalOdds: number;
  jointProbabilityAdjusted: number;
  ev: number;
  riskScore: number;
  correlationLevel: CorrelationLevel;
  targetOdds?: { min: number; max: number };
}): number {
  // Estimated-odds picks contribute 70% of their EV (no bookmaker confirmation of edge).
  const avgPickEv = input.picks.reduce((sum, pick) =>
    sum + pick.ev * (pick.oddsType === "estimated" ? 0.7 : 1), 0) / input.picks.length;
  const avgPickProb = input.picks.reduce((sum, pick) => sum + pick.anchoredProb, 0) / input.picks.length;
  const cappedEv = Math.min(Math.max(input.ev, 0), 0.25);
  // Penalización de cuota total más firme: mantiene el ranking en rangos
  // realistas y evita que dominen las combinadas de cuota muy alta.
  const oddsPenalty = Math.max(0, Math.log(input.totalOdds) - 1.6) * 7;
  const legs = input.picks.length;
  const diversityPenalty = marketConcentrationPenalty(input.picks);
  // Cuota objetivo como objetivo de construcción (P1.2): premia caer dentro
  // del rango pedido y penaliza la distancia al punto medio, de modo que el
  // ranking acerque las combinadas a la cuota que busca el usuario.
  const targetPenalty = input.targetOdds
    ? input.totalOdds >= input.targetOdds.min && input.totalOdds <= input.targetOdds.max
      ? -3
      : Math.abs(input.totalOdds - (input.targetOdds.min + input.targetOdds.max) / 2) * 1.5
    : 0;

  const profileAdjustment =
    input.profile === "conservative"
      ? input.jointProbabilityAdjusted * 26 - Math.max(0, input.totalOdds - 2.6) * 4 - Math.max(0, legs - 2) * 5
      : input.profile === "aggressive"
        ? Math.min(Math.max(input.totalOdds - 3, 0), 24) * 1.8 + (legs >= 3 ? 9 : -7) - input.jointProbabilityAdjusted * 8
        : Math.max(0, 8 - Math.abs(input.totalOdds - 3.8)) * 1.3 + (legs === 3 ? 5 : 0);

  return +(
    cappedEv * 45 +
    input.jointProbabilityAdjusted * 60 +
    Math.min(Math.max(avgPickEv, 0), 0.12) * 50 +
    avgPickProb * 10 -
    input.riskScore * 0.08 -
    correlationPenalty[input.correlationLevel] * 0.4 -
    oddsPenalty +
    diversityPenalty +
    profileAdjustment -
    targetPenalty
  ).toFixed(4);
}

function marketConcentrationPenalty(picks: ParlayPick[]): number {
  const counts = new Map<string, number>();
  for (const pick of picks) {
    const key = marketDistributionKey(pick);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let penalty = 0;
  for (const count of counts.values()) {
    // Penalización fuerte por concentrar el mismo mercado (ej. todo over/under),
    // suficiente para que las combinadas con mezcla real de mercados rankeen arriba.
    if (count > 1) penalty -= (count - 1) * 9;
    if (count > 2) penalty -= (count - 2) * 4;
  }
  // Premio por diversidad real de mercados.
  if (counts.size >= 2) penalty += 4;
  return penalty;
}
