import type { ModelMarketProbability, SameMatchJointProbability, ScorePredicate, StatMarketType, StatSelectionKey } from "./market-types";
import type { ScoreMatrix } from "./score-matrix";

const TOTAL_LINES = [0.5, 1.5, 2.5, 3.5, 4.5] as const;

export function selectionToScorePredicate(selection: StatSelectionKey): ScorePredicate {
  switch (selection) {
    case "home_win": return (h, a) => h > a;
    case "draw": return (h, a) => h === a;
    case "away_win": return (h, a) => h < a;
    case "over_0_5": return (h, a) => h + a >= 1;
    case "under_0_5": return (h, a) => h + a <= 0;
    case "over_1_5": return (h, a) => h + a >= 2;
    case "under_1_5": return (h, a) => h + a <= 1;
    case "over_2_5": return (h, a) => h + a >= 3;
    case "under_2_5": return (h, a) => h + a <= 2;
    case "over_3_5": return (h, a) => h + a >= 4;
    case "under_3_5": return (h, a) => h + a <= 3;
    case "over_4_5": return (h, a) => h + a >= 5;
    case "under_4_5": return (h, a) => h + a <= 4;
    case "btts_yes": return (h, a) => h > 0 && a > 0;
    case "btts_no": return (h, a) => h === 0 || a === 0;
    case "home_over_0_5": return (h) => h >= 1;
    case "home_under_0_5": return (h) => h === 0;
    case "home_over_1_5": return (h) => h >= 2;
    case "home_under_1_5": return (h) => h <= 1;
    case "away_over_0_5": return (_h, a) => a >= 1;
    case "away_under_0_5": return (_h, a) => a === 0;
    case "away_over_1_5": return (_h, a) => a >= 2;
    case "away_under_1_5": return (_h, a) => a <= 1;
    case "double_chance_1x": return (h, a) => h >= a;
    case "double_chance_12": return (h, a) => h !== a;
    case "double_chance_x2": return (h, a) => h <= a;
  }
}

export function probabilityForSelection(matrix: ScoreMatrix, selection: StatSelectionKey): number {
  const predicate = selectionToScorePredicate(selection);
  return probabilityForPredicate(matrix, predicate);
}

export function probabilityForPredicate(matrix: ScoreMatrix, predicate: ScorePredicate): number {
  return matrix.entries.reduce(
    (sum, entry) => sum + (predicate(entry.homeGoals, entry.awayGoals) ? entry.probability : 0),
    0
  );
}

export function jointProbabilityForSelections(
  matrix: ScoreMatrix,
  selections: StatSelectionKey[],
  epsilon = 1e-9
): SameMatchJointProbability {
  const predicates = selections.map(selectionToScorePredicate);
  const individual = selections.map((selection) => probabilityForSelection(matrix, selection));
  const independentProbability = individual.reduce((product, probability) => product * probability, 1);
  const jointProbability = probabilityForPredicate(
    matrix,
    (homeGoals, awayGoals) => predicates.every((predicate) => predicate(homeGoals, awayGoals))
  );
  const isInvalid = jointProbability <= epsilon;
  return {
    jointProbability,
    independentProbability,
    correlationRatio: independentProbability > 0 ? jointProbability / independentProbability : 0,
    isInvalid,
    reasons: isInvalid
      ? ["Selecciones incompatibles según la matriz de marcadores."]
      : [`Probabilidad conjunta exacta calculada desde matriz de goles; ratio ${independentProbability > 0 ? (jointProbability / independentProbability).toFixed(2) : "0.00"}.`],
  };
}

export function deriveMarketProbabilities(matrix: ScoreMatrix): ModelMarketProbability[] {
  const out: ModelMarketProbability[] = [
    prob("1x2", "home_win", matrix),
    prob("1x2", "draw", matrix),
    prob("1x2", "away_win", matrix),
    prob("btts", "btts_yes", matrix),
    prob("btts", "btts_no", matrix),
    prob("team_totals", "home_over_0_5", matrix),
    prob("team_totals", "home_under_0_5", matrix),
    prob("team_totals", "home_over_1_5", matrix),
    prob("team_totals", "home_under_1_5", matrix),
    prob("team_totals", "away_over_0_5", matrix),
    prob("team_totals", "away_under_0_5", matrix),
    prob("team_totals", "away_over_1_5", matrix),
    prob("team_totals", "away_under_1_5", matrix),
    prob("double_chance", "double_chance_1x", matrix),
    prob("double_chance", "double_chance_12", matrix),
    prob("double_chance", "double_chance_x2", matrix),
  ];

  for (const line of TOTAL_LINES) {
    const suffix = String(line).replace(".", "_") as "0_5" | "1_5" | "2_5" | "3_5" | "4_5";
    out.push(prob("totals", `over_${suffix}` as StatSelectionKey, matrix));
    out.push(prob("totals", `under_${suffix}` as StatSelectionKey, matrix));
  }

  return out;
}

function prob(market: StatMarketType, selection: StatSelectionKey, matrix: ScoreMatrix): ModelMarketProbability {
  return {
    market,
    selection,
    probability: probabilityForSelection(matrix, selection),
    source: "poisson_score_matrix",
  };
}
