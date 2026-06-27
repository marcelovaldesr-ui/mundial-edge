import type { Edge } from "../types";
import type { ParlayPick } from "../parlays/parlay-types";

// ─── Taxonomía de señales (P1.3) ────────────────────────────────
// Convierte datos que el modelo YA computa (edge, confianza, cuota real,
// warnings del ensemble) en badges legibles. No inventa lógica nueva:
// solo sube a la UI señales que antes vivían en texto largo o en debug.

export type SignalBadgeVariant = "success" | "warning" | "danger" | "muted" | "outline";

export interface SignalBadge {
  label: string;
  variant: SignalBadgeVariant;
  title?: string;
}

export interface SignalBadgeInput {
  confidence?: "low" | "medium" | "high";
  edge: number;                       // edge final (modelo − implícita de mercado)
  anchoredProb: number;               // probabilidad final
  ev: number;                         // EV final
  tier?: string;                      // ValueTier del EV final
  marketProbability?: number | null;
  modelProbability?: number | null;
  hasRealOdds: boolean;
  warnings?: string[];
  /** Antigüedad del dato en horas (edges persistidos). */
  ageHours?: number;
}

const STALE_EDGE_HOURS = 6;

function pctLabel(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function deriveSignalBadges(input: SignalBadgeInput): SignalBadge[] {
  const badges: SignalBadge[] = [];
  const warnings = input.warnings ?? [];
  const noRealOdds = !input.hasRealOdds || warnings.some((w) => w.toLowerCase().includes("sin cuota real"));

  if (noRealOdds) {
    badges.push({
      label: "Cuota estimada",
      variant: "warning",
      title: "Probabilidad de modelo sin cuota real comparable; no es un edge apostable.",
    });
  } else if (input.edge > 0.02) {
    badges.push({
      label: "Pick value",
      variant: "success",
      title: "El modelo asigna más probabilidad que la implícita del mercado (edge positivo con cuota real).",
    });
  }

  if (input.anchoredProb >= 0.6 && input.edge <= 0.02) {
    badges.push({
      label: "Pick probable",
      variant: "outline",
      title: "Probabilidad alta; el value frente al mercado es marginal.",
    });
  }

  if (input.tier === "high" || input.ev > 0.15) {
    badges.push({
      label: "Edge alto · verificar",
      variant: "warning",
      title: "EV inusualmente alto: posible dato atípico o error del modelo. Verificar la cuota.",
    });
  }

  if (input.marketProbability != null && input.modelProbability != null) {
    const gap = input.modelProbability - input.marketProbability;
    if (Math.abs(gap) >= 0.1) {
      badges.push({
        label: "Mercado contradice al modelo",
        variant: "muted",
        title: `Modelo ${pctLabel(input.modelProbability)} vs mercado ${pctLabel(input.marketProbability)} (difieren más de 10 puntos).`,
      });
    }
  }

  if (input.confidence === "low") {
    badges.push({
      label: "Confianza baja",
      variant: "muted",
      title: "Muestra corta o datos limitados; trátalo con cautela (solo perfiles agresivos).",
    });
  }

  if (input.ageHours != null && input.ageHours >= STALE_EDGE_HOURS) {
    badges.push({
      label: `Dato persistido (${Math.round(input.ageHours)}h)`,
      variant: "muted",
      title: "Edge leído de almacenamiento; puede no reflejar el mercado actual. Verifica la cuota antes de apostar.",
    });
  }

  return badges;
}

export function signalBadgesForEdge(edge: Edge): SignalBadge[] {
  const breakdown = edge.final_probability_breakdown;
  return deriveSignalBadges({
    confidence: edge.final_probability_confidence ?? breakdown?.confidence,
    edge: edge.final_edge ?? edge.edge,
    anchoredProb: edge.final_probability ?? edge.model_probability,
    ev: edge.final_expected_value ?? edge.expected_value,
    tier: edge.final_tier ?? edge.tier,
    marketProbability: breakdown?.components.marketProbability ?? edge.implied_probability,
    modelProbability: breakdown?.components.poissonProbability,
    hasRealOdds: !!edge.bookmaker,
    warnings: breakdown?.warnings,
    ageHours: edge.updated_at ? Math.max(0, (Date.now() - new Date(edge.updated_at).getTime()) / 3_600_000) : undefined,
  });
}

export function signalBadgesForPick(pick: ParlayPick): SignalBadge[] {
  const breakdown = pick.finalProbabilityBreakdown;
  return deriveSignalBadges({
    confidence: pick.confidence,
    edge: pick.edge,
    anchoredProb: pick.anchoredProb,
    ev: pick.ev,
    tier: pick.riskLevel,
    marketProbability: breakdown?.components.marketProbability ?? pick.marketProb,
    modelProbability: breakdown?.components.poissonProbability,
    hasRealOdds: !!pick.bookmaker,
    warnings: breakdown?.warnings,
  });
}
