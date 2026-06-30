import { getServiceSupabase, isLiveMode } from "@/lib/supabase/server";
import { fetchFixtures, fetchResults, fetchOdds, fetchLineups, type ProviderOdd } from "./providers";
import { buildPredictions, buildEdges, MODEL_VERSION } from "@/lib/model/engine";
import { computeDynamicMarketWeight } from "@/lib/model/calibration";
import * as mock from "./mock";

export type SyncJob = "fixtures" | "results" | "odds" | "predictions" | "lineups" | "settle";

export interface SyncResult {
  job: SyncJob;
  status: "success" | "error";
  records: number;
  message: string;
  source: string;
}

const FIX_SRC = () => (isLiveMode() ? (process.env.FIXTURES_PROVIDER ?? "football-data") : mock.MOCK_SOURCE);
const ODDS_SRC = () => (isLiveMode() ? (process.env.ODDS_PROVIDER ?? "the-odds-api") : mock.MOCK_SOURCE);

// ─── sync_logs ───────────────────────────────────────────────
async function logStart(job: SyncJob, source: string): Promise<string | null> {
  if (!isLiveMode()) return null;
  const sb = getServiceSupabase()!;
  const { data } = await sb.from("sync_logs")
    .insert({ job, status: "running", source, started_at: new Date().toISOString() })
    .select("id").single();
  return data?.id ?? null;
}
async function logEnd(id: string | null, status: "success" | "error", records: number, message: string) {
  if (!isLiveMode() || !id) return;
  const sb = getServiceSupabase()!;
  await sb.from("sync_logs").update({
    status, records_affected: records, message: message.slice(0, 500), finished_at: new Date().toISOString(),
  }).eq("id", id);
}

async function upsertRows(
  table: string,
  rows: any[],
  options: { onConflict: string },
  chunkSize = 500
) {
  if (!rows.length) return;
  const sb = getServiceSupabase()!;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await sb.from(table).upsert(chunk, options);
    if (error) {
      throw new Error(`${table} upsert failed: ${error.message}`);
    }
  }
}

async function deleteRowsByMatchIds(table: string, matchIds: string[], chunkSize = 200) {
  if (!matchIds.length) return;
  const sb = getServiceSupabase()!;
  for (let i = 0; i < matchIds.length; i += chunkSize) {
    const chunk = matchIds.slice(i, i + chunkSize);
    const { error } = await sb.from(table).delete().in("match_id", chunk);
    if (error) {
      throw new Error(`${table} delete failed: ${error.message}`);
    }
  }
}

function dedupeBy<T>(rows: T[], keyOf: (row: T) => string): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) byKey.set(keyOf(row), row);
  return Array.from(byKey.values());
}

async function teamIdMap(): Promise<Map<string, string>> {
  const sb = getServiceSupabase()!;
  const { data } = await sb.from("teams").select("id, external_id");
  return new Map((data ?? []).filter((t: any) => t.external_id).map((t: any) => [t.external_id, t.id]));
}

// ─── Estadísticas calculadas desde los resultados reales ─────
// football-data.org no entrega stats; las derivamos de los partidos
// finalizados. Genera una fila por CADA equipo (0 partidos => prior neutro).
async function recomputeStats(): Promise<number> {
  const sb = getServiceSupabase()!;
  const { data: teams } = await sb.from("teams").select("id");
  const { data: finished } = await sb.from("matches")
    .select("home_team_id, away_team_id, home_score, away_score, kickoff")
    .eq("status", "finished");

  type Acc = { mp: number; gf: number; ga: number; form: { d: string; r: "W" | "D" | "L" }[] };
  const acc = new Map<string, Acc>();
  const ensure = (id: string) => acc.get(id) ?? acc.set(id, { mp: 0, gf: 0, ga: 0, form: [] }).get(id)!;

  for (const m of finished ?? []) {
    if (m.home_score == null || m.away_score == null) continue;
    const h = ensure(m.home_team_id), a = ensure(m.away_team_id);
    h.mp++; a.mp++;
    h.gf += m.home_score; h.ga += m.away_score;
    a.gf += m.away_score; a.ga += m.home_score;
    const hr: "W" | "D" | "L" = m.home_score > m.away_score ? "W" : m.home_score < m.away_score ? "L" : "D";
    const ar: "W" | "D" | "L" = hr === "W" ? "L" : hr === "L" ? "W" : "D";
    h.form.push({ d: m.kickoff, r: hr });
    a.form.push({ d: m.kickoff, r: ar });
  }

  const rows = (teams ?? []).map((t: any) => {
    const s = acc.get(t.id) ?? { mp: 0, gf: 0, ga: 0, form: [] };
    const form = s.form.sort((x, y) => y.d.localeCompare(x.d)).slice(0, 5).map((f) => f.r);
    return {
      team_id: t.id,
      matches_played: s.mp,
      goals_for: s.gf,
      goals_against: s.ga,
      gf_per_game: s.mp ? +(s.gf / s.mp).toFixed(3) : 0,
      ga_per_game: s.mp ? +(s.ga / s.mp).toFixed(3) : 0,
      recent_form: form,
      updated_at: new Date().toISOString(),
    };
  });
  await upsertRows("team_stats", rows, { onConflict: "team_id" });
  return rows.length;
}

// ─── Jobs ────────────────────────────────────────────────────
export async function syncFixtures(): Promise<SyncResult> {
  const source = FIX_SRC();
  const logId = await logStart("fixtures", source);
  try {
    if (!isLiveMode()) return done("fixtures", source, logId, mock.matches.length, "Mock: fixtures en memoria.");
    const sb = getServiceSupabase()!;
    const { teams, fixtures } = await fetchFixtures();

    if (teams.length)
      await upsertRows(
        "teams",
        teams.map((t) => ({ external_id: t.external_id, name: t.name, code: t.code, flag: t.flag })),
        { onConflict: "external_id" });

    const tMap = await teamIdMap();
    const matchRows = fixtures.map((f) => {
      const home_team_id = tMap.get(f.home_external_id);
      const away_team_id = tMap.get(f.away_external_id);
      if (!home_team_id || !away_team_id) return null;
      return {
        external_id: f.external_id, home_team_id, away_team_id,
        stage: f.stage, kickoff: f.kickoff, venue: f.venue,
        status: f.status, home_score: f.home_score, away_score: f.away_score,
        updated_at: new Date().toISOString(),
      };
    }).filter(Boolean);
    await upsertRows("matches", matchRows as any[], { onConflict: "external_id" });

    const nStats = await recomputeStats();
    return done("fixtures", source, logId, matchRows.length,
      `Equipos: ${teams.length}, partidos: ${matchRows.length}, stats: ${nStats}.`);
  } catch (e) {
    return fail("fixtures", source, logId, e);
  }
}

export async function syncResults(): Promise<SyncResult> {
  const source = FIX_SRC();
  const logId = await logStart("results", source);
  try {
    if (!isLiveMode()) return done("results", source, logId, 0, "Mock: sin resultados nuevos.");
    const sb = getServiceSupabase()!;
    const results = await fetchResults();
    let n = 0;
    for (const r of results) {
      const { error } = await sb.from("matches").update({
        status: r.status, home_score: r.home_score, away_score: r.away_score,
        updated_at: new Date().toISOString(),
      }).eq("external_id", r.external_id);
      if (!error) n++;
    }
    await recomputeStats();
    // Pilar 1: recalibración automática tras cada resultado.
    syncPredictions().catch((e) => console.error("[auto-recalibration] predictions sync failed:", e));
    // Liquidar picks cuyo partido ya finalizó.
    settlePicksLog().catch((e) => console.error("[auto-settle] picks settlement failed:", e));
    return done("results", source, logId, n, "Resultados actualizados; predicciones en recalibración.");
  } catch (e) {
    return fail("results", source, logId, e);
  }
}

// Normaliza nombres de equipo para emparejar entre proveedores.
const TEAM_ALIASES: Record<string, string> = {
  southkorea: "korearepublic", korearepublic: "korearepublic",
  iran: "iran", iriran: "iran", iranislamicrepublic: "iran",
  usa: "unitedstates", unitedstates: "unitedstates", unitedstatesofamerica: "unitedstates",
  czechia: "czechrepublic", czechrepublic: "czechrepublic",
  ivorycoast: "cotedivoire", cotedivoire: "cotedivoire",
  capeverde: "caboverde", caboverde: "caboverde",
};
function normTeam(name: string): string {
  const s = (name ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  return TEAM_ALIASES[s] ?? s;
}
// Cuando una cuota viene en orden invertido (visita como local), hay que
// intercambiar los outcomes de 1x2; btts y over/under son simétricos.
function swapOutcome(o: ProviderOdd): ProviderOdd {
  if (o.market !== "1x2") return o;
  const flip = o.outcome === "home" ? "away" : o.outcome === "away" ? "home" : o.outcome;
  return { ...o, outcome: flip };
}

export async function syncOdds(): Promise<SyncResult> {
  const source = ODDS_SRC();
  const logId = await logStart("odds", source);
  try {
    if (!isLiveMode()) return done("odds", source, logId, mock.odds.length, "Mock: cuotas en memoria.");
    const sb = getServiceSupabase()!;
    const providerOdds = await fetchOdds();
    const now = new Date().toISOString();

    // Mapas de emparejamiento
    const { data: matches } = await sb.from("matches")
      .select("id, external_id, home_team_id, away_team_id");
    const { data: teams } = await sb.from("teams").select("id, name");
    const teamName = new Map((teams ?? []).map((t: any) => [t.id, normTeam(t.name)]));
    const byExternal = new Map((matches ?? []).filter((m: any) => m.external_id).map((m: any) => [m.external_id, m.id]));
    const byPair = new Map<string, string>();   // "home|away" -> match_id
    for (const m of matches ?? []) {
      const h = teamName.get(m.home_team_id), a = teamName.get(m.away_team_id);
      if (h && a) byPair.set(`${h}|${a}`, m.id);
    }

    let matched = 0, unmatched = 0;
    const rows = providerOdds.map((o) => {
      let match_id: string | undefined;
      let odd = o;
      if (o.fixture_external_id) match_id = byExternal.get(o.fixture_external_id);
      if (!match_id && o.home_name && o.away_name) {
        const key = `${normTeam(o.home_name)}|${normTeam(o.away_name)}`;
        match_id = byPair.get(key);
        if (!match_id) {
          const rev = `${normTeam(o.away_name)}|${normTeam(o.home_name)}`;
          if (byPair.has(rev)) { match_id = byPair.get(rev); odd = swapOutcome(o); }
        }
      }
      if (!match_id) { unmatched++; return null; }
      matched++;
      return {
        match_id, bookmaker: odd.bookmaker, market: odd.market, outcome: odd.outcome,
        decimal_odds: odd.decimal_odds, line: odd.line ?? null, source, fetched_at: now,
      };
    }).filter(Boolean);

    const uniqueRows = dedupeBy(rows as any[], (r) =>
      `${r.match_id}|${r.bookmaker}|${r.market}|${r.outcome}`
    );
    const duplicates = rows.length - uniqueRows.length;

    await upsertRows("odds", uniqueRows, { onConflict: "match_id,bookmaker,market,outcome" });
    return done("odds", source, logId, uniqueRows.length,
      `Cuotas emparejadas: ${matched}, sin partido: ${unmatched}, duplicadas descartadas: ${duplicates}.`);
  } catch (e) {
    return fail("odds", source, logId, e);
  }
}

export async function syncPredictions(): Promise<SyncResult> {
  const source = MODEL_VERSION;
  const logId = await logStart("predictions", source);
  try {
    if (!isLiveMode()) {
      let n = 0;
      for (const m of mock.matches) {
        const hs = mock.teamStats.find((s) => s.team_id === m.home_team_id)!;
        const as = mock.teamStats.find((s) => s.team_id === m.away_team_id)!;
        const preds = buildPredictions(m, hs, as);
        n += buildEdges(m, preds, mock.odds.filter((x) => x.match_id === m.id)).length;
      }
      return done("predictions", source, logId, n, "Mock: predicciones/edges al vuelo.");
    }

    const sb = getServiceSupabase()!;
    const { data: matches } = await sb.from("matches").select("*").in("status", ["scheduled", "live"]);
    const { data: stats } = await sb.from("team_stats").select("*");
    // IMPORTANTE: filtrar odds solo por los partidos scheduled/live para evitar el
    // límite de 1000 filas por defecto de PostgREST que trunca la respuesta cuando
    // la tabla completa supera ese tamaño (e.g. 7000+ odds de partidos finalizados).
    const scheduledMatchIds = (matches ?? []).map((m: any) => m.id).filter(Boolean);
    console.log(`[syncPredictions] partidos scheduled/live: ${scheduledMatchIds.length}`);

    const { data: allOdds } = scheduledMatchIds.length
      ? await sb.from("odds").select("*").in("match_id", scheduledMatchIds)
      : { data: [] };
    const statMap = new Map((stats ?? []).map((s: any) => [s.team_id, s]));
    console.log(`[syncPredictions] stats cargadas: ${statMap.size}, cuotas: ${(allOdds ?? []).length}`);

    // B.2: Dynamic MARKET_WEIGHT based on live Brier Score of WC 2026 data.
    const calibration = await computeDynamicMarketWeight(sb);
    console.log(`[syncPredictions] calibration: ${calibration.note} (weight=${calibration.effectiveMarketWeight})`);

    const predRows: any[] = [], edgeRows: any[] = [];
    let skipped = 0;
    for (const m of matches ?? []) {
      const hs = statMap.get(m.home_team_id), as = statMap.get(m.away_team_id);
      if (!hs || !as) { skipped++; continue; }
      const preds = buildPredictions(m as any, hs as any, as as any);
      const o = (allOdds ?? []).filter((x: any) => x.match_id === m.id);
      const edges = buildEdges(m as any, preds, o as any, calibration.effectiveMarketWeight);
      predRows.push(...preds);
      edgeRows.push(...edges);
      console.log(`[syncPredictions] ${m.id}: ${preds.length} preds, ${edges.length} edges, ${o.length} odds`);
    }
    if (skipped) console.warn(`[syncPredictions] ${skipped} partidos sin stats — omitidos`);
    const dbPredRows = predRows.map(({ id, ...row }) => row);
    const dbEdgeRows = edgeRows.map(({ id, ...row }) => row);

    // Limpia edges de partidos finalizados (evita que se acumulen stale en tabla)
    const { data: finishedMatches } = await sb.from("matches").select("id").eq("status", "finished");
    const finishedIds = (finishedMatches ?? []).map((m: any) => m.id).filter(Boolean);
    if (finishedIds.length) {
      console.log(`[syncPredictions] limpiando edges de ${finishedIds.length} partidos finalizados`);
      await deleteRowsByMatchIds("edges", finishedIds);
    }

    await deleteRowsByMatchIds("edges", scheduledMatchIds);
    await upsertRows("predictions", dbPredRows, { onConflict: "match_id,market,outcome,model_version" });
    await upsertRows("edges", dbEdgeRows, { onConflict: "match_id,market,outcome" });
    console.log(`[syncPredictions] completado: ${dbPredRows.length} predicciones, ${dbEdgeRows.length} edges`);
    return done("predictions", source, logId, edgeRows.length, `Predicciones: ${dbPredRows.length}, edges: ${dbEdgeRows.length}, sin stats: ${skipped}`);
  } catch (e) {
    return fail("predictions", source, logId, e);
  }
}

export async function syncLineups(): Promise<SyncResult> {
  const source = "api-football";
  const logId = await logStart("lineups", source);
  try {
    if (!process.env.API_FOOTBALL_KEY) {
      return done("lineups", source, logId, 0, "API_FOOTBALL_KEY not configured — skipping lineups.");
    }
    if (!isLiveMode()) {
      return done("lineups", source, logId, 0, "Mock: lineups no aplican en modo mock.");
    }
    const sb = getServiceSupabase()!;
    const now = new Date();
    const window = new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString();
    const { data: upcoming } = await sb
      .from("matches")
      .select("id, external_id")
      .eq("status", "scheduled")
      .gte("kickoff", now.toISOString())
      .lte("kickoff", window);

    let saved = 0;
    for (const m of upcoming ?? []) {
      if (!m.external_id) continue;
      const lineups = await fetchLineups(String(m.external_id));
      if (!lineups) continue;
      const { error } = await sb.from("lineups").upsert({
        match_id: m.id,
        home_xi: lineups.home,
        away_xi: lineups.away,
        source,
        fetched_at: new Date().toISOString(),
      }, { onConflict: "match_id" });
      if (!error) saved++;
      else console.error(`[syncLineups] upsert error for ${m.id}:`, error.message);
    }
    return done("lineups", source, logId, saved, `Alineaciones guardadas: ${saved}/${(upcoming ?? []).length} partidos.`);
  } catch (e) {
    return fail("lineups", source, logId, e);
  }
}

export async function settlePicksLog(): Promise<SyncResult> {
  const source = "picks-settlement";
  // Log under "predictions" job to avoid breaking SyncLog type constraints.
  const logId = await logStart("predictions", source);
  try {
    if (!isLiveMode()) return done("predictions", source, logId, 0, "Mock: skip settle.");
    const sb = getServiceSupabase()!;

    const { data: pending } = await sb
      .from("picks_log")
      .select("*")
      .is("result", null);

    if (!pending?.length) {
      return done("predictions", source, logId, 0, "Sin picks pendientes de liquidar.");
    }

    const matchIds = [...new Set((pending as any[]).map((p: any) => p.match_id))];
    const { data: finishedMatches } = await sb
      .from("matches")
      .select("id, home_score, away_score, status")
      .in("id", matchIds)
      .eq("status", "finished");

    const matchMap = new Map((finishedMatches ?? []).map((m: any) => [m.id, m]));

    let settled = 0;
    for (const pick of pending as any[]) {
      const match = matchMap.get(pick.match_id);
      if (!match || match.home_score == null || match.away_score == null) continue;

      const hs = Number(match.home_score);
      const as_ = Number(match.away_score);
      const total = hs + as_;
      let won: boolean | null = null;

      if (pick.market === "1x2") {
        if (pick.outcome === "home") won = hs > as_;
        else if (pick.outcome === "away") won = as_ > hs;
        else if (pick.outcome === "draw") won = hs === as_;
      } else if (pick.market === "over_under_2_5") {
        won = pick.outcome === "over" ? total > 2.5 : total < 2.5;
      } else if (pick.market === "over_under_1_5") {
        won = pick.outcome === "over" ? total > 1.5 : total < 1.5;
      } else if (pick.market === "over_under_3_5") {
        won = pick.outcome === "over" ? total > 3.5 : total < 3.5;
      } else if (pick.market === "btts") {
        const bttsYes = hs > 0 && as_ > 0;
        won = pick.outcome === "yes" ? bttsYes : !bttsYes;
      }

      if (won === null) continue;
      const pnl = won ? Number(pick.decimal_odds) - 1 : -1.0;

      await sb.from("picks_log").update({
        result: won ? "win" : "loss",
        settled_at: new Date().toISOString(),
        pnl,
      }).eq("id", pick.id);
      settled++;
    }

    return done("predictions", source, logId, settled, `${settled} picks liquidados.`);
  } catch (e) {
    return fail("predictions", source, logId, e);
  }
}

export async function runJob(job: SyncJob): Promise<SyncResult> {
  switch (job) {
    case "fixtures": return syncFixtures();
    case "results": return syncResults();
    case "odds": return syncOdds();
    case "predictions": return syncPredictions();
    case "lineups": return syncLineups();
    case "settle": return settlePicksLog();
  }
}
export async function runAll(): Promise<SyncResult[]> {
  return [
    await syncFixtures(),
    await syncResults(),
    await syncOdds(),
    await syncPredictions(),
    await syncLineups(),
  ];
}

async function done(job: SyncJob, source: string, logId: string | null, records: number, message: string): Promise<SyncResult> {
  await logEnd(logId, "success", records, message);
  return { job, status: "success", records, message, source };
}
async function fail(job: SyncJob, source: string, logId: string | null, e: unknown): Promise<SyncResult> {
  const message = e instanceof Error ? e.message : String(e);
  await logEnd(logId, "error", 0, message);
  return { job, status: "error", records: 0, message, source };
}
