import type { WorldCupGroupContext } from "../world-cup/group-context";
import type { ScoreMatrix } from "./score-matrix";

export type PredictionConfidenceLabel = "low" | "medium" | "high";

export interface PredictionConfidenceInput {
  probabilities: { home: number; draw: number; away: number };
  homeGamesPlayed: number;
  awayGamesPlayed: number;
  /** Share from 0..1 attributed to the Bayesian/rating prior rather than observed matches. */
  priorWeight: number;
  scoreMatrix: ScoreMatrix;
  modelWarnings?: string[];
  homeRatingFallback?: boolean;
  awayRatingFallback?: boolean;
  groupContext?: WorldCupGroupContext;
}

export interface ConfidenceResult {
  score: number;
  label: PredictionConfidenceLabel;
  drivers: string[];
  warnings: string[];
}

export function calculatePredictionConfidence(input: PredictionConfidenceInput): ConfidenceResult {
  validateInput(input);
  const sorted = Object.values(input.probabilities).sort((a, b) => b - a);
  const concentration = clamp((sorted[0] - 1 / 3) / 0.37, 0, 1);
  const topMargin = clamp((sorted[0] - sorted[1]) / 0.30, 0, 1);
  const minGames = Math.min(input.homeGamesPlayed, input.awayGamesPlayed);
  const sampleStrength = clamp(minGames / 4, 0, 1);
  const observedStrength = 1 - clamp(input.priorWeight, 0, 1);
  const dispersionConfidence = 1 - normalizedEntropy(input.scoreMatrix);
  const drivers: string[] = [];
  const warnings = [...(input.modelWarnings ?? [])];

  let score = 30
    + concentration * 20
    + topMargin * 20
    + sampleStrength * 18
    + observedStrength * 7
    + dispersionConfidence * 10;

  if (sorted[0] >= 0.55) drivers.push("Probabilidad 1X2 concentrada en el pick principal.");
  else drivers.push("Distribucion 1X2 relativamente pareja.");
  if (sorted[0] - sorted[1] >= 0.12) drivers.push("Margen claro entre primera y segunda opcion.");
  if (minGames >= 4) drivers.push("Muestra observada de al menos cuatro partidos por equipo.");
  else warnings.push(`Muestra corta: minimo ${minGames} partidos observados por equipo.`);
  if (input.priorWeight >= 0.65) warnings.push("La prediccion depende fuertemente del prior.");
  else if (input.priorWeight <= 0.35) drivers.push("Peso observado suficiente frente al prior.");
  if (dispersionConfidence >= 0.35) drivers.push("Matriz de marcadores relativamente concentrada.");

  const fallbackCount = Number(Boolean(input.homeRatingFallback)) + Number(Boolean(input.awayRatingFallback));
  if (fallbackCount) {
    score -= fallbackCount * 10;
    warnings.push(fallbackCount === 2 ? "Ambos equipos usan rating fallback neutral." : "Un equipo usa rating fallback neutral.");
  }
  if (hasStrongGroupContext(input.groupContext)) {
    score -= 7;
    warnings.push("Contexto fuerte de grupos agrega incertidumbre conductual.");
  }
  const explicitWarningCount = input.modelWarnings?.length ?? 0;
  if (explicitWarningCount) score -= Math.min(15, explicitWarningCount * 4);

  score = Math.round(clamp(score, 0, 100));
  return { score, label: labelForScore(score), drivers: unique(drivers), warnings: unique(warnings) };
}

export function labelForScore(score: number): PredictionConfidenceLabel {
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new RangeError("Confidence score must be between 0 and 100.");
  if (score < 45) return "low";
  if (score < 70) return "medium";
  return "high";
}

function normalizedEntropy(matrix: ScoreMatrix): number {
  const probabilities = matrix.entries.map((entry) => entry.probability).filter((probability) => probability > 0);
  if (probabilities.length <= 1) return 0;
  const entropy = -probabilities.reduce((sum, probability) => sum + probability * Math.log(probability), 0);
  return clamp(entropy / Math.log(probabilities.length), 0, 1);
}

function hasStrongGroupContext(context?: WorldCupGroupContext): boolean {
  if (!context || context.phase !== "GROUP_STAGE") return false;
  return Object.values(context.modifiers).reduce((sum, value) => sum + Math.abs(value), 0) >= 0.05;
}

function validateInput(input: PredictionConfidenceInput): void {
  const values = Object.values(input.probabilities);
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1) || Math.abs(values.reduce((a, b) => a + b, 0) - 1) > 1e-6) {
    throw new RangeError("1X2 probabilities must be finite, non-negative and sum to 1.");
  }
  if (![input.homeGamesPlayed, input.awayGamesPlayed].every((value) => Number.isInteger(value) && value >= 0)) {
    throw new RangeError("gamesPlayed must be non-negative integers.");
  }
  if (!Number.isFinite(input.priorWeight) || input.priorWeight < 0 || input.priorWeight > 1) {
    throw new RangeError("priorWeight must be between 0 and 1.");
  }
}

function unique(values: string[]): string[] { return [...new Set(values)]; }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
