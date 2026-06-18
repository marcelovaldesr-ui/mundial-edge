import type { ConservativeCalibrationStrategy, MarketCalibrationSet } from "./market-calibration";

export type StatModelCalibrationMode =
  | "none"
  | "experimental-platt"
  | "platt-blend-25"
  | "platt-blend-50"
  | "platt-blend-75"
  | "favorite-cap-65"
  | "favorite-max-boost-08";

export interface MarketCalibrationPreset {
  id: StatModelCalibrationMode;
  status: "identity" | "experimental";
  source: "identity" | "manual-full-corpus-fit";
  description: string;
  calibration: MarketCalibrationSet;
  strategy: ConservativeCalibrationStrategy;
  /** Passed the documented conservative LOOWC selection rule; still not a production default. */
  candidate: boolean;
}

export const STAT_MODEL_CALIBRATION_FLAG = "STAT_MODEL_CALIBRATION";
export const DEFAULT_STAT_MODEL_CALIBRATION: StatModelCalibrationMode = "none";

const IDENTITY_PARAMS = Object.freeze({ a: 1, b: 0 });

export const IDENTITY_CALIBRATION_PRESET: MarketCalibrationPreset = {
  id: "none",
  status: "identity",
  source: "identity",
  description: "No-op Platt transform; production default.",
  calibration: {
    homeWin: IDENTITY_PARAMS,
    draw: IDENTITY_PARAMS,
    awayWin: IDENTITY_PARAMS,
    over25: IDENTITY_PARAMS,
    btts: IDENTITY_PARAMS,
  },
  strategy: { type: "full-platt" },
  candidate: false,
};

/**
 * Experimental/manual until the fit is promoted into a versioned training pipeline.
 * Values are updated only from the full 1998-2022 xg-v2.1-prior8 diagnostic corpus.
 */
export const XG_V21_PRIOR8_EXPERIMENTAL_PLATT_PRESET: MarketCalibrationPreset = {
  id: "experimental-platt",
  status: "experimental",
  source: "manual-full-corpus-fit",
  description: "Experimental one-vs-rest Platt calibration for xg-v2.1-prior8 1X2.",
  calibration: {
    homeWin: { a: 3.5496835990011832, b: 1.0474610337496084, epsilon: 1e-10 },
    draw: { a: 10.169770748204764, b: 10.009075226790799, epsilon: 1e-10 },
    awayWin: { a: 3.3940814460338595, b: 1.192857480261473, epsilon: 1e-10 },
  },
  strategy: { type: "full-platt" },
  candidate: false,
};

function conservativePreset(
  id: Exclude<StatModelCalibrationMode, "none" | "experimental-platt">,
  description: string,
  strategy: ConservativeCalibrationStrategy
): MarketCalibrationPreset {
  return {
    id,
    status: "experimental",
    source: "manual-full-corpus-fit",
    description,
    calibration: XG_V21_PRIOR8_EXPERIMENTAL_PLATT_PRESET.calibration,
    strategy,
    candidate: id === "platt-blend-25",
  };
}

export const CONSERVATIVE_CALIBRATION_PRESETS: MarketCalibrationPreset[] = [
  conservativePreset("platt-blend-25", "25% Platt and 75% raw prior8.", { type: "blend", blend: 0.25 }),
  conservativePreset("platt-blend-50", "50% Platt and 50% raw prior8.", { type: "blend", blend: 0.5 }),
  conservativePreset("platt-blend-75", "75% Platt and 25% raw prior8.", { type: "blend", blend: 0.75 }),
  conservativePreset("favorite-cap-65", "Apply Platt only while raw top-pick probability is below 65%.", { type: "raw-top-threshold", threshold: 0.65 }),
  conservativePreset("favorite-max-boost-08", "Cap the raw favorite probability boost at eight percentage points.", { type: "favorite-max-boost", maxBoost: 0.08 }),
];

const CALIBRATION_PRESETS = new Map<StatModelCalibrationMode, MarketCalibrationPreset>([
  [IDENTITY_CALIBRATION_PRESET.id, IDENTITY_CALIBRATION_PRESET],
  [XG_V21_PRIOR8_EXPERIMENTAL_PLATT_PRESET.id, XG_V21_PRIOR8_EXPERIMENTAL_PLATT_PRESET],
  ...CONSERVATIVE_CALIBRATION_PRESETS.map((preset): [StatModelCalibrationMode, MarketCalibrationPreset] => [preset.id, preset]),
]);

export function resolveStatModelCalibration(value?: string | null): MarketCalibrationPreset {
  return CALIBRATION_PRESETS.get(value as StatModelCalibrationMode) ?? IDENTITY_CALIBRATION_PRESET;
}

export function getActiveStatModelCalibration(
  explicitValue?: string | null,
  environmentValue: string | undefined = process.env[STAT_MODEL_CALIBRATION_FLAG]
): MarketCalibrationPreset {
  return resolveStatModelCalibration(explicitValue ?? environmentValue);
}
