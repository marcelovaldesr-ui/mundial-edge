import type { Team, Match, TeamStats, Odd } from "../types";

// ─── Dataset mock (datos ilustrativos, NO oficiales) ─────────────
// Fechas ancladas al periodo del Mundial 2026 para una demo coherente.
// Reemplazable por proveedores reales en modo "live".

export const MOCK_SOURCE = "mock-dataset-v1";

export const teams: Team[] = [
  { id: "t-arg", name: "Argentina", code: "ARG", group: "A", flag: "🇦🇷", fifa_rank: 1 },
  { id: "t-fra", name: "Francia",   code: "FRA", group: "A", flag: "🇫🇷", fifa_rank: 2 },
  { id: "t-bra", name: "Brasil",    code: "BRA", group: "B", flag: "🇧🇷", fifa_rank: 5 },
  { id: "t-eng", name: "Inglaterra",code: "ENG", group: "B", flag: "🏴", fifa_rank: 4 },
  { id: "t-esp", name: "España",    code: "ESP", group: "C", flag: "🇪🇸", fifa_rank: 8 },
  { id: "t-por", name: "Portugal",  code: "POR", group: "C", flag: "🇵🇹", fifa_rank: 6 },
  { id: "t-ned", name: "Países Bajos", code: "NED", group: "D", flag: "🇳🇱", fifa_rank: 7 },
  { id: "t-chi", name: "Chile",     code: "CHI", group: "D", flag: "🇨🇱", fifa_rank: 40 },
];

const T = (id: string) => teams.find((x) => x.id === id)!;

export const teamStats: TeamStats[] = [
  stat("t-arg", 3, 7, 2, ["W", "W", "D"]),
  stat("t-fra", 3, 6, 3, ["W", "L", "W"]),
  stat("t-bra", 3, 8, 3, ["W", "W", "W"]),
  stat("t-eng", 3, 4, 2, ["D", "W", "D"]),
  stat("t-esp", 3, 6, 4, ["W", "D", "L"]),
  stat("t-por", 3, 5, 3, ["L", "W", "W"]),
  stat("t-ned", 3, 4, 4, ["D", "L", "W"]),
  stat("t-chi", 3, 2, 6, ["L", "L", "D"]),
];

function stat(
  team_id: string,
  mp: number,
  gf: number,
  ga: number,
  form: ("W" | "D" | "L")[]
): TeamStats {
  return {
    team_id,
    matches_played: mp,
    goals_for: gf,
    goals_against: ga,
    goal_diff: gf - ga,
    recent_form: form,
    gf_per_game: +(gf / mp).toFixed(3),
    ga_per_game: +(ga / mp).toFixed(3),
  };
}

const base = "2026-06-20T";
export const matches: Match[] = [
  match("m1", "t-arg", "t-bra", "Round of 16", `${base}21:00:00Z`, "MetLife Stadium"),
  match("m2", "t-fra", "t-eng", "Round of 16", "2026-06-21T18:00:00Z", "SoFi Stadium"),
  match("m3", "t-esp", "t-ned", "Round of 16", "2026-06-21T21:00:00Z", "Estadio Azteca"),
  match("m4", "t-por", "t-chi", "Round of 16", "2026-06-22T18:00:00Z", "AT&T Stadium"),
].map((m) => ({ ...m, home_team: T(m.home_team_id), away_team: T(m.away_team_id) }));

function match(
  id: string,
  home: string,
  away: string,
  stage: string,
  kickoff: string,
  venue: string
): Match {
  return {
    id,
    home_team_id: home,
    away_team_id: away,
    stage,
    kickoff,
    venue,
    status: "scheduled",
    home_score: null,
    away_score: null,
  };
}

// Cuotas mock de 2 casas por partido (1x2 + over/under 2.5 + btts).
// Incluyen overround realista (~105-108%).
export const odds: Odd[] = buildMockOdds();

function buildMockOdds(): Odd[] {
  const now = new Date().toISOString();
  const rows: Odd[] = [];
  type MockOdds = {
    h: number; d: number; a: number;
    over15: number; under15: number;
    over: number; under: number;
    over35: number; under35: number;
    yes: number; no: number;
    dc1x: number; dcX2: number; dc12: number;
  };
  const table: Record<string, MockOdds> = {
    //              1x2              over1.5  under1.5   over2.5  under2.5   over3.5  under3.5  btts      double_chance
    m1: { h: 2.45, d: 3.30, a: 2.95, over15: 1.32, under15: 3.35, over: 2.05, under: 1.78, over35: 2.95, under35: 1.40, yes: 1.85, no: 1.95, dc1x: 1.42, dcX2: 1.60, dc12: 1.33 },
    m2: { h: 2.20, d: 3.25, a: 3.40, over15: 1.40, under15: 2.95, over: 2.10, under: 1.72, over35: 3.05, under35: 1.38, yes: 1.80, no: 2.00, dc1x: 1.38, dcX2: 1.68, dc12: 1.30 },
    m3: { h: 2.05, d: 3.40, a: 3.70, over15: 1.38, under15: 3.05, over: 2.00, under: 1.80, over35: 3.10, under35: 1.38, yes: 1.90, no: 1.90, dc1x: 1.35, dcX2: 1.72, dc12: 1.28 },
    m4: { h: 1.55, d: 4.00, a: 6.00, over15: 1.45, under15: 2.80, over: 1.95, under: 1.85, over35: 3.20, under35: 1.37, yes: 2.05, no: 1.75, dc1x: 1.22, dcX2: 1.95, dc12: 1.18 },
  };
  for (const [matchId, o] of Object.entries(table)) {
    for (const bk of ["BetMock", "OddsLab"]) {
      const jitter = bk === "OddsLab" ? 1.02 : 1;
      push(rows, matchId, bk, "1x2", "home", o.h * jitter, now);
      push(rows, matchId, bk, "1x2", "draw", o.d, now);
      push(rows, matchId, bk, "1x2", "away", o.a * (2 - jitter), now);
      push(rows, matchId, bk, "over_under_1_5", "over", o.over15, now);
      push(rows, matchId, bk, "over_under_1_5", "under", o.under15, now);
      push(rows, matchId, bk, "over_under_2_5", "over", o.over, now);
      push(rows, matchId, bk, "over_under_2_5", "under", o.under, now);
      push(rows, matchId, bk, "over_under_3_5", "over", o.over35, now);
      push(rows, matchId, bk, "over_under_3_5", "under", o.under35, now);
      push(rows, matchId, bk, "btts", "yes", o.yes, now);
      push(rows, matchId, bk, "btts", "no", o.no, now);
      push(rows, matchId, bk, "double_chance", "1x", o.dc1x, now);
      push(rows, matchId, bk, "double_chance", "x2", o.dcX2, now);
      push(rows, matchId, bk, "double_chance", "12", o.dc12, now);
    }
  }
  return rows;
}

function push(rows: Odd[], matchId: string, bk: string, market: any, outcome: any, dec: number, now: string) {
  rows.push({
    id: `${matchId}:${bk}:${market}:${outcome}`,
    match_id: matchId,
    bookmaker: bk,
    market,
    outcome,
    decimal_odds: +dec.toFixed(2),
    source: MOCK_SOURCE,
    fetched_at: now,
  });
}
