import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";
import type { Match, TeamStats, Edge } from "@/lib/types";
import { buildScoreMatricesByMatchId } from "@/lib/stat-model";
import { decorateEdgesWithFinalProbability } from "@/lib/model/final-probability";
import { getTopRecommendations } from "@/lib/model/recommendations";
import { getMatchEnvironmentMap } from "@/lib/context/match-environment";
import { computeEnvironmentModifier } from "@/lib/context/environment-modifiers";
import { resolveVenueInfo } from "@/lib/context/venue-coordinates";
import { filterPreMatchMatches } from "@/lib/matches/pre-match-eligibility";
import { getRecommendedPredictionConfig } from "@/lib/stat-model";
import { isQualityPick } from "@/lib/model/edge";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const sb = getServiceSupabase();
  if (!sb) return NextResponse.json({ error: "no supabase client" });

  const now = new Date();

  // Fetch all data
  const [{ data: allMatches }, { data: allStats }, { data: allEdgesRaw }] = await Promise.all([
    sb.from("matches").select("*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)").order("kickoff"),
    sb.from("team_stats").select("*"),
    sb.from("edges").select("*, match:matches!inner(*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*))").order("expected_value", { ascending: false }),
  ]);

  const matches = (allMatches as Match[]) ?? [];
  const stats = (allStats as TeamStats[]) ?? [];
  const allEdges = (allEdgesRaw as unknown as Edge[]) ?? [];

  const preMatchMatches = filterPreMatchMatches(matches);

  // Build environment modifiers
  const envDataMap = await getMatchEnvironmentMap(preMatchMatches, matches).catch(() => new Map());
  const environmentModifiersByMatchId = new Map(
    [...envDataMap.entries()].map(([id, env]) => [id, computeEnvironmentModifier(env)])
  );

  // Build predictions via stat model
  const config = getRecommendedPredictionConfig();
  const statModel = buildScoreMatricesByMatchId(matches, stats, {
    predictionConfig: config,
    environmentModifiersByMatchId,
  });

  const leagueAvg = stats.length ? stats.reduce((sum, s) => sum + s.gf_per_game, 0) / stats.length : 1.35;

  // Filter pre-match edges from the materialized edges table and annotate qualifies
  const preMatchMatchIds = new Set(preMatchMatches.map((m) => m.id));
  const rawEdges = allEdges
    .filter((e) => preMatchMatchIds.has(e.match_id))
    .map((e) => ({ ...e, qualifies: isQualityPick(e) }));

  // Calibrate (applies bias corrections + final probability blend)
  const calibratedEdges = decorateEdgesWithFinalProbability(rawEdges, statModel.predictions);

  // Build per-match result
  const matchResults = preMatchMatches.map((match) => {
    const prediction = statModel.predictions.find((p) => p.matchId === match.id);
    const edges = calibratedEdges.filter((e) => e.match_id === match.id);
    const envMod = environmentModifiersByMatchId.get(match.id);
    const envData = envDataMap.get(match.id);
    const venue = resolveVenueInfo(match.venue);

    // Per-market best pick
    const byMarket: Record<string, { outcome: string; odds: number; finalProb: number; finalEdge: number; ev: number; biasNote?: string }[]> = {};
    for (const e of edges) {
      if (!byMarket[e.market]) byMarket[e.market] = [];
      byMarket[e.market].push({
        outcome: e.outcome,
        odds: e.decimal_odds,
        finalProb: e.final_probability ?? e.model_probability,
        finalEdge: e.final_edge ?? e.edge,
        ev: e.final_expected_value ?? e.expected_value,
      });
    }

    // Top 3 picks (realistic, conservative, value)
    const recs = getTopRecommendations(edges);

    return {
      matchId: match.id,
      home: match.home_team?.name ?? match.home_team_id,
      away: match.away_team?.name ?? match.away_team_id,
      kickoff: match.kickoff,
      stage: match.stage,
      venue: match.venue,
      venueResolved: venue?.name ?? null,
      altitudeM: venue?.altitudeM ?? 0,

      // Lambda diagnostics
      lambdas: prediction ? {
        rawHome: prediction.lambdas.original.home,
        rawAway: prediction.lambdas.original.away,
        calibratedHome: prediction.lambdas.calibrated.home,
        calibratedAway: prediction.lambdas.calibrated.away,
      } : null,

      // Environment modifier applied
      envModifier: envMod && (envMod.homeMultiplier !== 1 || envMod.awayMultiplier !== 1) ? {
        homeMultiplier: envMod.homeMultiplier,
        awayMultiplier: envMod.awayMultiplier,
        notes: envMod.notes,
        weather: envData?.weather ? {
          tempC: envData.weather.tempC,
          precipMm: envData.weather.precipMm,
          windKmh: envData.weather.windKmh,
        } : null,
        fatigueDaysHome: envData?.fatigueDaysHome ?? null,
        fatigueDaysAway: envData?.fatigueDaysAway ?? null,
      } : null,

      // Market probabilities from model (key markets only)
      modelProbs: prediction ? {
        home: prob(prediction, "home_win"),
        draw: prob(prediction, "draw"),
        away: prob(prediction, "away_win"),
        over2_5: prob(prediction, "over_2_5"),
        btts: prob(prediction, "btts_yes"),
        over1_5: prob(prediction, "over_1_5"),
        over3_5: prob(prediction, "over_3_5"),
      } : null,

      // Best odds per key market
      marketOdds: {
        over2_5: bestOdds(edges, "over_under_2_5", "over"),
        under2_5: bestOdds(edges, "over_under_2_5", "under"),
        btts_yes: bestOdds(edges, "btts", "yes"),
        btts_no: bestOdds(edges, "btts", "no"),
      },

      // Top recommendations
      picks: recs.map((r) => ({
        mode: r.mode,
        market: r.edge.market,
        outcome: r.edge.outcome,
        odds: r.edge.decimal_odds,
        impliedProb: r.edge.implied_probability,
        finalProb: r.edge.final_probability ?? r.edge.model_probability,
        rawPoissonProb: r.edge.model_probability,
        finalEdge: r.edge.final_edge ?? r.edge.edge,
        ev: r.edge.final_expected_value ?? r.edge.expected_value,
        bookmaker: r.edge.bookmaker,
        justification: r.justification,
      })),

      edgeCount: edges.length,
      qualifiedCount: edges.filter((e) => e.qualifies).length,
    };
  });

  return NextResponse.json({
    serverNow: now.toISOString(),
    matchCount: preMatchMatches.length,
    totalEdges: calibratedEdges.length,
    leagueAvgGoals: leagueAvg,
    modelVariant: config.modelVariant,
    matches: matchResults,
  });
}

function prob(p: { marketProbabilities: { selection: string; probability: number }[] }, key: string): number | null {
  return p.marketProbabilities.find((m) => m.selection === key)?.probability ?? null;
}

function bestOdds(edges: Edge[], market: string, outcome: string) {
  const e = edges.find((x) => x.market === market && x.outcome === outcome);
  return e ? { odds: e.decimal_odds, implied: e.implied_probability, finalProb: e.final_probability ?? e.model_probability, finalEdge: e.final_edge ?? e.edge, ev: e.final_expected_value ?? e.expected_value } : null;
}
