import type { Edge, Market, Outcome } from "../types";
import type { MatchStatModelPrediction, StatSelectionKey } from "../stat-model";
import { isPreMatchEligible } from "../matches/pre-match-eligibility";
import { classifyEv, expectedValue } from "./edge";

export type FinalProbabilityConfidence = "low" | "medium" | "high";

export interface FinalProbabilityWeights {
  market: number;
  poisson: number;
  ratings: number;
  realStats: number;
  worldCupContext: number;
}

export interface FinalProbabilityInput {
  marketProbability?: number | null;
  poissonProbability?: number | null;
  ratingProbability?: number | null;
  realStatsProbability?: number | null;
  worldCupContextProbability?: number | null;
  decimalOdds?: number | null;
  bookmakerCount?: number;
  vigRemoved?: boolean;
  preMatchEligible?: boolean;
  poissonConfidence?: FinalProbabilityConfidence;
  realStatsMatches?: number;
  ratingSource?: string | null;
  contextWarnings?: string[];
}

export interface FinalProbabilityResult {
  finalProbability: number;
  confidence: FinalProbabilityConfidence;
  weights: FinalProbabilityWeights;
  warnings: string[];
  explanation: string;
  components: {
    marketProbability: number | null;
    poissonProbability: number | null;
    ratingProbability: number | null;
    realStatsProbability: number | null;
    worldCupContextProbability: number | null;
  };
}

export function calculateMarketProbability(decimalOdds: number): number {
  return decimalOdds > 1 && Number.isFinite(decimalOdds) ? 1 / decimalOdds : 0;
}

export function normalizeMarketProbability(probabilities: number[]): number[] {
  const clean = probabilities.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const sum = clean.reduce((acc, value) => acc + value, 0);
  return sum > 0 ? clean.map((value) => value / sum) : clean;
}

export function clampProbability(value: number, min = 0.02, max = 0.98): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(min, Math.min(max, value));
}

export function calculateProbabilityBlendWeights(input: FinalProbabilityInput): FinalProbabilityWeights {
  const hasMarket = validProbability(input.marketProbability);
  const hasPoisson = validProbability(input.poissonProbability);
  const hasRating = validProbability(input.ratingProbability);
  const hasStats = validProbability(input.realStatsProbability);
  const hasContext = validProbability(input.worldCupContextProbability);
  const lowStats = (input.realStatsMatches ?? 0) < 2;

  const raw: FinalProbabilityWeights = hasMarket
    ? {
        market: 0.56,
        poisson: hasPoisson ? 0.24 : 0,
        ratings: hasRating ? (lowStats ? 0.14 : 0.08) : 0,
        realStats: hasStats ? (lowStats ? 0.02 : 0.08) : 0,
        worldCupContext: hasContext ? 0.04 : 0,
      }
    : {
        market: 0,
        poisson: hasPoisson ? 0.45 : 0,
        ratings: hasRating ? (lowStats ? 0.32 : 0.2) : 0,
        realStats: hasStats ? (lowStats ? 0.08 : 0.25) : 0,
        worldCupContext: hasContext ? 0.08 : 0,
      };

  if (input.contextWarnings?.length) raw.worldCupContext *= 0.5;
  if (input.ratingSource === "neutral_fallback") raw.ratings *= 0.4;
  if (input.poissonConfidence === "low") raw.poisson *= 0.75;

  return normalizeWeights(raw);
}

export function calculateFinalProbability(input: FinalProbabilityInput): FinalProbabilityResult {
  const warnings: string[] = [];
  const marketProbability = validProbability(input.marketProbability) ? input.marketProbability! : null;
  const poissonProbability = validProbability(input.poissonProbability) ? input.poissonProbability! : null;
  const ratingProbability = validProbability(input.ratingProbability) ? input.ratingProbability! : null;
  const realStatsProbability = validProbability(input.realStatsProbability) ? input.realStatsProbability! : null;
  const worldCupContextProbability = validProbability(input.worldCupContextProbability) ? input.worldCupContextProbability! : null;

  if (!marketProbability) warnings.push("Sin cuota real: probabilidad de modelo, no edge apostable.");
  if (marketProbability && !input.vigRemoved) warnings.push("Probabilidad de mercado basada en cuota individual; vig no removido.");
  if (!input.preMatchEligible) warnings.push("Partido no elegible para edge pre-partido.");
  if ((input.realStatsMatches ?? 0) < 2) warnings.push("Muestra real del Mundial limitada; rating seed pesa más.");
  if (input.ratingSource === "manual_seed") warnings.push("Rating base manual usado como prior prudente.");
  if (input.contextWarnings?.length) warnings.push(...input.contextWarnings);

  const weights = calculateProbabilityBlendWeights(input);
  const weighted =
    (marketProbability ?? 0) * weights.market +
    (poissonProbability ?? 0) * weights.poisson +
    (ratingProbability ?? 0) * weights.ratings +
    (realStatsProbability ?? 0) * weights.realStats +
    (worldCupContextProbability ?? 0) * weights.worldCupContext;

  const anchored = marketProbability
    ? clampProbability(weighted, Math.max(0.02, marketProbability - 0.12), Math.min(0.98, marketProbability + 0.12))
    : clampProbability(weighted);

  return {
    finalProbability: anchored,
    confidence: getFinalProbabilityConfidence({ ...input, marketProbability, poissonProbability }),
    weights,
    warnings,
    explanation: explainFinalProbability({ ...input, marketProbability, poissonProbability }, weights),
    components: {
      marketProbability,
      poissonProbability,
      ratingProbability,
      realStatsProbability,
      worldCupContextProbability,
    },
  };
}

export function getFinalProbabilityConfidence(input: FinalProbabilityInput): FinalProbabilityConfidence {
  let score = 0;
  if (validProbability(input.marketProbability)) score += 3;
  if ((input.bookmakerCount ?? 0) >= 2) score += 1;
  if (input.vigRemoved) score += 1;
  if (validProbability(input.poissonProbability)) score += input.poissonConfidence === "high" ? 2 : input.poissonConfidence === "medium" ? 1.5 : 0.75;
  if ((input.realStatsMatches ?? 0) >= 4) score += 1.5;
  else if ((input.realStatsMatches ?? 0) >= 2) score += 1;
  if (input.ratingSource === "manual_seed") score += 0.75;
  if (input.contextWarnings?.length) score -= 1;
  if (!input.preMatchEligible) score -= 2;
  if (!validProbability(input.marketProbability) && score > 3) score = 3;
  if (score >= 5.5) return "high";
  if (score >= 2.5) return "medium";
  return "low";
}

export function explainFinalProbability(input: FinalProbabilityInput, weights: FinalProbabilityWeights): string {
  if (validProbability(input.marketProbability)) {
    return `Probabilidad final calibrada: el mercado es baseline principal (${pctWeight(weights.market)}), con ajuste prudente por Poisson, rating de selección, stats reales y contexto del Mundial.`;
  }
  return "Probabilidad de modelo sin cuota real: combina Poisson, rating de selección, stats reales y contexto del Mundial, pero no se considera edge apostable.";
}

export function decorateEdgesWithFinalProbability(
  edges: Edge[],
  predictions: MatchStatModelPrediction[]
): Edge[] {
  const predictionByMatch = new Map(predictions.map((prediction) => [prediction.matchId, prediction]));
  return edges.map((edge) => {
    const prediction = predictionByMatch.get(edge.match_id);
    const poissonProbability = prediction ? probabilityForEdge(prediction, edge.market, edge.outcome) : null;
    const hasRatings = prediction?.homeRating || prediction?.awayRating;
    const hasContext = prediction?.groupContext && Object.values(prediction.groupContext.modifiers).some((value) => value !== 0);
    const realStatsMatches = prediction
      ? Math.round(Math.min(prediction.expectedGoalsBlend.homeStatsWeight, prediction.expectedGoalsBlend.awayStatsWeight) * 5)
      : 0;
    const final = calculateFinalProbability({
      marketProbability: edge.implied_probability,
      poissonProbability,
      ratingProbability: hasRatings ? poissonProbability : null,
      realStatsProbability: realStatsMatches > 0 ? poissonProbability : null,
      worldCupContextProbability: hasContext ? poissonProbability : null,
      decimalOdds: edge.decimal_odds,
      bookmakerCount: edge.bookmaker ? 1 : 0,
      vigRemoved: true,
      preMatchEligible: isPreMatchEligible(edge.match),
      poissonConfidence: prediction?.confidence === "high" ? "high" : prediction?.confidence === "medium" ? "medium" : "low",
      realStatsMatches,
      ratingSource: prediction?.homeRating?.source ?? prediction?.awayRating?.source,
      contextWarnings: prediction?.groupContext?.warnings,
    });
    const finalExpectedValue = expectedValue(final.finalProbability, edge.decimal_odds);
    return {
      ...edge,
      final_probability: final.finalProbability,
      final_probability_confidence: final.confidence,
      final_probability_explanation: final.explanation,
      final_probability_breakdown: final,
      final_edge: final.finalProbability - edge.implied_probability,
      final_expected_value: finalExpectedValue,
      final_tier: classifyEv(finalExpectedValue),
    };
  });
}

function probabilityForEdge(prediction: MatchStatModelPrediction, market: Market, outcome: Outcome): number | null {
  const selection = selectionForEdge(market, outcome);
  if (!selection) return null;
  return prediction.marketProbabilities.find((item) => item.selection === selection)?.probability ?? null;
}

function selectionForEdge(market: Market, outcome: Outcome): StatSelectionKey | null {
  if (market === "1x2") {
    if (outcome === "home") return "home_win";
    if (outcome === "away") return "away_win";
    if (outcome === "draw") return "draw";
  }
  if (market === "btts") return outcome === "yes" ? "btts_yes" : "btts_no";
  if (market === "over_under_2_5") return outcome === "over" ? "over_2_5" : "under_2_5";
  return null;
}

function normalizeWeights(weights: FinalProbabilityWeights): FinalProbabilityWeights {
  const sum = Object.values(weights).reduce((acc, value) => acc + Math.max(0, value), 0);
  if (sum <= 0) return { market: 0, poisson: 1, ratings: 0, realStats: 0, worldCupContext: 0 };
  return {
    market: weights.market / sum,
    poisson: weights.poisson / sum,
    ratings: weights.ratings / sum,
    realStats: weights.realStats / sum,
    worldCupContext: weights.worldCupContext / sum,
  };
}

function validProbability(value: number | null | undefined): value is number {
  return Number.isFinite(value) && value != null && value > 0 && value < 1;
}

function pctWeight(value: number): string {
  return `${Math.round(value * 100)}%`;
}
