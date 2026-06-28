import type { Market, Outcome, MatchStatus } from "@/lib/types";
import { getServiceSupabase } from "@/lib/supabase/server";
import { fetchSofascoreOdds } from "./sofascore-provider";
import { normalizeSofascoreOdds } from "./sofascore-normalizer";

// ============================================================
//  Adaptadores de proveedores externos (modo live).
//
//  STACK GRATIS para el Mundial 2026 EN CURSO:
//    - Fixtures/resultados: football-data.org (token free incluye la WC)
//    - Cuotas:              The Odds API (free 500 créditos, key soccer_fifa_world_cup)
//
//  Respaldo: API-Football (su plan free NO cubre la temporada actual).
//
//  Selección por variables de entorno:
//    FIXTURES_PROVIDER = football-data (default) | api-football
//    ODDS_PROVIDER     = the-odds-api  (default) | api-football
//
//  Las funciones devuelven DTOs neutrales. sync.ts mapea a la BD
//  (por external_id cuando comparten id, o por nombre de equipo).
// ============================================================

const env = (k: string) => process.env[k];

// ─── DTOs neutrales ──────────────────────────────────────────
export interface ProviderTeam {
  external_id: string;
  name: string;
  code: string;
  flag: string | null;
}
export interface ProviderFixture {
  external_id: string;
  home_external_id: string;
  away_external_id: string;
  home_name: string;
  away_name: string;
  stage: string;
  kickoff: string;
  venue: string | null;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
}
export interface FixturesBundle {
  teams: ProviderTeam[];
  fixtures: ProviderFixture[];
}
export interface ProviderOdd {
  fixture_external_id?: string;   // si el proveedor de cuotas comparte id
  home_name?: string;             // para emparejar por nombre (cross-provider)
  away_name?: string;
  commence_time?: string;
  bookmaker: string;
  market: Market;
  outcome: Outcome;
  decimal_odds: number;
  line?: number | null;           // 1.5 / 2.5 / 3.5 for over_under; null otherwise
}

// ─── Dispatchers públicos (lo que usa sync.ts) ───────────────
export async function fetchFixtures(): Promise<FixturesBundle> {
  return fixturesProvider() === "api-football"
    ? fetchFixturesApiFootball(false)
    : fetchFromFootballData(false);
}
export async function fetchResults(): Promise<ProviderFixture[]> {
  if (fixturesProvider() === "api-football") return (await fetchFixturesApiFootball(true)).fixtures;
  return (await fetchFromFootballData(true)).fixtures;
}
export async function fetchOdds(): Promise<ProviderOdd[]> {
  // Capa 1: proveedor principal (The Odds API o API-Football)
  const primary: ProviderOdd[] =
    oddsProvider() === "api-football" ? await fetchOddsApiFootball() : await fetchOddsTheOddsApi();

  // Capa 2: Sofascore — mercados adicionales (opt-in, no rompe el flujo si falla)
  if (process.env.SOFASCORE_ENABLED !== "true") return primary;

  let sfOdds: ProviderOdd[] = [];
  try {
    sfOdds = await fetchOddsSofascore();
  } catch (err) {
    // Circuit abierto o error total — continúa con cuotas primarias
    console.error("[providers] Sofascore falló, usando solo proveedor principal:", String(err));
    return primary;
  }

  // Dedup: Sofascore no añade mercados ya cubiertos por el proveedor primario
  const covered = new Set(
    primary.map((o) => `${o.home_name ?? ""}|${o.away_name ?? ""}|${o.market}|${o.outcome}`)
  );
  for (const odd of sfOdds) {
    const key = `${odd.home_name ?? ""}|${odd.away_name ?? ""}|${odd.market}|${odd.outcome}`;
    if (!covered.has(key)) {
      primary.push(odd);
      covered.add(key);
    }
  }

  return primary;
}

/** Lee matches con sofascore_event_id y obtiene cuotas extendidas de Sofascore. */
async function fetchOddsSofascore(): Promise<ProviderOdd[]> {
  const sb = getServiceSupabase();
  if (!sb) return [];

  const { data: matches } = await sb
    .from("matches")
    .select("id, sofascore_event_id, home_team_id, away_team_id")
    .in("status", ["scheduled", "live"])
    .not("sofascore_event_id", "is", null)
    .limit(30);

  if (!matches?.length) return [];

  // Nombres de equipos para el ProviderOdd (emparejar luego en sync.ts por nombre)
  const teamIds = [...new Set(matches.flatMap((m: any) => [m.home_team_id, m.away_team_id]))];
  const { data: teams } = await sb.from("teams").select("id, name").in("id", teamIds);
  const teamName = new Map((teams ?? []).map((t: any) => [t.id, t.name as string]));

  const result: ProviderOdd[] = [];
  for (const match of matches) {
    const eventId = String(match.sofascore_event_id);
    const homeName = teamName.get(match.home_team_id) ?? "";
    const awayName = teamName.get(match.away_team_id) ?? "";

    let rawOdds;
    try {
      rawOdds = await fetchSofascoreOdds(eventId);
    } catch (err) {
      // Circuit breaker abierto — propaga para cortar el job
      throw err;
    }

    if (!rawOdds.length) continue;
    const normalized = normalizeSofascoreOdds(match.id, homeName, awayName, rawOdds);
    result.push(...normalized);
  }

  return result;
}

const fixturesProvider = () => env("FIXTURES_PROVIDER") ?? "football-data";
const oddsProvider = () => env("ODDS_PROVIDER") ?? "the-odds-api";

// ============================================================
//  football-data.org  (v4)
//  Docs: https://www.football-data.org/documentation/quickstart
// ============================================================
const FD_BASE = () => env("FOOTBALL_DATA_BASE") ?? "https://api.football-data.org/v4";
const FD_COMP = () => env("FOOTBALL_DATA_COMPETITION") ?? "WC"; // World Cup

async function fdGet(path: string): Promise<any> {
  const token = env("FOOTBALL_DATA_TOKEN");
  if (!token) throw new Error("FOOTBALL_DATA_TOKEN no configurado");
  const res = await fetch(`${FD_BASE()}${path}`, {
    headers: { "X-Auth-Token": token },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${await res.text()}`);
  return res.json();
}

const FD_STAGE: Record<string, string> = {
  GROUP_STAGE: "Group Stage",
  LAST_16: "Round of 16",
  ROUND_OF_16: "Round of 16",
  LAST_32: "Round of 32",
  QUARTER_FINALS: "Quarter-finals",
  SEMI_FINALS: "Semi-finals",
  THIRD_PLACE: "Third place",
  FINAL: "Final",
};

function footballDataStage(match: any): string {
  if (match.stage === "GROUP_STAGE" && match.group) {
    const group = String(match.group).toUpperCase().replace(/^GROUP[\s_-]*/, "");
    if (/^[A-L]$/.test(group)) return `Group ${group}`;
  }
  return FD_STAGE[match.stage] ?? (match.group ?? "Group Stage");
}

function fdStatus(s: string): MatchStatus {
  if (["SCHEDULED", "TIMED"].includes(s)) return "scheduled";
  if (["IN_PLAY", "PAUSED"].includes(s)) return "live";
  if (["FINISHED", "AWARDED"].includes(s)) return "finished";
  return "postponed";
}

function fdTeamCode(t: any): string {
  return (t?.tla as string) || (t?.name as string)?.slice(0, 3).toUpperCase() || "???";
}

async function fetchFromFootballData(onlyFinished: boolean): Promise<FixturesBundle> {
  const season = env("FOOTBALL_DATA_SEASON"); // opcional (ej. 2026)
  const q = [season ? `season=${season}` : "", onlyFinished ? "status=FINISHED" : ""]
    .filter(Boolean).join("&");
  const json = await fdGet(`/competitions/${FD_COMP()}/matches${q ? `?${q}` : ""}`);
  const matches: any[] = json.matches ?? [];

  const teamsMap = new Map<string, ProviderTeam>();
  const fixtures: ProviderFixture[] = [];
  for (const m of matches) {
    const h = m.homeTeam, a = m.awayTeam;
    if (!h?.id || !a?.id) continue; // partidos sin equipos definidos (placeholders de fase)
    for (const t of [h, a]) {
      const id = String(t.id);
      if (!teamsMap.has(id)) {
        teamsMap.set(id, { external_id: id, name: t.name, code: fdTeamCode(t), flag: t.crest ?? null });
      }
    }
    fixtures.push({
      external_id: String(m.id),
      home_external_id: String(h.id),
      away_external_id: String(a.id),
      home_name: h.name,
      away_name: a.name,
      stage: footballDataStage(m),
      kickoff: m.utcDate,
      venue: m.venue ?? null,
      status: fdStatus(m.status),
      home_score: m.score?.fullTime?.home ?? null,
      away_score: m.score?.fullTime?.away ?? null,
    });
  }
  return { teams: Array.from(teamsMap.values()), fixtures };
}

// ============================================================
//  The Odds API  (v4)  — cuotas
//  Docs: https://the-odds-api.com/liveapi/guides/v4/
// ============================================================
// The Odds API soporta h2h, totals y btts para la WC (btts disponible en algunas regiones).
const AF_MARKET_KEYS = "h2h,totals,btts";

// D.2: shared rate-limit state (per-instance; logs WARNING/CRITICAL to console)
let oddsApiRequestsRemaining: number | null = null;

async function fetchWithRetry(url: string, opts: RequestInit, maxAttempts = 3): Promise<Response> {
  let lastError: Error = new Error("Unknown fetch error");
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, opts);
      // D.2: Read rate-limit headers
      const remaining = res.headers.get("x-requests-remaining");
      if (remaining != null) {
        oddsApiRequestsRemaining = Number(remaining);
        if (oddsApiRequestsRemaining < 10) {
          console.error(`[odds-api] CRITICAL: solo ${oddsApiRequestsRemaining} requests restantes — saltando sync`);
          throw new Error(`ODDS_API_RATE_CRITICAL: ${oddsApiRequestsRemaining} remaining`);
        }
        if (oddsApiRequestsRemaining < 50) {
          console.warn(`[odds-api] WARNING: ${oddsApiRequestsRemaining} requests restantes`);
        }
      }
      if (res.ok) return res;
      // D.1: Only retry on 5xx; 4xx are permanent failures
      if (res.status < 500) throw new Error(`The Odds API ${res.status}: ${await res.text()}`);
      lastError = new Error(`The Odds API ${res.status} (attempt ${attempt + 1})`);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("ODDS_API_RATE_CRITICAL")) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    if (attempt < maxAttempts - 1) {
      const waitMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
      console.warn(`[odds-api] Retry ${attempt + 1}/${maxAttempts - 1} in ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastError;
}

async function fetchOddsTheOddsApi(): Promise<ProviderOdd[]> {
  const key = env("ODDS_API_KEY");
  const baseUrl = env("ODDS_API_BASE") ?? "https://api.the-odds-api.com/v4";
  const sport = env("ODDS_SPORT_KEY") ?? "soccer_fifa_world_cup";
  const regions = env("ODDS_API_REGIONS") ?? "eu,us,uk,au";
  if (!key) throw new Error("ODDS_API_KEY no configurada");

  const url = `${baseUrl}/sports/${sport}/odds?regions=${regions}&markets=${AF_MARKET_KEYS}&oddsFormat=decimal&apiKey=${key}`;
  const res = await fetchWithRetry(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`The Odds API ${res.status}`);
  const raw = (await res.json()) as any[];

  // Mapeo de líneas de totales a mercados tipados.
  const TOTAL_LINE_MARKET: Record<number, Market> = {
    1.5: "over_under_1_5",
    2.5: "over_under_2_5",
    3.5: "over_under_3_5",
  };

  const out: ProviderOdd[] = [];
  for (const game of raw) {
    const home = game.home_team, away = game.away_team;
    for (const bk of game.bookmakers ?? []) {
      for (const market of bk.markets ?? []) {
        if (market.key !== "h2h" && market.key !== "totals" && market.key !== "btts") continue;
        for (const oc of market.outcomes ?? []) {
          let m: Market | null = null;
          let outcome: Outcome | null = null;

          if (market.key === "h2h") {
            m = "1x2";
            if (oc.name === home) outcome = "home";
            else if (oc.name === away) outcome = "away";
            else if (oc.name === "Draw") outcome = "draw";
          } else if (market.key === "totals") {
            const point = Number(oc.point);
            m = TOTAL_LINE_MARKET[point] ?? null;
            if (!m) continue;
            outcome = String(oc.name).toLowerCase().includes("over") ? "over" : "under";
          } else if (market.key === "btts") {
            m = "btts";
            outcome = String(oc.name).toLowerCase() === "yes" ? "yes" : "no";
          }

          if (!m || !outcome) continue;
          const dec = Number(oc.price);
          if (!dec || dec <= 1) continue;
          out.push({
            home_name: home, away_name: away, commence_time: game.commence_time,
            bookmaker: bk.title ?? bk.key, market: m, outcome, decimal_odds: dec,
          });
        }
      }
    }
  }
  return out;
}

// ============================================================
//  API-Football  (v3)  — RESPALDO (su free no cubre temporada actual)
// ============================================================
function afHeaders() {
  const key = env("API_FOOTBALL_KEY");
  if (!key) throw new Error("API_FOOTBALL_KEY no configurada");
  return { "x-apisports-key": key };
}
const afBase = () => env("API_FOOTBALL_BASE") ?? "https://v3.football.api-sports.io";
const afLeague = () => env("API_FOOTBALL_LEAGUE") ?? "1";
const afSeason = () => env("API_FOOTBALL_SEASON") ?? "2022";

async function afGet(path: string): Promise<any> {
  const res = await fetch(`${afBase()}${path}`, { headers: afHeaders(), next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length)
    throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`);
  return json;
}

function afMapStatus(short: string): MatchStatus {
  if (["NS", "TBD"].includes(short)) return "scheduled";
  if (["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "INT"].includes(short)) return "live";
  if (["FT", "AET", "PEN"].includes(short)) return "finished";
  return "postponed";
}

async function fetchFixturesApiFootball(onlyFinished: boolean): Promise<FixturesBundle> {
  const status = onlyFinished ? "&status=FT-AET-PEN" : "";
  const json = await afGet(`/fixtures?league=${afLeague()}&season=${afSeason()}${status}`);
  const teamsMap = new Map<string, ProviderTeam>();
  const fixtures: ProviderFixture[] = [];
  for (const r of json.response ?? []) {
    const h = r.teams.home, a = r.teams.away;
    for (const t of [h, a]) {
      const id = String(t.id);
      if (!teamsMap.has(id))
        teamsMap.set(id, { external_id: id, name: t.name, code: (t.name as string)?.slice(0, 3).toUpperCase(), flag: t.logo ?? null });
    }
    fixtures.push({
      external_id: String(r.fixture.id),
      home_external_id: String(h.id), away_external_id: String(a.id),
      home_name: h.name, away_name: a.name,
      stage: r.league?.round ?? "Group Stage",
      kickoff: r.fixture.date, venue: r.fixture.venue?.name ?? null,
      status: afMapStatus(r.fixture.status?.short ?? "NS"),
      home_score: r.goals?.home ?? null, away_score: r.goals?.away ?? null,
    });
  }
  return { teams: Array.from(teamsMap.values()), fixtures };
}

const AF_BET_MARKET: Record<number, Market> = { 1: "1x2", 8: "btts", 5: "over_under_2_5" };

async function fetchOddsApiFootball(): Promise<ProviderOdd[]> {
  const json = await afGet(`/odds?league=${afLeague()}&season=${afSeason()}`);
  const out: ProviderOdd[] = [];
  for (const r of json.response ?? []) {
    const fixtureId = String(r.fixture?.id);
    for (const bk of r.bookmakers ?? []) {
      for (const bet of bk.bets ?? []) {
        const market = AF_BET_MARKET[bet.id];
        if (!market) continue;
        for (const v of bet.values ?? []) {
          const outcome = afMapOutcome(market, v.value);
          if (!outcome) continue;
          const dec = Number(v.odd);
          if (!dec || dec <= 1) continue;
          out.push({ fixture_external_id: fixtureId, bookmaker: bk.name, market, outcome, decimal_odds: dec });
        }
      }
    }
  }
  return out;
}
function afMapOutcome(market: Market, value: string): Outcome | null {
  const v = String(value).toLowerCase();
  if (market === "1x2") return v === "home" ? "home" : v === "draw" ? "draw" : v === "away" ? "away" : null;
  if (market === "btts") return v === "yes" ? "yes" : v === "no" ? "no" : null;
  if (market === "over_under_2_5") return v === "over 2.5" ? "over" : v === "under 2.5" ? "under" : null;
  return null;
}

// ============================================================
//  API-Football Pro — Lineups & Injuries (scaffold)
//  Activado solo cuando API_FOOTBALL_KEY está configurado.
//  Degrada elegantemente si la key no existe o la llamada falla.
// ============================================================

export interface LineupData {
  home: string[];   // nombres de titulares del equipo local
  away: string[];   // nombres de titulares del equipo visitante
}

export interface InjuryPlayer {
  name: string;
  type: string;     // "Injured" | "Suspended" | "Questionable"
  reason: string;
  teamSide: "home" | "away";
}

export async function fetchLineups(fixtureExternalId: string): Promise<LineupData | null> {
  const key = env("API_FOOTBALL_KEY");
  if (!key) return null;
  try {
    const res = await fetch(
      `${afBase()}/fixtures/lineups?fixture=${fixtureExternalId}`,
      { headers: afHeaders(), next: { revalidate: 0 } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const responses: any[] = json.response ?? [];
    if (responses.length < 2) return null;
    const toNames = (r: any): string[] =>
      (r.startXI ?? []).map((p: any) => p.player?.name ?? "").filter(Boolean);
    return { home: toNames(responses[0]), away: toNames(responses[1]) };
  } catch {
    return null;
  }
}

export async function fetchInjuries(fixtureExternalId: string): Promise<InjuryPlayer[]> {
  const key = env("API_FOOTBALL_KEY");
  if (!key) return [];
  try {
    const res = await fetch(
      `${afBase()}/injuries?fixture=${fixtureExternalId}`,
      { headers: afHeaders(), next: { revalidate: 900 } }  // 15 min cache
    );
    if (!res.ok) return [];
    const json = await res.json();
    const responses: any[] = json.response ?? [];
    // responses[0..n] each have player + team info
    // We need to determine home/away based on team position
    const out: InjuryPlayer[] = [];
    for (const r of responses) {
      const name = r.player?.name ?? "";
      const type = r.player?.type ?? "Injured";
      const reason = r.player?.reason ?? type;
      // team id — we don't know home/away here, caller must enrich
      out.push({ name, type, reason, teamSide: "home" });
    }
    return out;
  } catch {
    return [];
  }
}

export async function fetchInjuriesForMatch(
  fixtureExternalId: string,
  homeTeamAfId: string,
  awayTeamAfId: string,
): Promise<InjuryPlayer[]> {
  const key = env("API_FOOTBALL_KEY");
  if (!key) return [];
  try {
    const res = await fetch(
      `${afBase()}/injuries?fixture=${fixtureExternalId}`,
      { headers: afHeaders(), next: { revalidate: 900 } }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const responses: any[] = json.response ?? [];
    return responses.map((r: any) => ({
      name: r.player?.name ?? "Desconocido",
      type: r.player?.type ?? "Injured",
      reason: r.player?.reason ?? r.player?.type ?? "Baja",
      teamSide: String(r.team?.id) === homeTeamAfId ? "home" as const : "away" as const,
    }));
  } catch {
    return [];
  }
}
