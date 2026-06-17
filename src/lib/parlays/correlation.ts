import type { CorrelationEvaluation, CorrelationLevel, ParlayPick } from "./parlay-types";

const PENALTY: Record<CorrelationLevel, number> = {
  low: 1,
  medium: 0.9,
  high: 0.75,
  invalid: 0,
};

const rank: Record<CorrelationLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  invalid: 3,
};

function stronger(a: CorrelationLevel, b: CorrelationLevel): CorrelationLevel {
  return rank[a] >= rank[b] ? a : b;
}

function byMatch(picks: ParlayPick[]): Map<string, ParlayPick[]> {
  const out = new Map<string, ParlayPick[]>();
  for (const pick of picks) {
    const group = out.get(pick.matchId) ?? [];
    group.push(pick);
    out.set(pick.matchId, group);
  }
  return out;
}

export function compareCorrelationLevel(
  a: Exclude<CorrelationLevel, "invalid">,
  b: Exclude<CorrelationLevel, "invalid">
): number {
  return rank[a] - rank[b];
}

export function evaluateCorrelation(picks: ParlayPick[]): CorrelationEvaluation {
  const reasons: string[] = [];
  let level: CorrelationLevel = "low";
  const seenPickIds = new Set<string>();
  const seenSelections = new Set<string>();

  for (const pick of picks) {
    const selectionKey = `${pick.matchId}:${pick.market}:${pick.selection}`;
    if (seenPickIds.has(pick.id) || seenSelections.has(selectionKey)) {
      return {
        level: "invalid",
        penaltyFactor: PENALTY.invalid,
        reasons: ["Pick duplicado dentro de la combinada."],
      };
    }
    seenPickIds.add(pick.id);
    seenSelections.add(selectionKey);
  }

  for (const matchPicks of byMatch(picks).values()) {
    if (matchPicks.length < 2) continue;
    if (matchPicks.length > 2) {
      reasons.push("Más de dos selecciones del mismo partido sin modelo conjunto específico.");
      return { level: "invalid", penaltyFactor: PENALTY.invalid, reasons };
    }

    const seenMarkets = new Map<string, ParlayPick>();
    for (const pick of matchPicks) {
      const marketKey = `${pick.market}`;
      const previous = seenMarkets.get(marketKey);
      if (previous) {
        reasons.push(
          previous.selection === pick.selection
            ? "Selecciones duplicadas en el mismo mercado y partido."
            : "Selecciones contradictorias en el mismo mercado y partido."
        );
        return { level: "invalid", penaltyFactor: PENALTY.invalid, reasons };
      }
      seenMarkets.set(marketKey, pick);
    }

    const markets = new Set(matchPicks.map((pick) => pick.market));
    if (markets.size > 1) {
      const hasResultMarket = markets.has("1x2");
      const hasTotals = markets.has("over_under_2_5") || markets.has("btts");
      const sameMatchLevel: CorrelationLevel =
        matchPicks.length >= 3 || (hasResultMarket && hasTotals) ? "high" : "medium";

      level = stronger(level, sameMatchLevel);
      reasons.push(
        sameMatchLevel === "high"
          ? "Múltiples mercados del mismo partido con dependencia alta."
          : "Mercados distintos del mismo partido; independencia parcial."
      );
    }
  }

  if (!reasons.length) {
    reasons.push("Picks de partidos distintos; correlación baja asumida.");
  }

  return {
    level,
    penaltyFactor: PENALTY[level],
    reasons,
  };
}
