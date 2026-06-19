import { evaluateCorrelation, compareCorrelationLevel } from "./correlation";
import { calculateRiskScore, riskLabel, scoreParlay } from "./parlay-scoring";
import { calculateMatrixAwareJointProbability } from "./stat-model-adapter";
import { isPreMatchEligible } from "../matches/pre-match-eligibility";
import { formatMarketWithLine, marketDistributionKey } from "../markets/market-display";
import type {
  GenerateParlaysOptions,
  GenerateParlaysResult,
  Parlay,
  ParlayPick,
  ParlayProfile,
  ProfileRules,
  RejectedParlayCandidate,
  RejectionReason,
  SuggestedParlay,
} from "./parlay-types";
import { suggestStake } from "./staking";

export const PARLAY_PROFILE_RULES: Record<ParlayProfile, ProfileRules> = {
  conservative: {
    label: "Conservadora",
    maxLegs: 3,
    candidateLimit: 24,
    minPickProbability: 0.42,
    minJointProbability: 0.14,
    minEV: 0.02,
    maxEV: 0.28,
    maxPickOdds: 3.2,
    maxTotalOdds: 10,
    maxRiskScore: 62,
    maxCorrelation: "medium",
    targetOddsRange: [1.8, 4.5],
    preferredLegs: [2],
    kellyMultiplier: 0.25,
    maxStakePercent: 0.0075,
  },
  balanced: {
    label: "Balanceada",
    maxLegs: 4,
    candidateLimit: 30,
    minPickProbability: 0.24,
    minJointProbability: 0.06,
    minEV: 0.02,
    maxEV: 0.45,
    maxPickOdds: 5,
    maxTotalOdds: 25,
    maxRiskScore: 76,
    maxCorrelation: "medium",
    targetOddsRange: [3, 9],
    preferredLegs: [2, 3],
    kellyMultiplier: 0.35,
    maxStakePercent: 0.015,
  },
  aggressive: {
    label: "Agresiva",
    maxLegs: 5,
    candidateLimit: 36,
    minPickProbability: 0.08,
    minJointProbability: 0.02,
    minEV: 0,
    maxEV: 0.9,
    maxPickOdds: 6,
    maxTotalOdds: 70,
    maxRiskScore: 90,
    maxCorrelation: "high",
    targetOddsRange: [6, 30],
    preferredLegs: [3, 4],
    kellyMultiplier: 0.5,
    maxStakePercent: 0.025,
  },
};

function product(values: number[]): number {
  return values.reduce((acc, value) => acc * value, 1);
}

function comboId(profile: ParlayProfile, picks: ParlayPick[]): string {
  return `${profile}:${picks.map((pick) => pick.id).sort().join("|")}`;
}

function combinations<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  const walk = (start: number, current: T[]) => {
    if (current.length === size) {
      out.push([...current]);
      return;
    }
    for (let i = start; i <= items.length - (size - current.length); i++) {
      current.push(items[i]);
      walk(i + 1, current);
      current.pop();
    }
  };
  walk(0, []);
  return out;
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function parseNow(now: GenerateParlaysOptions["now"]): number {
  if (!now) return Date.now();
  return now instanceof Date ? now.getTime() : new Date(now).getTime();
}

function isPreMatchPick(pick: ParlayPick, nowMs: number): boolean {
  return isPreMatchEligible(pick.match ?? { status: pick.matchStatus, kickoff: pick.startsAt }, nowMs);
}

function rejectionId(profile: ParlayProfile, picks: ParlayPick[], reason: RejectionReason): string {
  return `${profile}:rejected:${reason}:${picks.map((pick) => pick.id).sort().join("|")}`;
}

function reject(input: {
  profile: ParlayProfile;
  picks: ParlayPick[];
  reason: RejectionReason;
  message: string;
  totalOdds?: number;
  jointProbabilityRaw?: number;
  jointProbabilityAdjusted?: number;
  ev?: number;
  riskScore?: number;
  correlationLevel?: RejectedParlayCandidate["correlationLevel"];
  correlationReasons?: string[];
}): RejectedParlayCandidate {
  return {
    id: rejectionId(input.profile, input.picks, input.reason),
    profile: input.profile,
    picks: input.picks,
    reason: input.reason,
    message: input.message,
    totalOdds: input.totalOdds,
    jointProbabilityRaw: input.jointProbabilityRaw,
    jointProbabilityAdjusted: input.jointProbabilityAdjusted,
    ev: input.ev,
    riskScore: input.riskScore,
    correlationLevel: input.correlationLevel,
    correlationReasons: input.correlationReasons,
  };
}

function validateCandidatePick(
  pick: ParlayPick,
  options: GenerateParlaysOptions,
  rules: ProfileRules,
  nowMs: number
): { ok: true } | { ok: false; reason: RejectionReason; message: string } {
  const allowedMarkets = new Set(options.allowedMarkets ?? []);
  const minEdge = options.minEdge ?? 0.02;
  const minConfidence = options.minConfidence ?? (options.allowLowConfidence === false ? "medium" : "low");
  if (allowedMarkets.size && !allowedMarkets.has(pick.market)) {
    return { ok: false, reason: "pick_invalid", message: "Mercado no permitido por filtros." };
  }
  if (!isPreMatchPick(pick, nowMs)) {
    return { ok: false, reason: "pick_expired", message: "Pick vencido, live o no pre-partido." };
  }
  if (
    !isFinitePositive(pick.odds) ||
    !(pick.anchoredProb > 0 && pick.anchoredProb < 1 && Number.isFinite(pick.anchoredProb)) ||
    !(pick.marketProb > 0 && pick.marketProb < 1 && Number.isFinite(pick.marketProb)) ||
    !Number.isFinite(pick.ev) ||
    !Number.isFinite(pick.edge)
  ) {
    return { ok: false, reason: "pick_invalid", message: "Cuota, probabilidad o EV inválidos." };
  }
  if (pick.odds < 1.15 || pick.odds > rules.maxPickOdds || pick.ev > 1) {
    return { ok: false, reason: "pick_invalid", message: "Pick fuera de rangos individuales del perfil." };
  }
  if (pick.edge < minEdge) {
    return { ok: false, reason: "edge_below_minimum", message: `Edge individual por debajo de ${(minEdge * 100).toFixed(1)}%.` };
  }
  if (confidenceRank(pick.confidence) < confidenceRank(minConfidence)) {
    return { ok: false, reason: "confidence_below_minimum", message: `Confianza ${pick.confidence} por debajo de ${minConfidence}.` };
  }
  if (pick.anchoredProb < rules.minPickProbability) {
    return { ok: false, reason: "pick_invalid", message: "Probabilidad individual por debajo del mínimo del perfil." };
  }
  return { ok: true };
}

function baseCandidates(
  picks: ParlayPick[],
  options: GenerateParlaysOptions,
  rules: ProfileRules
): { candidates: ParlayPick[]; rejected: RejectedParlayCandidate[] } {
  const allowedMarkets = new Set(options.allowedMarkets ?? []);
  const nowMs = parseNow(options.now);
  const bySelection = new Map<string, ParlayPick>();
  const rejected: RejectedParlayCandidate[] = [];

  for (const pick of picks) {
    const key = `${pick.matchId}:${pick.market}:${pick.selection}`;
    const current = bySelection.get(key);
    if (current) {
      rejected.push(reject({
        profile: options.profile,
        picks: [pick],
        reason: "pick_duplicated",
        message: "Pick duplicado por partido/mercado/selección; se conserva el de mayor EV.",
      }));
    }
    if (!current || pick.ev > current.ev) bySelection.set(key, pick);
  }

  const validCandidates = Array.from(bySelection.values())
    .filter((pick) => {
      const valid = validateCandidatePick(pick, options, rules, nowMs);
      if (!valid.ok) {
        rejected.push(reject({
          profile: options.profile,
          picks: [pick],
          reason: valid.reason,
          message: valid.message,
        }));
      }
      return valid.ok;
    })
    .sort((a, b) => candidateScore(b) - candidateScore(a));
  for (const pick of validCandidates.slice(rules.candidateLimit)) {
    rejected.push(reject({
      profile: options.profile,
      picks: [pick],
      reason: "candidate_limit",
      message: `Fuera del top ${rules.candidateLimit} de candidatos por score.`,
    }));
  }
  const candidates = validCandidates.slice(0, rules.candidateLimit);
  return { candidates, rejected };
}

function confidenceRank(confidence: "low" | "medium" | "high"): number {
  return confidence === "high" ? 2 : confidence === "medium" ? 1 : 0;
}

function candidateScore(pick: ParlayPick): number {
  return pick.ev + pick.edge * 0.6 + pick.anchoredProb * 0.2 + confidenceRank(pick.confidence) * 0.025 + (pick.isQualityPick ? 0.01 : 0);
}

function buildWarnings(parlay: {
  profile: ParlayProfile;
  picks: ParlayPick[];
  correlationLevel: string;
  ev: number;
  riskScore: number;
  jointProbabilityAdjusted: number;
  totalOdds: number;
}): string[] {
  const warnings: string[] = [];
  if (parlay.correlationLevel === "medium" || parlay.correlationLevel === "high") {
    warnings.push("Incluye picks del mismo partido; la probabilidad conjunta fue penalizada por correlación.");
  }
  if (parlay.ev > 0.18) {
    warnings.push("EV alto: revisar cuotas y supuestos antes de usarlo como referencia.");
  }
  if (parlay.jointProbabilityAdjusted < 0.06) {
    warnings.push("Probabilidad conjunta baja: tratar como escenario de alta incertidumbre.");
  }
  if (parlay.totalOdds > 20) {
    warnings.push("Cuota total elevada: la varianza domina aunque el EV sea positivo.");
  }
  if (
    parlay.profile === "aggressive" ||
    parlay.riskScore >= 80 ||
    parlay.totalOdds > 25 ||
    parlay.picks.length >= 5 ||
    parlay.jointProbabilityAdjusted < 0.07
  ) {
    warnings.push("Alta varianza: aunque el EV estimado es positivo, la probabilidad conjunta es baja. Stake sugerido reducido para controlar riesgo.");
  }
  if (parlay.riskScore >= 55 || parlay.picks.length >= 4) {
    warnings.push("Combinada de alta varianza; no garantiza resultados.");
  }
  warnings.push("El análisis es probabilístico y no es asesoría financiera.");
  return warnings;
}

function explanationFor(profile: ParlayProfile, parlay: {
  picks: ParlayPick[];
  correlationLevel: string;
  ev: number;
  jointProbabilityAdjusted: number;
  totalOdds: number;
}): string {
  const base = `${parlay.picks.length} picks de calidad, cuota ${parlay.totalOdds.toFixed(2)}, probabilidad ajustada ${(parlay.jointProbabilityAdjusted * 100).toFixed(1)}%, EV ${(parlay.ev * 100).toFixed(1)}% y correlación ${parlay.correlationLevel}. ${marketMixExplanation(parlay.picks)}`;
  if (profile === "conservative") {
    return `Aparece como conservadora porque prioriza selecciones de probabilidad alta, cuota total moderada y riesgo bajo. ${base}`;
  }
  if (profile === "balanced") {
    return `Aparece como balanceada porque combina valor esperado positivo con probabilidad conjunta razonable y varianza controlada. ${base}`;
  }
  return `Aparece como agresiva porque acepta mayor varianza y explora una cuota total más ambiciosa, manteniendo EV ajustado positivo y stake acotado. ${base}`;
}

function marketMixExplanation(picks: ParlayPick[]): string {
  const counts = new Map<string, { count: number; label: string }>();
  for (const pick of picks) {
    const key = marketDistributionKey(pick);
    const current = counts.get(key);
    if (current) current.count++;
    else counts.set(key, { count: 1, label: formatMarketWithLine(pick) });
  }
  const repeated = Array.from(counts.values()).filter((item) => item.count > 1);
  if (!repeated.length) {
    return "La combinación mantiene diversidad de mercados cuando las alternativas tienen calidad comparable.";
  }
  const main = repeated.sort((a, b) => b.count - a.count)[0];
  return `${main.label} aparece ${main.count} veces; se mantiene porque esos picks superan filtros de EV, probabilidad y riesgo, aunque el ranking aplica una penalización suave por concentración.`;
}

export function generateParlays(picks: ParlayPick[], options: GenerateParlaysOptions): Parlay[] {
  return generateParlaysWithDebug(picks, options).parlays;
}

export function generateParlaysWithDebug(picks: ParlayPick[], options: GenerateParlaysOptions): GenerateParlaysResult {
  const rules = PARLAY_PROFILE_RULES[options.profile];
  const maxLegs = options.maxLegs ?? rules.maxLegs;
  const minJointProbability = options.minJointProbability ?? rules.minJointProbability;
  const minEV = options.minEV ?? rules.minEV;
  const maxCorrelation = options.maxCorrelation ?? rules.maxCorrelation;
  const maxResults = options.maxResults ?? 30;
  const maxTotalOdds = options.maxTotalOdds ?? 10;
  const { candidates, rejected } = baseCandidates(picks, options, rules);
  const parlays: Parlay[] = [];

  for (let size = 2; size <= Math.min(maxLegs, candidates.length); size++) {
    for (const pickSet of combinations(candidates, size)) {
      const matrixAware = hasSameMatchScoreMatrix(pickSet, options.scoreMatricesByMatchId);
      let correlation = evaluateCorrelation(pickSet);
      if (
        matrixAware &&
        correlation.level === "invalid" &&
        correlation.reasons.some((reason) => reason.includes("Más de dos"))
      ) {
        correlation = {
          level: "high",
          penaltyFactor: 1,
          reasons: ["Múltiples selecciones del mismo partido evaluadas con matriz de goles."],
        };
      }
      if (correlation.level === "invalid") {
        const message = correlation.reasons[0] ?? "Correlación inválida.";
        rejected.push(reject({
          profile: options.profile,
          picks: pickSet,
          reason: message.includes("Más de dos")
            ? "same_match_overload"
            : message.includes("contradictorias")
              ? "same_market_contradiction"
              : "invalid_correlation",
          message,
          correlationLevel: correlation.level,
          correlationReasons: correlation.reasons,
        }));
        continue;
      }
      if (options.allowSameMatch === false && new Set(pickSet.map((pick) => pick.matchId)).size !== pickSet.length) {
        rejected.push(reject({
          profile: options.profile,
          picks: pickSet,
          reason: "invalid_correlation",
          message: "El perfil/opción no permite selecciones del mismo partido.",
          correlationLevel: correlation.level,
          correlationReasons: correlation.reasons,
        }));
        continue;
      }
      if (!matrixAware && compareCorrelationLevel(correlation.level, maxCorrelation) > 0) {
        rejected.push(reject({
          profile: options.profile,
          picks: pickSet,
          reason: "invalid_correlation",
          message: "Correlación por encima del máximo permitido por el perfil.",
          correlationLevel: correlation.level,
          correlationReasons: correlation.reasons,
        }));
        continue;
      }

      const totalOdds = product(pickSet.map((pick) => pick.odds));
      if (!Number.isFinite(totalOdds) || totalOdds > Math.min(rules.maxTotalOdds, maxTotalOdds)) {
        rejected.push(reject({
          profile: options.profile,
          picks: pickSet,
          reason: "total_odds_too_high",
          message: "Cuota total por encima del máximo del perfil.",
          totalOdds,
          correlationLevel: correlation.level,
          correlationReasons: correlation.reasons,
        }));
        continue;
      }
      const jointProbabilityRaw = product(pickSet.map((pick) => pick.anchoredProb));
      const matrixJoint = calculateMatrixAwareJointProbability(pickSet, options.scoreMatricesByMatchId);
      if (matrixJoint.isInvalid) {
        rejected.push(reject({
          profile: options.profile,
          picks: pickSet,
          reason: "invalid_correlation",
          message: matrixJoint.reasons[0] ?? "Selecciones incompatibles según matriz de goles.",
          totalOdds,
          jointProbabilityRaw,
          jointProbabilityAdjusted: 0,
          ev: -1,
          correlationLevel: "invalid",
          correlationReasons: matrixJoint.reasons,
        }));
        continue;
      }
      const jointProbabilityAdjusted = matrixJoint.usedScoreMatrix
        ? matrixJoint.jointProbabilityAdjusted
        : jointProbabilityRaw * correlation.penaltyFactor;
      const ev = jointProbabilityAdjusted * totalOdds - 1;
      if (
        !Number.isFinite(jointProbabilityRaw) ||
        !Number.isFinite(jointProbabilityAdjusted) ||
        !Number.isFinite(ev) ||
        jointProbabilityAdjusted < minJointProbability
      ) {
        rejected.push(reject({
          profile: options.profile,
          picks: pickSet,
          reason: "joint_probability_too_low",
          message: "Probabilidad conjunta por debajo del mínimo del perfil.",
          totalOdds,
          jointProbabilityRaw,
          jointProbabilityAdjusted,
          ev,
          correlationLevel: correlation.level,
          correlationReasons: correlation.reasons,
        }));
        continue;
      }
      if (ev < minEV || ev > rules.maxEV) {
        rejected.push(reject({
          profile: options.profile,
          picks: pickSet,
          reason: "ev_out_of_range",
          message: "EV combinado fuera del rango razonable del perfil.",
          totalOdds,
          jointProbabilityRaw,
          jointProbabilityAdjusted,
          ev,
          correlationLevel: correlation.level,
          correlationReasons: correlation.reasons,
        }));
        continue;
      }

      const riskScore = calculateRiskScore({
        picks: pickSet,
        totalOdds,
        jointProbabilityAdjusted,
        correlationLevel: correlation.level,
      });
      if (riskScore > rules.maxRiskScore) {
        rejected.push(reject({
          profile: options.profile,
          picks: pickSet,
          reason: "risk_too_high",
          message: "Risk score por encima del máximo del perfil.",
          totalOdds,
          jointProbabilityRaw,
          jointProbabilityAdjusted,
          ev,
          riskScore,
          correlationLevel: correlation.level,
          correlationReasons: correlation.reasons,
        }));
        continue;
      }
      const stake = suggestStake({
        odds: totalOdds,
        probability: jointProbabilityAdjusted,
        profile: options.profile,
        bankroll: options.bankroll,
        riskScore,
        legs: pickSet.length,
        correlationLevel: correlation.level,
      });
      const parlayBase = {
        picks: pickSet,
        correlationLevel: correlation.level,
        ev,
        riskScore,
        jointProbabilityAdjusted,
        totalOdds,
        profile: options.profile,
      };

      const parlay: Parlay = {
        id: comboId(options.profile, pickSet),
        profile: options.profile,
        picks: pickSet,
        totalOdds,
        jointProbabilityRaw,
        jointProbabilityAdjusted,
        correlationLevel: correlation.level,
        correlationReasons: matrixJoint.usedScoreMatrix
          ? ["Correlación calculada por matriz de goles.", ...matrixJoint.reasons]
          : correlation.reasons,
        correlationMethod: matrixJoint.usedScoreMatrix ? "score_matrix" : "heuristic",
        correlationRatio: matrixJoint.correlationRatio,
        sameMatchJointProbability: matrixJoint.sameMatchJointProbability,
        ev,
        riskScore,
        riskLevel: riskLabel(riskScore),
        suggestedStakeUnits: stake.suggestedStakeUnits,
        suggestedStakePercent: stake.suggestedStakePercent,
        suggestedStakeAmount: stake.suggestedStakeAmount,
        stakeReason: stake.reason,
        score: 0,
        explanation: explanationFor(options.profile, parlayBase),
        warnings: [...new Set([
          ...buildWarnings(parlayBase),
          ...(options.predictionMetadata?.warnings ?? []),
        ])],
        modelVariantUsed: options.predictionMetadata?.modelVariantUsed,
        calibrationUsed: options.predictionMetadata?.calibrationUsed,
        configSource: options.predictionMetadata?.configSource,
      };
      parlay.score = scoreParlay({ ...parlay, profile: options.profile });
      parlays.push(parlay);
    }
  }

  const sorted = parlays
    .sort((a, b) => b.score - a.score || b.jointProbabilityAdjusted - a.jointProbabilityAdjusted)
    .slice(0, maxResults);
  return { parlays: sorted, rejected };
}

export function generateSuggestedParlays(
  picks: ParlayPick[],
  config: Omit<GenerateParlaysOptions, "profile"> = {}
): SuggestedParlay[] {
  const definitions = [
    {
      theme: "favorite" as const,
      label: "Combo favorito",
      description: "2–3 favoritos con edge superior a 2%.",
      candidates: picks.filter((pick) => pick.market === "1x2" && pick.odds <= 2.25 && pick.edge >= 0.02),
      profile: "balanced" as const,
      minEdge: 0.02,
      minOdds: 1,
    },
    {
      theme: "goals" as const,
      label: "Combo goles",
      description: "2–3 selecciones de más de 2.5 goles con edge superior a 2%.",
      candidates: picks.filter((pick) => pick.market === "over_under_2_5" && pick.selection === "over" && pick.edge >= 0.02),
      profile: "balanced" as const,
      minEdge: 0.02,
      minOdds: 1,
    },
    {
      theme: "surprise" as const,
      label: "Combo sorpresa",
      description: "Dos victorias visitantes con edge superior a 5% y cuota combinada mayor a 5.",
      candidates: picks.filter((pick) => pick.market === "1x2" && pick.selection === "away" && pick.edge >= 0.05),
      profile: "aggressive" as const,
      minEdge: 0.05,
      minOdds: 5,
    },
  ];

  const suggestions: SuggestedParlay[] = [];
  for (const definition of definitions) {
    const generated = generateParlays(definition.candidates, {
      ...config,
      profile: definition.profile,
      minEdge: definition.minEdge,
      minEV: 0,
      minJointProbability: 0,
      allowLowConfidence: true,
      maxLegs: definition.theme === "surprise" ? 2 : 3,
      maxResults: 20,
    });
    const parlay = generated.find((candidate) => candidate.totalOdds >= definition.minOdds);
    if (parlay) suggestions.push({
      theme: definition.theme,
      label: definition.label,
      description: definition.description,
      parlay,
    });
  }
  return suggestions;
}

function hasSameMatchScoreMatrix(
  picks: ParlayPick[],
  scoreMatricesByMatchId?: GenerateParlaysOptions["scoreMatricesByMatchId"]
): boolean {
  if (!scoreMatricesByMatchId) return false;
  const counts = new Map<string, number>();
  for (const pick of picks) counts.set(pick.matchId, (counts.get(pick.matchId) ?? 0) + 1);
  return Array.from(counts.entries()).some(([matchId, count]) => count > 1 && !!scoreMatricesByMatchId[matchId]);
}
