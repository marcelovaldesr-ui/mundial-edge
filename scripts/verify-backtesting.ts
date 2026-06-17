import assert from "node:assert/strict";
import { calculateBacktestMetrics, brierScore, logLoss } from "../src/lib/backtesting/scoring";
import { calculateProfitLoss, createPredictionSnapshot } from "../src/lib/backtesting/prediction-snapshot";

assert.equal(calculateProfitLoss("win", 2.5, 1), 1.5);
assert.equal(calculateProfitLoss("loss", 2.5, 1), -1);
assert.equal(calculateProfitLoss("push", 2.5, 1), 0);
assert.equal(calculateProfitLoss("unknown", 2.5, 1), null);

const rows = [
  { probability: 0.7, actual: true },
  { probability: 0.4, actual: false },
];
const brier = brierScore(rows);
const loss = logLoss(rows);
assert(brier != null && brier > 0 && brier < 0.3);
assert(loss != null && loss > 0);

const snapshots = [
  createPredictionSnapshot({
    matchId: "m1",
    market: "1x2",
    selection: "home",
    odds: 2,
    impliedProbability: 0.5,
    poissonProbability: 0.58,
    marketProbability: 0.5,
    finalProbability: 0.56,
    confidence: "medium",
    edge: 0.06,
    expectedValue: 0.12,
    timestamp: "2026-06-17T00:00:00Z",
    matchStatusAtPrediction: "scheduled",
    resultStatus: "finished",
    outcomeResult: "win",
  }),
  createPredictionSnapshot({
    matchId: "m2",
    market: "1x2",
    selection: "away",
    odds: 2.2,
    impliedProbability: 0.45,
    poissonProbability: 0.5,
    marketProbability: 0.45,
    finalProbability: 0.52,
    confidence: "medium",
    edge: 0.07,
    expectedValue: 0.14,
    timestamp: "2026-06-17T00:00:00Z",
    matchStatusAtPrediction: "scheduled",
    resultStatus: "finished",
    outcomeResult: "loss",
  }),
];

const metrics = calculateBacktestMetrics(snapshots);
assert.equal(metrics.count, 2);
assert(metrics.brierScore != null);
assert(metrics.logLoss != null);
assert.equal(metrics.hitRate, 0.5);
assert(metrics.warnings.some((warning) => warning.includes("Muestra insuficiente")));
assert(metrics.calibrationBuckets.some((bucket) => bucket.label === "50-60%" && bucket.count === 2));

console.log("Backtesting verification passed");
