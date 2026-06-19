import { applyDixonColesAdjustment, type DixonColesRho } from "./dixon-coles";
import { deriveMarketProbabilities } from "./market-probabilities";
import type { ModelMarketProbability, StatSelectionKey } from "./market-types";
import { createScoreMatrix, poissonProbability } from "./score-matrix";

export const EXPLAINED_MARKETS = [
  "home_win",
  "draw",
  "away_win",
  "over_2_5",
  "under_2_5",
  "btts_yes",
  "btts_no",
] as const satisfies readonly StatSelectionKey[];

export type ExplainedMarketSelection = (typeof EXPLAINED_MARKETS)[number];

export interface ProbabilityInterval {
  selection: ExplainedMarketSelection;
  point: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface MarketProbabilityIntervals {
  method: "parametric-lambda-bootstrap-lognormal-v1";
  samples: number;
  percentileRange: "P10-P90";
  lambdaSigma: { home: number; away: number };
  intervals: ProbabilityInterval[];
}

export interface ProbabilityIntervalsInput {
  lambdaHome: number;
  lambdaAway: number;
  homeGamesPlayed: number;
  awayGamesPlayed: number;
  priorWeight: number;
  confidence: "low" | "medium" | "high";
  pointProbabilities: ModelMarketProbability[];
  seed: string | number;
  samples?: number;
  maxGoals?: number;
  dixonColesRho?: DixonColesRho | null;
}

/** Deterministic parametric bootstrap around the production lambdas. */
export function calculateMarketProbabilityIntervals(input: ProbabilityIntervalsInput): MarketProbabilityIntervals {
  const samples = Math.max(200, Math.floor(input.samples ?? 600));
  const random = mulberry32(typeof input.seed === "number" ? input.seed : hashSeed(input.seed));
  const sigma = {
    home: lambdaSigma(input.homeGamesPlayed, input.priorWeight, input.confidence),
    away: lambdaSigma(input.awayGamesPlayed, input.priorWeight, input.confidence),
  };
  const distributions = Object.fromEntries(EXPLAINED_MARKETS.map((selection) => [selection, [] as number[]])) as Record<ExplainedMarketSelection, number[]>;

  for (let index = 0; index < samples; index += 1) {
    const lambdaHome = lognormalMeanPreserving(input.lambdaHome, sigma.home, standardNormal(random));
    const lambdaAway = lognormalMeanPreserving(input.lambdaAway, sigma.away, standardNormal(random));
    const probabilities = sampledProbabilities(lambdaHome, lambdaAway, input.maxGoals ?? 12, input.dixonColesRho);
    for (const selection of EXPLAINED_MARKETS) {
      distributions[selection].push(probabilities[selection]);
    }
  }

  const pointBySelection = new Map(input.pointProbabilities.map((row) => [row.selection, row.probability]));
  const intervals = EXPLAINED_MARKETS.map((selection): ProbabilityInterval => {
    const sorted = distributions[selection].sort((a, b) => a - b);
    const point = pointBySelection.get(selection) ?? percentile(sorted, 0.5);
    return {
      selection,
      point,
      p10: Math.min(point, percentile(sorted, 0.10)),
      p50: percentile(sorted, 0.50),
      p90: Math.max(point, percentile(sorted, 0.90)),
    };
  });

  return {
    method: "parametric-lambda-bootstrap-lognormal-v1",
    samples,
    percentileRange: "P10-P90",
    lambdaSigma: sigma,
    intervals,
  };
}

function sampledProbabilities(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals: number,
  rho?: DixonColesRho | null
): Record<ExplainedMarketSelection, number> {
  if (rho != null) {
    const poisson = createScoreMatrix({ homeExpectedGoals: lambdaHome, awayExpectedGoals: lambdaAway, maxGoals });
    const rows = deriveMarketProbabilities(applyDixonColesAdjustment(poisson, rho).matrix);
    return Object.fromEntries(EXPLAINED_MARKETS.map((selection) => [
      selection,
      rows.find((row) => row.selection === selection)?.probability ?? 0,
    ])) as Record<ExplainedMarketSelection, number>;
  }

  const home = Array.from({ length: maxGoals + 1 }, (_, goals) => poissonProbability(lambdaHome, goals));
  const away = Array.from({ length: maxGoals + 1 }, (_, goals) => poissonProbability(lambdaAway, goals));
  const mass = home.reduce((sum, value) => sum + value, 0) * away.reduce((sum, value) => sum + value, 0);
  const result: Record<ExplainedMarketSelection, number> = {
    home_win: 0, draw: 0, away_win: 0,
    over_2_5: 0, under_2_5: 0,
    btts_yes: 0, btts_no: 0,
  };
  for (let homeGoals = 0; homeGoals <= maxGoals; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= maxGoals; awayGoals += 1) {
      const probability = (home[homeGoals] * away[awayGoals]) / mass;
      if (homeGoals > awayGoals) result.home_win += probability;
      else if (homeGoals === awayGoals) result.draw += probability;
      else result.away_win += probability;
      if (homeGoals + awayGoals >= 3) result.over_2_5 += probability;
      else result.under_2_5 += probability;
      if (homeGoals > 0 && awayGoals > 0) result.btts_yes += probability;
      else result.btts_no += probability;
    }
  }
  return result;
}

function lambdaSigma(gamesPlayed: number, priorWeight: number, confidence: ProbabilityIntervalsInput["confidence"]): number {
  const samplePenalty = 1 - Math.min(Math.max(gamesPlayed, 0), 6) / 6;
  const confidencePenalty = confidence === "low" ? 0.05 : confidence === "medium" ? 0.02 : 0;
  return clamp(0.13 + samplePenalty * 0.16 + clamp(priorWeight, 0, 1) * 0.10 + confidencePenalty, 0.12, 0.44);
}

function lognormalMeanPreserving(mean: number, sigma: number, normal: number): number {
  return clamp(mean * Math.exp(sigma * normal - sigma * sigma / 2), 0.05, 6);
}

function standardNormal(random: () => number): number {
  const u1 = Math.max(random(), Number.EPSILON);
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function percentile(sorted: number[], quantile: number): number {
  const position = (sorted.length - 1) * quantile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
