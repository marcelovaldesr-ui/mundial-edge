import assert from "node:assert/strict";
import {
  DEFAULT_STAT_MODEL_VARIANT,
  getActiveStatModelVariant,
  resolveStatModelVariant,
} from "../src/lib/stat-model/model-variant";
import {
  getDefaultPredictionConfig,
  getRecommendedPredictionConfig,
  resolvePredictionConfig,
} from "../src/lib/stat-model/prediction-config";
import { getActiveStatModelCalibration } from "../src/lib/stat-model/calibration-presets";

assert.equal(DEFAULT_STAT_MODEL_VARIANT, "legacy-neutral");
assert.equal(resolveStatModelVariant("legacy-neutral").id, "legacy-neutral");
assert.equal(resolveStatModelVariant("xg-v2.1-prior8").id, "xg-v2.1-prior8");

const v22 = resolveStatModelVariant("xg-v2.2-mismatch-spread");
assert.equal(v22.id, "xg-v2.2-mismatch-spread");
assert.equal(v22.status, "candidate");
assert.equal(v22.recommended, false);
assert.equal(v22.notRecommended, false);
assert.equal(v22.calibrationEligible, true);
assert.equal(v22.expectedGoalsRatingModel, "attack_defense_v2_mismatch_spread");
assert.equal(v22.priorStrength, 8);
assert.equal(getActiveStatModelVariant(undefined, "xg-v2.2-mismatch-spread").id, v22.id);
const previousVariantFlag = process.env.STAT_MODEL_VARIANT;
const previousCalibrationFlag = process.env.STAT_MODEL_CALIBRATION;
process.env.STAT_MODEL_VARIANT = "xg-v2.2-mismatch-spread";
process.env.STAT_MODEL_CALIBRATION = "platt-blend-25";
assert.equal(getActiveStatModelVariant().id, v22.id);
assert.equal(getActiveStatModelCalibration().id, "platt-blend-25");
if (previousVariantFlag == null) delete process.env.STAT_MODEL_VARIANT;
else process.env.STAT_MODEL_VARIANT = previousVariantFlag;
if (previousCalibrationFlag == null) delete process.env.STAT_MODEL_CALIBRATION;
else process.env.STAT_MODEL_CALIBRATION = previousCalibrationFlag;

const dixonColes = resolveStatModelVariant("experimental-dixon-coles");
assert.equal(dixonColes.status, "experimental");
assert.equal(dixonColes.recommended, false);
assert.equal(dixonColes.notRecommended, true);

assert.equal(resolveStatModelVariant("invalid-variant").id, "legacy-neutral");
assert.equal(getActiveStatModelVariant(undefined, "invalid-variant").id, "legacy-neutral");

const defaults = getDefaultPredictionConfig();
assert.equal(defaults.modelVariant, "legacy-neutral");
assert.equal(defaults.calibration, "none");

const recommended = getRecommendedPredictionConfig();
assert.equal(recommended.modelVariant, "xg-v2.1-prior8");
assert.equal(recommended.calibration, "platt-blend-25");

const v22Calibrated = resolvePredictionConfig({
  modelVariant: "xg-v2.2-mismatch-spread",
  calibration: "platt-blend-25",
});
assert.equal(v22Calibrated.modelVariant, "xg-v2.2-mismatch-spread");
assert.equal(v22Calibrated.calibration, "platt-blend-25");
assert.deepEqual(v22Calibrated.warnings, []);

console.log("Model variant verification passed");
