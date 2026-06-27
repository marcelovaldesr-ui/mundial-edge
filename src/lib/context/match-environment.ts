import type { Match } from "@/lib/types";
import { resolveVenueInfo } from "./venue-coordinates";

export interface WeatherData {
  tempC: number;
  precipMm: number;
  windKmh: number;
  fetchedAt: string;
}

export interface MatchEnvironmentData {
  matchId: string;
  venueAltitudeM: number;
  weather: WeatherData | null;
  fatigueDaysHome: number | null;
  fatigueDaysAway: number | null;
  notes: string[];
}

// Module-level cache: key = "lat,lon,date" → weather data (30 min TTL)
const weatherCache = new Map<string, { expiresAt: number; data: WeatherData }>();
const WEATHER_TTL_MS = 30 * 60 * 1000;

async function fetchWeatherForVenue(lat: number, lon: number, kickoffIso: string): Promise<WeatherData | null> {
  if (!lat && !lon) return null;
  const date = kickoffIso.slice(0, 10);
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)},${date}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m,precipitation,wind_speed_10m` +
      `&timezone=UTC&forecast_days=14&start_date=${date}&end_date=${date}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const d = await res.json() as { hourly?: { temperature_2m?: number[]; precipitation?: number[]; wind_speed_10m?: number[] } };
    if (!d.hourly) return null;

    // Pick the hour closest to match kickoff
    const kickoffHour = new Date(kickoffIso).getUTCHours();
    const idx = Math.min(kickoffHour, (d.hourly.temperature_2m?.length ?? 1) - 1);
    const data: WeatherData = {
      tempC: d.hourly.temperature_2m?.[idx] ?? 20,
      precipMm: d.hourly.precipitation?.[idx] ?? 0,
      windKmh: d.hourly.wind_speed_10m?.[idx] ?? 0,
      fetchedAt: new Date().toISOString(),
    };
    weatherCache.set(cacheKey, { expiresAt: Date.now() + WEATHER_TTL_MS, data });
    return data;
  } catch {
    return null;
  }
}

function computeFatigueDays(
  teamId: string,
  matchKickoff: string,
  allMatches: Match[]
): number | null {
  const kickoffMs = new Date(matchKickoff).getTime();
  const previous = allMatches
    .filter(
      (m) =>
        m.status === "finished" &&
        (m.home_team_id === teamId || m.away_team_id === teamId) &&
        new Date(m.kickoff).getTime() < kickoffMs
    )
    .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());

  if (!previous.length) return null;
  const lastMs = new Date(previous[0].kickoff).getTime();
  return Math.round((kickoffMs - lastMs) / (1000 * 60 * 60 * 24));
}

export async function getMatchEnvironmentData(
  match: Match,
  allMatches: Match[]
): Promise<MatchEnvironmentData> {
  const notes: string[] = [];
  const venue = resolveVenueInfo(match.venue);

  const altitudeM = venue?.altitudeM ?? 0;
  if (altitudeM > 1000) notes.push(`Alta altitud: ${altitudeM}m (${venue?.name ?? match.venue})`);

  const weather = venue
    ? await fetchWeatherForVenue(venue.lat, venue.lon, match.kickoff)
    : null;

  const fatigueDaysHome = computeFatigueDays(match.home_team_id, match.kickoff, allMatches);
  const fatigueDaysAway = computeFatigueDays(match.away_team_id, match.kickoff, allMatches);

  return { matchId: match.id, venueAltitudeM: altitudeM, weather, fatigueDaysHome, fatigueDaysAway, notes };
}

export async function getMatchEnvironmentMap(
  matches: Match[],
  allMatches: Match[]
): Promise<Map<string, MatchEnvironmentData>> {
  const results = await Promise.all(matches.map((m) => getMatchEnvironmentData(m, allMatches)));
  return new Map(results.map((r) => [r.matchId, r]));
}
