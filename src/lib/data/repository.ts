import type { Match, Edge, TeamStats, Odd, SyncLog } from "@/lib/types";
import { getServiceSupabase, isLiveMode } from "@/lib/supabase/server";
import * as mock from "./mock";
import { buildPredictions, buildEdges } from "@/lib/model/engine";
import { isQualityPick } from "@/lib/model/edge";
import { filterPreMatchEdges } from "@/lib/matches/pre-match-eligibility";

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
    const sb = getServiceSupabase()!;
    const { data } = await sb
      .from("matches")
      .select("*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)")
      .order("kickoff", { ascending: true });
    return (data as Match[]) ?? [];
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
    const sb = getServiceSupabase()!;
    // Leemos la tabla `edges` directamente (no la vista v_top_edges) para no
    // depender de la caché de esquema de PostgREST, y traemos el partido +
    // equipos anidados para mostrar nombres en la tabla.
    const { data, error } = await sb
      .from("edges")
      .select(
        "*, match:matches!inner(*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*))"
      )
      .order("expected_value", { ascending: false });
    if (error) {
      console.error("[getEdges] error:", error.message);
      return [];
    }
    const rows = (data as unknown as Edge[]) ?? [];
    return annotate(rows);
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
    const sb = getServiceSupabase()!;
    const { data } = await sb.from("odds").select("*").eq("match_id", matchId);
    return (data as Odd[]) ?? [];
  }
  return mock.odds.filter((o) => o.match_id === matchId);
}

export async function getTeamStats(): Promise<TeamStats[]> {
  if (isLiveMode()) {
    const sb = getServiceSupabase()!;
    const { data, error } = await sb.from("team_stats").select("*");
    if (error) {
      console.error("[getTeamStats] error:", error.message);
      return [];
    }
    return (data as TeamStats[]) ?? [];
  }
  return mock.teamStats;
}

export async function getLastSync(): Promise<{ at: string | null; source: string }> {
  if (isLiveMode()) {
    const sb = getServiceSupabase()!;
    const { data } = await sb
      .from("sync_logs").select("finished_at, source")
      .eq("status", "success").order("finished_at", { ascending: false }).limit(1);
    const row = data?.[0];
    return { at: row?.finished_at ?? null, source: row?.source ?? "supabase" };
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
