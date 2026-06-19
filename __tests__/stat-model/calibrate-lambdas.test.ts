import test from "node:test";
import assert from "node:assert/strict";
import { applyTemperature } from "../../src/lib/stat-model/calibrate-lambdas";

test("T=1 preserves ordinary lambdas", () => {
  assert.deepEqual(applyTemperature(1.6, 1.1, 1), { lambdaHomeCal: 1.6, lambdaAwayCal: 1.1 });
});

test("T<1 expands the absolute lambda difference", () => {
  const result = applyTemperature(1.6, 1.1, 0.8);
  assert.ok(Math.abs(result.lambdaHomeCal - result.lambdaAwayCal) > 0.5);
});

test("calibrated lambdas never become negative or zero", () => {
  const result = applyTemperature(0, 0.05, 1.5);
  assert.ok(result.lambdaHomeCal >= 0.1 && result.lambdaAwayCal >= 0.1);
});
