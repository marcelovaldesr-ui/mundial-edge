# Mundial Edge — Handoff / Contexto para continuar

> Documento de traspaso. Resume qué es el proyecto, cómo está construido, el
> estado actual y los próximos pasos. Pensado para que otro asistente/dev
> retome el trabajo sin perder contexto. Carpeta del proyecto:
> `C:\Users\marce\OneDrive\Documentos\Claude\Projects\Tipster\mundial-edge`

## 1. Qué es

Plataforma web de **análisis estadístico** del Mundial 2026. Calcula la
probabilidad de cada resultado con un modelo propio y la compara contra la
**probabilidad implícita** de las cuotas del mercado, para obtener **edge** y
**valor esperado (EV)**. Es una herramienta **probabilística**: muestra avisos
de riesgo en todas las vistas y nunca usa lenguaje tipo "apuesta segura". No es
asesoría financiera.

## 2. Stack

- **Next.js 14.2.35** (App Router, carpeta `src/`)
- **TypeScript** (strict, `target: es2017`)
- **TailwindCSS** + componentes UI estilo shadcn (propios, en `src/components/ui`)
- **Supabase / Postgres** vía `@supabase/supabase-js`
- **Recharts** (gráfico de probabilidad)
- **API Routes** para sincronización + **cron** (vercel.json y GitHub Actions)
- Deploy objetivo: **Vercel** (plan Hobby gratis)

`npm run typecheck` (= `tsc --noEmit`) pasa con **0 errores**. La matemática del
modelo está verificada con asserts (sumas de probabilidad, devig, fronteras de
clasificación, EV de cuota justa).

## 3. Estructura de archivos (lo importante)

```
src/app/
  layout.tsx, globals.css        # layout + tema oscuro + disclaimer global
  page.tsx                       # Dashboard (próximos + mejores oportunidades)
  matches/page.tsx               # Listado de partidos
  matches/[id]/page.tsx          # Detalle (gráfico modelo vs mercado + tabla)
  edges/page.tsx                 # Ranking de edges (tabla ordenable por EV)
  admin/page.tsx                 # Panel admin (sync manual + historial)
  api/sync/{fixtures,results,odds,predictions}/route.ts
  api/cron/route.ts              # Cadena completa o ?job=
src/components/
  nav, match-card, edge-table(client/sortable), probability-chart(client/recharts),
  risk-badge, disclaimer, last-updated, sync-panel(client), outcome-label
  ui/{button,card,badge,table}
src/lib/
  types.ts, utils.ts, auth.ts(valida CRON_SECRET)
  model/  poisson.ts, expected-goals.ts, odds.ts, edge.ts, engine.ts
  data/   mock.ts, providers.ts, repository.ts(lectura), sync.ts(escritura/orquestación)
  supabase/ client.ts, server.ts
supabase/schema.sql              # 7 tablas + vista v_top_edges + RLS
vercel.json                      # 1 cron diario (Hobby-friendly)
.github/workflows/sync-cron.yml  # cron gratis cada 2h (alternativa a Vercel Pro)
docs/DEPLOY.md, docs/POST_MVP.md
```

## 4. Modelo estadístico (poisson-v1)

`src/lib/model/`:
1. `expected-goals.ts` → λ (goles esperados) por equipo combinando goles a
   favor/en contra por partido, diferencia de gol, forma reciente ponderada,
   fuerza relativa del rival, base de goles del torneo y ventaja de localía.
2. `poisson.ts` → matriz de marcadores Poisson×Poisson → mercados 1X2,
   ambos marcan (btts) y más/menos 2.5.
3. `odds.ts` → probabilidad implícita `1/cuota` + **corrección de overround**
   (devig proporcional por mercado cuando hay varias cuotas).
4. `edge.ts` → `edge = modelo − implícita`, `EV = modelo × cuota − 1`, y
   clasificación por tiers: `no_bet` (EV<0), `no_value` (<3%), `low` (<8%),
   `medium` (<15%), `high` (≥15%, con advertencia).
5. `engine.ts` → `buildPredictions()` y `buildEdges()` por partido. Toma la
   mejor cuota disponible entre casas por (mercado, outcome).

## 5. Datos y proveedores (modo LIVE, todo gratis)

Stack elegido para el **Mundial 2026 en curso** (API-Football free NO cubre la
temporada actual, por eso se descartó como principal):

- **Fixtures / resultados → football-data.org**
  - `FIXTURES_PROVIDER=football-data`, competición `WC`, header `X-Auth-Token`.
  - Una sola llamada trae equipos + partidos. Último sync: **48 equipos, 72 partidos**.
  - Plan free: ~10 req/min (suficiente, el sync hace 1 llamada).
- **Cuotas → The Odds API**
  - `ODDS_PROVIDER=the-odds-api`, sport `soccer_fifa_world_cup`, markets `h2h,totals`.
  - ⚠️ `btts` NO está soportado por este endpoint (daba error 422) → ya removido.
  - Plan free: 500 créditos/mes; cada `/odds` cuesta `regiones × mercados`.
- **team_stats → CALCULADAS localmente** en `sync.ts` (`recomputeStats`) a partir
  de los partidos finalizados. No dependen de ninguna API de pago. Se genera una
  fila por cada equipo (prior neutro si aún no jugó).
- **Emparejamiento cuotas↔partidos**: como cada proveedor usa sus propios IDs, las
  cuotas de The Odds API se emparejan con los partidos de football-data **por
  nombre de equipo normalizado** (función `normTeam` + `TEAM_ALIASES` en `sync.ts`,
  con manejo de orden invertido local/visita para 1X2).
- **API-Football**: queda como respaldo en `providers.ts` (su free no sirve para
  la temporada actual, sí para temporadas pasadas como el Mundial 2022).

Modo de datos: `isLiveMode()` = `DATA_MODE===live` **y** Supabase service key
configurada. Si falta algo, cae automáticamente a **mock** (dataset de ejemplo,
predicciones computadas al vuelo en `repository.ts`).

## 6. Variables de entorno

Están en `.env.local` (gitignored), ya rellenadas con valores reales del usuario:

```
DATA_MODE=live
FIXTURES_PROVIDER=football-data
ODDS_PROVIDER=the-odds-api
FOOTBALL_DATA_TOKEN=***            # football-data.org
FOOTBALL_DATA_COMPETITION=WC
ODDS_API_KEY=***                   # the-odds-api.com
ODDS_SPORT_KEY=soccer_fifa_world_cup
ODDS_API_REGIONS=eu,uk
NEXT_PUBLIC_SUPABASE_URL=***
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_***   # clave PUBLISHABLE (pública)
SUPABASE_SERVICE_ROLE_KEY=sb_secret_***            # clave SECRET (server only)
CRON_SECRET=***                    # autoriza /api/sync/* y /api/cron
```

> Nota: Supabase formato nuevo → `sb_publishable_*` va en ANON (pública),
> `sb_secret_*` va en SERVICE_ROLE (nunca en una var `NEXT_PUBLIC_`).

## 7. Base de datos

`supabase/schema.sql` ya ejecutado en el proyecto Supabase del usuario. Tablas:
`teams` (con `external_id` para mapear al proveedor), `matches`, `team_stats`,
`odds`, `predictions`, `edges`, `sync_logs`. Vista `v_top_edges`. RLS: **lectura
pública, escritura solo service_role**.

## 8. Sincronización

- `GET/POST /api/sync/{fixtures,results,odds,predictions}` — job individual.
- `GET /api/cron` — cadena completa, o `?job=odds`.
- Auth: requieren `CRON_SECRET` (header `Authorization: Bearer`, `x-cron-secret`,
  o `?secret=`). En dev sin CRON_SECRET se permite.
- El panel `/admin` los dispara con botones (campo para el secret).
- Orden de dependencia: fixtures → results → odds → predictions.

## 9. Estado actual (último run)

| Job | Estado | Detalle |
|---|---|---|
| fixtures | ✅ success | 48 equipos, 72 partidos |
| results | ✅ success | 16 finalizados |
| odds | ⚠️ corregido | fallaba 422 por `btts`; ya removido, **falta re-ejecutar** |
| predictions | ✅ (0 edges) | dará edges en cuanto odds empareje cuotas |

## 10. Próximos pasos (prioridad)

1. **Reinstalar `node_modules` limpio.** Está corrupto (`util-deprecate`, `dlv`)
   por la sincronización de OneDrive. Pausar OneDrive o mover el proyecto a una
   ruta fuera de OneDrive (ej. `C:\dev\mundial-edge`), luego `npm install`.
2. **Re-ejecutar `odds` y `predictions`** tras el fix de `btts`. Verificar en el
   mensaje de odds "emparejadas: X / sin partido: Y".
3. Si hay muchas cuotas "sin partido", **ampliar `TEAM_ALIASES`** en `sync.ts`
   (`normTeam`) con los nombres que difieran entre football-data y The Odds API.
4. Verificar el dashboard con datos reales (`/`, `/edges`, `/matches/[id]`).
5. Para producción: **auth real en `/admin`** (hoy solo protege el secret de los
   jobs, no la vista). Deploy en Vercel siguiendo `docs/DEPLOY.md`.

## 11. Problemas conocidos

- **OneDrive + node_modules**: causa corrupción, locks y errores Watchpack
  (escaneo de `C:\pagefile.sys`, etc.). Recomendado mover el proyecto fuera de
  OneDrive para desarrollo.
- **The Odds API**: no soporta `btts` en `/odds`; créditos limitados (500/mes) →
  sincronizar cuotas de forma espaciada, no en bucle.
- **football-data.org free**: cobertura del Mundial sí, pero los placeholders de
  fases eliminatorias sin equipos definidos se omiten (por eso 72 y no 104).
- En la máquina del usuario el dev server corre en **puerto 3003** (3000-3002 ocupados).

## 12. Cómo correr en local

```powershell
cd <carpeta-del-proyecto>
npm install
npm run dev            # arranca en http://localhost:3003 (o el que indique)
# sincronizar: navegador → /admin → pegar CRON_SECRET → "Ejecutar todo"
```
