import type { Team, TeamStats } from "../types";
import { expectedGoals as currentExpectedGoals, formFactor } from "../model/expected-goals";
import type { WorldCupGroupContext } from "../world-cup/group-context";
import {
  getAttackStrength,
  getDefenseStrength,
  getOverallStrength,
  getTeamStrengthRating,
  neutralTeamStrengthRating,
  type TeamStrengthRating,
} from "./team-strength-ratings";

export type ExpectedGoalsRatingModel = "legacy_v1" | "attack_defense_v2" | "attack_defense_v2_mismatch_spread";

export interface StatExpectedGoalsInput {
  home: TeamStats;
  away: TeamStats;
  homeTeam?: Team;
  awayTeam?: Team;
  leagueAvgGoals?: number;
  groupContext?: WorldCupGroupContext;
  /** Ablation hook for offline evaluation. Production behavior defaults to true. */
  useBaseRatings?: boolean;
  /** Injectable rating snapshot for offline backtests. Production uses the current seed. */
  ratingResolver?: (team: Team) => TeamStrengthRating | null;
  neutralVenue?: boolean;
  ratingModel?: ExpectedGoalsRatingModel;
  /** Experimental Bayesian regularization for observed World Cup stats. Opt-in only. */
  priorStrength?: number;
}

export interface StatExpectedGoalsResult {
  homeExpectedGoals: number;
  awayExpectedGoals: number;
  source: "rating_stats_blend_v1" | "team_stats_expected_goals_v1";
  homeRating: TeamStrengthRating | null;
  awayRating: TeamStrengthRating | null;
  blend: {
    homeRatingWeight: number;
    awayRatingWeight: number;
    homeStatsWeight: number;
    awayStatsWeight: number;
  };
  assumptions: string[];
  ratingModel: ExpectedGoalsRatingModel;
  neutralVenue: boolean;
  priorStrength: number | null;
  diagnostic: ExpectedGoalsDiagnosticBreakdown;
}

export interface ExpectedGoalsSideBreakdown {
  priorRatingComponent: number | null;
  observedStatsComponent: number;
  bayesianAdjustedObservedComponent: number;
  tournamentAverageComponent: number;
  contextAdjustment: number;
  bayesianObservedWeight: number | null;
  ratingBlendWeight: number;
  statsBlendWeight: number;
  preContextXg: number;
  experimentalMismatchAdjustment: number;
  finalXg: number;
  capsApplied: string[];
}

export interface ExpectedGoalsDiagnosticBreakdown {
  home: ExpectedGoalsSideBreakdown;
  away: ExpectedGoalsSideBreakdown;
  guardrails: { minXg: 0.2; maxXg: 4.5; contextMin: 0.94; contextMax: 1.06 };
}

export interface ExpectedGoalsComponents {
  priorRating: number;
  recentForm: number;
  context: number;
  tournamentAvg: number;
}

export interface ExpectedGoalsWithComponentsResult {
  home: number;
  away: number;
  components: {
    home: ExpectedGoalsComponents;
    away: ExpectedGoalsComponents;
  };
  weightInfo: {
    gamesPlayed: number;
    priorStrength: number;
    blendWeights: {
      prior: number;
      recent: number;
      context: number;
      avg: number;
    };
  };
  /** Full result retained so prediction builders do not calculate xG twice. */
  details: StatExpectedGoalsResult;
}

/**
 * Returns the production xG together with an exact additive decomposition.
 * Each side satisfies tournamentAvg + priorRating + recentForm + context = xG.
 */
export function getExpectedGoalsWithComponents(input: StatExpectedGoalsInput): ExpectedGoalsWithComponentsResult {
  const details = estimateExpectedGoals(input);
  const components = {
    home: additiveComponents(details.diagnostic.home),
    away: additiveComponents(details.diagnostic.away),
  };
  const blendWeights = normalizedComponentWeights(components.home, components.away);

  return {
    home: details.homeExpectedGoals,
    away: details.awayExpectedGoals,
    components,
    weightInfo: {
      gamesPlayed: Math.min(input.home.matches_played, input.away.matches_played),
      priorStrength: details.priorStrength ?? 0,
      blendWeights,
    },
    details,
  };
}

export function estimateExpectedGoals(input: StatExpectedGoalsInput): StatExpectedGoalsResult {
  const leagueAvg = input.leagueAvgGoals ?? 1.35;
  const neutralVenue = input.neutralVenue ?? false;
  const ratingModel = input.ratingModel ?? "attack_defense_v2";
  const rawObserved = ratingModel === "legacy_v1"
    ? currentExpectedGoals({
      home: input.home,
      away: input.away,
      leagueAvgGoals: leagueAvg,
      homeAdvantage: neutralVenue ? 1 : 1.07,
    })
    : observedStatsExpectedGoals(input.home, input.away, leagueAvg, neutralVenue ? 1 : 1.07);

  const useBaseRatings = input.useBaseRatings ?? true;
  const homeRating = useBaseRatings ? resolveRating(input.homeTeam, input.ratingResolver) : null;
  const awayRating = useBaseRatings ? resolveRating(input.awayTeam, input.ratingResolver) : null;
  const priorStrength = validatePriorStrength(input.priorStrength);
  const regularized = ratingModel !== "legacy_v1" && priorStrength != null && homeRating && awayRating
    ? bayesianObservedExpectedGoals({
      home: input.home,
      away: input.away,
      homeRating,
      awayRating,
      leagueAvg,
      homeAdvantage: neutralVenue ? 1 : 1.07,
      priorStrength,
    })
    : rawObserved;
  const { lambdaHome, lambdaAway } = regularized;
  if (!useBaseRatings) {
    const homeContext = contextModifier("home", input.groupContext);
    const awayContext = contextModifier("away", input.groupContext);
    const homeExpectedGoals = clamp(lambdaHome * homeContext, 0.2, 4.5);
    const awayExpectedGoals = clamp(lambdaAway * awayContext, 0.2, 4.5);
    return {
      homeExpectedGoals,
      awayExpectedGoals,
      source: "team_stats_expected_goals_v1",
      homeRating: null,
      awayRating: null,
      blend: {
        homeRatingWeight: 0,
        awayRatingWeight: 0,
        homeStatsWeight: 1,
        awayStatsWeight: 1,
      },
      assumptions: baseAssumptions([
        "Ablation offline: ratings base desactivados.",
        input.groupContext ? "Contexto de grupo conservado en la ablacion." : "Sin contexto de grupo aplicado.",
      ]),
      ratingModel,
      neutralVenue,
      priorStrength,
      diagnostic: diagnosticBreakdown({
        rawObserved, regularized, leagueAvg, homeContext, awayContext,
        homeRatingComponent: null, awayRatingComponent: null,
        homeRatingWeight: 0, awayRatingWeight: 0,
        homeExpectedGoals, awayExpectedGoals,
        homeMismatchAdjustment: 0, awayMismatchAdjustment: 0,
        homeMatches: input.home.matches_played, awayMatches: input.away.matches_played,
        priorStrength,
      }),
    };
  }
  if (!homeRating || !awayRating) {
    return {
      homeExpectedGoals: lambdaHome,
      awayExpectedGoals: lambdaAway,
      source: "team_stats_expected_goals_v1",
      homeRating,
      awayRating,
      blend: {
        homeRatingWeight: 0,
        awayRatingWeight: 0,
        homeStatsWeight: 1,
        awayStatsWeight: 1,
      },
      assumptions: baseAssumptions([
        "Sin rating base completo para una o ambas selecciones; se usa el estimador por team_stats.",
      ]),
      ratingModel,
      neutralVenue,
      priorStrength,
      diagnostic: diagnosticBreakdown({
        rawObserved, regularized, leagueAvg, homeContext: 1, awayContext: 1,
        homeRatingComponent: null, awayRatingComponent: null,
        homeRatingWeight: 0, awayRatingWeight: 0,
        homeExpectedGoals: lambdaHome, awayExpectedGoals: lambdaAway,
        homeMismatchAdjustment: 0, awayMismatchAdjustment: 0,
        homeMatches: input.home.matches_played, awayMatches: input.away.matches_played,
        priorStrength,
      }),
    };
  }

  const ratingHome = ratingExpectedGoals({
    own: homeRating,
    opponent: awayRating,
    leagueAvgGoals: leagueAvg,
    homeAdvantage: neutralVenue ? 1 : 1.04,
    model: ratingModel,
  });
  const ratingAway = ratingExpectedGoals({
    own: awayRating,
    opponent: homeRating,
    leagueAvgGoals: leagueAvg,
    homeAdvantage: 1,
    model: ratingModel,
  });
  // v2.1 first shrinks observed rates/xG toward the rating prior and then blends
  // that already-regularized result with the same rating a second time. v2.2 is
  // experimental: prior8 remains, but this redundant outer attraction is removed.
  const removeRedundantRatingBlend = ratingModel === "attack_defense_v2_mismatch_spread";
  const homeRatingWeight = removeRedundantRatingBlend ? 0 : ratingWeight(input.home.matches_played, homeRating);
  const awayRatingWeight = removeRedundantRatingBlend ? 0 : ratingWeight(input.away.matches_played, awayRating);
  const homeContext = contextModifier("home", input.groupContext);
  const awayContext = contextModifier("away", input.groupContext);

  const homeBeforeMismatch = clamp(
    blend(lambdaHome, ratingHome, homeRatingWeight) * homeContext,
    0.2,
    4.5
  );
  const awayBeforeMismatch = clamp(
    blend(lambdaAway, ratingAway, awayRatingWeight) * awayContext,
    0.2,
    4.5
  );
  const mismatch = removeRedundantRatingBlend
    ? applyExperimentalMismatchSpread(homeBeforeMismatch, awayBeforeMismatch, homeRating, awayRating)
    : { homeExpectedGoals: homeBeforeMismatch, awayExpectedGoals: awayBeforeMismatch, homeAdjustment: 0, awayAdjustment: 0 };
  const homeExpectedGoals = mismatch.homeExpectedGoals;
  const awayExpectedGoals = mismatch.awayExpectedGoals;
  const sharedGames = Math.min(input.home.matches_played, input.away.matches_played);
  const bayesianStatsWeight = priorStrength == null ? 1 : sharedGames / (sharedGames + priorStrength);
  const homeStatsWeight = (1 - homeRatingWeight) * bayesianStatsWeight;
  const awayStatsWeight = (1 - awayRatingWeight) * bayesianStatsWeight;

  return {
    homeExpectedGoals,
    awayExpectedGoals,
    source: "rating_stats_blend_v1",
    homeRating,
    awayRating,
    blend: {
      homeRatingWeight: 1 - homeStatsWeight,
      awayRatingWeight: 1 - awayStatsWeight,
      homeStatsWeight,
      awayStatsWeight,
    },
    assumptions: baseAssumptions([
      input.home.matches_played < 2 || input.away.matches_played < 2
        ? "Modelo apoyado principalmente en rating base por baja muestra del Mundial."
        : "Stats reales disponibles; rating base usado como ajuste secundario.",
      "Ratings seed manuales con confidence media como máximo; no son precisión absoluta.",
      input.groupContext ? "Contexto de grupo aplicado con modificadores pequeños y transparentes." : "Sin contexto de grupo específico aplicado.",
      homeRating.source === "neutral_fallback" || awayRating.source === "neutral_fallback"
        ? "Sin rating específico para una selección; usando prior neutral."
        : "Rating base específico disponible para ambas selecciones.",
      ratingModel !== "legacy_v1"
        ? priorStrength == null
          ? "xG v2: ataque propio aumenta xG y defensa rival alta reduce concesion esperada."
          : removeRedundantRatingBlend
            ? `xG v2.2 experimental: priorStrength=${priorStrength}, sin segundo blend rating y con mismatch spread conservando total.`
            : `xG v2.1 experimental: stats observadas regularizadas con priorStrength=${priorStrength}.`
        : "Formula legacy v1 conservada para comparacion reproducible.",
      neutralVenue ? "Sede neutral: no se aplica ventaja de localia." : "Sede no neutral: se conserva ventaja de localia.",
    ]),
    ratingModel,
    neutralVenue,
    priorStrength,
    diagnostic: diagnosticBreakdown({
      rawObserved, regularized, leagueAvg, homeContext, awayContext,
      homeRatingComponent: ratingHome, awayRatingComponent: ratingAway,
      homeRatingWeight, awayRatingWeight,
      homeExpectedGoals, awayExpectedGoals,
      homeMismatchAdjustment: mismatch.homeAdjustment,
      awayMismatchAdjustment: mismatch.awayAdjustment,
      homeMatches: input.home.matches_played, awayMatches: input.away.matches_played,
      priorStrength,
    }),
  };
}

function diagnosticBreakdown(input: {
  rawObserved: { lambdaHome: number; lambdaAway: number };
  regularized: { lambdaHome: number; lambdaAway: number };
  leagueAvg: number;
  homeContext: number;
  awayContext: number;
  homeRatingComponent: number | null;
  awayRatingComponent: number | null;
  homeRatingWeight: number;
  awayRatingWeight: number;
  homeExpectedGoals: number;
  awayExpectedGoals: number;
  homeMismatchAdjustment: number;
  awayMismatchAdjustment: number;
  homeMatches: number;
  awayMatches: number;
  priorStrength: number | null;
}): ExpectedGoalsDiagnosticBreakdown {
  const sharedGames = Math.min(input.homeMatches, input.awayMatches);
  const bayesianObservedWeight = input.priorStrength == null
    ? null
    : sharedGames / (sharedGames + input.priorStrength);
  const side = (
    rawObserved: number,
    regularized: number,
    ratingComponent: number | null,
    ratingWeight: number,
    contextAdjustment: number,
    mismatchAdjustment: number,
    finalXg: number
  ): ExpectedGoalsSideBreakdown => {
    const preContextXg = ratingComponent == null
      ? regularized
      : blend(regularized, ratingComponent, ratingWeight);
    const unclampedFinal = preContextXg * contextAdjustment + mismatchAdjustment;
    const capsApplied: string[] = [];
    if (rawObserved <= 0.2) capsApplied.push("observed-stats-min-0.2");
    if (rawObserved >= 4.5) capsApplied.push("observed-stats-max-4.5");
    if (regularized <= 0.2) capsApplied.push("bayesian-component-min-0.2");
    if (regularized >= 4.5) capsApplied.push("bayesian-component-max-4.5");
    if (unclampedFinal < 0.2) capsApplied.push("final-xg-min-0.2");
    if (unclampedFinal > 4.5) capsApplied.push("final-xg-max-4.5");
    if (contextAdjustment === 0.94) capsApplied.push("context-min-0.94");
    if (contextAdjustment === 1.06) capsApplied.push("context-max-1.06");
    return {
      priorRatingComponent: ratingComponent,
      observedStatsComponent: rawObserved,
      bayesianAdjustedObservedComponent: regularized,
      tournamentAverageComponent: input.leagueAvg,
      contextAdjustment,
      bayesianObservedWeight,
      ratingBlendWeight: ratingWeight,
      statsBlendWeight: 1 - ratingWeight,
      preContextXg,
      experimentalMismatchAdjustment: mismatchAdjustment,
      finalXg,
      capsApplied,
    };
  };
  return {
    home: side(input.rawObserved.lambdaHome, input.regularized.lambdaHome, input.homeRatingComponent, input.homeRatingWeight, input.homeContext, input.homeMismatchAdjustment, input.homeExpectedGoals),
    away: side(input.rawObserved.lambdaAway, input.regularized.lambdaAway, input.awayRatingComponent, input.awayRatingWeight, input.awayContext, input.awayMismatchAdjustment, input.awayExpectedGoals),
    guardrails: { minXg: 0.2, maxXg: 4.5, contextMin: 0.94, contextMax: 1.06 },
  };
}

function additiveComponents(side: ExpectedGoalsSideBreakdown): ExpectedGoalsComponents {
  const ratingWeight = side.ratingBlendWeight;
  const regularizationContribution = (side.bayesianAdjustedObservedComponent - side.observedStatsComponent) * (1 - ratingWeight);
  const outerRatingContribution = side.priorRatingComponent == null
    ? 0
    : (side.priorRatingComponent - side.tournamentAverageComponent) * ratingWeight;
  const priorRating = regularizationContribution + outerRatingContribution;
  const recentForm = (side.observedStatsComponent - side.tournamentAverageComponent) * (1 - ratingWeight);
  const context = side.finalXg - side.tournamentAverageComponent - priorRating - recentForm;
  return {
    priorRating: cleanFloat(priorRating),
    recentForm: cleanFloat(recentForm),
    context: cleanFloat(context),
    tournamentAvg: side.tournamentAverageComponent,
  };
}

function normalizedComponentWeights(
  home: ExpectedGoalsComponents,
  away: ExpectedGoalsComponents
): ExpectedGoalsWithComponentsResult["weightInfo"]["blendWeights"] {
  const magnitude = (key: keyof ExpectedGoalsComponents) => Math.abs(home[key]) + Math.abs(away[key]);
  const values = {
    prior: magnitude("priorRating"),
    recent: magnitude("recentForm"),
    context: magnitude("context"),
    avg: magnitude("tournamentAvg"),
  };
  const total = values.prior + values.recent + values.context + values.avg || 1;
  return {
    prior: values.prior / total,
    recent: values.recent / total,
    context: values.context / total,
    avg: values.avg / total,
  };
}

function cleanFloat(value: number): number {
  return Math.abs(value) < 1e-12 ? 0 : value;
}

function validatePriorStrength(value: number | undefined): number | null {
  if (value == null) return null;
  if (![2, 4, 6, 8].includes(value)) throw new Error(`priorStrength must be one of 2, 4, 6 or 8; received ${value}.`);
  return value;
}

function resolveRating(
  team: Team | undefined,
  ratingResolver?: (team: Team) => TeamStrengthRating | null
): TeamStrengthRating | null {
  if (!team) return null;
  if (ratingResolver) return ratingResolver(team);
  return getTeamStrengthRating(team.code) ?? neutralTeamStrengthRating(team.code, team.name);
}

function ratingExpectedGoals(input: {
  own: TeamStrengthRating;
  opponent: TeamStrengthRating;
  leagueAvgGoals: number;
  homeAdvantage: number;
  model: ExpectedGoalsRatingModel;
}): number {
  if (input.model === "legacy_v1") {
    const attackFactor = 0.68 + input.own.attackRating / 100 * 0.64;
    const defenseResistance = 1.32 - input.opponent.defenseRating / 100 * 0.64;
    const overallTilt = 1 + clamp(input.own.overallRating - input.opponent.overallRating, -25, 25) / 180;
    return clamp(input.leagueAvgGoals * attackFactor * defenseResistance * overallTilt * input.homeAdvantage, 0.2, 4.5);
  }

  const attackFactor = clamp(1 + (getAttackStrength(input.own) - 75) / 100, 0.78, 1.25);
  // Una defensa mayor representa mas resistencia y, por tanto, menos xG rival.
  const defenseConcession = clamp(1 - (getDefenseStrength(input.opponent) - 75) / 100, 0.78, 1.25);
  const overallTilt = 1 + clamp(getOverallStrength(input.own) - getOverallStrength(input.opponent), -25, 25) / 300;
  return clamp(input.leagueAvgGoals * attackFactor * defenseConcession * overallTilt * input.homeAdvantage, 0.2, 4.5);
}

function ratingWeight(matchesPlayed: number, rating: TeamStrengthRating): number {
  if (rating.source === "neutral_fallback") return Math.max(0.15, 0.45 - matchesPlayed * 0.12);
  const base = rating.confidence === "medium" ? 0.68 : 0.55;
  return clamp(base - Math.min(matchesPlayed, 5) * 0.13, 0.12, base);
}

function observedStatsExpectedGoals(
  home: TeamStats,
  away: TeamStats,
  leagueAvg: number,
  homeAdvantage: number
): { lambdaHome: number; lambdaAway: number } {
  const homeFor = observedRate(home.gf_per_game, home.matches_played, leagueAvg);
  const homeAgainst = observedRate(home.ga_per_game, home.matches_played, leagueAvg);
  const awayFor = observedRate(away.gf_per_game, away.matches_played, leagueAvg);
  const awayAgainst = observedRate(away.ga_per_game, away.matches_played, leagueAvg);
  const homeAttack = homeFor / leagueAvg;
  const homeDefense = homeAgainst / leagueAvg;
  const awayAttack = awayFor / leagueAvg;
  const awayDefense = awayAgainst / leagueAvg;
  const gdHome = 1 + clamp(home.goal_diff, -15, 15) / 100;
  const gdAway = 1 + clamp(away.goal_diff, -15, 15) / 100;
  return {
    lambdaHome: clamp(leagueAvg * homeAttack * awayDefense * formFactor(home.recent_form) * gdHome * homeAdvantage, 0.2, 4.5),
    lambdaAway: clamp(leagueAvg * awayAttack * homeDefense * formFactor(away.recent_form) * gdAway, 0.2, 4.5),
  };
}

function bayesianObservedExpectedGoals(input: {
  home: TeamStats;
  away: TeamStats;
  homeRating: TeamStrengthRating;
  awayRating: TeamStrengthRating;
  leagueAvg: number;
  homeAdvantage: number;
  priorStrength: number;
}): { lambdaHome: number; lambdaAway: number } {
  const { home, away, homeRating, awayRating, leagueAvg, homeAdvantage, priorStrength } = input;
  const homeAttackPrior = leagueAvg * clamp(1 + (getAttackStrength(homeRating) - 75) / 100, 0.78, 1.25);
  const awayAttackPrior = leagueAvg * clamp(1 + (getAttackStrength(awayRating) - 75) / 100, 0.78, 1.25);
  const homeDefensePrior = leagueAvg * clamp(1 - (getDefenseStrength(homeRating) - 75) / 100, 0.78, 1.25);
  const awayDefensePrior = leagueAvg * clamp(1 - (getDefenseStrength(awayRating) - 75) / 100, 0.78, 1.25);
  const homeFor = bayesianMetric(observedRate(home.gf_per_game, home.matches_played, leagueAvg), homeAttackPrior, home.matches_played, priorStrength);
  const awayFor = bayesianMetric(observedRate(away.gf_per_game, away.matches_played, leagueAvg), awayAttackPrior, away.matches_played, priorStrength);
  const homeAgainst = bayesianMetric(observedRate(home.ga_per_game, home.matches_played, leagueAvg), homeDefensePrior, home.matches_played, priorStrength);
  const awayAgainst = bayesianMetric(observedRate(away.ga_per_game, away.matches_played, leagueAvg), awayDefensePrior, away.matches_played, priorStrength);
  const rawHome = leagueAvg * (homeFor / leagueAvg) * (awayAgainst / leagueAvg) * formFactor(home.recent_form) * (1 + clamp(home.goal_diff, -15, 15) / 100) * homeAdvantage;
  const rawAway = leagueAvg * (awayFor / leagueAvg) * (homeAgainst / leagueAvg) * formFactor(away.recent_form) * (1 + clamp(away.goal_diff, -15, 15) / 100);
  const priorHome = ratingExpectedGoals({ own: homeRating, opponent: awayRating, leagueAvgGoals: leagueAvg, homeAdvantage, model: "attack_defense_v2" });
  const priorAway = ratingExpectedGoals({ own: awayRating, opponent: homeRating, leagueAvgGoals: leagueAvg, homeAdvantage: 1, model: "attack_defense_v2" });
  const sharedGames = Math.min(home.matches_played, away.matches_played);
  return {
    lambdaHome: clamp(bayesianMetric(rawHome, priorHome, sharedGames, priorStrength), 0.2, 4.5),
    lambdaAway: clamp(bayesianMetric(rawAway, priorAway, sharedGames, priorStrength), 0.2, 4.5),
  };
}

function bayesianMetric(observed: number, prior: number, gamesPlayed: number, priorStrength: number): number {
  const weight = gamesPlayed / (gamesPlayed + priorStrength);
  return weight * observed + (1 - weight) * prior;
}

function applyExperimentalMismatchSpread(
  homeXg: number,
  awayXg: number,
  homeRating: TeamStrengthRating,
  awayRating: TeamStrengthRating
): { homeExpectedGoals: number; awayExpectedGoals: number; homeAdjustment: number; awayAdjustment: number } {
  const signedRatingDiff = getOverallStrength(homeRating) - getOverallStrength(awayRating);
  const requestedTransfer = mismatchTransfer(Math.abs(signedRatingDiff));
  if (signedRatingDiff === 0 || requestedTransfer === 0) {
    return { homeExpectedGoals: homeXg, awayExpectedGoals: awayXg, homeAdjustment: 0, awayAdjustment: 0 };
  }
  const favoriteXg = signedRatingDiff > 0 ? homeXg : awayXg;
  const underdogXg = signedRatingDiff > 0 ? awayXg : homeXg;
  const transfer = Math.min(requestedTransfer, 4.5 - favoriteXg, underdogXg - 0.2);
  const homeAdjustment = signedRatingDiff > 0 ? transfer : -transfer;
  const awayAdjustment = -homeAdjustment;
  return {
    homeExpectedGoals: clamp(homeXg + homeAdjustment, 0.2, 4.5),
    awayExpectedGoals: clamp(awayXg + awayAdjustment, 0.2, 4.5),
    homeAdjustment,
    awayAdjustment,
  };
}

/** Continuous transfer: 0 at diff 10, 0.06 at 15, 0.15 at 20, capped at 0.30. */
function mismatchTransfer(ratingDiff: number): number {
  if (ratingDiff <= 10) return 0;
  const tier10to15 = Math.min(ratingDiff - 10, 5) * 0.012;
  const tier15to20 = Math.min(Math.max(ratingDiff - 15, 0), 5) * 0.018;
  const tier20plus = Math.max(ratingDiff - 20, 0) * 0.025;
  return Math.min(tier10to15 + tier15to20 + tier20plus, 0.3);
}

function observedRate(rate: number, matchesPlayed: number, leagueAvg: number): number {
  return matchesPlayed > 0 && Number.isFinite(rate) && rate >= 0 ? rate : leagueAvg;
}

function contextModifier(side: "home" | "away", context?: WorldCupGroupContext): number {
  if (!context) return 1;
  const m = context.modifiers;
  const raw = side === "home"
    ? m.urgencyModifierHome + m.goalDifferenceIncentiveHome + m.rotationRiskHome + m.drawUtility
    : m.urgencyModifierAway + m.goalDifferenceIncentiveAway + m.rotationRiskAway + m.drawUtility;
  return clamp(1 + raw, 0.94, 1.06);
}

function blend(statsLambda: number, ratingLambda: number, ratingShare: number): number {
  return statsLambda * (1 - ratingShare) + ratingLambda * ratingShare;
}

function baseAssumptions(extra: string[]): string[] {
  return [
    "Modelo Mundial Edge: combina rating base por selección, team_stats del Mundial y promedio global de goles.",
    "La probabilidad es del modelo; no es edge apostable sin comparación contra cuota real.",
    ...extra,
  ];
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
