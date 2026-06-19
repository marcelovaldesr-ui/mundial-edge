import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

interface CheckResult { name: string; command?: string; passed: boolean; durationMs: number; detail: string }

const startedAt = new Date().toISOString();
const checks: CheckResult[] = [];
const commands = [
  ["Typecheck", "typecheck"],
  ["Lint", "lint"],
  ["Unit: calibrated matrix", "test:calibrated-matrix"],
  ["Unit: best third places", "test:best-third-places"],
  ["Unit: explainability", "test:explainability"],
  ["Integration: stat model", "verify:stat-model"],
  ["Integration: prediction consumers", "verify:prediction-consumers"],
  ["Integration: parlays", "verify:parlays"],
  ["Integration: groups UI", "verify:world-cup-groups-ui-data"],
  ["Backtesting", "verify:world-cup-backtest"],
  ["Calibration report", "generate:calibration-report"],
  ["Transparency", "verify:transparency"],
  ["Full tournament E2E", "e2e:full-tournament"],
  ["Performance", "perf:launch"],
  ["Robustness", "verify:launch-robustness"],
  ["Production build", "build"],
] as const;

for (const [name, script] of commands) checks.push(runNpm(name, script));
checks.push(staticCheck("Production env template", () => {
  const source = readFileSync(resolve(".env.production.example"), "utf8");
  const required = ["STAT_MODEL_VARIANT=calibrated-matrix", "CALIBRATION_TEMPERATURE=0.65", "SIMULATION_ITERATIONS=10000", "MIN_EDGE_DEFAULT=0.02", "MIN_CONFIDENCE_FILTER=low", "MAX_PARLAYS_PER_REQUEST=50"];
  if (!required.every((value) => source.includes(value))) throw new Error("Missing one or more launch defaults.");
  return "All non-secret launch defaults documented.";
}));
checks.push(staticCheck("Generated artifacts", () => {
  const paths = ["data/calibration-report.json", "data/e2e/group-stage-predictions.json", "data/e2e/simulation-results.json", "data/perf/performance-report.json"];
  for (const path of paths) {
    if (!existsSync(resolve(path))) throw new Error(`Missing ${path}`);
    JSON.parse(readFileSync(resolve(path), "utf8"));
  }
  return `${paths.length} valid JSON artifacts.`;
}));
checks.push(staticCheck("Public transparency pages", () => {
  for (const path of ["src/app/transparencia/page.tsx", "src/app/metodologia/page.tsx"]) if (!existsSync(resolve(path))) throw new Error(`Missing ${path}`);
  return "Transparency and methodology routes exist and are included in the production build.";
}));

const passed = checks.every((check) => check.passed);
const report = {
  schemaVersion: 1,
  startedAt,
  completedAt: new Date().toISOString(),
  passed,
  checks,
  manualBeforeDeploy: [
    "Replace rated-pool-synthetic-groups-v1 with the synchronized official 48-team fixture when available in the repository.",
    "Configure Supabase, provider and CRON secrets in the deployment platform; never expose service-role/API keys with NEXT_PUBLIC_.",
    "Run Lighthouse from the production region and confirm Vercel function duration/memory with live data.",
    "Verify the first live sync and compare counts: 48 teams, 72 group matches and complete odds markets.",
  ],
};
writeJson("data/pre-launch-report.json", report);
console.table(Object.fromEntries(checks.map((check) => [check.name, check.passed ? "PASS" : "FAIL"])));
console.log(passed ? "Pre-launch automated checklist passed" : "Pre-launch checklist has failures; inspect data/pre-launch-report.json");
if (!passed) process.exitCode = 1;

function runNpm(name: string, script: string): CheckResult {
  const start = Date.now();
  const executable = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", `npm run ${script}`] : ["run", script];
  const result = spawnSync(executable, args, { cwd: process.cwd(), encoding: "utf8", stdio: "pipe" });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}\n${result.error?.message ?? ""}`.trim();
  if (output) process.stdout.write(`${output}\n`);
  return {
    name,
    command: `npm run ${script}`,
    passed: result.status === 0,
    durationMs: Date.now() - start,
    detail: result.status === 0 ? "Command completed successfully." : tail(output, 1200),
  };
}

function staticCheck(name: string, check: () => string): CheckResult {
  const start = Date.now();
  try {
    const detail = check();
    return { name, passed: true, durationMs: Date.now() - start, detail };
  } catch (error) {
    return { name, passed: false, durationMs: Date.now() - start, detail: error instanceof Error ? error.message : String(error) };
  }
}

function writeJson(path: string, value: unknown): void {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function tail(value: string, max: number): string { return value.length <= max ? value : value.slice(-max); }
