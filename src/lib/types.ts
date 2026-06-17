// ─── Tipos de dominio compartidos ────────────────────────────────

export interface Team {
  id: string;
  name: string;
  code: string;        // ISO-3, ej. "ARG"
  group: string | null;
  flag?: string | null;
  fifa_rank?: number | null;
}

export type MatchStatus = "scheduled" | "live" | "finished" | "postponed";

export interface Match {
  id: string;
  home_team_id: string;
  away_team_id: string;
  stage: string;       // "Group A", "Round of 32", ...
  kickoff: string;     // ISO datetime
  venue: string | null;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  // joins (opcionales, completados por la capa de datos)
  home_team?: Team;
  away_team?: Team;
}

export interface TeamStats {
  team_id: string;
  matches_played: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  // forma reciente: array de "W" | "D" | "L" (más reciente primero)
  recent_form: ("W" | "D" | "L")[];
  // ratios por partido (derivados)
  gf_per_game: number;
  ga_per_game: number;
}

export type Market = "1x2" | "btts" | "over_under_2_5";
export type Outcome =
  | "home" | "draw" | "away"            // 1x2
  | "yes" | "no"                        // btts
  | "over" | "under";                   // over/under

export interface Odd {
  id: string;
  match_id: string;
  bookmaker: string;
  market: Market;
  outcome: Outcome;
  decimal_odds: number;
  source: string;          // "the-odds-api" | "mock" | ...
  fetched_at: string;      // ISO
}

export interface Prediction {
  id: string;
  match_id: string;
  market: Market;
  outcome: Outcome;
  model_probability: number;   // 0..1
  model_version: string;
  source: string;              // "poisson-v1"
  created_at: string;
}

export type ValueTier =
  | "no_bet"        // EV < 0
  | "no_value"      // 0% .. 3%
  | "low"           // 3% .. 8%
  | "medium"        // 8% .. 15%
  | "high";         // > 15% (con advertencia)

export interface Edge {
  id: string;
  match_id: string;
  market: Market;
  outcome: Outcome;
  decimal_odds: number;
  implied_probability: number;   // ajustada por overround
  model_probability: number;
  edge: number;                  // model - implied
  expected_value: number;        // EV en fracción (0.08 = 8%)
  tier: ValueTier;
  bookmaker: string;
  source: string;
  updated_at: string;
  // calculado en lectura: ¿pasa los filtros de calidad (modo tipster)?
  qualifies?: boolean;
  // calculado en runtime: ensemble calibrado mercado + Poisson + ratings/contexto
  final_probability?: number;
  final_edge?: number;
  final_expected_value?: number;
  final_tier?: ValueTier;
  final_probability_confidence?: "low" | "medium" | "high";
  final_probability_explanation?: string;
  final_probability_breakdown?: {
    finalProbability: number;
    confidence: "low" | "medium" | "high";
    explanation: string;
    weights: {
      market: number;
      poisson: number;
      ratings: number;
      realStats: number;
      worldCupContext: number;
    };
    warnings: string[];
    components: {
      marketProbability: number | null;
      poissonProbability: number | null;
      ratingProbability: number | null;
      realStatsProbability: number | null;
      worldCupContextProbability: number | null;
    };
  };
  // joins opcionales
  match?: Match;
}

export interface SyncLog {
  id: string;
  job: "fixtures" | "results" | "odds" | "predictions";
  status: "success" | "error" | "running";
  source: string;
  records_affected: number;
  message: string | null;
  started_at: string;
  finished_at: string | null;
}
