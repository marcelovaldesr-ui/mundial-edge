import type { Market, Outcome, Match } from "@/lib/types";
import { formatMarketName, formatSelectionName } from "@/lib/markets/market-display";

export function marketLabel(market: Market): string {
  return formatMarketName(market);
}

export function outcomeLabel(market: Market, outcome: Outcome, match?: Match): string {
  return formatSelectionName({ market, outcome, match });
}
