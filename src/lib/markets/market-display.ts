import type { Market, Match, Outcome } from "../types";
import type { ParlayPick } from "../parlays/parlay-types";

type DisplayInput = {
  market: string;
  outcome?: string;
  selection?: string;
  line?: number | string | null;
  match?: Match;
};

export type MarketDisplayCategory =
  | "winner"
  | "double_chance"
  | "goals_total"
  | "btts"
  | "team_total"
  | "handicap"
  | "corners"
  | "cards"
  | "shots"
  | "unknown";

export function formatMarketName(input: Market | string | DisplayInput): string {
  const market = marketKey(input);
  const category = getMarketCategoryLabel(input);
  if (category === "Ganador") return "Ganador del partido";
  if (category !== "Mercado") return category;
  return market.replace(/_/g, " ");
}

export function formatSelectionName(input: DisplayInput | ParlayPick | { market: Market; outcome: Outcome; match?: Match }): string {
  const market = marketKey(input);
  const selection = selectionKey(input);
  const match = "match" in input ? input.match : undefined;

  if (market === "1x2") {
    if (selection === "home") return match?.home_team?.code ?? "Local";
    if (selection === "away") return match?.away_team?.code ?? "Visita";
    return "Empate";
  }

  if (market === "btts") return `Ambos equipos anotan: ${selection === "yes" ? "Sí" : "No"}`;

  if (isTotalsMarket(market)) {
    const line = formatLine(extractLine(input, market) ?? 2.5);
    return `${selection === "over" ? "Más" : "Menos"} de ${line} goles`;
  }

  if (market.includes("corner")) {
    const line = formatLine(extractLine(input, market));
    return `${selection === "over" ? "Más" : "Menos"} de ${line ?? "?"} corners`;
  }

  if (market.includes("card") || market.includes("tarjeta")) {
    const line = formatLine(extractLine(input, market));
    return `${selection === "over" ? "Más" : "Menos"} de ${line ?? "?"} tarjetas`;
  }

  if (market.includes("double_chance")) return `Doble oportunidad: ${selection.toUpperCase()}`;
  if (market.includes("handicap")) return `Hándicap ${selection.replace(/^handicap_?/, "")}`;

  if (selection === "over" || selection === "under") {
    const line = formatLine(extractLine(input, market));
    return `${selection === "over" ? "Más" : "Menos"} de ${line ?? "?"} unidades`;
  }

  return selection || "Selección";
}

export function formatMarketWithLine(input: Market | string | DisplayInput): string {
  const market = marketKey(input);
  if (isTotalsMarket(market)) return `Total de goles ${formatLine(extractLine(input, market) ?? 2.5)}`;
  if (market.includes("corner")) return `Corners ${formatLine(extractLine(input, market)) ?? ""}`.trim();
  if (market.includes("card") || market.includes("tarjeta")) return `Tarjetas ${formatLine(extractLine(input, market)) ?? ""}`.trim();
  return formatMarketName(input);
}

export function getMarketCategoryLabel(input: Market | string | DisplayInput): string {
  const category = getMarketCategory(input);
  if (category === "winner") return "Ganador";
  if (category === "double_chance") return "Doble oportunidad";
  if (category === "goals_total") return "Total de goles";
  if (category === "btts") return "Ambos equipos anotan";
  if (category === "team_total") return "Goles del equipo";
  if (category === "handicap") return "Hándicap";
  if (category === "corners") return "Corners";
  if (category === "cards") return "Tarjetas";
  if (category === "shots") return "Remates";
  return "Mercado";
}

export function getMarketCategory(input: Market | string | DisplayInput): MarketDisplayCategory {
  const market = marketKey(input);
  if (market === "1x2" || market === "h2h") return "winner";
  if (market.includes("double_chance")) return "double_chance";
  if (market === "btts") return "btts";
  if (market.includes("team_total")) return "team_total";
  if (market.includes("handicap")) return "handicap";
  if (market.includes("corner")) return "corners";
  if (market.includes("card") || market.includes("tarjeta")) return "cards";
  if (market.includes("shot")) return "shots";
  if (isTotalsMarket(market)) return "goals_total";
  return "unknown";
}

export function marketDistributionKey(input: DisplayInput | ParlayPick | { market: Market; outcome?: Outcome }): string {
  const category = getMarketCategory(input);
  const line = extractLine(input, marketKey(input));
  if (category === "goals_total" && line != null) return `goals_total_${formatLine(line)}`;
  if (category === "corners" && line != null) return `corners_${formatLine(line)}`;
  if (category === "cards" && line != null) return `cards_${formatLine(line)}`;
  return category;
}

function marketKey(input: Market | string | DisplayInput): string {
  return String(typeof input === "string" ? input : input.market).toLowerCase();
}

function selectionKey(input: DisplayInput | ParlayPick | { market: Market; outcome?: Outcome }): string {
  const raw = "selection" in input ? input.selection : "outcome" in input ? input.outcome : "";
  return String(raw ?? "").toLowerCase();
}

function isTotalsMarket(market: string): boolean {
  return market === "over_under_2_5" || market === "totals" || market.includes("total_goals") || market.includes("goals_total");
}

function extractLine(input: Market | string | DisplayInput | ParlayPick | { market: Market }, market = marketKey(input)): number | null {
  if (typeof input !== "string" && "line" in input && input.line != null) {
    const parsed = Number(input.line);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const match = market.match(/(?:^|_)(\d+)_(\d+)(?:$|_)/);
  if (match) return Number(`${match[1]}.${match[2]}`);
  if (market === "over_under_2_5") return 2.5;
  return null;
}

function formatLine(value: number | string | null | undefined): string | null {
  if (value == null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return parsed.toFixed(1);
}
