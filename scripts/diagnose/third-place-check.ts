import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import type { Match } from "../../src/lib/types";
import { buildWorldCup2026Groups } from "../../src/lib/tournament/world-cup-2026-groups";
import { simulateWorldCup2026FromSchedules } from "../../src/lib/tournament/group-simulation-service";

loadEnvConfig(process.cwd());
void main();

async function main(): Promise<void> {
const simulations = 10_000;
let matches: Match[] = [];
let source = "local-fallback";
try {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (process.env.DATA_MODE === "live" && url && key) {
    const response = await createClient(url, key).from("matches").select("*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)");
    if (response.error) throw response.error;
    matches = (response.data as Match[] | null) ?? [];
    source = `live repository (${matches.length} matches)`;
  }
} catch (error) {
  console.warn(`Could not load repository matches; using local fallback: ${error instanceof Error ? error.message : String(error)}`);
}
const schedules = buildWorldCup2026Groups(matches);
const result = simulateWorldCup2026FromSchedules({
  groups: schedules.map((schedule) => ({ groupId: schedule.groupId, teams: schedule.teams, matches: schedule.matches })),
  simulations,
  seed: 20260618,
});
const teams = result.groups.flatMap((group) => group.standings.map((team) => ({ groupId: group.groupId, ...team })));
const currentThirds = schedules.map((schedule) => schedule.standings[2]);
const currentThirdIds = new Set(currentThirds.map((row) => row.teamId));
const thirds = teams
  .filter((team) => currentThirdIds.has(team.teamId))
  .sort((a, b) => b.probabilityAdvance - a.probabilityAdvance);

console.log(`Mundial 2026 - mejores terceros | ${simulations.toLocaleString("es-CL")} simulaciones | seed=${result.seed} | source=${source}`);
console.table(thirds.map((team) => ({
  Grupo: team.groupId,
  Equipo: `${team.teamName} (${team.teamCode})`,
  "P(clasifica)": percent(team.probabilityAdvance),
  "P(top-2)": percent(team.probabilityAdvanceAsTop2),
  "P(clasifica como 3.º)": percent(team.probabilityAdvanceAsThird),
  "P(termina 3.º)": percent(team.probabilityFinishThird),
})));

const byPoints = new Map(result.thirdPlaceQualificationByPoints.map((band) => [band.points, band]));
console.log("Probabilidad de que un tercero avance según puntos obtenidos:");
console.table([3, 4, 5, 6].map((points) => {
  const band = byPoints.get(points);
  return {
    Puntos: points,
    Casos: band?.appearances ?? 0,
    Clasificados: band?.qualified ?? 0,
    "P(avanza | puntos)": band ? percent(band.probabilityAdvance) : "sin casos",
  };
}));

const advanceSum = teams.reduce((sum, team) => sum + team.probabilityAdvance, 0);
const top2Sum = teams.reduce((sum, team) => sum + team.probabilityAdvanceAsTop2, 0);
const thirdSum = teams.reduce((sum, team) => sum + team.probabilityAdvanceAsThird, 0);
console.log(`Control: suma P(clasifica)=${advanceSum.toFixed(6)}; top-2=${top2Sum.toFixed(6)}; mejores terceros=${thirdSum.toFixed(6)}.`);
if (Math.abs(advanceSum - 32) > 1e-9 || Math.abs(top2Sum - 24) > 1e-9 || Math.abs(thirdSum - 8) > 1e-9) {
  throw new Error("Qualification probability totals are inconsistent.");
}
}

function percent(value: number): string { return `${(value * 100).toFixed(2)}%`; }
