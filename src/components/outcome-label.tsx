import type { Market, Outcome, Match } from "@/lib/types";

export function marketLabel(market: Market): string {
  return market === "1x2" ? "1X2" : market === "btts" ? "Ambos marcan" : "Más/Menos 2.5";
}

export function outcomeLabel(market: Market, outcome: Outcome, match?: Match): string {
  if (market === "1x2") {
    if (outcome === "home") return match?.home_team?.code ?? "Local";
    if (outcome === "away") return match?.away_team?.code ?? "Visita";
    return "Empate";
  }
  if (market === "btts") return outcome === "yes" ? "Sí" : "No";
  return outcome === "over" ? "Más de 2.5" : "Menos de 2.5";
}
