import type { Parlay, ParlayFilters, ParlayRiskLevel, ParlaySortKey } from "./parlay-types";

const riskRank: Record<ParlayRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  very_high: 3,
};

export function filterParlays(parlays: Parlay[], filters: ParlayFilters): Parlay[] {
  return parlays.filter((parlay) => {
    if (filters.maxRisk && riskRank[parlay.riskLevel] > riskRank[filters.maxRisk]) return false;
    if (filters.minOdds != null && parlay.totalOdds < filters.minOdds) return false;
    if (filters.maxOdds != null && parlay.totalOdds > filters.maxOdds) return false;
    if (filters.minEV != null && parlay.ev < filters.minEV) return false;
    if (filters.minProbability != null && parlay.jointProbabilityAdjusted < filters.minProbability) return false;
    if (filters.hideHighCorrelation && parlay.correlationLevel === "high") return false;
    if (filters.legs != null && parlay.picks.length !== filters.legs) return false;
    return true;
  });
}

export function sortParlays(parlays: Parlay[], sortKey: ParlaySortKey): Parlay[] {
  const sorted = [...parlays];
  sorted.sort((a, b) => {
    switch (sortKey) {
      case "ev":
        return b.ev - a.ev;
      case "probability":
        return b.jointProbabilityAdjusted - a.jointProbabilityAdjusted;
      case "risk":
        return a.riskScore - b.riskScore;
      case "odds":
        return b.totalOdds - a.totalOdds;
      case "stake":
        return b.suggestedStakeUnits - a.suggestedStakeUnits;
      case "score":
      default:
        return b.score - a.score;
    }
  });
  return sorted;
}

export function sortAndFilterParlays(
  parlays: Parlay[],
  filters: ParlayFilters,
  sortKey: ParlaySortKey
): Parlay[] {
  return sortParlays(filterParlays(parlays, filters), sortKey);
}
