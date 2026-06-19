import type { Market, Match, MatchStatus, Outcome, ValueTier } from "../types";
import type { PredictionConfigSource, ScoreMatrix, StatModelCalibrationMode, StatModelVariant } from "../stat-model";
import type { FinalProbabilityResult } from "../model/final-probability";

export type ParlayProfile = "conservative" | "balanced" | "aggressive";
export type ParlayConfidence = "low" | "medium" | "high";
export type CorrelationLevel = "low" | "medium" | "high" | "invalid";
export type ParlayRiskLevel = "low" | "medium" | "high" | "very_high";
export type ParlaySortKey = "score" | "ev" | "probability" | "risk" | "odds" | "stake";
export type RejectionReason =
  | "pick_duplicated"
  | "pick_expired"
  | "pick_invalid"
  | "edge_below_minimum"
  | "confidence_below_minimum"
  | "candidate_limit"
  | "joint_probability_too_low"
  | "ev_out_of_range"
  | "risk_too_high"
  | "total_odds_too_high"
  | "invalid_correlation"
  | "same_match_overload"
  | "same_market_contradiction";

export interface ParlayPick {
  id: string;
  matchId: string;
  market: Market;
  selection: Outcome;
  odds: number;
  marketProb: number;
  anchoredProb: number;
  probability: number;
  pick: Outcome;
  probabilitySource: "edge.model_probability_blended" | "edge.final_probability_ensemble";
  edge: number;
  confidence: ParlayConfidence;
  ev: number;
  riskLevel: ValueTier;
  isQualityPick: boolean;
  startsAt: string;
  matchStatus?: MatchStatus;
  bookmaker?: string;
  match?: Match;
  finalProbabilityBreakdown?: FinalProbabilityResult;
}

export interface CorrelationEvaluation {
  level: CorrelationLevel;
  penaltyFactor: number;
  reasons: string[];
}

export interface StakeSuggestion {
  kellyFraction: number;
  suggestedStakeUnits: number;
  suggestedStakePercent: number | null;
  suggestedStakeAmount: number | null;
  label: string;
  reason: string;
}

export interface Parlay {
  id: string;
  profile: ParlayProfile;
  picks: ParlayPick[];
  totalOdds: number;
  jointProbabilityRaw: number;
  jointProbabilityAdjusted: number;
  correlationLevel: CorrelationLevel;
  correlationReasons: string[];
  correlationMethod: "heuristic" | "score_matrix";
  correlationRatio?: number;
  sameMatchJointProbability?: number;
  ev: number;
  riskScore: number;
  riskLevel: ParlayRiskLevel;
  suggestedStakeUnits: number;
  suggestedStakePercent: number | null;
  suggestedStakeAmount: number | null;
  stakeReason: string;
  score: number;
  explanation: string;
  warnings: string[];
  modelVariantUsed?: StatModelVariant;
  calibrationUsed?: StatModelCalibrationMode;
  configSource?: PredictionConfigSource;
}

export interface RejectedParlayCandidate {
  id: string;
  profile: ParlayProfile;
  picks: ParlayPick[];
  reason: RejectionReason;
  message: string;
  totalOdds?: number;
  jointProbabilityRaw?: number;
  jointProbabilityAdjusted?: number;
  ev?: number;
  riskScore?: number;
  correlationLevel?: CorrelationLevel;
  correlationReasons?: string[];
}

export interface GenerateParlaysResult {
  parlays: Parlay[];
  rejected: RejectedParlayCandidate[];
}

export interface GenerateParlaysOptions {
  profile: ParlayProfile;
  maxResults?: number;
  minJointProbability?: number;
  minEV?: number;
  minEdge?: number;
  minConfidence?: ParlayConfidence;
  allowLowConfidence?: boolean;
  maxCorrelation?: Exclude<CorrelationLevel, "invalid">;
  bankroll?: number;
  allowedMarkets?: Market[];
  allowSameMatch?: boolean;
  maxLegs?: number;
  maxTotalOdds?: number;
  now?: Date | string;
  scoreMatricesByMatchId?: Record<string, ScoreMatrix>;
  predictionMetadata?: {
    modelVariantUsed: StatModelVariant;
    calibrationUsed: StatModelCalibrationMode;
    configSource: PredictionConfigSource;
    warnings?: string[];
  };
}

export type SuggestedParlayTheme = "favorite" | "goals" | "surprise";

export interface SuggestedParlay {
  theme: SuggestedParlayTheme;
  label: string;
  description: string;
  parlay: Parlay;
}

export interface ParlayFilters {
  maxRisk?: ParlayRiskLevel;
  minOdds?: number;
  maxOdds?: number;
  minEV?: number;
  minProbability?: number;
  hideHighCorrelation?: boolean;
  legs?: number;
}

export interface ProfileRules {
  label: string;
  maxLegs: number;
  candidateLimit: number;
  minPickProbability: number;
  minJointProbability: number;
  minEV: number;
  maxEV: number;
  maxPickOdds: number;
  maxTotalOdds: number;
  maxRiskScore: number;
  maxCorrelation: Exclude<CorrelationLevel, "invalid">;
  targetOddsRange: [number, number];
  preferredLegs: number[];
  kellyMultiplier: number;
  maxStakePercent: number;
}
