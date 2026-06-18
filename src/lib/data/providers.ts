import type { Market, Outcome, MatchStatus } from "@/lib/types";

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
  return oddsProvider() === "api-football" ? fetchOddsApiFootball() : fetchOddsTheOddsApi();
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
// The Odds API soporta h2h (1x2) y totals (over/under) para fútbol.
// btts no está disponible en este endpoint, así que no se solicita.
const AF_MARKET_KEYS = "h2h,totals";

async function fetchOddsTheOddsApi(): Promise<ProviderOdd[]> {
  const key = env("ODDS_API_KEY");
  const baseUrl = env("ODDS_API_BASE") ?? "https://api.the-odds-api.com/v4";
  const sport = env("ODDS_SPORT_KEY") ?? "soccer_fifa_world_cup";
  const regions = env("ODDS_API_REGIONS") ?? "eu,uk";
  if (!key) throw new Error("ODDS_API_KEY no configurada");

  const url = `${baseUrl}/sports/${sport}/odds?regions=${regions}&markets=${AF_MARKET_KEYS}&oddsFormat=decimal&apiKey=${key}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`The Odds API ${res.status}: ${await res.text()}`);
  const raw = (await res.json()) as any[];

  const out: ProviderOdd[] = [];
  for (const game of raw) {
    const home = game.home_team, away = game.away_team;
    for (const bk of game.bookmakers ?? []) {
      for (const market of bk.markets ?? []) {
        const m: Market | null =
          market.key === "h2h" ? "1x2"
          : market.key === "totals" ? "over_under_2_5"
          : market.key === "btts" ? "btts" : null;
        if (!m) continue;
        for (const oc of market.outcomes ?? []) {
          let outcome: Outcome | null = null;
          if (m === "1x2") {
            if (oc.name === home) outcome = "home";
            else if (oc.name === away) outcome = "away";
            else if (oc.name === "Draw") outcome = "draw";
          } else if (m === "over_under_2_5") {
            if (oc.point !== 2.5) continue;
            outcome = String(oc.name).toLowerCase().includes("over") ? "over" : "under";
          } else if (m === "btts") {
            outcome = String(oc.name).toLowerCase() === "yes" ? "yes" : "no";
          }
          if (!outcome) continue;
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
