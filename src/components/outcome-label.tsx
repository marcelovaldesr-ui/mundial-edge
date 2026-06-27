import type { Match } from "@/lib/types";
import { formatMarketName, formatSelectionName } from "@/lib/markets/market-display";

export function marketLabel(market: string): string {
  return formatMarketName(market);
}

export function outcomeLabel(market: string, outcome: string, match?: Match): string {
  return formatSelectionName({ market, outcome, match });
}
