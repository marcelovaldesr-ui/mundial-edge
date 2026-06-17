export type ScorePredicate = (homeGoals: number, awayGoals: number) => boolean;

export type StatSelectionKey =
  | "home_win"
  | "draw"
  | "away_win"
  | "over_0_5"
  | "under_0_5"
  | "over_1_5"
  | "under_1_5"
  | "over_2_5"
  | "under_2_5"
  | "over_3_5"
  | "under_3_5"
  | "over_4_5"
  | "under_4_5"
  | "btts_yes"
  | "btts_no"
  | "home_over_0_5"
  | "home_under_0_5"
  | "home_over_1_5"
  | "home_under_1_5"
  | "away_over_0_5"
  | "away_under_0_5"
  | "away_over_1_5"
  | "away_under_1_5"
  | "double_chance_1x"
  | "double_chance_12"
  | "double_chance_x2";

export type StatMarketType =
  | "1x2"
  | "totals"
  | "btts"
  | "team_totals"
  | "double_chance";

export interface ModelMarketProbability {
  market: StatMarketType;
  selection: StatSelectionKey;
  probability: number;
  source: "poisson_score_matrix";
}

export interface SameMatchJointProbability {
  jointProbability: number;
  independentProbability: number;
  correlationRatio: number;
  isInvalid: boolean;
  reasons: string[];
}
