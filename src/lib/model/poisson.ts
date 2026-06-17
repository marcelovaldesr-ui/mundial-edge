// ─── Modelo Poisson simple para fútbol ───────────────────────────
// Estima la matriz de marcadores a partir de los goles esperados (xG)
// de cada equipo, y deriva probabilidades de mercados.
//
// IMPORTANTE: es un modelo INICIAL y deliberadamente simple. Sirve
// como base transparente; ver docs/POST_MVP para mejoras (Dixon-Coles,
// regresión, ratings Elo/SPI, etc.).

/** P(X = k) para una Poisson de media lambda. */
export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export interface ScoreMatrix {
  /** matrix[h][a] = P(home marca h, away marca a) */
  matrix: number[][];
  maxGoals: number;
  lambdaHome: number;
  lambdaAway: number;
}

/**
 * Construye la matriz de probabilidades de marcador asumiendo
 * independencia entre los goles de cada equipo (Poisson x Poisson).
 */
export function buildScoreMatrix(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals = 8
): ScoreMatrix {
  const matrix: number[][] = [];
  for (let h = 0; h <= maxGoals; h++) {
    matrix[h] = [];
    for (let a = 0; a <= maxGoals; a++) {
      matrix[h][a] = poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway);
    }
  }
  return { matrix, maxGoals, lambdaHome, lambdaAway };
}

export interface MarketProbabilities {
  home: number;
  draw: number;
  away: number;
  bttsYes: number;
  bttsNo: number;
  over2_5: number;
  under2_5: number;
}

/** Deriva probabilidades de mercado a partir de la matriz de marcadores. */
export function marketsFromMatrix(sm: ScoreMatrix): MarketProbabilities {
  let home = 0, draw = 0, away = 0, bttsYes = 0, over = 0;
  const { matrix, maxGoals } = sm;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = matrix[h][a];
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
      if (h > 0 && a > 0) bttsYes += p;
      if (h + a > 2.5) over += p;
    }
  }
  // Normaliza por la masa truncada (goles > maxGoals)
  const total = home + draw + away || 1;
  return {
    home: home / total,
    draw: draw / total,
    away: away / total,
    bttsYes,
    bttsNo: 1 - bttsYes,
    over2_5: over,
    under2_5: 1 - over,
  };
}
