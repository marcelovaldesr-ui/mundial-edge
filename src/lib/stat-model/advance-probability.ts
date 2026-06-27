import type { ScoreMatrix } from "./score-matrix";

// ─── Mercado "Clasifica" (P0.3) ─────────────────────────────────
// En eliminatorias el resultado final no es 1X2 a 90': si hay empate a 90'
// se define en prórroga/penaltis. Derivamos P(equipo avanza) de la matriz de
// 90 minutos + un reparto del empate. NO es una cuota real: se marca como
// estimada. P(avanza) = P(gana 90') + P(empate 90') · P(avanza en ET/penaltis).

export interface AdvanceProbabilityInput {
  homeRating?: number | null;
  awayRating?: number | null;
}

export interface AdvanceProbabilityResult {
  win90Home: number;
  draw90: number;
  win90Away: number;
  /** P(local avanza | empate a 90'); penaltis ~ moneda al aire, leve sesgo por rating. */
  extraTimeHomeShare: number;
  homeAdvance: number;
  awayAdvance: number;
  estimatedHomeOdds: number;
  estimatedAwayOdds: number;
  source: "derived_from_90min_matrix";
  estimated: true;
}

export function calculateAdvanceProbability(
  matrix: ScoreMatrix,
  input: AdvanceProbabilityInput = {}
): AdvanceProbabilityResult {
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  for (const entry of matrix.entries) {
    if (entry.homeGoals > entry.awayGoals) pHome += entry.probability;
    else if (entry.homeGoals < entry.awayGoals) pAway += entry.probability;
    else pDraw += entry.probability;
  }
  const total = pHome + pDraw + pAway || 1;
  pHome /= total;
  pDraw /= total;
  pAway /= total;

  // Reparto del empate: prior 50/50 encogido hacia 0.5 (50%) para no sobrevender,
  // y acotado a [0.35, 0.65] porque los penaltis son casi azar.
  const rh = input.homeRating ?? null;
  const ra = input.awayRating ?? null;
  let extraTimeHomeShare = 0.5;
  if (rh != null && ra != null && rh + ra > 0) {
    const ratingShare = rh / (rh + ra);
    extraTimeHomeShare = 0.5 + (ratingShare - 0.5) * 0.5;
  }
  extraTimeHomeShare = Math.min(0.65, Math.max(0.35, extraTimeHomeShare));

  const homeAdvance = pHome + pDraw * extraTimeHomeShare;
  const awayAdvance = pAway + pDraw * (1 - extraTimeHomeShare);

  return {
    win90Home: pHome,
    draw90: pDraw,
    win90Away: pAway,
    extraTimeHomeShare,
    homeAdvance,
    awayAdvance,
    estimatedHomeOdds: homeAdvance > 0 ? 1 / homeAdvance : 0,
    estimatedAwayOdds: awayAdvance > 0 ? 1 / awayAdvance : 0,
    source: "derived_from_90min_matrix",
    estimated: true,
  };
}
