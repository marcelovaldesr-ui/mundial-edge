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
}

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
