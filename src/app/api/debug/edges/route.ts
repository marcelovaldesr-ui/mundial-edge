import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const sb = getServiceSupabase();
  if (!sb) return NextResponse.json({ error: "no supabase client", DATA_MODE: process.env.DATA_MODE });

  const now = new Date();

  // 1. Count raw edges
  const { count: edgeCount } = await sb.from("edges").select("*", { count: "exact", head: true });

  // 2. Edges with join (same query as getAllEdges)
  const { data: joinedEdges, error: joinError } = await sb
    .from("edges")
    .select("id, match_id, market, outcome, expected_value, implied_probability, match:matches!inner(id, status, kickoff)")
    .order("expected_value", { ascending: false })
    .limit(10);

  // 3. Scheduled matches
  const { data: scheduledMatches } = await sb
    .from("matches")
    .select("id, status, kickoff")
    .in("status", ["scheduled", "live"]);

  // 4. Filter analysis
  const futureEdges = (joinedEdges ?? []).filter((e: any) => {
    const m = e.match;
    if (!m) return false;
    if (m.status !== "scheduled" && m.status !== "live") return false;
    const kickoffMs = m.kickoff ? new Date(m.kickoff).getTime() : 0;
    return kickoffMs > now.getTime();
  });

  return NextResponse.json({
    serverNow: now.toISOString(),
    DATA_MODE: process.env.DATA_MODE,
    edgeCount,
    joinedEdgesReturned: joinedEdges?.length ?? 0,
    joinError: joinError?.message ?? null,
    scheduledMatches: scheduledMatches?.length ?? 0,
    futureEdgesAfterFilter: futureEdges.length,
    sampleJoinedEdges: (joinedEdges ?? []).slice(0, 3).map((e: any) => ({
      match_id: e.match_id,
      market: e.market,
      outcome: e.outcome,
      ev: e.expected_value,
      implied_prob: e.implied_probability,
      match: e.match ? {
        status: e.match.status,
        kickoff: e.match.kickoff,
        isFuture: e.match.kickoff ? new Date(e.match.kickoff).getTime() > now.getTime() : false,
      } : null,
    })),
    scheduledMatchKickoffs: (scheduledMatches ?? []).map((m: any) => ({
      id: m.id.slice(0, 8),
      status: m.status,
      kickoff: m.kickoff,
      isFuture: m.kickoff ? new Date(m.kickoff).getTime() > now.getTime() : false,
    })),
  });
}
