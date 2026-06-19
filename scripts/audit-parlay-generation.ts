import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { edgeToParlayPick } from "../src/lib/parlays/edge-adapter";
import { generateParlaysWithDebug } from "../src/lib/parlays/parlay-engine";
import { isQualityPick } from "../src/lib/model/edge";
import { isPreMatchEligible } from "../src/lib/matches/pre-match-eligibility";
import type { GenerateParlaysOptions, ParlayPick } from "../src/lib/parlays/parlay-types";
import type { Edge, Match } from "../src/lib/types";

loadEnvConfig(process.cwd());
void main();

async function main(): Promise<void> {
  const { picks, source, now } = await loadAuditPicks();
  const configurations: Array<{ name: string; picks: ParlayPick[]; options: GenerateParlaysOptions }> = [
    {
      name: "Referencia estricta",
      picks: picks.filter((pick) => pick.isQualityPick),
      options: { profile: "balanced", minEdge: 0.05, minConfidence: "medium", allowLowConfidence: false, maxResults: 1_000, maxTotalOdds: 25, now },
    },
    {
      name: "Conservador",
      picks,
      options: { profile: "conservative", minEdge: 0.05, minConfidence: "medium", allowLowConfidence: false, maxResults: 30, now },
    },
    {
      name: "Equilibrado",
      picks,
      options: { profile: "balanced", minEdge: 0.02, minConfidence: "low", allowLowConfidence: true, maxResults: 30, now },
    },
    {
      name: "Oportunista",
      picks,
      options: { profile: "aggressive", minEdge: 0, minConfidence: "low", allowLowConfidence: true, maxResults: 30, now },
    },
  ];

  console.log(`AUDITORIA PARLAYS | source=${source} | picks=${picks.length} | matches=${new Set(picks.map((pick) => pick.matchId)).size}`);
  for (const configuration of configurations) {
    const result = generateParlaysWithDebug(configuration.picks, configuration.options);
    console.log(`\n${configuration.name}`);
    console.table([{
      Generadas: result.parlays.length,
      Descartadas: result.rejected.length,
      "Cuota 1.5-2": oddsCount(result.parlays.map((row) => row.totalOdds), 1.5, 2),
      "Cuota 2-3": oddsCount(result.parlays.map((row) => row.totalOdds), 2, 3),
      "Cuota 3-5": oddsCount(result.parlays.map((row) => row.totalOdds), 3, 5),
      "Cuota 5+": result.parlays.filter((row) => row.totalOdds >= 5).length,
    }]);
    console.table([...countBy(result.rejected.map((row) => row.reason)).entries()].map(([Filtro, Descartes]) => ({ Filtro, Descartes })));
    console.table(result.rejected.slice(0, 20).map((row) => ({
      Filtro: row.reason,
      Picks: row.picks.map((pick) => pick.id).join(" + "),
      Edge: row.picks.map((pick) => percent(pick.edge)).join(" / "),
      Confidence: row.picks.map((pick) => pick.confidence).join(" / "),
      Cuota: row.totalOdds?.toFixed(2) ?? "—",
      EV: row.ev == null ? "—" : percent(row.ev),
    })));
  }

  const balanced = generateParlaysWithDebug(picks, configurations[2].options).parlays.length;
  if (balanced < 20) throw new Error(`Expected at least 20 balanced parlays for the audit slate; received ${balanced}.`);
}

async function loadAuditPicks(): Promise<{ picks: ParlayPick[]; source: string; now: string }> {
  const now = new Date().toISOString();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (process.env.DATA_MODE === "live" && url && key) {
    const response = await createClient(url, key)
      .from("edges")
      .select("*, match:matches!inner(*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*))")
      .order("expected_value", { ascending: false });
    if (response.error) throw response.error;
    const edges = ((response.data as unknown as Edge[]) ?? []).filter((edge) => edge.match && isPreMatchEligible(edge.match, now));
    const matchIds = [...new Set(edges.map((edge) => edge.match_id))].slice(0, 12);
    const selected = edges.filter((edge) => matchIds.includes(edge.match_id));
    return {
      picks: selected.map((edge) => edgeToParlayPick({ ...edge, qualifies: isQualityPick(edge) })),
      source: `live (${selected.length} edges / ${matchIds.length} matches)`,
      now,
    };
  }
  return { picks: syntheticPicks(now), source: "synthetic 12-match slate", now };
}

function syntheticPicks(now: string): ParlayPick[] {
  return Array.from({ length: 12 }, (_, index) => {
    const kickoff = new Date(Date.parse(now) + (index + 1) * 3_600_000).toISOString();
    const match: Match = {
      id: `audit-${index + 1}`, home_team_id: `h-${index}`, away_team_id: `a-${index}`,
      stage: "Group", kickoff, venue: null, status: "scheduled", home_score: null, away_score: null,
    };
    return [
      syntheticPick(match, "1x2", "home", 1.75, 0.60, 0.029, index),
      syntheticPick(match, "over_under_2_5", "over", 1.9, 0.56, 0.034, index),
      syntheticPick(match, "btts", "yes", 1.85, 0.57, 0.029, index),
    ];
  }).flat();
}

function syntheticPick(match: Match, market: Edge["market"], outcome: Edge["outcome"], odds: number, probability: number, edge: number, index: number): ParlayPick {
  return edgeToParlayPick({
    id: `${match.id}:${market}:${outcome}`, match_id: match.id, market, outcome, decimal_odds: odds,
    implied_probability: probability - edge, model_probability: probability, edge,
    expected_value: probability * odds - 1, tier: index % 3 === 0 ? "low" : "medium",
    bookmaker: "AuditBook", source: "audit", updated_at: new Date().toISOString(), qualifies: true, match,
  });
}

function oddsCount(values: number[], min: number, max: number): number { return values.filter((value) => value >= min && value < max).length; }
function percent(value: number): string { return `${(value * 100).toFixed(1)}%`; }
function countBy<T>(values: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return new Map([...counts.entries()].sort((a, b) => b[1] - a[1]));
}
