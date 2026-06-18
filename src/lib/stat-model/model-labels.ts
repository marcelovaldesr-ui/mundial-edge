import type { PredictionConfigSource } from "./prediction-config";
import type { StatModelCalibrationMode } from "./calibration-presets";
import type { StatModelVariant } from "./model-variant";

export function modelVariantLabel(variant: StatModelVariant): string {
  if (variant === "legacy-neutral") return "Legacy neutral";
  if (variant === "xg-v2.1-prior8") return "xG v2.1 prior8";
  if (variant === "xg-v2.2-mismatch-spread") return "xG v2.2 mismatch spread";
  return "Dixon-Coles experimental";
}

export function calibrationLabel(calibration: StatModelCalibrationMode): string {
  if (calibration === "none") return "sin calibración";
  if (calibration === "platt-blend-25") return "calibración conservadora";
  if (calibration === "experimental-platt") return "Platt experimental";
  return calibration;
}

export function modelConfigurationLabel(
  variant: StatModelVariant,
  calibration: StatModelCalibrationMode
): string {
  return `${modelVariantLabel(variant)} + ${calibrationLabel(calibration)}`;
}

export function configSourceLabel(source: PredictionConfigSource): string {
  if (source === "recommended") return "configuración recomendada";
  if (source === "default") return "configuración global por defecto";
  return "override explícito";
}

export function dataSourceLabel(source: string): string {
  if (source === "poisson-v1") return "pipeline persistido";
  if (source === "mock-dataset-v1") return "dataset local ilustrativo";
  return source || "sin fuente informada";
}
