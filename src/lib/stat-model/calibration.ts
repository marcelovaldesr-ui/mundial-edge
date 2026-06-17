export interface AnchoredProbabilityInput {
  modelProbPoisson: number;
  marketProbNoVig: number;
  marketWeight?: number;
}

export interface AnchoredProbabilityResult {
  modelProbPoisson: number;
  marketProbNoVig: number;
  anchoredProb: number;
  marketWeight: number;
  modelWeight: number;
}

export const DEFAULT_MARKET_WEIGHT = 0.78;

export function anchorProbability(input: AnchoredProbabilityInput): AnchoredProbabilityResult {
  const marketWeight = input.marketWeight ?? DEFAULT_MARKET_WEIGHT;
  if (!isProbability(input.modelProbPoisson) || !isProbability(input.marketProbNoVig)) {
    throw new RangeError("modelProbPoisson and marketProbNoVig must be probabilities in [0, 1].");
  }
  if (marketWeight < 0 || marketWeight > 1) {
    throw new RangeError("marketWeight must be between 0 and 1.");
  }
  const modelWeight = 1 - marketWeight;
  return {
    modelProbPoisson: input.modelProbPoisson,
    marketProbNoVig: input.marketProbNoVig,
    anchoredProb: marketWeight * input.marketProbNoVig + modelWeight * input.modelProbPoisson,
    marketWeight,
    modelWeight,
  };
}

function isProbability(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
