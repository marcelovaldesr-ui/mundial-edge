import { evaluateCorrelation } from "../src/lib/parlays/correlation";
import { edgeToParlayPick } from "../src/lib/parlays/edge-adapter";
import { generateParlays, generateParlaysWithDebug } from "../src/lib/parlays/parlay-engine";
import { sortAndFilterParlays, sortParlays } from "../src/lib/parlays/parlay-filtering";
import { scoreParlay } from "../src/lib/parlays/parlay-scoring";
import type { Parlay, ParlayPick } from "../src/lib/parlays/parlay-types";
import { kellyFraction, suggestStake } from "../src/lib/parlays/staking";
import type { Edge } from "../src/lib/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function near(actual: number, expected: number, tolerance = 0.000001) {
  assert(Math.abs(actual - expected) <= tolerance, `Expected ${actual} to be near ${expected}`);
}

function pick(overrides: Partial<ParlayPick>): ParlayPick {
  return {
    id: overrides.id ?? "pick",
    matchId: overrides.matchId ?? "m1",
    market: overrides.market ?? "1x2",
    selection: overrides.selection ?? "home",
    odds: overrides.odds ?? 2,
    marketProb: overrides.marketProb ?? 0.5,
    anchoredProb: overrides.anchoredProb ?? 0.55,
    probabilitySource: overrides.probabilitySource ?? "edge.model_probability_blended",
    edge: overrides.edge ?? 0.05,
    ev: overrides.ev ?? 0.1,
    riskLevel: overrides.riskLevel ?? "medium",
    isQualityPick: overrides.isQualityPick ?? true,
    startsAt: overrides.startsAt ?? "2026-06-20T20:00:00Z",
    matchStatus: overrides.matchStatus ?? "scheduled",
    bookmaker: overrides.bookmaker,
    match: overrides.match,
  };
}

function edgeAdapter() {
  const edge: Edge = {
    id: "edge-1",
    match_id: "m1",
    market: "1x2",
    outcome: "home",
    decimal_odds: 2.05,
    implied_probability: 0.49,
    model_probability: 0.57,
    edge: 0.08,
    expected_value: 0.1685,
    tier: "high",
    bookmaker: "TestBook",
    source: "poisson-v1",
    updated_at: "2026-06-17T12:00:00Z",
    qualifies: true,
    match: {
      id: "m1",
      home_team_id: "h",
      away_team_id: "a",
      stage: "Group",
      kickoff: "2026-06-20T20:00:00Z",
      venue: null,
      status: "scheduled",
      home_score: null,
      away_score: null,
    },
  };
  const parlayPick = edgeToParlayPick(edge);
  near(parlayPick.anchoredProb, edge.model_probability);
  near(parlayPick.marketProb, edge.implied_probability);
  assert(parlayPick.probabilitySource === "edge.model_probability_blended", "Expected explicit anchored probability source");
}

function independentParlay() {
  const picks = [
    pick({ id: "a", matchId: "m1", odds: 2, anchoredProb: 0.55 }),
    pick({ id: "b", matchId: "m2", odds: 1.8, anchoredProb: 0.6 }),
  ];
  const [parlay] = generateParlays(picks, {
    profile: "balanced",
    minJointProbability: 0,
    minEV: -1,
    maxResults: 1,
    now: "2026-06-16T00:00:00Z",
  });
  assert(parlay, "Expected one independent parlay");
  near(parlay.totalOdds, 3.6);
  near(parlay.jointProbabilityRaw, 0.33);
  near(parlay.jointProbabilityAdjusted, 0.33);
  near(parlay.ev, 0.188);
}

function correlatedParlay() {
  const picks = [
    pick({ id: "a", matchId: "m1", market: "1x2", selection: "home", odds: 1.8, anchoredProb: 0.62 }),
    pick({ id: "b", matchId: "m1", market: "over_under_2_5", selection: "over", odds: 1.9, anchoredProb: 0.58 }),
  ];
  const correlation = evaluateCorrelation(picks);
  assert(correlation.level === "high", "Expected high correlation for 1x2 + totals in same match");
  near(correlation.penaltyFactor, 0.75);
}

function invalidParlay() {
  const picks = [
    pick({ id: "a", matchId: "m1", market: "1x2", selection: "home" }),
    pick({ id: "b", matchId: "m1", market: "1x2", selection: "away" }),
  ];
  const correlation = evaluateCorrelation(picks);
  assert(correlation.level === "invalid", "Expected contradictory same-market picks to be invalid");
  const parlays = generateParlays(picks, {
    profile: "aggressive",
    minJointProbability: 0,
    minEV: -1,
    now: "2026-06-16T00:00:00Z",
  });
  assert(parlays.length === 0, "Expected invalid parlay to be discarded");
}

function staking() {
  assert(kellyFraction(2, 0.45) < 0, "Expected negative Kelly for negative EV");
  const noStake = suggestStake({ odds: 2, probability: 0.45, profile: "balanced" });
  assert(noStake.suggestedStakeUnits === 0, "Expected zero stake for negative EV");

  const capped = suggestStake({ odds: 4, probability: 0.55, profile: "aggressive", bankroll: 1000 });
  assert(capped.suggestedStakePercent === 0.025, "Expected aggressive stake cap");
  assert(capped.suggestedStakeAmount === 25, "Expected bankroll amount from cap");

  const conservative = suggestStake({ odds: 2, probability: 0.58, profile: "conservative" });
  const balanced = suggestStake({ odds: 2, probability: 0.58, profile: "balanced" });
  assert(balanced.suggestedStakeUnits >= conservative.suggestedStakeUnits, "Expected profile to affect stake");

  const highVariance = suggestStake({
    odds: 27.328,
    probability: 0.0643,
    profile: "aggressive",
    bankroll: 100000,
    riskScore: 86,
    legs: 5,
    correlationLevel: "low",
  });
  assert(highVariance.suggestedStakeUnits <= 0.75, "Expected high-variance aggressive parlay to keep stake low");
  assert(highVariance.suggestedStakePercent !== null && highVariance.suggestedStakePercent < 0.01, "Expected stake percent under 1%");
  assert(highVariance.reason.includes("Stake reducido por alta varianza"), "Expected stake reason to explain variance haircut");
}

function expiredPicksAreExcluded() {
  const picks = [
    pick({ id: "a", matchId: "m1", startsAt: "2026-06-15T20:00:00Z" }),
    pick({ id: "b", matchId: "m2", startsAt: "2026-06-20T20:00:00Z" }),
    pick({ id: "c", matchId: "m3", matchStatus: "live", startsAt: "2026-06-20T20:00:00Z" }),
  ];
  const parlays = generateParlays(picks, {
    profile: "balanced",
    minJointProbability: 0,
    minEV: -1,
    now: "2026-06-16T00:00:00Z",
  });
  assert(parlays.length === 0, "Expected expired/live picks to be excluded before generation");
}

function debugRejections() {
  const picks = [
    pick({ id: "a", matchId: "m1", startsAt: "2026-06-15T20:00:00Z" }),
    pick({ id: "b", matchId: "m2", startsAt: "2026-06-20T20:00:00Z", odds: 6.5 }),
    pick({ id: "c", matchId: "m3", startsAt: "2026-06-20T20:00:00Z" }),
  ];
  const result = generateParlaysWithDebug(picks, {
    profile: "balanced",
    minJointProbability: 0,
    minEV: -1,
    now: "2026-06-16T00:00:00Z",
  });
  assert(result.rejected.some((x) => x.reason === "pick_expired"), "Expected expired pick rejection");
  assert(result.rejected.some((x) => x.reason === "pick_invalid"), "Expected invalid pick rejection");

  const invalid = generateParlaysWithDebug([
    pick({ id: "d", matchId: "m4", market: "1x2", selection: "home" }),
    pick({ id: "e", matchId: "m4", market: "1x2", selection: "away" }),
  ], {
    profile: "aggressive",
    minJointProbability: 0,
    minEV: -1,
    now: "2026-06-16T00:00:00Z",
  });
  assert(invalid.rejected.some((x) => x.reason === "same_market_contradiction"), "Expected contradiction rejection");
}

function tooManySameMatchPicksAreInvalid() {
  const picks = [
    pick({ id: "a", matchId: "m1", market: "1x2", selection: "home" }),
    pick({ id: "b", matchId: "m1", market: "over_under_2_5", selection: "over" }),
    pick({ id: "c", matchId: "m1", market: "btts", selection: "yes" }),
  ];
  const correlation = evaluateCorrelation(picks);
  assert(correlation.level === "invalid", "Expected 3 picks from same match to be invalid");
}

function ranking() {
  const giantEvLowProb = scoreParlay({
    picks: [
      pick({ id: "a", matchId: "m1", odds: 6, anchoredProb: 0.09, ev: 0.2, riskLevel: "high" }),
      pick({ id: "b", matchId: "m2", odds: 5.5, anchoredProb: 0.1, ev: 0.2, riskLevel: "high" }),
    ],
    totalOdds: 33,
    jointProbabilityAdjusted: 0.009,
    ev: 0.35,
    riskScore: 88,
    correlationLevel: "low",
  });
  const reasonable = scoreParlay({
    picks: [
      pick({ id: "c", matchId: "m3", odds: 1.8, anchoredProb: 0.62, ev: 0.08, riskLevel: "low" }),
      pick({ id: "d", matchId: "m4", odds: 1.9, anchoredProb: 0.59, ev: 0.07, riskLevel: "low" }),
    ],
    totalOdds: 3.42,
    jointProbabilityAdjusted: 0.3658,
    ev: 0.251,
    riskScore: 32,
    correlationLevel: "low",
  });
  assert(reasonable > giantEvLowProb, "Expected score to prefer reasonable probability over giant EV alone");
}

function sortingAndFiltering() {
  const base = {
    id: "p",
    profile: "balanced",
    picks: [pick({ id: "x", matchId: "m10" }), pick({ id: "y", matchId: "m11" })],
    jointProbabilityRaw: 0.2,
    correlationLevel: "low",
    correlationReasons: [],
    suggestedStakePercent: null,
    suggestedStakeAmount: null,
    stakeReason: "",
    explanation: "",
    warnings: [],
  } satisfies Partial<Parlay>;
  const parlays: Parlay[] = [
    { ...base, id: "a", totalOdds: 3, jointProbabilityAdjusted: 0.22, ev: 0.08, riskScore: 20, riskLevel: "low", suggestedStakeUnits: 0.5, score: 10 } as Parlay,
    { ...base, id: "b", totalOdds: 8, jointProbabilityAdjusted: 0.1, ev: 0.25, riskScore: 65, riskLevel: "high", suggestedStakeUnits: 0.25, score: 8 } as Parlay,
    { ...base, id: "c", totalOdds: 4, jointProbabilityAdjusted: 0.3, ev: 0.12, riskScore: 35, riskLevel: "medium", suggestedStakeUnits: 1, score: 12 } as Parlay,
  ];
  assert(sortParlays(parlays, "ev")[0].id === "b", "Expected EV sorting");
  assert(sortParlays(parlays, "probability")[0].id === "c", "Expected probability sorting");
  assert(sortParlays(parlays, "risk")[0].id === "a", "Expected risk sorting");
  const filtered = sortAndFilterParlays(parlays, { maxRisk: "medium", minOdds: 3.5, minEV: 0.1 }, "score");
  assert(filtered.length === 1 && filtered[0].id === "c", "Expected filters to keep only reasonable candidate");
}

edgeAdapter();
independentParlay();
correlatedParlay();
invalidParlay();
staking();
expiredPicksAreExcluded();
debugRejections();
tooManySameMatchPicksAreInvalid();
ranking();
sortingAndFiltering();

console.log("Parlay verification passed");
