import * as mock from "../src/lib/data/mock";
import { buildEdges, buildPredictions } from "../src/lib/model/engine";
import { getTopRecommendations } from "../src/lib/model/recommendations";
import { realismLabel } from "../src/lib/model/edge";
import type { Edge } from "../src/lib/types";

const leagueAvg = mock.teamStats.reduce((s, x) => s + x.gf_per_game, 0) / mock.teamStats.length;
const all: Edge[] = [];
for (const m of mock.matches) {
  const hs = mock.teamStats.find((s) => s.team_id === m.home_team_id)!;
  const as2 = mock.teamStats.find((s) => s.team_id === m.away_team_id)!;
  const matchOdds = mock.odds.filter((o) => o.match_id === m.id);
  const preds = buildPredictions(m, hs, as2, leagueAvg);
  const edges = buildEdges(m, preds, matchOdds).map((e) => ({ ...e, match: m }));
  all.push(...edges);
}

// --- Distribución de mercados ---
const byMarket = new Map<string, number>();
for (const e of all) byMarket.set(e.market, (byMarket.get(e.market) ?? 0) + 1);
console.log("=== Distribución de edges por mercado (ANTES: solo 3, AHORA: debe ser 6) ===");
for (const [market, count] of [...byMarket.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${market}: ${count} edges`);
}

// --- Quality picks ---
const qp = all.filter((e) => e.expected_value > 0.02 && e.implied_probability >= 0.08);
const byM2 = new Map<string, number>();
for (const e of qp) byM2.set(e.market, (byM2.get(e.market) ?? 0) + 1);
console.log(`\n=== Quality picks (EV>2%, impliedProb>8%): ${qp.length} total ===`);
for (const [market, count] of [...byM2.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${market}: ${count}`);
}

// --- Realism filter test ---
const artificial = all.filter((e) => {
  const prob = e.final_probability ?? e.model_probability;
  const ev = e.final_edge ?? e.edge;
  return realismLabel(prob, ev) === "artificial";
});
console.log(`\n=== Picks marcados como 'artificial' (prob<15% && edge>3%): ${artificial.length} ===`);
for (const e of artificial.slice(0, 5)) {
  const prob = e.final_probability ?? e.model_probability;
  const ev = e.final_edge ?? e.edge;
  console.log(`  ${e.match?.home_team?.code}-${e.match?.away_team?.code} | ${e.market} ${e.outcome} @ ${e.decimal_odds.toFixed(2)} | prob=${(prob*100).toFixed(1)}% edge=${(ev*100).toFixed(1)}%`);
}

// --- Top 3 recomendaciones ---
const recs = getTopRecommendations(all);
console.log(`\n=== Top Recomendaciones: ${recs.length} picks ===`);
for (const rec of recs) {
  const e = rec.edge;
  const prob = e.final_probability ?? e.model_probability;
  const ev = e.final_edge ?? e.edge;
  const label = `${e.match?.home_team?.code ?? "?"}-${e.match?.away_team?.code ?? "?"}`;
  console.log(`[${rec.mode.toUpperCase().padEnd(12)}] ${label} | ${e.market} ${e.outcome} @ ${e.decimal_odds.toFixed(2)}`);
  console.log(`  Prob: ${(prob*100).toFixed(1)}% | Edge: ${(ev*100).toFixed(1)}% | EV: ${(e.expected_value*100).toFixed(1)}%`);
  console.log(`  ${rec.justification}`);
}

console.log("\n✓ Test completado");
