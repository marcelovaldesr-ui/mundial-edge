import type { DixonColesRho } from "./dixon-coles";
import type { ExpectedGoalsRatingModel } from "./expected-goals";

export type StatModelVariant = "legacy-neutral" | "xg-v2.1-prior8" | "experimental-dixon-coles";
export type StatModelVariantStatus = "production" | "candidate" | "experimental";

export interface StatModelVariantConfig {
  id: StatModelVariant;
  status: StatModelVariantStatus;
  expectedGoalsRatingModel: ExpectedGoalsRatingModel;
  priorStrength: 8 | null;
  neutralVenue: true;
  dixonColesRho: DixonColesRho | null;
  recommended: boolean;
  notRecommended: boolean;
}

export const DEFAULT_STAT_MODEL_VARIANT: StatModelVariant = "legacy-neutral";
export const STAT_MODEL_FEATURE_FLAG = "STAT_MODEL_VARIANT";

export const STAT_MODEL_VARIANTS: Record<StatModelVariant, StatModelVariantConfig> = {
  "legacy-neutral": {
    id: "legacy-neutral", status: "production", expectedGoalsRatingModel: "legacy_v1",
    priorStrength: null, neutralVenue: true, dixonColesRho: null, recommended: false, notRecommended: false,
  },
  "xg-v2.1-prior8": {
    id: "xg-v2.1-prior8", status: "candidate", expectedGoalsRatingModel: "attack_defense_v2",
    priorStrength: 8, neutralVenue: true, dixonColesRho: null, recommended: true, notRecommended: false,
  },
  "experimental-dixon-coles": {
    id: "experimental-dixon-coles", status: "experimental", expectedGoalsRatingModel: "attack_defense_v2",
    priorStrength: 8, neutralVenue: true, dixonColesRho: -0.15, recommended: false, notRecommended: true,
  },
};

/** Resolves an explicit feature-flag value; invalid or absent values fail closed to Legacy. */
export function resolveStatModelVariant(value?: string | null): StatModelVariantConfig {
  if (value && Object.prototype.hasOwnProperty.call(STAT_MODEL_VARIANTS, value)) {
    return STAT_MODEL_VARIANTS[value as StatModelVariant];
  }
  return STAT_MODEL_VARIANTS[DEFAULT_STAT_MODEL_VARIANT];
}

/** Server-side feature flag resolver. An explicit option wins over STAT_MODEL_VARIANT. */
export function getActiveStatModelVariant(
  explicitValue?: string | null,
  environmentValue: string | undefined = process.env[STAT_MODEL_FEATURE_FLAG]
): StatModelVariantConfig {
  return resolveStatModelVariant(explicitValue ?? environmentValue);
}
