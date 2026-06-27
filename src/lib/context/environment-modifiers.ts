import type { MatchEnvironmentData } from "./match-environment";

export interface EnvironmentModifier {
  homeMultiplier: number;
  awayMultiplier: number;
  notes: string[];
}

const NEUTRAL: EnvironmentModifier = { homeMultiplier: 1, awayMultiplier: 1, notes: [] };

/**
 * Altitude effect on expected goals.
 * Research consensus: ~+0.15 total goals at 2000m, ~+0.08 at 1500m.
 * As lambda multiplier (assuming avg total lambda ~2.2):
 *   2287m (Azteca):   +0.15 total → ×1.068 per team
 *   1623m (Akron):    +0.09 total → ×1.040 per team
 *    493m (Monterrey): +0.02 total → ×1.009 per team
 */
function altitudeMultiplier(altM: number): number {
  if (altM >= 2000) return 1.07;
  if (altM >= 1500) return 1.04;
  if (altM >= 800)  return 1.02;
  return 1.0;
}

/**
 * Temperature effect: very hot weather increases fatigue → fewer goals in second half.
 * Net effect is small but real: -2% per team at 32°C+, -4% at 36°C+.
 */
function temperatureMultiplier(tempC: number): number {
  if (tempC >= 36) return 0.96;
  if (tempC >= 32) return 0.98;
  return 1.0;
}

/**
 * Rain: slippery surface → more defensive errors → slight goal uptick.
 * Wind: disrupts long balls and set pieces → slight reduction.
 */
function weatherMultiplier(precipMm: number, windKmh: number): number {
  let factor = 1.0;
  if (precipMm >= 5) factor *= 1.02;
  if (windKmh >= 50) factor *= 0.97;
  return factor;
}

/**
 * Fatigue: days since last match.
 * 0-2 days: very fatigued (×0.94)
 * 3 days: fatigued (×0.97)
 * 4 days: slight fatigue (×0.99)
 * 5+ days: fresh (×1.00)
 */
function fatigueMultiplier(days: number | null): number {
  if (days === null) return 1.0;
  if (days <= 2) return 0.94;
  if (days <= 3) return 0.97;
  if (days <= 4) return 0.99;
  return 1.0;
}

export function computeEnvironmentModifier(env: MatchEnvironmentData | null | undefined): EnvironmentModifier {
  if (!env) return NEUTRAL;

  const notes: string[] = [...env.notes];

  const altMult = altitudeMultiplier(env.venueAltitudeM);
  const tempMult = env.weather ? temperatureMultiplier(env.weather.tempC) : 1.0;
  const weatherMult = env.weather ? weatherMultiplier(env.weather.precipMm, env.weather.windKmh) : 1.0;
  const homeFatigue = fatigueMultiplier(env.fatigueDaysHome);
  const awayFatigue = fatigueMultiplier(env.fatigueDaysAway);

  const sharedMult = clamp(altMult * tempMult * weatherMult, 0.85, 1.15);
  const homeMultiplier = clamp(sharedMult * homeFatigue, 0.80, 1.20);
  const awayMultiplier = clamp(sharedMult * awayFatigue, 0.80, 1.20);

  if (env.venueAltitudeM > 1000)
    notes.push(`Altitud ${env.venueAltitudeM}m → ×${altMult.toFixed(3)} goles esperados`);
  if (env.weather && env.weather.tempC >= 32)
    notes.push(`Temperatura ${env.weather.tempC}°C → ×${tempMult.toFixed(3)}`);
  if (env.fatigueDaysHome !== null && env.fatigueDaysHome <= 4)
    notes.push(`Fatiga local (${env.fatigueDaysHome} días) → ×${homeFatigue.toFixed(3)}`);
  if (env.fatigueDaysAway !== null && env.fatigueDaysAway <= 4)
    notes.push(`Fatiga visitante (${env.fatigueDaysAway} días) → ×${awayFatigue.toFixed(3)}`);

  if (homeMultiplier === 1 && awayMultiplier === 1) return NEUTRAL;
  return { homeMultiplier, awayMultiplier, notes };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
