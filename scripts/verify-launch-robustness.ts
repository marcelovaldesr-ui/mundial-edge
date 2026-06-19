import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getRecommendedPredictionConfig } from "../src/lib/stat-model/prediction-config";
import { maxParlaysPerRequest, minimumConfidenceFilter, minimumEdgeDefault, simulationIterations } from "../src/lib/config/runtime";
import { edgeToParlayPick, generateParlays } from "../src/lib/parlays";
import { buildLaunchPredictions, createLaunchRehearsalFixtures, createSyntheticMarketIntegration } from "./e2e/fixtures";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const config = getRecommendedPredictionConfig();
assert(config.modelVariant === "calibrated-matrix" && config.calibration === "none", "Recommended production config must be calibrated-matrix T=0.65.");
assert(simulationIterations() === 10_000, "Production simulation fallback must be 10,000.");
assert(minimumEdgeDefault() === 0.02 && minimumConfidenceFilter() === "low" && maxParlaysPerRequest() === 50, "Launch filter defaults are incorrect.");

const fixtures = createLaunchRehearsalFixtures();
assert(fixtures.teamStats.every((row) => row.matches_played === 0), "Robustness fixture must emulate jornada 1 without recent data.");
const predictions = buildLaunchPredictions(fixtures);
assert(predictions.every((row) => row.homeExpectedGoals >= 0.2 && row.homeExpectedGoals <= 4.5 && row.awayExpectedGoals >= 0.2 && row.awayExpectedGoals <= 4.5), "Rating-only xG must remain within guardrails.");
assert(predictions.every((row) => row.homeRating != null && row.awayRating != null), "Rating-only fallback must resolve a rating for every rehearsal team.");
assert(predictions.every((row) => row.marketProbabilities.every((market) => market.probability >= 0 && market.probability <= 1)), "Rating-only probabilities must be bounded.");

const integration = createSyntheticMarketIntegration(fixtures, predictions);
const noOpportunities = generateParlays(integration.edges.map(edgeToParlayPick), {
  profile: "balanced",
  minEdge: 0.20,
  allowLowConfidence: true,
  maxResults: 50,
  now: "2026-06-01T00:00:00.000Z",
});
assert(noOpportunities.length === 0, "Extreme edge filter should return an empty result, not throw.");

const edgeUi = readFileSync(resolve("src/components/edge-table.tsx"), "utf8");
assert(edgeUi.includes("No se encontraron oportunidades con esos filtros."), "Edge UI requires a friendly empty state.");
const groupUi = readFileSync(resolve("src/components/world-cup-groups-simulation.tsx"), "utf8");
assert(groupUi.includes('role="tablist"') && groupUi.includes("QualificationBadge"), "Group UI must expose group tabs and qualification badges.");
const detailUi = readFileSync(resolve("src/components/poisson-model-card.tsx"), "utf8");
assert(detailUi.includes("PredictionExplainability"), "Match UI must include waterfall, confidence intervals and explanation.");
const transparencyUi = readFileSync(resolve("src/app/transparencia/page.tsx"), "utf8");
assert(transparencyUi.includes("ReliabilityChart") && transparencyUi.includes("Desglose por Mundial"), "Transparency UI is incomplete.");

for (const path of ["data/e2e/group-stage-predictions.json", "data/e2e/simulation-results.json", "data/perf/performance-report.json", "data/calibration-report.json"]) {
  JSON.parse(readFileSync(resolve(path), "utf8"));
}
const productionEnv = readFileSync(resolve(".env.production.example"), "utf8");
for (const expected of ["STAT_MODEL_VARIANT=calibrated-matrix", "CALIBRATION_TEMPERATURE=0.65", "SIMULATION_ITERATIONS=10000", "MIN_EDGE_DEFAULT=0.02", "MIN_CONFIDENCE_FILTER=low", "MAX_PARLAYS_PER_REQUEST=50"]) {
  assert(productionEnv.includes(expected), `Missing production env setting: ${expected}`);
}

console.log("Launch robustness verification passed");
