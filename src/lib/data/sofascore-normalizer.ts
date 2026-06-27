/**
 * sofascore-normalizer.ts
 *
 * Transforma los datos crudos de Sofascore (fraccionales, marketId numérico,
 * nombres de outcome en inglés) al formato ProviderOdd del sistema.
 *
 * Estructura real observada en FASE 0.4 (junio 2026):
 *   - Odds: campo `fractionalValue` ("14/1" = 15.0 decimal)
 *   - Línea over/under: campo `choiceGroup` ("1.5", "2.5", "3.5")
 *   - Outcomes 1x2: "1" / "X" / "2"
 *   - Outcomes BTTS: "Yes" / "No"
 *   - Outcomes over/under: "Over" / "Under"
 *   - Outcomes double_chance: "1X" / "X2" / "12"
 */

import type { Market, Outcome } from "@/lib/types";
import type { ProviderOdd } from "./providers";
import type { SofascoreRawOdd } from "./sofascore-provider";

// ─── Mapeo marketId → Market ──────────────────────────────────────────────────
function resolveMarket(raw: SofascoreRawOdd): Market | null {
  switch (raw.marketId) {
    case 1:  return "1x2";
    case 2:  return "double_chance";
    case 5:  return "btts";
    case 9: {
      const cg = raw.choiceGroup ?? "";
      if (cg === "1.5") return "over_under_1_5";
      if (cg === "2.5") return "over_under_2_5";
      if (cg === "3.5") return "over_under_3_5";
      return null;
    }
    default:
      return null;
  }
}

// ─── Mapeo nombre de outcome → Outcome ───────────────────────────────────────
const OUTCOME_MAP: Record<string, Outcome> = {
  // 1x2
  "1":     "home",
  "X":     "draw",
  "2":     "away",
  // btts
  "Yes":   "yes",
  "No":    "no",
  // over/under (marketId=9)
  "Over":  "over",
  "Under": "under",
  // double_chance
  "1X":    "1x",
  "X2":    "x2",
  "12":    "12",
};

// ─── Conversión de cuota fraccional a decimal ─────────────────────────────────
function fracToDecimal(frac: string): number {
  const parts = frac.split("/");
  if (parts.length !== 2) return NaN;
  const num = Number(parts[0]);
  const den = Number(parts[1]);
  if (!den || isNaN(num) || isNaN(den)) return NaN;
  return num / den + 1;
}

// ─── Función principal ────────────────────────────────────────────────────────
export function normalizeSofascoreOdds(
  matchId: string,
  homeName: string,
  awayName: string,
  rawOdds: SofascoreRawOdd[]
): ProviderOdd[] {
  const out: ProviderOdd[] = [];

  for (const raw of rawOdds) {
    const market = resolveMarket(raw);
    if (!market) {
      console.warn(`[sofascore-normalizer] marketId=${raw.marketId} choiceGroup=${raw.choiceGroup ?? "-"} sin mapeo — descartado.`);
      continue;
    }

    // Línea numérica para over/under
    const line = raw.choiceGroup ? Number(raw.choiceGroup) : null;

    for (const choice of raw.choices) {
      const outcome = OUTCOME_MAP[choice.name];
      if (!outcome) {
        console.warn(`[sofascore-normalizer] outcome desconocido: "${choice.name}" en market=${market} — descartado.`);
        continue;
      }

      const decimal_odds = fracToDecimal(choice.fractionalValue);
      if (isNaN(decimal_odds) || decimal_odds < 1.01 || decimal_odds > 50) {
        console.warn(`[sofascore-normalizer] cuota inválida: "${choice.fractionalValue}" → ${decimal_odds} — descartada.`);
        continue;
      }

      out.push({
        home_name: homeName,
        away_name: awayName,
        bookmaker: "sofascore",
        market,
        outcome,
        decimal_odds,
        line: isNaN(line!) ? null : line,
      });
    }
  }

  return out;
}
