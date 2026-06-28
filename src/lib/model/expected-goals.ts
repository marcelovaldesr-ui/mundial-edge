import type { TeamStats } from "../types";

// ─── Estimación de goles esperados (lambda) por equipo ───────────
// Combina, de forma transparente y ponderable:
//   - goles a favor / en contra por partido
//   - diferencia de gol
//   - forma reciente
//   - fuerza relativa del rival
// Sobre una línea base de goles del torneo, más ventaja de localía.

export interface XgInput {
  home: TeamStats;
  away: TeamStats;
  /** media de goles por equipo y partido del torneo (línea base) */
  leagueAvgGoals?: number;
  /** multiplicador de ventaja de localía (1.0 = neutral, típico Mundial) */
  homeAdvantage?: number;
}

export interface XgResult {
  lambdaHome: number;
  lambdaAway: number;
}

const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));

/** Convierte forma reciente (W/D/L) en un factor multiplicativo ~[0.85, 1.15]. */
export function formFactor(form: ("W" | "D" | "L")[]): number {
  if (!form.length) return 1;
  const pts = form.map((r) => (r === "W" ? 3 : r === "D" ? 1 : 0));
  // ponderación decreciente: el partido más reciente pesa más
  let num = 0, den = 0;
  pts.forEach((p, i) => {
    const w = Math.pow(0.7, i);
    num += p * w;
    den += 3 * w;
  });
  const ratio = den ? num / den : 0.5; // 0..1
  return clamp(0.85 + ratio * 0.3, 0.85, 1.15);
}

export function expectedGoals(input: XgInput): XgResult {
  const leagueAvg = input.leagueAvgGoals ?? 1.35;
  const homeAdv = input.homeAdvantage ?? 1.07;
  const { home, away } = input;

  // Fuerzas de ataque y defensa relativas a la media (estilo Maher/Dixon-Coles)
  const homeAttack = (home.gf_per_game || leagueAvg) / leagueAvg;
  const homeDefense = (home.ga_per_game || leagueAvg) / leagueAvg;
  const awayAttack = (away.gf_per_game || leagueAvg) / leagueAvg;
  const awayDefense = (away.ga_per_game || leagueAvg) / leagueAvg;

  // Ajuste por diferencia de gol acumulada (señal de calidad sostenida)
  const gdHome = 1 + clamp(home.goal_diff, -15, 15) / 100;
  const gdAway = 1 + clamp(away.goal_diff, -15, 15) / 100;

  // Forma reciente
  const formHome = formFactor(home.recent_form);
  const formAway = formFactor(away.recent_form);

  // lambda = base * ataque propio * defensa rival * forma * gd * localía
  let lambdaHome =
    leagueAvg * homeAttack * awayDefense * formHome * gdHome * homeAdv;
  let lambdaAway =
    leagueAvg * awayAttack * homeDefense * formAway * gdAway;

  lambdaHome = clamp(lambdaHome, 0.2, 4.5);
  lambdaAway = clamp(lambdaAway, 0.2, 4.5);

  return { lambdaHome, lambdaAway };
}
