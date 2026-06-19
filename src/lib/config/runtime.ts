export type MinimumConfidence = "low" | "medium" | "high";

export function simulationIterations(): number {
  return integerEnv("SIMULATION_ITERATIONS", 10_000, 1_000, 1_000_000);
}

export function minimumEdgeDefault(): number {
  return numberEnv("MIN_EDGE_DEFAULT", 0.02, 0, 1);
}

export function minimumConfidenceFilter(): MinimumConfidence {
  const value = process.env.MIN_CONFIDENCE_FILTER;
  return value === "medium" || value === "high" ? value : "low";
}

export function maxParlaysPerRequest(): number {
  return integerEnv("MAX_PARLAYS_PER_REQUEST", 50, 1, 100);
}

function integerEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function numberEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number.parseFloat(process.env[name] ?? "");
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}
