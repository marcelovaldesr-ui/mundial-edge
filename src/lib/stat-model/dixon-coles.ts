import type { ScoreMatrix, ScoreMatrixEntry } from "./score-matrix";

export const DIXON_COLES_RHO_VALUES = [-0.15, -0.10, -0.05, 0, 0.05] as const;
export type DixonColesRho = typeof DIXON_COLES_RHO_VALUES[number];

export interface DixonColesAdjustedCell {
  homeGoals: 0 | 1;
  awayGoals: 0 | 1;
  tau: number;
  probabilityBefore: number;
  probabilityAfter: number;
}

export interface DixonColesMetadata {
  rho: DixonColesRho;
  adjustedCells: DixonColesAdjustedCell[];
  normalizationFactor: number;
}

export interface DixonColesAdjustment {
  matrix: ScoreMatrix;
  metadata: DixonColesMetadata;
}

/** Applies the classic Dixon-Coles low-score correction without mutating the input matrix. */
export function applyDixonColesAdjustment(matrix: ScoreMatrix, rho: DixonColesRho): DixonColesAdjustment {
  if (!DIXON_COLES_RHO_VALUES.includes(rho)) {
    throw new RangeError(`rho must be one of ${DIXON_COLES_RHO_VALUES.join(", ")}.`);
  }
  if (rho === 0) {
    const entries = matrix.entries.map((entry) => ({ ...entry }));
    return {
      matrix: { ...matrix, entries },
      metadata: {
        rho,
        adjustedCells: lowScoreCoordinates().map(([homeGoals, awayGoals]) => {
          const entry = requiredEntry(entries, homeGoals, awayGoals);
          return { homeGoals, awayGoals, tau: 1, probabilityBefore: entry.probability, probabilityAfter: entry.probability };
        }),
        normalizationFactor: 1,
      },
    };
  }
  const adjustedBeforeNormalization = matrix.entries.map((entry) => ({
    ...entry,
    probability: correctedProbability(entry, matrix.homeExpectedGoals, matrix.awayExpectedGoals, rho),
  }));
  if (adjustedBeforeNormalization.some((entry) => !Number.isFinite(entry.probability) || entry.probability < 0)) {
    throw new RangeError("Dixon-Coles adjustment produced an invalid probability.");
  }
  const adjustedMass = adjustedBeforeNormalization.reduce((sum, entry) => sum + entry.probability, 0);
  if (!Number.isFinite(adjustedMass) || adjustedMass <= 0) {
    throw new RangeError("Dixon-Coles adjustment produced invalid probability mass.");
  }
  const normalizationFactor = 1 / adjustedMass;
  const entries = adjustedBeforeNormalization.map((entry) => ({
    ...entry,
    probability: entry.probability * normalizationFactor,
  }));
  const adjustedCells = lowScoreCoordinates().map(([homeGoals, awayGoals]) => {
    const before = requiredEntry(matrix.entries, homeGoals, awayGoals);
    const after = requiredEntry(entries, homeGoals, awayGoals);
    return {
      homeGoals,
      awayGoals,
      tau: tau(homeGoals, awayGoals, matrix.homeExpectedGoals, matrix.awayExpectedGoals, rho),
      probabilityBefore: before.probability,
      probabilityAfter: after.probability,
    };
  });
  return {
    matrix: {
      ...matrix,
      entries,
      rawMass: adjustedMass,
      tailProbability: Math.max(0, 1 - adjustedMass),
      normalized: true,
    },
    metadata: { rho, adjustedCells, normalizationFactor },
  };
}

function correctedProbability(
  entry: ScoreMatrixEntry,
  lambdaHome: number,
  lambdaAway: number,
  rho: DixonColesRho
): number {
  if (entry.homeGoals > 1 || entry.awayGoals > 1) return entry.probability;
  return entry.probability * tau(entry.homeGoals, entry.awayGoals, lambdaHome, lambdaAway, rho);
}

function tau(homeGoals: number, awayGoals: number, lambdaHome: number, lambdaAway: number, rho: DixonColesRho): number {
  if (homeGoals === 0 && awayGoals === 0) return Math.max(0, 1 - lambdaHome * lambdaAway * rho);
  if (homeGoals === 1 && awayGoals === 0) return Math.max(0, 1 + lambdaAway * rho);
  if (homeGoals === 0 && awayGoals === 1) return Math.max(0, 1 + lambdaHome * rho);
  if (homeGoals === 1 && awayGoals === 1) return Math.max(0, 1 - rho);
  return 1;
}

function lowScoreCoordinates(): Array<[0 | 1, 0 | 1]> {
  return [[0, 0], [1, 0], [0, 1], [1, 1]];
}

function requiredEntry(entries: ScoreMatrixEntry[], homeGoals: number, awayGoals: number): ScoreMatrixEntry {
  const entry = entries.find((candidate) => candidate.homeGoals === homeGoals && candidate.awayGoals === awayGoals);
  if (!entry) throw new RangeError(`Score matrix is missing ${homeGoals}-${awayGoals}.`);
  return entry;
}
