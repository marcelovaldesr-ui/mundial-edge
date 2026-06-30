/**
 * Kelly Criterion — Sizing de stakes para Mundial Edge.
 *
 * Usamos 25% Kelly (fractional) para reducir varianza y proteger contra
 * errores de calibración del modelo. El cap de 3% evita ruina por picks
 * con Kelly inflado por datos escasos.
 */

export const KELLY_FRACTION = 0.25;       // 25% Kelly conservador
export const MAX_STAKE_PCT = 0.03;        // 3% máximo por pick
export const MIN_EV_FOR_STAKE = 0.03;    // EV mínimo para recomendar stake
export const HIGH_KELLY_THRESHOLD = 0.08; // Kelly > 8% → posible edge inflado

export type KellyResult = {
  kellyPct: number;      // Kelly% bruto (sin fraccionar ni capear)
  stakePct: number;      // % recomendado del bankroll (fraccionado + capeado)
  stakeAmount: number;   // Monto en $ si se provee bankroll
  isCapped: boolean;     // true si se aplicó el cap de 3%
  isHighKelly: boolean;  // true si Kelly% > 8% (posible edge inflado)
  isNoStake: boolean;    // true si EV insuficiente o Kelly negativo
  reasoning: string;     // Explicación para mostrar al usuario
};

export function computeKelly(
  ev: number,
  decimalOdds: number,
  bankroll = 0
): KellyResult {
  if (ev < MIN_EV_FOR_STAKE || decimalOdds <= 1) {
    return {
      kellyPct: 0, stakePct: 0, stakeAmount: 0,
      isCapped: false, isHighKelly: false, isNoStake: true,
      reasoning: "EV insuficiente para recomendar stake.",
    };
  }

  const kellyPct = ev / (decimalOdds - 1);
  const fractionalKelly = kellyPct * KELLY_FRACTION;
  const isCapped = fractionalKelly > MAX_STAKE_PCT;
  const stakePct = Math.min(fractionalKelly, MAX_STAKE_PCT);
  const isHighKelly = kellyPct > HIGH_KELLY_THRESHOLD;
  const stakeAmount = bankroll > 0 ? bankroll * stakePct : 0;

  const reasoning = isCapped
    ? `Kelly puro: ${(kellyPct * 100).toFixed(1)}% → capeado a ${(MAX_STAKE_PCT * 100).toFixed(0)}% por límite de riesgo`
    : `Kelly 25%: ${(fractionalKelly * 100).toFixed(1)}% del bankroll`;

  return { kellyPct, stakePct, stakeAmount, isCapped, isHighKelly, isNoStake: false, reasoning };
}

export function formatStake(result: KellyResult, bankroll: number): string {
  if (result.isNoStake) return "–";
  if (bankroll > 0) return `$${result.stakeAmount.toFixed(0)}`;
  return `${(result.stakePct * 100).toFixed(1)}%`;
}
