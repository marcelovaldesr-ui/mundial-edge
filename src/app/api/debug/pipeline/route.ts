import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";
import { getAllEdges, getEdges } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = getServiceSupabase();
  if (!sb) return NextResponse.json({ error: "no supabase client" });

  // 1. Simple query (same as debug/edges — known to work)
  const { data: simple, error: simpleErr } = await sb
    .from("edges")
    .select("id, match_id, expected_value, match:matches!inner(id, status, kickoff)")
    .order("expected_value", { ascending: false })
    .limit(5);

  // 2. Full nested query (same as getAllEdges in repository.ts)
  const { data: full, error: fullErr } = await sb
    .from("edges")
    .select("*, match:matches!inner(*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*))")
    .order("expected_value", { ascending: false })
    .limit(5);

  // 3. Call getAllEdges() exactly (goes through cachedLiveRead)
  let allEdgesCount = -1;
  let allEdgesError: string | null = null;
  let allEdgesSample: unknown = null;
  try {
    const result = await getAllEdges();
    allEdgesCount = result.length;
    allEdgesSample = result.slice(0, 2).map((e) => ({
      id: e.id,
      match_id: e.match_id,
      hasMatch: !!e.match,
      matchStatus: e.match?.status ?? null,
      matchKickoff: e.match?.kickoff ?? null,
    }));
  } catch (e: unknown) {
    allEdgesError = e instanceof Error ? e.message : String(e);
  }

  // 4. Call getEdges() (getAllEdges + filterPreMatchEdges)
  let filteredEdgesCount = -1;
  let filteredEdgesError: string | null = null;
  try {
    const result = await getEdges();
    filteredEdgesCount = result.length;
  } catch (e: unknown) {
    filteredEdgesError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    simpleQuery: {
      count: simple?.length ?? 0,
      error: simpleErr?.message ?? null,
      sample: (simple ?? []).slice(0, 2).map((e: any) => ({
        id: e.id,
        match_id: e.match_id,
        hasMatch: !!e.match,
        matchIsArray: Array.isArray(e.match),
        matchStatus: Array.isArray(e.match) ? e.match[0]?.status : e.match?.status,
      })),
    },
    fullNestedQuery: {
      count: full?.length ?? 0,
      error: fullErr?.message ?? null,
      sample: (full ?? []).slice(0, 2).map((e: any) => ({
        id: e.id,
        match_id: e.match_id,
        hasMatch: !!e.match,
        matchIsArray: Array.isArray(e.match),
        matchStatus: Array.isArray(e.match) ? e.match[0]?.status : e.match?.status,
        matchKickoff: Array.isArray(e.match) ? e.match[0]?.kickoff : e.match?.kickoff,
        homeTeam: Array.isArray(e.match) ? e.match[0]?.home_team?.code : e.match?.home_team?.code,
      })),
    },
    getAllEdges: {
      count: allEdgesCount,
      error: allEdgesError,
      sample: allEdgesSample,
    },
    getEdges: {
      count: filteredEdgesCount,
      error: filteredEdgesError,
    },
  });
}
