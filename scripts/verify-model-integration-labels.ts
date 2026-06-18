import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { getDefaultPredictionConfig, getRecommendedPredictionConfig } from "../src/lib/stat-model/prediction-config";
import { dataSourceLabel, modelConfigurationLabel } from "../src/lib/stat-model/model-labels";

const uiFiles = [...walk(resolve("src/app")), ...walk(resolve("src/components"))]
  .filter((file) => /\.(tsx|ts)$/.test(file));
const uiSource = uiFiles.map((file) => ({ file, text: readFileSync(file, "utf8") }));

assert.equal(
  uiSource.filter(({ text }) => text.includes("poisson-v1")).length,
  0,
  "Main UI must not hardcode the obsolete poisson-v1 source label."
);
assert.equal(dataSourceLabel("poisson-v1"), "pipeline persistido");

const recommended = getRecommendedPredictionConfig();
assert.equal(recommended.modelVariant, "xg-v2.1-prior8");
assert.equal(recommended.calibration, "platt-blend-25");
assert.equal(
  modelConfigurationLabel(recommended.modelVariant, recommended.calibration),
  "xG v2.1 prior8 + calibración conservadora"
);

const defaults = getDefaultPredictionConfig();
assert.equal(defaults.modelVariant, "legacy-neutral");
assert.equal(defaults.calibration, "none");
assert.equal(modelConfigurationLabel(defaults.modelVariant, defaults.calibration), "Legacy neutral + sin calibración");

const recommendedConsumers = [
  "src/app/page.tsx",
  "src/app/edges/page.tsx",
  "src/app/parlays/page.tsx",
  "src/app/matches/[id]/page.tsx",
  "src/app/stat-model/page.tsx",
];
for (const path of recommendedConsumers) {
  const text = readFileSync(resolve(path), "utf8");
  assert(text.includes("ModelMetadata"), `${path} must render effective model metadata.`);
  assert(text.includes("recommended") || text.includes("getRecommendedPredictionConfig"), `${path} must resolve the recommended configuration explicitly.`);
}

const matchesPage = readFileSync(resolve("src/app/matches/page.tsx"), "utf8");
assert(matchesPage.includes("modelo base persistido"), "Matches list must identify its persisted base model path.");

const parlayDiagnostics = readFileSync(resolve("src/components/parlay-workspace.tsx"), "utf8");
assert(parlayDiagnostics.includes("Peso mercado"), "Ensemble market percentage must be labelled as a weight.");
assert(parlayDiagnostics.includes("Prob. final"), "Final percentage must be labelled as a probability.");

for (const { file, text } of uiSource) {
  assert(!/\{\s*undefined\s*\}/.test(text), `${file} must not render undefined metadata.`);
  assert(!/>\s*(undefined|NaN)\s*</.test(text), `${file} must not expose invalid metadata text.`);
}

console.log(`Model integration label verification passed (${uiFiles.length} UI files scanned)`);

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
