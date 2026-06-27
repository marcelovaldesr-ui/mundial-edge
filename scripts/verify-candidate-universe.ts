import { matches, teamStats, odds } from "../src/lib/data/mock";
import { buildPredictions, buildEdges } from "../src/lib/model/engine";
import { decorateEdgesWithFinalProbability } from "../src/lib/model/final-probability";
import { buildScoreMatricesByMatchId } from "../src/lib/stat-model/match-prediction";
import { buildCandidatePicks } from "../src/lib/parlays/candidate-universe";
import { generateParlaysWithFallback } from "../src/lib/parlays/parlay-engine";
import type { ParlayProfile } from "../src/lib/parlays/parlay-types";
import type { Edge, TeamStats } from "../src/lib/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

// Reloj de referencia anterior al kickoff de los partidos mock (20-22 jun),
// para que el modelo los trate como pre-partido y produzca predicciones.
const REF = "2026-06-19T00:00:00Z";

const leagueAvg = +(teamStats.reduce((s, x) => s + x.gf_per_game, 0) / teamStats.length).toFixed(3);
const statFor = (id: string): TeamStats =>
  teamStats.find((s) => s.team_id === id) ?? {
    team_id: id, matches_played: 0, goals_for: 0, goals_against: 0,
    goal_diff: 0, recent_form: [], gf_per_game: leagueAvg, ga_per_game: leagueAvg,
  };

const edges: Edge[] = matches.flatMap((m) => {
  const preds = buildPredictions(m, statFor(m.home_team_id), statFor(m.away_team_id), leagueAvg);
  const matchOdds = odds.filter((o) => o.match_id === m.id);
  return buildEdges(m, preds, matchOdds).map((e) => ({ ...e, match: m }));
});

const model = buildScoreMatricesByMatchId(matches, teamStats, { predictionConfig: "recommended", generatedAt: REF });
const predictions = model.predictions;
assert(predictions.length > 0, "model must produce predictions for pre-match mock matches at REF date");

const decorated = decorateEdgesWithFinalProbability(edges, predictions);
const realOnly = buildCandidatePicks(decorated, predictions, matches, { includeEstimated: false });
const full = buildCandidatePicks(decorated, predictions, matches);

// 1) Pool expansion via estimated picks
assert(full.length > realOnly.length, "estimated picks must expand the pool beyond real edges");
assert(full.some((p) => p.oddsType === "estimated"), "pool must contain estimated picks");
assert(full.some((p) => p.market === "double_chance"), "pool must contain estimated double_chance");
assert(full.some((p) => p.market === "clasifica"), "pool must contain estimated clasifica (mock is Round of 16)");

// 2) Estimated picks never claim value
for (const p of full.filter((p) => p.oddsType === "estimated")) {
  assert(Math.abs(p.edge) < 1e-9, "estimated pick edge must be 0");
  assert(Math.abs(p.ev) < 1e-9, "estimated pick EV must be 0");
  assert(p.bookmaker == null, "estimated pick must have no bookmaker (cuota estimada)");
}

const common = { scoreMatricesByMatchId: model.scoreMatricesByMatchId, now: REF };
const riskCfg: Record<ParlayProfile, { minEdge: number; minConfidence: "low" | "medium"; allowLowConfidence: boolean }> = {
  conservative: { minEdge: 0.05, minConfidence: "medium", allowLowConfidence: false },
  balanced: { minEdge: 0.02, minConfidence: "low", allowLowConfidence: true },
  aggressive: { minEdge: 0, minConfidence: "low", allowLowConfidence: true },
};

// 3) Fallback: NEVER mute-empty, across profiles and target-odds bands (incl. 1-2 and ~x3)
const bands = [{ min: 1, max: 2 }, { min: 2, max: 3 }, { min: 2.8, max: 3.5 }];
for (const profile of ["conservative", "balanced", "aggressive"] as ParlayProfile[]) {
  for (const targetOdds of bands) {
    const res = generateParlaysWithFallback(full, { profile, ...riskCfg[profile], targetOdds, ...common }, 3);
    const hasOptions = res.parlays.length > 0 || res.relaxedAlternatives.length > 0;
    const explainedEmpty = res.emptyStateMessage !== null && res.rejected.length > 0;
    assert(hasOptions || explainedEmpty, `never mute-empty (${profile} ${targetOdds.min}-${targetOdds.max})`);
  }
}

// 4) Pool expansion actually yields combinadas (balanced, no band restriction)
const balanced = generateParlaysWithFallback(full, { profile: "balanced", ...riskCfg.balanced, ...common }, 3);
assert(balanced.parlays.length + balanced.relaxedAlternatives.length >= 1, "expanded pool must yield >=1 combinada (balanced)");

// 5) excludeEstimated keeps estimated picks out (value profile semantics)
const valueRun = generateParlaysWithFallback(full, { profile: "balanced", excludeEstimated: true, ...riskCfg.balanced, ...common }, 3);
const leaked = [...valueRun.parlays, ...valueRun.relaxedAlternatives].some((pl) => pl.picks.some((pk) => pk.oddsType === "estimated"));
assert(!leaked, "excludeEstimated must keep estimated picks out of every combinada");

// 6) No parlay ships with invalid correlation
const all = [...balanced.parlays, ...balanced.relaxedAlternatives];
assert(all.every((pl) => pl.correlationLevel !== "invalid"), "no parlay should ship with invalid correlation");

console.log("Candidate universe verification passed", {
  predictions: predictions.length,
  realOnly: realOnly.length,
  full: full.length,
  estimated: full.filter((p) => p.oddsType === "estimated").length,
  doubleChance: full.filter((p) => p.market === "double_chance").length,
  clasifica: full.filter((p) => p.market === "clasifica").length,
  balancedOptions: balanced.parlays.length + balanced.relaxedAlternatives.length,
});
