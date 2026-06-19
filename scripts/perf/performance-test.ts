import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { simulateWorldCup2026FromSchedules } from "../../src/lib/tournament/group-simulation-service";
import { buildLaunchPrediction, buildLaunchPredictions, createLaunchRehearsalFixtures, LAUNCH_MODEL_CONFIG } from "../e2e/fixtures";

async function main(): Promise<void> {
const fixtures = createLaunchRehearsalFixtures();
const simulationRuns: number[] = [];
for (let run = 0; run < 5; run++) {
  const start = performance.now();
  const result = simulateWorldCup2026FromSchedules({
    groups: fixtures.groups,
    simulations: 10_000,
    seed: 20260618 + run,
    modelVariant: LAUNCH_MODEL_CONFIG.modelVariant,
    calibration: LAUNCH_MODEL_CONFIG.calibration,
  });
  const advanceSum = result.groups.flatMap((group) => group.standings).reduce((sum, row) => sum + row.probabilityAdvance, 0);
  if (Math.abs(advanceSum - 32) > 0.01) throw new Error(`Performance run ${run + 1} produced invalid advancement sum.`);
  simulationRuns.push(performance.now() - start);
}

const sequentialStart = performance.now();
const sequentialPredictions = buildLaunchPredictions(fixtures);
const sequentialMs = performance.now() - sequentialStart;

const stats = new Map(fixtures.teamStats.map((row) => [row.team_id, row]));
const parallelStart = performance.now();
const parallelPredictions = await Promise.all(fixtures.matches.map(async (match) => buildLaunchPrediction(match, stats, fixtures.matches)));
const parallelMs = performance.now() - parallelStart;
if (sequentialPredictions.length !== 72 || parallelPredictions.length !== 72) throw new Error("Prediction benchmark did not produce all 72 predictions.");

const pageLoads = await measurePages(process.env.PERF_BASE_URL);
const averageSimulationMs = average(simulationRuns);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  environment: { node: process.version, platform: process.platform, architecture: process.arch },
  dataset: fixtures.dataset,
  model: LAUNCH_MODEL_CONFIG,
  monteCarlo: {
    simulationsPerRun: 10_000,
    runs: simulationRuns.map(round),
    averageMs: round(averageSimulationMs),
    thresholdMs: 5_000,
    passed: averageSimulationMs <= 5_000,
  },
  predictions: {
    matches: 72,
    sequentialMs: round(sequentialMs),
    parallelMs: round(parallelMs),
    thresholdMs: 10_000,
    passed: Math.max(sequentialMs, parallelMs) <= 10_000,
    note: "La generación es CPU-bound y síncrona; Promise.all no crea paralelismo real en un único proceso Node.",
  },
  pageLoads,
  optimizations: [
    "Las matrices de cada partido se calculan una sola vez antes de las iteraciones.",
    "Los marcadores se separan por resultado 1X2 una sola vez; no se filtran 169 celdas dentro de cada iteración.",
    "Los intervalos paramétricos usan cálculo directo para mercados cuando Dixon-Coles no está activo.",
  ],
};

writeJson("data/perf/performance-report.json", report);
console.table({
  "Monte Carlo promedio (ms)": report.monteCarlo.averageMs,
  "Predicciones secuenciales (ms)": report.predictions.sequentialMs,
  "Predicciones Promise.all (ms)": report.predictions.parallelMs,
});
if (!report.monteCarlo.passed || !report.predictions.passed) throw new Error("Performance thresholds exceeded; inspect data/perf/performance-report.json.");
console.log("Performance test passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function measurePages(baseUrl: string | undefined) {
  if (!baseUrl) {
    const previousPath = resolve("data/perf/performance-report.json");
    if (existsSync(previousPath)) {
      const previous = JSON.parse(readFileSync(previousPath, "utf8")) as { pageLoads?: { measured?: boolean; baseUrl?: string | null; pages?: unknown[] } };
      if (previous.pageLoads?.measured && previous.pageLoads.pages?.length) {
        return { ...previous.pageLoads, note: "Última medición HTTP conservada. Define PERF_BASE_URL para actualizarla." };
      }
    }
    return { measured: false, baseUrl: null, pages: [], note: "Set PERF_BASE_URL against a running production/dev server to include HTTP timings." };
  }
  const paths = ["/stat-model", "/edges", "/transparencia", "/metodologia", "/matches"];
  let matchDetailPath: string | null = null;
  for (const path of paths) {
    try {
      const warm = await fetch(new URL(path, baseUrl));
      const body = await warm.text();
      if (path === "/matches") matchDetailPath = body.match(/href="(\/matches\/[^"?#]+)"/)?.[1] ?? null;
    } catch { /* The measured request below records any failure. */ }
  }
  if (matchDetailPath) {
    paths.push(matchDetailPath);
    try { await (await fetch(new URL(matchDetailPath, baseUrl))).text(); } catch { /* Measured below. */ }
  }
  const pages = [];
  for (const path of paths) {
    const start = performance.now();
    try {
      const response = await fetch(new URL(path, baseUrl));
      const body = await response.text();
      pages.push({ path, status: response.status, durationMs: round(performance.now() - start), bytes: Buffer.byteLength(body), passed: response.ok });
    } catch (error) {
      pages.push({ path, status: 0, durationMs: round(performance.now() - start), bytes: 0, passed: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { measured: true, baseUrl, pages, note: "Tiempos HTTP locales; no sustituyen un Lighthouse desde la región de despliegue." };
}

function writeJson(path: string, value: unknown): void {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function average(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function round(value: number): number { return Math.round(value * 100) / 100; }
