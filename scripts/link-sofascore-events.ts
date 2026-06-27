/**
 * link-sofascore-events.ts
 *
 * Lee los partidos de nuestra BD que aún no tienen sofascore_event_id y
 * los empareja con los eventos del Mundial 2026 en Sofascore.
 *
 * Uso: npm run link:sofascore
 *
 * Requiere: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.
 */

import { createClient } from "@supabase/supabase-js";
import * as https from "https";
import * as zlib from "zlib";

// ─── Sofascore config (obtenidos en FASE 0) ───────────────────────────────────
// tournamentId=16: FIFA World Cup | seasonId=58210: World Cup 2026
const SF_TOURNAMENT_ID = Number(process.env.SOFASCORE_TOURNAMENT_ID ?? "16");
const SF_SEASON_ID = Number(process.env.SOFASCORE_SEASON_ID ?? "58210");
const SF_BASE = "https://api.sofascore.app/api/v1";
const SF_HEADERS = {
  "User-Agent": "SofaScore/5.99.0 (iPhone; iOS 17.0; Scale/3.00)",
  "Accept": "application/json",
  "Accept-Encoding": "gzip",
};

// ─── Rate limiter (1 req/s) ───────────────────────────────────────────────────
let lastReqAt = 0;
async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
async function sfFetch(path: string): Promise<any> {
  const wait = 1100 - (Date.now() - lastReqAt);
  if (wait > 0) await sleep(wait);
  lastReqAt = Date.now();

  return new Promise((resolve, reject) => {
    const req = https.get(`${SF_BASE}${path}`, { headers: SF_HEADERS }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks);
        const decompress = res.headers["content-encoding"] === "gzip" ? zlib.gunzipSync : (b: Buffer) => b;
        try {
          const body = decompress(raw).toString("utf-8");
          resolve(body ? JSON.parse(body) : null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error("Sofascore request timeout"));
    });
  });
}

// ─── Normalización de nombres ─────────────────────────────────────────────────
const TEAM_ALIASES: Record<string, string> = {
  southkorea: "korearepublic",
  usa: "unitedstates",
  unitedstatesofamerica: "unitedstates",
  czechia: "czechrepublic",
  ivorycoast: "cotedivoire",
  capeverde: "caboverde",
  drCongo: "democraticrepublicofthecongo",
};
function normTeam(name: string): string {
  const s = (name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
  return TEAM_ALIASES[s] ?? s;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // 1. Partidos en BD sin sofascore_event_id, en status pendiente/live
  const { data: matches, error: matchErr } = await sb
    .from("matches")
    .select("id, home_team_id, away_team_id, kickoff, sofascore_event_id")
    .in("status", ["scheduled", "live"])
    .is("sofascore_event_id", null);

  if (matchErr) {
    console.error("Error leyendo matches:", matchErr.message);
    process.exit(1);
  }
  if (!matches?.length) {
    console.log("No hay partidos pendientes de linkear.");
    return;
  }

  // 2. Nombres de equipos (para emparejar)
  const teamIds = [...new Set(matches.flatMap((m: any) => [m.home_team_id, m.away_team_id]))];
  const { data: teams } = await sb.from("teams").select("id, name").in("id", teamIds);
  const teamName = new Map((teams ?? []).map((t: any) => [t.id, t.name as string]));

  // 3. Obtener eventos de Sofascore (hasta 3 páginas, 90 eventos)
  const sfEvents: any[] = [];
  for (let page = 0; page <= 2; page++) {
    const data = await sfFetch(
      `/unique-tournament/${SF_TOURNAMENT_ID}/season/${SF_SEASON_ID}/events/next/${page}`
    );
    const evs = data?.events ?? [];
    sfEvents.push(...evs);
    if (evs.length === 0) break;
  }
  console.log(`Sofascore: ${sfEvents.length} eventos obtenidos.`);

  // 4. Emparejar
  let linked = 0;
  let unmatched = 0;

  for (const match of matches) {
    const homeRaw = teamName.get(match.home_team_id) ?? "";
    const awayRaw = teamName.get(match.away_team_id) ?? "";
    const homeNorm = normTeam(homeRaw);
    const awayNorm = normTeam(awayRaw);
    const kickoffMs = new Date(match.kickoff).getTime();
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

    let bestMatch: any = null;
    for (const ev of sfEvents) {
      const sfHome = normTeam(ev.homeTeam?.name ?? "");
      const sfAway = normTeam(ev.awayTeam?.name ?? "");
      const sfTs = (ev.startTimestamp ?? 0) * 1000;

      const namesMatch = sfHome === homeNorm && sfAway === awayNorm;
      const timeClose = Math.abs(sfTs - kickoffMs) <= TWO_HOURS_MS;

      if (namesMatch && timeClose) {
        bestMatch = ev;
        break;
      }
    }

    if (bestMatch) {
      const { error } = await sb
        .from("matches")
        .update({ sofascore_event_id: String(bestMatch.id) })
        .eq("id", match.id);
      if (error) {
        console.warn(`  Error actualizando ${homeRaw} vs ${awayRaw}: ${error.message}`);
      } else {
        console.log(`  ✓ ${homeRaw} vs ${awayRaw} → sfId=${bestMatch.id}`);
        linked++;
      }
    } else {
      console.warn(`  ✗ Sin match: ${homeRaw} vs ${awayRaw} (kickoff=${match.kickoff})`);
      unmatched++;
    }
  }

  console.log(`\nResumen: ${linked} linkeados, ${unmatched} sin match.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
