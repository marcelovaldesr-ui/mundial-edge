import { ELO_RATING_ROWS } from "./elo-ratings-data";
import type { TeamStrengthRating } from "./team-strength-ratings";

export interface HistoricalEloRating {
  worldCup: number;
  date: string;
  team: string;
  elo: number;
  sourceUrl: string;
}

export const ELO_PRIOR_WEIGHT = 0.1;
export const ELO_TO_MUNDIAL_EDGE_SCALE = Object.freeze({ a: 1.0196, b: -7.1915 });
export const ELO_DATA: readonly HistoricalEloRating[] = ELO_RATING_ROWS;

/** Maps the typical 1200–2200 international Elo span linearly into 60–100. */
export function normalizeEloRating(elo: number): number {
  if (!Number.isFinite(elo)) throw new RangeError("elo must be finite.");
  return clamp(60 + (elo - 1200) * 0.04, 60, 100);
}

export function getHistoricalElo(worldCupYear: number, teamId: string): HistoricalEloRating | null {
  const code = teamId.trim().toUpperCase();
  return ELO_DATA.find((row) => row.worldCup === worldCupYear && row.team === code) ?? null;
}

/** OLS mapping fitted on all 224 pre-tournament pairs to remove the scale bias. */
export function calibrateEloToMundialEdgeScale(elo: number): number {
  const normalized = normalizeEloRating(elo);
  return clamp(ELO_TO_MUNDIAL_EDGE_SCALE.a * normalized + ELO_TO_MUNDIAL_EDGE_SCALE.b, 60, 100);
}

/**
 * Uses a conservative 10% external Elo prior and 90% of the existing profile.
 * Elo has no attack/defence split, so the small original component preserves it.
 */
export function getTeamRatingsForWorldCup(
  worldCupYear: number,
  teamId: string,
  original?: TeamStrengthRating,
  eloWeight = ELO_PRIOR_WEIGHT
): TeamStrengthRating | null {
  const entry = getHistoricalElo(worldCupYear, teamId);
  if (!entry) return null;
  const eloOverall = calibrateEloToMundialEdgeScale(entry.elo);
  if (!Number.isFinite(eloWeight) || eloWeight < 0 || eloWeight > 1) throw new RangeError("eloWeight must be between 0 and 1.");
  const overall = original ? blend(eloOverall, original.overall, eloWeight) : eloOverall;
  const attack = original ? blend(eloOverall, original.attack, eloWeight) : eloOverall;
  const defense = original ? blend(eloOverall, original.defense, eloWeight) : eloOverall;
  return {
    teamCode: entry.team,
    teamName: original?.teamName ?? entry.team,
    overall,
    attack,
    defense,
    overallRating: overall,
    attackRating: attack,
    defenseRating: defense,
    confidence: "high",
    source: "historical_elo_hybrid",
    isHistorical: worldCupYear < 2026,
    updatedAt: entry.date,
  };
}

function blend(eloRating: number, originalRating: number, eloWeight: number): number {
  return round(eloWeight * eloRating + (1 - eloWeight) * originalRating);
}

function round(value: number): number { return Math.round(value * 100) / 100; }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
