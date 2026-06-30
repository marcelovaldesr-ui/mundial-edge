import type { Match, Edge, TeamStats, Odd, SyncLog } from "@/lib/types";
import { MARKET_WEIGHT } from "@/lib/model/edge";
import { computeKelly } from "@/lib/model/kelly";
import { getServiceSupabase, isLiveMode } from "@/lib/supabase/server";
import * as mock from "./mock";
import { buildPredictions, buildEdges } from "@/lib/model/engine";
import { isQualityPick } from "@/lib/model/edge";
import { filterPreMatchEdges } from "@/lib/matches/pre-match-eligibility";
import { cachedLiveRead } from "./read-cache";

/** Marca cada edge con `qualifies` (filtros de calidad estilo tipster). */
const annotate = (edges: Edge[]): Edge[] =>
  edges.map((e) => ({ ...e, qualifies: isQualityPick(e) }));

// ============================================================
//  Capa de lectura. Páginas/Server Components la consumen.
//  - Modo mock: computa predicciones/edges en memoria.
//  - Modo live: lee tablas materializadas en Supabase.
// ============================================================

const leagueAvg = computeLeagueAvg(mock.teamStats);

function computeLeagueAvg(stats: TeamStats[]): number {
  if (!stats.length) return 1.35;
  const avg = stats.reduce((s, x) => s + x.gf_per_game, 0) / stats.length;
  return +avg.toFixed(3);
}

function statFor(teamId: string): TeamStats {
  return (
    mock.teamStats.find((s) => s.team_id === teamId) ?? {
      team_id: teamId, matches_played: 0, goals_for: 0, goals_against: 0,
      goal_diff: 0, recent_form: [], gf_per_game: leagueAvg, ga_per_game: leagueAvg,
    }
  );
}

/** Computa todos los edges del dataset mock. */
function mockEdges(): Edge[] {
  const all: Edge[] = [];
  for (const m of mock.matches) {
    const preds = buildPredictions(m, statFor(m.home_team_id), statFor(m.away_team_id), leagueAvg);
    const matchOdds = mock.odds.filter((o) => o.match_id === m.id);
    const edges = buildEdges(m, preds, matchOdds).map((e) => ({ ...e, match: m }));
    all.push(...edges);
  }
  return all;
}

// ─── API pública de lectura ──────────────────────────────────

export async function getMatches(): Promise<Match[]> {
  if (isLiveMode()) {
    return cachedLiveRead("matches", 60_000, async () => {
      const sb = getServiceSupabase()!;
      const { data, error } = await sb
        .from("matches")
        .select("*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)")
        .order("kickoff", { ascending: true });
      if (error) {
        console.error("[getMatches] error:", error.message);
        return [];
      }
      return (data as Match[]) ?? [];
    });
  }
  return [...mock.matches].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

export async function getMatch(id: string): Promise<Match | null> {
  const matches = await getMatches();
  return matches.find((m) => m.id === id) ?? null;
}

export async function getEdges(): Promise<Edge[]> {
  return filterPreMatchEdges(await getAllEdges());
}

export async function getAllEdges(): Promise<Edge[]> {
  if (isLiveMode()) {
    return cachedLiveRead("edges", 60_000, async () => {
      const sb = getServiceSupabase()!;
      // Leemos la tabla `edges` directamente (no la vista v_top_edges) para no
      // depender de la caché de esquema de PostgREST, y traemos el partido +
      // equipos anidados para mostrar nombres en la tabla.
      // Use column-name hints (not FK constraint names) for team joins — constraint names
      // cause PostgREST to traverse the FK in reverse, multiplying rows (~190 instead of 57).
      const { data, error } = await sb
        .from("edges")
        .select(
          "*, match:matches!inner(*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*))"
        )
        .order("expected_value", { ascending: false });
      if (error) {
        console.error("[getEdges] error:", error.message);
        return [];
      }
      const rows = (data as unknown as Edge[]) ?? [];
      return annotate(rows);
    });
  }
  return annotate(mockEdges().sort((a, b) => b.expected_value - a.expected_value));
}

export async function getEdgesForMatch(matchId: string): Promise<Edge[]> {
  const edges = await getEdges();
  return edges
    .filter((e) => e.match_id === matchId)
    .sort((a, b) => b.expected_value - a.expected_value);
}

export async function getAllEdgesForMatch(matchId: string): Promise<Edge[]> {
  const edges = await getAllEdges();
  return edges
    .filter((e) => e.match_id === matchId)
    .sort((a, b) => b.expected_value - a.expected_value);
}

export async function getOddsForMatch(matchId: string): Promise<Odd[]> {
  if (isLiveMode()) {
    return cachedLiveRead(`odds:${matchId}`, 15_000, async () => {
      const sb = getServiceSupabase()!;
      const { data, error } = await sb.from("odds").select("*").eq("match_id", matchId);
      if (error) {
        console.error("[getOddsForMatch] error:", error.message);
        return [];
      }
      return (data as Odd[]) ?? [];
    });
  }
  return mock.odds.filter((o) => o.match_id === matchId);
}

export async function getTeamStats(): Promise<TeamStats[]> {
  if (isLiveMode()) {
    return cachedLiveRead("team-stats", 120_000, async () => {
      const sb = getServiceSupabase()!;
      const { data, error } = await sb.from("team_stats").select("*");
      if (error) {
        console.error("[getTeamStats] error:", error.message);
        return [];
      }
      return (data as TeamStats[]) ?? [];
    });
  }
  return mock.teamStats;
}

export async function getLastSync(): Promise<{ at: string | null; source: string }> {
  if (isLiveMode()) {
    return cachedLiveRead("last-sync", 15_000, async () => {
      const sb = getServiceSupabase()!;
      const { data, error } = await sb
        .from("sync_logs").select("finished_at, source")
        .eq("status", "success").order("finished_at", { ascending: false }).limit(1);
      if (error) {
        console.error("[getLastSync] error:", error.message);
        return { at: null, source: "supabase-unavailable" };
      }
      const row = data?.[0];
      return { at: row?.finished_at ?? null, source: row?.source ?? "supabase" };
    });
  }
  // En mock, "última actualización" = ahora (se computa en cada request).
  const latest = mock.odds.reduce<string | null>(
    (acc, o) => (!acc || o.fetched_at > acc ? o.fetched_at : acc), null);
  return { at: latest, source: mock.MOCK_SOURCE };
}

export async function getSyncLogs(limit = 20): Promise<SyncLog[]> {
  if (isLiveMode()) {
    const sb = getServiceSupabase()!;
    const { data } = await sb
      .from("sync_logs").select("*")
      .order("started_at", { ascending: false }).limit(limit);
    return (data as SyncLog[]) ?? [];
  }
  return [];
}

export const dataMode = () => (isLiveMode() ? "live" : "mock");

/**
 * Top picks estrictos: EV ≥ 5%, máximo 5 edges, ordenados por EV DESC.
 * Registra los picks mostrados en picks_log (side-effect silencioso).
 */
export async function getTopEdges(): Promise<Edge[]> {
  const all = await getEdges();
  const top = all
    .filter((e) => e.expected_value >= 0.05)
    .slice(0, 5);
  try {
    await logPicksShown(top);
  } catch (e) {
    console.error("[getTopEdges] logPicksShown failed:", e);
  }
  return top;
}

export async function logPicksShown(edges: Edge[]): Promise<void> {
  if (!isLiveMode() || !edges.length) return;
  const sb = getServiceSupabase()!;
  for (const e of edges) {
    const kelly = computeKelly(e.expected_value, e.decimal_odds);
    await sb.from("picks_log").upsert(
      {
        match_id: e.match_id,
        market: e.market,
        outcome: e.outcome,
        decimal_odds: e.decimal_odds,
        model_prob: e.model_probability,
        implied_prob: e.implied_probability,
        ev: e.expected_value,
        kelly_pct: kelly.isNoStake ? null : kelly.kellyPct,
        stake_pct: kelly.isNoStake ? null : kelly.stakePct,
        shown_at: new Date().toISOString(),
      },
      { onConflict: "match_id,market,outcome", ignoreDuplicates: true }
    );
  }
}

/** Finished matches with their best edges for pick history (E.1). */
export interface FinishedPickRow {
  matchId: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  kickoff: string;
  market: string;
  outcome: string;
  decimalOdds: number;
  modelProb: number;
  ev: number;
  won: boolean;
}

export async function getFinishedPickHistory(limit = 50): Promise<FinishedPickRow[]> {
  if (!isLiveMode()) return [];
  const sb = getServiceSupabase()!;
  const { data: matches } = await sb
    .from("matches")
    .select("id, home_team:teams!home_team_id(name, code), away_team:teams!away_team_id(name, code), home_score, away_score, kickoff")
    .eq("status", "finished")
    .not("home_score", "is", null)
    .order("kickoff", { ascending: false })
    .limit(30);

  if (!matches?.length) return [];
  const matchIds = (matches as any[]).map((m) => m.id);

  const { data: edges } = await sb
    .from("edges")
    .select("match_id, market, outcome, decimal_odds, model_probability, expected_value")
    .in("match_id", matchIds)
    .gte("expected_value", 0.02)
    .order("expected_value", { ascending: false })
    .limit(limit);

  if (!edges?.length) return [];

  const matchMap = new Map((matches as any[]).map((m) => [m.id, m]));
  const rows: FinishedPickRow[] = [];

  for (const e of edges as any[]) {
    const m = matchMap.get(e.match_id);
    if (!m || m.home_score == null || m.away_score == null) continue;

    // Determine if the pick won
    let won = false;
    if (e.market === "1x2") {
      if (e.outcome === "home") won = m.home_score > m.away_score;
      else if (e.outcome === "away") won = m.home_score < m.away_score;
      else if (e.outcome === "draw") won = m.home_score === m.away_score;
    } else if (e.market === "btts") {
      const scored = m.home_score > 0 && m.away_score > 0;
      won = e.outcome === "yes" ? scored : !scored;
    } else if (e.market === "over_under_1_5" || e.market === "over_under_2_5" || e.market === "over_under_3_5") {
      const total = m.home_score + m.away_score;
      const line = e.market === "over_under_1_5" ? 1.5 : e.market === "over_under_2_5" ? 2.5 : 3.5;
      won = e.outcome === "over" ? total > line : total < line;
    }

    rows.push({
      matchId: m.id,
      home: m.home_team?.code ?? m.home_team?.name ?? "?",
      away: m.away_team?.code ?? m.away_team?.name ?? "?",
      homeScore: m.home_score,
      awayScore: m.away_score,
      kickoff: m.kickoff,
      market: e.market,
      outcome: e.outcome,
      decimalOdds: e.decimal_odds,
      modelProb: e.model_probability,
      ev: e.expected_value,
      won,
    });
  }
  return rows;
}

export interface RoiStats {
  totalPicks: number;
  settled: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  roi: number;
  sinceDate: string | null;
  byMarket: Record<string, { picks: number; wins: number; pnl: number; roi: number }>;
}

export async function getRoiStats(): Promise<RoiStats | null> {
  if (!isLiveMode()) return null;
  const sb = getServiceSupabase()!;
  const { data } = await sb
    .from("picks_log")
    .select("*")
    .order("shown_at", { ascending: true });

  if (!(data as any[])?.length) return null;

  const all = data as any[];
  const settled = all.filter((p) => p.result === "win" || p.result === "loss");
  if (!settled.length) return null;

  const wins = settled.filter((p) => p.result === "win").length;
  const totalPnl = settled.reduce((s: number, p: any) => s + Number(p.pnl ?? 0), 0);
  const roi = totalPnl / settled.length;

  const byMarket: RoiStats["byMarket"] = {};
  for (const p of settled) {
    const m = (p.market as string) ?? "unknown";
    if (!byMarket[m]) byMarket[m] = { picks: 0, wins: 0, pnl: 0, roi: 0 };
    byMarket[m].picks++;
    if (p.result === "win") byMarket[m].wins++;
    byMarket[m].pnl += Number(p.pnl ?? 0);
  }
  for (const m of Object.keys(byMarket)) {
    byMarket[m].roi = byMarket[m].pnl / byMarket[m].picks;
  }

  return {
    totalPicks: all.length,
    settled: settled.length,
    wins,
    losses: settled.length - wins,
    winRate: wins / settled.length,
    totalPnl,
    roi,
    sinceDate: all[0]?.shown_at ?? null,
    byMarket,
  };
}

const KELLY_BUCKETS = [
  { bucket: "0–2%", min: 0,    max: 0.02 },
  { bucket: "2–4%", min: 0.02, max: 0.04 },
  { bucket: "4–6%", min: 0.04, max: 0.06 },
  { bucket: "6–8%", min: 0.06, max: 0.08 },
  { bucket: ">8%",  min: 0.08, max: Infinity },
];

export async function getKellyDistribution(): Promise<{
  bucket: string; picks: number; wins: number; winRate: number; roi: number;
}[] | null> {
  if (!isLiveMode()) return null;
  const sb = getServiceSupabase()!;
  const { data } = await sb
    .from("picks_log")
    .select("kelly_pct, result, pnl")
    .not("result", "is", null)
    .not("kelly_pct", "is", null);

  if (!(data as any[])?.length) return null;
  const rows = data as any[];

  const result = KELLY_BUCKETS.map(({ bucket, min, max }) => {
    const inBucket = rows.filter(
      (p) => Number(p.kelly_pct) >= min && Number(p.kelly_pct) < max
        && (p.result === "win" || p.result === "loss")
    );
    const wins = inBucket.filter((p) => p.result === "win").length;
    const pnl = inBucket.reduce((s: number, p: any) => s + Number(p.pnl ?? 0), 0);
    return {
      bucket,
      picks: inBucket.length,
      wins,
      winRate: inBucket.length > 0 ? wins / inBucket.length : 0,
      roi: inBucket.length > 0 ? pnl / inBucket.length : 0,
    };
  }).filter((b) => b.picks > 0);

  return result.length > 0 ? result : null;
}

export interface ModelStatus {
  marketWeight: number;
  tableCounts: { matches: number; edges: number; odds: number; team_stats: number };
  lastSyncByJob: Partial<Record<SyncLog["job"], { at: string | null; status: string; records: number }>>;
  edgesByMarket: { market: string; count: number; qualifiedCount: number }[];
}

export async function getModelStatus(): Promise<ModelStatus> {
  if (!isLiveMode()) {
    const edges = annotate(mockEdges());
    const byMarket = new Map<string, { count: number; qualifiedCount: number }>();
    for (const e of edges) {
      const m = byMarket.get(e.market) ?? { count: 0, qualifiedCount: 0 };
      m.count++;
      if (e.qualifies) m.qualifiedCount++;
      byMarket.set(e.market, m);
    }
    return {
      marketWeight: MARKET_WEIGHT,
      tableCounts: { matches: mock.matches.length, edges: edges.length, odds: mock.odds.length, team_stats: mock.teamStats.length },
      lastSyncByJob: {},
      edgesByMarket: Array.from(byMarket.entries()).map(([market, v]) => ({ market, ...v })),
    };
  }

  const sb = getServiceSupabase()!;
  const [{ count: matchCount }, { count: edgeCount }, { count: oddsCount }, { count: statsCount }, { data: logs }, { data: edgeRows }] =
    await Promise.all([
      sb.from("matches").select("*", { count: "exact", head: true }),
      sb.from("edges").select("*", { count: "exact", head: true }),
      sb.from("odds").select("*", { count: "exact", head: true }),
      sb.from("team_stats").select("*", { count: "exact", head: true }),
      sb.from("sync_logs").select("job, status, records_affected, finished_at")
        .eq("status", "success").order("finished_at", { ascending: false }).limit(40),
      sb.from("edges").select("market, expected_value, implied_probability, decimal_odds"),
    ]);

  const lastSyncByJob: ModelStatus["lastSyncByJob"] = {};
  for (const log of (logs ?? []) as any[]) {
    if (!lastSyncByJob[log.job as SyncLog["job"]]) {
      lastSyncByJob[log.job as SyncLog["job"]] = { at: log.finished_at, status: log.status, records: log.records_affected };
    }
  }

  const byMarket = new Map<string, { count: number; qualifiedCount: number }>();
  for (const e of (edgeRows ?? []) as any[]) {
    const m = byMarket.get(e.market) ?? { count: 0, qualifiedCount: 0 };
    m.count++;
    if (isQualityPick(e)) m.qualifiedCount++;
    byMarket.set(e.market, m);
  }

  return {
    marketWeight: MARKET_WEIGHT,
    tableCounts: { matches: matchCount ?? 0, edges: edgeCount ?? 0, odds: oddsCount ?? 0, team_stats: statsCount ?? 0 },
    lastSyncByJob,
    edgesByMarket: Array.from(byMarket.entries()).map(([market, v]) => ({ market, ...v })),
  };
}
