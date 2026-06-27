import type { Edge } from "../types";
import { realismLabel, passesRealismProfile } from "./edge";

export type RecommendationMode = "realistic" | "conservative" | "value";

export interface TopRecommendation {
  mode: RecommendationMode;
  label: string;
  edge: Edge;
  score: number;
  justification: string;
}

/**
 * Selecciona el mejor pick por cada modo de recomendación.
 *
 * - realistic:    mayor combinación edge + probabilidad, prob ≥ 15%
 * - conservative: mayor probabilidad con edge ≥ 2%, prob ≥ 50%
 * - value:        mayor edge con prob ≥ 20%, edge ≥ 3%
 *
 * Siempre descarta picks con realism === "artificial".
 */
export function getTopRecommendations(edges: Edge[]): TopRecommendation[] {
  const eligible = edges.filter((e) => {
    const prob = e.final_probability ?? e.model_probability;
    const ev = e.final_edge ?? e.edge;
    // Descarta artefactos del modelo, picks por debajo del umbral agresivo (15%),
    // y edges que no pasan los filtros de calidad (odds range, EV máximo, etc.)
    return (
      e.qualifies !== false &&
      realismLabel(prob, ev) !== "artificial" &&
      passesRealismProfile(prob, "aggressive")
    );
  });

  const picks: TopRecommendation[] = [];

  // --- Realista: score combinado edge+prob ---
  const realistic = [...eligible]
    .filter((e) => (e.final_edge ?? e.edge) >= 0.02)
    .sort((a, b) => {
      const sa = realisticScore(a), sb = realisticScore(b);
      return sb - sa;
    })[0];
  if (realistic) {
    const prob = realistic.final_probability ?? realistic.model_probability;
    const ev = realistic.final_edge ?? realistic.edge;
    picks.push({
      mode: "realistic",
      label: "Mejor pick realista",
      edge: realistic,
      score: realisticScore(realistic),
      justification: `Prob. ${pct(prob)} · Edge ${pct(ev)} · EV ${pct(realistic.final_expected_value ?? realistic.expected_value)}. Combinación óptima entre ventaja estadística y probabilidad de ocurrencia.`,
    });
  }

  // --- Conservadora: máx probabilidad, edge ≥ 2%, prob ≥ 50% (perfil conservative) ---
  const conservative = [...eligible]
    .filter((e) => {
      const prob = e.final_probability ?? e.model_probability;
      const ev = e.final_edge ?? e.edge;
      return passesRealismProfile(prob, "conservative") && ev >= 0.02;
    })
    .sort((a, b) => {
      const pa = a.final_probability ?? a.model_probability;
      const pb = b.final_probability ?? b.model_probability;
      return pb - pa;
    })[0];
  if (conservative && conservative.id !== realistic?.id) {
    const prob = conservative.final_probability ?? conservative.model_probability;
    const ev = conservative.final_edge ?? conservative.edge;
    picks.push({
      mode: "conservative",
      label: "Mejor pick conservador",
      edge: conservative,
      score: prob,
      justification: `Prob. ${pct(prob)} · Edge ${pct(ev)} · Cuota ${conservative.decimal_odds.toFixed(2)}. Alta probabilidad de acierto — adecuado para base de combinada o apuesta simple de bajo riesgo.`,
    });
  }

  // --- Valor: máx edge, prob ≥ 30% (perfil balanced), edge ≥ 3% ---
  const value = [...eligible]
    .filter((e) => {
      const prob = e.final_probability ?? e.model_probability;
      const ev = e.final_edge ?? e.edge;
      return passesRealismProfile(prob, "balanced") && ev >= 0.03;
    })
    .sort((a, b) => {
      const ea = a.final_edge ?? a.edge;
      const eb = b.final_edge ?? b.edge;
      return eb - ea;
    })[0];
  if (value && value.id !== realistic?.id && value.id !== conservative?.id) {
    const prob = value.final_probability ?? value.model_probability;
    const ev = value.final_edge ?? value.edge;
    picks.push({
      mode: "value",
      label: "Mejor pick de valor",
      edge: value,
      score: ev,
      justification: `Prob. ${pct(prob)} · Edge ${pct(ev)} · Cuota ${value.decimal_odds.toFixed(2)}. Mayor ventaja estimada frente al mercado con probabilidad aún razonable.`,
    });
  }

  return picks;
}

function realisticScore(e: Edge): number {
  const prob = e.final_probability ?? e.model_probability;
  const ev = e.final_edge ?? e.edge;
  return prob * 0.55 + Math.min(ev, 0.15) / 0.15 * 0.45;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}
