import type { CorrelationLevel, ParlayPick, ParlayProfile, ParlayRiskLevel } from "./parlay-types";
import { marketDistributionKey } from "../markets/market-display";

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

  return Math.min(
    100,
    Math.round(legRisk + oddsRisk + probabilityRisk + pickTierRisk + correlationPenalty[input.correlationLevel])
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
}): number {
  const avgPickEv = input.picks.reduce((sum, pick) => sum + pick.ev, 0) / input.picks.length;
  const avgPickProb = input.picks.reduce((sum, pick) => sum + pick.anchoredProb, 0) / input.picks.length;
  const cappedEv = Math.min(Math.max(input.ev, 0), 0.25);
  const oddsPenalty = Math.max(0, Math.log(input.totalOdds) - 2.2) * 2.5;
  const legs = input.picks.length;
  const diversityPenalty = marketConcentrationPenalty(input.picks);

  const profileAdjustment =
    input.profile === "conservative"
      ? input.jointProbabilityAdjusted * 22 - Math.max(0, input.totalOdds - 4) * 2 - Math.max(0, legs - 2) * 4
      : input.profile === "aggressive"
        ? Math.min(Math.max(input.totalOdds - 3, 0), 24) * 1.8 + (legs >= 3 ? 9 : -7) - input.jointProbabilityAdjusted * 8
        : Math.max(0, 10 - Math.abs(input.totalOdds - 5.5)) * 1.2 + (legs === 3 ? 7 : -2);

  return +(
    cappedEv * 45 +
    input.jointProbabilityAdjusted * 60 +
    Math.min(Math.max(avgPickEv, 0), 0.12) * 50 +
    avgPickProb * 10 -
    input.riskScore * 0.08 -
    correlationPenalty[input.correlationLevel] * 0.4 -
    oddsPenalty +
    diversityPenalty +
    profileAdjustment
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
    if (count > 1) penalty -= (count - 1) * 1.5;
    if (count > 2) penalty -= (count - 2) * 2;
  }
  return penalty;
}
