import type { CorrelationLevel, ParlayProfile, StakeSuggestion } from "./parlay-types";

export const STAKE_RULES: Record<ParlayProfile, { kellyMultiplier: number; maxStakePercent: number }> = {
  conservative: { kellyMultiplier: 0.25, maxStakePercent: 0.0075 },
  balanced: { kellyMultiplier: 0.35, maxStakePercent: 0.015 },
  aggressive: { kellyMultiplier: 0.5, maxStakePercent: 0.025 },
};

function roundUnits(units: number): number {
  if (units <= 0) return 0;
  return Math.max(0.25, Math.round(units * 4) / 4);
}

export function kellyFraction(decimalOdds: number, probability: number): number {
  const b = decimalOdds - 1;
  if (b <= 0 || probability <= 0 || probability >= 1) return 0;
  const q = 1 - probability;
  return (b * probability - q) / b;
}

export function suggestStake(input: {
  odds: number;
  probability: number;
  profile: ParlayProfile;
  bankroll?: number;
  riskScore?: number;
  legs?: number;
  correlationLevel?: CorrelationLevel;
}): StakeSuggestion {
  const rules = STAKE_RULES[input.profile];
  const ev = input.probability * input.odds - 1;
  if (ev <= 0) {
    return {
      kellyFraction: Math.min(0, kellyFraction(input.odds, input.probability)),
      suggestedStakeUnits: 0,
      suggestedStakePercent: input.bankroll ? 0 : null,
      suggestedStakeAmount: input.bankroll ? 0 : null,
      label: "No recomendado",
      reason: "EV ajustado no positivo; Kelly no recomienda exposición.",
    };
  }
  const rawKelly = Math.max(0, kellyFraction(input.odds, input.probability));
  if (rawKelly <= 0) {
    return {
      kellyFraction: rawKelly,
      suggestedStakeUnits: 0,
      suggestedStakePercent: input.bankroll ? 0 : null,
      suggestedStakeAmount: input.bankroll ? 0 : null,
      label: "No recomendado",
      reason: "Kelly fraccional no positivo; stake sugerido cero.",
    };
  }

  const variance = stakeVarianceAdjustment(input);
  const cappedPercent = Math.min(rawKelly * rules.kellyMultiplier * variance.factor, variance.maxPercent, rules.maxStakePercent);
  const units = roundUnits(cappedPercent / 0.01);
  const amount = input.bankroll ? +(input.bankroll * cappedPercent).toFixed(2) : null;
  const varianceReason = variance.reasons.length
    ? ` Stake reducido por alta varianza: ${variance.reasons.join(", ")}.`
    : "";

  return {
    kellyFraction: rawKelly,
    suggestedStakeUnits: units,
    suggestedStakePercent: input.bankroll ? cappedPercent : null,
    suggestedStakeAmount: amount,
    label: amount == null ? `${units.toFixed(2).replace(/\.00$/, "")}u` : `${amount}`,
    reason: `Kelly fraccional aplicado con cap de ${(Math.min(variance.maxPercent, rules.maxStakePercent) * 100).toFixed(2)}% para perfil ${input.profile}.${varianceReason}`,
  };
}

function stakeVarianceAdjustment(input: {
  odds: number;
  probability: number;
  profile: ParlayProfile;
  riskScore?: number;
  legs?: number;
  correlationLevel?: CorrelationLevel;
}): { factor: number; maxPercent: number; reasons: string[] } {
  let factor = 1;
  let maxPercent = STAKE_RULES[input.profile].maxStakePercent;
  const reasons: string[] = [];

  if ((input.riskScore ?? 0) >= 80) {
    factor *= input.profile === "aggressive" ? 0.55 : 0.7;
    reasons.push("riskScore alto");
  }
  if (input.odds > 15) {
    factor *= 0.65;
    maxPercent = Math.min(maxPercent, 0.01);
    reasons.push("cuota total elevada");
  }
  if (input.odds > 25) {
    factor *= 0.5;
    maxPercent = Math.min(maxPercent, 0.0075);
    reasons.push("cuota total mayor a 25");
  }
  if ((input.legs ?? 0) >= 5) {
    factor *= 0.55;
    maxPercent = Math.min(maxPercent, 0.0075);
    reasons.push(`${input.legs} selecciones`);
  }
  if (input.probability < 0.07) {
    factor *= 0.6;
    maxPercent = Math.min(maxPercent, 0.0075);
    reasons.push("probabilidad conjunta baja");
  }
  if (input.correlationLevel === "high") {
    factor *= 0.75;
    reasons.push("correlación alta");
  }

  return { factor, maxPercent, reasons };
}
