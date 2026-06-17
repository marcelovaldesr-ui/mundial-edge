import type { PredictionSnapshot } from "./prediction-snapshot";

export interface CalibrationBucket {
  label: string;
  min: number;
  max: number;
  count: number;
  averageProbability: number | null;
  hitRate: number | null;
}

export interface BacktestMetrics {
  count: number;
  brierScore: number | null;
  logLoss: number | null;
  hitRate: number | null;
  roi: number | null;
  yield: number | null;
  averageEdge: number | null;
  calibrationBuckets: CalibrationBucket[];
  warnings: string[];
}

const EPS = 0.000001;

export function brierScore(rows: Array<{ probability: number; actual: boolean }>): number | null {
  if (!rows.length) return null;
  return average(rows.map((row) => Math.pow(row.probability - (row.actual ? 1 : 0), 2)));
}

export function logLoss(rows: Array<{ probability: number; actual: boolean }>): number | null {
  if (!rows.length) return null;
  return average(rows.map((row) => {
    const p = Math.max(EPS, Math.min(1 - EPS, row.probability));
    return -(row.actual ? Math.log(p) : Math.log(1 - p));
  }));
}

export function calculateBacktestMetrics(snapshots: PredictionSnapshot[]): BacktestMetrics {
  const settled = snapshots.filter((row) => row.outcomeResult === "win" || row.outcomeResult === "loss");
  const binary = settled.map((row) => ({ probability: row.finalProbability, actual: row.outcomeResult === "win" }));
  const profitRows = snapshots.filter((row) => row.profitLoss != null);
  const totalProfit = profitRows.reduce((sum, row) => sum + (row.profitLoss ?? 0), 0);
  const averageEdge = averageOrNull(snapshots.map((row) => row.edge).filter((value): value is number => value != null));
  const warnings: string[] = [];
  if (settled.length < 30) warnings.push("Muestra insuficiente para calibración fiable.");

  return {
    count: settled.length,
    brierScore: brierScore(binary),
    logLoss: logLoss(binary),
    hitRate: settled.length ? settled.filter((row) => row.outcomeResult === "win").length / settled.length : null,
    roi: profitRows.length ? totalProfit / profitRows.length : null,
    yield: profitRows.length ? totalProfit / profitRows.length : null,
    averageEdge,
    calibrationBuckets: calibrationBuckets(snapshots),
    warnings,
  };
}

export function calibrationBuckets(snapshots: PredictionSnapshot[]): CalibrationBucket[] {
  const ranges = [
    { label: "50-60%", min: 0.5, max: 0.6 },
    { label: "60-70%", min: 0.6, max: 0.7 },
    { label: "70-80%", min: 0.7, max: 0.8 },
    { label: "80-90%", min: 0.8, max: 0.9 },
  ];
  return ranges.map((range) => {
    const rows = snapshots.filter((row) => row.finalProbability >= range.min && row.finalProbability < range.max && (row.outcomeResult === "win" || row.outcomeResult === "loss"));
    return {
      ...range,
      count: rows.length,
      averageProbability: averageOrNull(rows.map((row) => row.finalProbability)),
      hitRate: rows.length ? rows.filter((row) => row.outcomeResult === "win").length / rows.length : null,
    };
  });
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageOrNull(values: number[]): number | null {
  return values.length ? average(values) : null;
}
