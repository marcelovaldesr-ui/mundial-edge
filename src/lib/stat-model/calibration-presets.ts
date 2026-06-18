import type { MarketCalibrationSet } from "./market-calibration";

export type StatModelCalibrationMode = "none" | "experimental-platt";

export interface MarketCalibrationPreset {
  id: StatModelCalibrationMode;
  status: "identity" | "experimental";
  source: "identity" | "manual-full-corpus-fit";
  description: string;
  calibration: MarketCalibrationSet;
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
};

export function resolveStatModelCalibration(value?: string | null): MarketCalibrationPreset {
  return value === "experimental-platt"
    ? XG_V21_PRIOR8_EXPERIMENTAL_PLATT_PRESET
    : IDENTITY_CALIBRATION_PRESET;
}

export function getActiveStatModelCalibration(
  explicitValue?: string | null,
  environmentValue: string | undefined = process.env[STAT_MODEL_CALIBRATION_FLAG]
): MarketCalibrationPreset {
  return resolveStatModelCalibration(explicitValue ?? environmentValue);
}
