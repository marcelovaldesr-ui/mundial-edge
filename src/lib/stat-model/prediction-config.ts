import {
  DEFAULT_STAT_MODEL_CALIBRATION,
  resolveStatModelCalibration,
  type StatModelCalibrationMode,
} from "./calibration-presets";
import {
  DEFAULT_STAT_MODEL_VARIANT,
  resolveStatModelVariant,
  type StatModelVariant,
} from "./model-variant";

export type PredictionConfigSource = "default" | "recommended" | "explicit-override";

export interface PredictionConfig {
  modelVariant: StatModelVariant;
  calibration: StatModelCalibrationMode;
  configSource: PredictionConfigSource;
  warnings: string[];
}

export interface PredictionConfigOverride {
  modelVariant?: StatModelVariant | string | null;
  calibration?: StatModelCalibrationMode | string | null;
}

export type PredictionConfigInput = "default" | "recommended" | PredictionConfigOverride | PredictionConfig | null | undefined;

const DEFAULT_PREDICTION_CONFIG = Object.freeze({
  modelVariant: DEFAULT_STAT_MODEL_VARIANT,
  calibration: DEFAULT_STAT_MODEL_CALIBRATION,
  configSource: "default",
  warnings: [],
} as const satisfies PredictionConfig);

const RECOMMENDED_PREDICTION_CONFIG = Object.freeze({
  modelVariant: "calibrated-matrix",
  calibration: "none",
  configSource: "recommended",
  warnings: [],
} as const satisfies PredictionConfig);

export function getDefaultPredictionConfig(): PredictionConfig {
  return { ...DEFAULT_PREDICTION_CONFIG, warnings: [] };
}

export function getRecommendedPredictionConfig(): PredictionConfig {
  return { ...RECOMMENDED_PREDICTION_CONFIG, warnings: [] };
}

/** Resolves product defaults, the recommended pair, or an explicit fail-closed override. */
export function resolvePredictionConfig(input?: PredictionConfigInput): PredictionConfig {
  if (input == null || input === "default") return getDefaultPredictionConfig();
  if (input === "recommended") return getRecommendedPredictionConfig();

  const warnings: string[] = "warnings" in input ? [...input.warnings] : [];
  const requestedVariant = input.modelVariant ?? DEFAULT_PREDICTION_CONFIG.modelVariant;
  const requestedCalibration = input.calibration ?? DEFAULT_PREDICTION_CONFIG.calibration;
  const variant = resolveStatModelVariant(requestedVariant);
  const calibration = resolveStatModelCalibration(requestedCalibration);

  if (requestedVariant !== variant.id) {
    warnings.push(`modelVariant=${String(requestedVariant)} no es valido; se uso ${variant.id}.`);
  }
  if (requestedCalibration !== calibration.id) {
    warnings.push(`calibration=${String(requestedCalibration)} no es valida; se uso ${calibration.id}.`);
  }

  const effectiveCalibration = variant.calibrationEligible ? calibration.id : "none";
  if (calibration.id !== effectiveCalibration) {
    warnings.push(`calibration=${calibration.id} no aplica a modelVariant=${variant.id}; se uso none.`);
  }
  if (variant.notRecommended) {
    warnings.push(`modelVariant=${variant.id} es experimental y no es el modelo recomendado.`);
  }

  return {
    modelVariant: variant.id,
    calibration: effectiveCalibration,
    configSource: "configSource" in input ? input.configSource : "explicit-override",
    warnings,
  };
}
