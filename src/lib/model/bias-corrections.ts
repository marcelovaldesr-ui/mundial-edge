/**
 * Market bias corrections derived from calibration-report.json
 * (448 WC matches 1998–2022, model xg-v2.2-mismatch-spread + T=0.65).
 *
 * The temperature scaling (T=0.65) inflates lambdas to sharpen 1x2 predictions,
 * but systematically overestimates goal totals.
 *
 * KEY FINDINGS:
 *   Over 2.5: bin 7 (n=341) predicted 78.2% actual 43.4% → factor 0.58
 *             bin 8 (n=104) predicted 81.0% actual 52.9% → factor 0.65
 *             Weighted correction: 0.58 when p > 60%
 *
 *   BTTS yes: bin 7 (n=436) predicted 75.8% actual 46.8% → factor 0.62
 *             Correction: 0.62 when p > 60%
 *
 *   Home win: bin 2 (n=39) predicted 26.2% actual 7.7%  → factor 0.50 (30-40% range: 0.65)
 *             Applies only when model says 20–40% for home win
 *
 *   Over 3.5: not directly measured, but same temperature inflation applies.
 *             Estimated factor 0.53 when p > 40% (derived from lambda inflation).
 *
 * These corrections apply to the POISSON component only — the market probability
 * (bookmaker) is unchanged and still dominates the final blend (56% weight).
 */

import type { Market, Outcome } from "@/lib/types";

export function applyBiasCorrection(
  probability: number | null | undefined,
  market: Market,
  outcome: Outcome
): number | null {
  if (probability == null || !Number.isFinite(probability) || probability <= 0) return null;
  const p = probability;

  // Over 2.5: model heavily overestimates when p > 60%
  if (market === "over_under_2_5" && outcome === "over" && p > 0.60) {
    return p * 0.58;
  }
  // Under 2.5: inverse — model underestimates when p < 40%
  if (market === "over_under_2_5" && outcome === "under" && p < 0.40) {
    return Math.min(0.98, p / 0.58);
  }

  // Over 3.5: similar inflation, stricter threshold
  if (market === "over_under_3_5" && outcome === "over" && p > 0.40) {
    return p * 0.53;
  }
  if (market === "over_under_3_5" && outcome === "under" && p < 0.60) {
    return Math.min(0.98, p / 0.53);
  }

  // Over 1.5: mild overestimation (WC actual ~82%, model ~87%)
  if (market === "over_under_1_5" && outcome === "over" && p > 0.82) {
    return p * 0.94;
  }
  if (market === "over_under_1_5" && outcome === "under" && p < 0.18) {
    return Math.min(0.98, p / 0.94);
  }

  // BTTS yes: overestimated when p > 60%
  if (market === "btts" && outcome === "yes" && p > 0.60) {
    return p * 0.62;
  }
  // BTTS no: underestimated when p < 40%
  if (market === "btts" && outcome === "no" && p < 0.40) {
    return Math.min(0.98, p / 0.62);
  }

  // Home win in 20–40% range: systematically overestimated in WC group stage
  if (market === "1x2" && outcome === "home" && p >= 0.20 && p < 0.40) {
    const factor = p < 0.30 ? 0.50 : 0.65;
    return p * factor;
  }

  return p;
}
