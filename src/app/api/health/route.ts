import { NextResponse } from "next/server";
import { getServiceSupabase, isLiveMode } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const timestamp = new Date().toISOString();

  if (!isLiveMode()) {
    return NextResponse.json({ status: "ok", mode: "mock", timestamp });
  }

  const sb = getServiceSupabase();
  if (!sb) {
    return NextResponse.json({ status: "down", supabase: false, timestamp }, { status: 503 });
  }

  // Supabase connectivity
  let supabase = false;
  let matchesCount = 0;
  let edgesCount = 0;
  const lastSync: Record<string, { at: string | null; status: string } | null> = {
    fixtures: null, results: null, odds: null, predictions: null,
  };

  try {
    const [matchRes, edgeRes, logsRes] = await Promise.all([
      sb.from("matches").select("*", { count: "exact", head: true }),
      sb.from("edges").select("*", { count: "exact", head: true }),
      sb.from("sync_logs").select("job, status, finished_at")
        .eq("status", "success").order("finished_at", { ascending: false }).limit(20),
    ]);
    supabase = !matchRes.error;
    matchesCount = matchRes.count ?? 0;
    edgesCount = edgeRes.count ?? 0;
    for (const row of (logsRes.data ?? []) as any[]) {
      if (!lastSync[row.job]) lastSync[row.job] = { at: row.finished_at, status: row.status };
    }
  } catch {
    supabase = false;
  }

  // Odds API lightweight check (just verify key configured)
  const oddsApi = Boolean(process.env.ODDS_API_KEY);

  const status = supabase ? (edgesCount > 0 ? "ok" : "degraded") : "down";

  return NextResponse.json({
    status,
    supabase,
    oddsApi,
    lastSync,
    matchesCount,
    edgesCount,
    timestamp,
  }, { status: status === "down" ? 503 : 200 });
}
