/**
 * sofascore-provider.ts
 *
 * Cliente HTTP para la API no oficial de Sofascore (api.sofascore.app).
 * Usa el endpoint mobile que no requiere challenge JavaScript.
 *
 * IDs obtenidos en exploración (junio 2026):
 *   tournamentId=16  → FIFA World Cup
 *   seasonId=58210   → World Cup 2026
 *   Endpoint base:   https://api.sofascore.app/api/v1
 *
 * ADVERTENCIA: API no oficial, puede cambiar sin previo aviso.
 *   Activar solo con SOFASCORE_ENABLED=true en .env.local.
 */

const SOFASCORE_BASE = "https://api.sofascore.app/api/v1";
const SOFASCORE_HEADERS: Record<string, string> = {
  "User-Agent": "SofaScore/5.99.0 (iPhone; iOS 17.0; Scale/3.00)",
  "Accept": "application/json",
  "Accept-Encoding": "gzip, deflate",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
};

// ─── Rate limiter: 1 req / 1.1s ──────────────────────────────────────────────
let lastRequestAt = 0;
async function rateLimitWait() {
  const wait = 1100 - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

// ─── Circuit breaker ──────────────────────────────────────────────────────────
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 3;

function recordSuccess() {
  consecutiveErrors = 0;
}
function recordError() {
  consecutiveErrors++;
  if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    throw new Error(
      `[sofascore] circuit open: ${consecutiveErrors} errores consecutivos. Sofascore bloqueó el acceso temporalmente.`
    );
  }
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────
async function sfGet(path: string): Promise<any | null> {
  await rateLimitWait();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${SOFASCORE_BASE}${path}`, {
      headers: SOFASCORE_HEADERS,
      signal: controller.signal,
      cache: "no-store",
    });

    if (res.status === 403 || res.status === 429) {
      console.warn(`[sofascore] ${res.status} en ${path} — saltando.`);
      recordError();
      return null;
    }

    if (!res.ok) {
      console.warn(`[sofascore] HTTP ${res.status} en ${path}`);
      recordError();
      return null;
    }

    const text = await res.text();
    if (!text) return null;

    const data = JSON.parse(text);
    recordSuccess();
    return data;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.warn(`[sofascore] timeout: ${path}`);
      recordError();
      return null;
    }
    // Propaga errores del circuit breaker
    if (err instanceof Error && err.message.includes("circuit open")) throw err;
    console.warn(`[sofascore] error de red en ${path}:`, String(err));
    recordError();
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Tipos de respuesta ───────────────────────────────────────────────────────
export interface SofascoreEvent {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  startTimestamp: number;
}

export interface SofascoreRawOdd {
  marketId: number;
  marketGroup: string;
  marketPeriod: string;
  choiceGroup?: string;   // línea para over/under: "1.5", "2.5", "3.5", ...
  choices: Array<{
    name: string;
    fractionalValue: string;
  }>;
}

// ─── Funciones públicas ───────────────────────────────────────────────────────

/**
 * Obtiene los próximos eventos del Mundial 2026 en Sofascore.
 * Incluye hasta 90 eventos (3 páginas × 30).
 */
export async function fetchSofascoreEventIds(
  tournamentId: number,
  seasonId: number
): Promise<SofascoreEvent[]> {
  const events: SofascoreEvent[] = [];
  for (let page = 0; page <= 2; page++) {
    const data = await sfGet(
      `/unique-tournament/${tournamentId}/season/${seasonId}/events/next/${page}`
    );
    const evs: any[] = data?.events ?? [];
    for (const ev of evs) {
      events.push({
        id: String(ev.id),
        homeTeamName: ev.homeTeam?.name ?? "",
        awayTeamName: ev.awayTeam?.name ?? "",
        startTimestamp: ev.startTimestamp ?? 0,
      });
    }
    if (evs.length === 0) break;
  }
  return events;
}

/**
 * Obtiene cuotas de un evento de Sofascore.
 * El endpoint /odds/1/all devuelve TODOS los mercados del único bookmaker disponible.
 * Filtra solo los mercados relevantes según marketId y (para match goals) choiceGroup.
 */
export async function fetchSofascoreOdds(
  eventId: string
): Promise<SofascoreRawOdd[]> {
  // El parámetro "1" del endpoint es el slot del bookmaker (solo hay uno)
  const data = await sfGet(`/event/${eventId}/odds/1/all`);
  const markets: any[] = data?.markets ?? [];

  const result: SofascoreRawOdd[] = [];
  const RELEVANT_MARKET_IDS = new Set([1, 2, 5, 9]);
  // Líneas de over/under que nos interesan
  const RELEVANT_LINES = new Set(["1.5", "2.5", "3.5"]);

  for (const mkt of markets) {
    const marketId: number = mkt.marketId;
    if (!RELEVANT_MARKET_IDS.has(marketId)) continue;

    // marketId=1: solo full-time (descartar 1st half)
    if (marketId === 1 && mkt.marketPeriod !== "Full-time") continue;

    // marketId=9 (Match goals): solo las líneas que mapeamos
    if (marketId === 9) {
      const cg: string = mkt.choiceGroup ?? "";
      if (!RELEVANT_LINES.has(cg)) continue;
    }

    const choices = (mkt.choices ?? []).map((c: any) => ({
      name: String(c.name ?? ""),
      fractionalValue: String(c.fractionalValue ?? ""),
    }));

    result.push({
      marketId,
      marketGroup: mkt.marketGroup ?? "",
      marketPeriod: mkt.marketPeriod ?? "",
      choiceGroup: mkt.choiceGroup,
      choices,
    });
  }

  return result;
}
