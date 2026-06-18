export interface MarketCalibrationParams {
  /** Platt slope. Values above 1 sharpen probabilities; values below 1 soften them. */
  a: number;
  /** Platt intercept on the log-odds scale. */
  b: number;
  /** Numerical clamp used before taking a logit. */
  epsilon?: number;
}

export interface MarketCalibrationSet {
  homeWin: MarketCalibrationParams;
  draw: MarketCalibrationParams;
  awayWin: MarketCalibrationParams;
  over25?: MarketCalibrationParams;
  btts?: MarketCalibrationParams;
}

export interface OneXTwoMarketProbabilities {
  homeWin: number;
  draw: number;
  awayWin: number;
}

export interface CalibrationMetadata {
  raw: OneXTwoMarketProbabilities;
  calibratedBeforeNormalization: OneXTwoMarketProbabilities;
  /** Multiplier applied to every independently calibrated outcome. */
  normalizationFactor: number;
  strategy?: ConservativeCalibrationStrategy;
  plattCalibrated?: OneXTwoMarketProbabilities;
}

export type ConservativeCalibrationStrategy =
  | { type: "full-platt" }
  | { type: "blend"; blend: number }
  | { type: "raw-top-threshold"; threshold: number }
  | { type: "favorite-max-boost"; maxBoost: number };

export interface CalibratedMarketProbabilities extends OneXTwoMarketProbabilities {
  metadata: CalibrationMetadata;
}

const DEFAULT_EPSILON = 1e-12;

export function sigmoid(value: number): number {
  if (!Number.isFinite(value)) {
    if (value === Number.POSITIVE_INFINITY) return 1;
    if (value === Number.NEGATIVE_INFINITY) return 0;
    throw new RangeError("Sigmoid input must not be NaN.");
  }
  if (value >= 0) return 1 / (1 + Math.exp(-value));
  const exp = Math.exp(value);
  return exp / (1 + exp);
}

export function probabilityLogit(probability: number, epsilon = DEFAULT_EPSILON): number {
  assertProbability(probability);
  assertEpsilon(epsilon);
  const safe = clamp(probability, epsilon, 1 - epsilon);
  return Math.log(safe) - Math.log1p(-safe);
}

/** Pure Platt/logistic calibration for one binary market probability. */
export function calibrateMarketProbability(
  probability: number,
  params: MarketCalibrationParams
): number {
  assertParams(params);
  const calibrated = sigmoid(params.a * probabilityLogit(probability, params.epsilon) + params.b);
  if (!Number.isFinite(calibrated)) throw new RangeError("Calibration produced a non-finite probability.");
  return clamp(calibrated, 0, 1);
}

/** Calibrates one-vs-rest 1X2 probabilities and restores the simplex by normalization. */
export function calibrateOneXTwoProbabilities(
  raw: OneXTwoMarketProbabilities,
  calibrationSet: MarketCalibrationSet
): CalibratedMarketProbabilities {
  const rawValues = [raw.homeWin, raw.draw, raw.awayWin];
  rawValues.forEach(assertProbability);
  const calibratedBeforeNormalization = {
    homeWin: calibrateMarketProbability(raw.homeWin, calibrationSet.homeWin),
    draw: calibrateMarketProbability(raw.draw, calibrationSet.draw),
    awayWin: calibrateMarketProbability(raw.awayWin, calibrationSet.awayWin),
  };
  const total = calibratedBeforeNormalization.homeWin
    + calibratedBeforeNormalization.draw
    + calibratedBeforeNormalization.awayWin;
  if (!Number.isFinite(total) || total <= 0) {
    throw new RangeError("Calibrated 1X2 probabilities cannot be normalized.");
  }
  const normalizationFactor = 1 / total;
  const calibrated = {
    homeWin: calibratedBeforeNormalization.homeWin * normalizationFactor,
    draw: calibratedBeforeNormalization.draw * normalizationFactor,
    awayWin: calibratedBeforeNormalization.awayWin * normalizationFactor,
  };
  const values = [calibrated.homeWin, calibrated.draw, calibrated.awayWin];
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new RangeError("Calibrated 1X2 probabilities must be finite and in [0, 1].");
  }
  return {
    ...calibrated,
    metadata: {
      raw: { ...raw },
      calibratedBeforeNormalization,
      normalizationFactor,
    },
  };
}

/** Applies a conservative policy after the independently fitted Platt transform. */
export function applyOneXTwoCalibrationStrategy(
  raw: OneXTwoMarketProbabilities,
  calibrationSet: MarketCalibrationSet,
  strategy: ConservativeCalibrationStrategy
): CalibratedMarketProbabilities {
  const platt = calibrateOneXTwoProbabilities(raw, calibrationSet);
  let final: OneXTwoMarketProbabilities;
  if (strategy.type === "full-platt") {
    final = pickProbabilities(platt);
  } else if (strategy.type === "blend") {
    if (!Number.isFinite(strategy.blend) || strategy.blend < 0 || strategy.blend > 1) {
      throw new RangeError("Calibration blend must be in [0, 1].");
    }
    final = mapProbabilities((key) => strategy.blend * platt[key] + (1 - strategy.blend) * raw[key]);
  } else if (strategy.type === "raw-top-threshold") {
    if (!Number.isFinite(strategy.threshold) || strategy.threshold < 0 || strategy.threshold > 1) {
      throw new RangeError("Raw top threshold must be in [0, 1].");
    }
    final = maximumProbability(raw) < strategy.threshold ? pickProbabilities(platt) : { ...raw };
  } else {
    if (!Number.isFinite(strategy.maxBoost) || strategy.maxBoost < 0 || strategy.maxBoost > 1) {
      throw new RangeError("Favorite maximum boost must be in [0, 1].");
    }
    final = capFavoriteBoost(raw, platt, strategy.maxBoost);
  }
  validateSimplex(final);
  return {
    ...final,
    metadata: {
      ...platt.metadata,
      strategy,
      plattCalibrated: pickProbabilities(platt),
    },
  };
}

function assertParams(params: MarketCalibrationParams): void {
  if (!Number.isFinite(params.a) || !Number.isFinite(params.b)) {
    throw new RangeError("Calibration parameters a and b must be finite.");
  }
  assertEpsilon(params.epsilon ?? DEFAULT_EPSILON);
}

function assertProbability(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError("Probability must be finite and in [0, 1].");
  }
}

function assertEpsilon(epsilon: number): void {
  if (!Number.isFinite(epsilon) || epsilon <= 0 || epsilon >= 0.5) {
    throw new RangeError("Calibration epsilon must be finite and between 0 and 0.5.");
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type ProbabilityKey = keyof OneXTwoMarketProbabilities;
const PROBABILITY_KEYS: ProbabilityKey[] = ["homeWin", "draw", "awayWin"];

function capFavoriteBoost(
  raw: OneXTwoMarketProbabilities,
  platt: OneXTwoMarketProbabilities,
  maxBoost: number
): OneXTwoMarketProbabilities {
  const favorite = PROBABILITY_KEYS.reduce((best, key) => raw[key] > raw[best] ? key : best, "homeWin");
  const cap = Math.min(1, raw[favorite] + maxBoost);
  if (platt[favorite] <= cap) return pickProbabilities(platt);
  const excess = platt[favorite] - cap;
  const otherKeys = PROBABILITY_KEYS.filter((key) => key !== favorite);
  const otherTotal = otherKeys.reduce((sum, key) => sum + platt[key], 0);
  if (otherTotal <= 0) throw new RangeError("Cannot redistribute capped favorite probability.");
  return mapProbabilities((key) => key === favorite ? cap : platt[key] + excess * (platt[key] / otherTotal));
}

function mapProbabilities(mapper: (key: ProbabilityKey) => number): OneXTwoMarketProbabilities {
  return { homeWin: mapper("homeWin"), draw: mapper("draw"), awayWin: mapper("awayWin") };
}

function pickProbabilities(value: OneXTwoMarketProbabilities): OneXTwoMarketProbabilities {
  return { homeWin: value.homeWin, draw: value.draw, awayWin: value.awayWin };
}

function maximumProbability(value: OneXTwoMarketProbabilities): number {
  return Math.max(value.homeWin, value.draw, value.awayWin);
}

function validateSimplex(value: OneXTwoMarketProbabilities): void {
  const values = Object.values(value);
  if (values.some((probability) => !Number.isFinite(probability) || probability < 0 || probability > 1)) {
    throw new RangeError("Strategy probabilities must be finite and in [0, 1].");
  }
  if (Math.abs(values.reduce((sum, probability) => sum + probability, 0) - 1) > 1e-9) {
    throw new RangeError("Strategy probabilities must sum to 1.");
  }
}
