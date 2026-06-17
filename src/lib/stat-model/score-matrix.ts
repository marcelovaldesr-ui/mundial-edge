export interface ScoreMatrixEntry {
  homeGoals: number;
  awayGoals: number;
  probability: number;
}

export interface ScoreMatrix {
  entries: ScoreMatrixEntry[];
  maxGoals: number;
  homeExpectedGoals: number;
  awayExpectedGoals: number;
  rawMass: number;
  tailProbability: number;
  normalized: boolean;
  version: "poisson-independent-v1";
}

export interface CreateScoreMatrixInput {
  homeExpectedGoals: number;
  awayExpectedGoals: number;
  maxGoals?: number;
  normalize?: boolean;
}

export function poissonProbability(lambda: number, goals: number): number {
  assertValidLambda(lambda);
  if (!Number.isInteger(goals) || goals < 0) return 0;
  if (lambda === 0) return goals === 0 ? 1 : 0;
  return (Math.exp(-lambda) * Math.pow(lambda, goals)) / factorial(goals);
}

export function createScoreMatrix(input: CreateScoreMatrixInput): ScoreMatrix {
  const maxGoals = input.maxGoals ?? 10;
  if (!Number.isInteger(maxGoals) || maxGoals < 1 || maxGoals > 30) {
    throw new RangeError("maxGoals must be an integer between 1 and 30.");
  }
  assertValidLambda(input.homeExpectedGoals);
  assertValidLambda(input.awayExpectedGoals);

  const normalize = input.normalize ?? true;
  const entries: ScoreMatrixEntry[] = [];
  let rawMass = 0;

  for (let homeGoals = 0; homeGoals <= maxGoals; homeGoals++) {
    const homeProb = poissonProbability(input.homeExpectedGoals, homeGoals);
    for (let awayGoals = 0; awayGoals <= maxGoals; awayGoals++) {
      const probability = homeProb * poissonProbability(input.awayExpectedGoals, awayGoals);
      rawMass += probability;
      entries.push({ homeGoals, awayGoals, probability });
    }
  }

  const divisor = normalize && rawMass > 0 ? rawMass : 1;
  return {
    entries: entries.map((entry) => ({ ...entry, probability: entry.probability / divisor })),
    maxGoals,
    homeExpectedGoals: input.homeExpectedGoals,
    awayExpectedGoals: input.awayExpectedGoals,
    rawMass,
    tailProbability: Math.max(0, 1 - rawMass),
    normalized: normalize,
    version: "poisson-independent-v1",
  };
}

export function scoreMatrixTotalProbability(matrix: ScoreMatrix): number {
  return matrix.entries.reduce((sum, entry) => sum + entry.probability, 0);
}

function assertValidLambda(lambda: number) {
  if (!Number.isFinite(lambda) || lambda < 0 || lambda > 10) {
    throw new RangeError("lambda must be finite and between 0 and 10.");
  }
}

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}
