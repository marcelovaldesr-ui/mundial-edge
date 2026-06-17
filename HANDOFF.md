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

---

## ACTUALIZACIÓN — 16 jun 2026 (sesión 2)

### Estado: pipeline LIVE funcionando con datos reales del Mundial 2026
- Proyecto movido a `C:\Users\marce\mundial-edge` (fuera de OneDrive — OneDrive
  corrompía node_modules y truncaba archivos). git inicializado.
- Proveedores reales conectados y con tokens en `.env.local`:
  - Fixtures/resultados: **football-data.org** (competición WC) → 48 equipos, 72 partidos.
  - Cuotas: **The Odds API** (`soccer_fifa_world_cup`, mercados h2h + totals; `btts` NO soportado, quitado).
  - team_stats se calculan de resultados (`recomputeStats` en sync.ts).
- Supabase poblado: edges ~190, partidos scheduled/live/finished. El dashboard ya muestra datos reales.

### Fix aplicado: lectura de edges
`repository.getEdges` ahora lee la **tabla `edges`** con join a `matches`/`teams`
(en vez de la vista `v_top_edges`, que PostgREST no tenía en su caché de esquema
y devolvía vacío). Filtra a partidos `scheduled`/`live`.

### Cambio grande: MODO TIPSTER (capa 1 + 3)
Problema detectado: el modelo, con poca muestra, daba probabilidades absurdas a
underdogs (ej. Argelia 35% vs Argentina) → falso "valor" de +886% EV.
Solución implementada:
- **Anclaje al mercado** (`engine.ts` + `edge.ts`): `prob_justa = 0.78·mercado_devig + 0.22·modelo`.
  Nuevo `marketConsensus()` (de-vig promediando casas). `buildEdges` guarda la prob anclada.
- **Filtros de calidad** (`edge.ts`): `isQualityPick()` con `PICK_RULES`
  (cuota 1.40–6.0, EV 2%–20%, prob implícita ≥ 8%). `MARKET_WEIGHT = 0.78`.
- `types.ts`: campo `Edge.qualifies?`. `repository.ts`: `annotate()` lo calcula en lectura.
- Dashboard (`page.tsx`): destaca solo picks de calidad; stat "Picks de calidad".
- `edge-table.tsx`: filtro "solo picks de calidad" + marca "atípico" a los que no pasan.

### Pendiente inmediato
1. **Re-ejecutar el job `predictions`** (en /admin) para reescribir los edges con
   los valores anclados; luego recargar el dashboard. (El motor solo recalcula al sincronizar.)
2. Verificar que las "mejores oportunidades" ya son sensatas (probablemente queden
   pocas o ninguna — es lo correcto con un mercado eficiente).
3. **Commitear** estos cambios (aún no hay commit del modo tipster).

### Próximo paso de producto (capa 2): ratings de fuerza
Para que el sistema encuentre valor REAL (no fabricado), sembrar el modelo con
ranking FIFA / Elo de selecciones, así conoce que Argentina ≫ Argelia desde el
partido 0 sin esperar resultados. Hoy `teams.fifa_rank` existe pero no se usa.

### Notas técnicas
- El typecheck desde el sandbox de la sesión daba falsos errores por truncación
  del puente de archivos; el código real compila. Verificar con `npm run build` o el dev server.
- Dev server suele levantar en puerto 3003. `.next` viejo puede estar corrupto → borrarlo y `npm run dev`.

---

## ACTUALIZACIÓN — sesión 3

### Estado: modo tipster validado contra Supabase
- `npm run typecheck` pasa con 0 errores.
- Se re-ejecutó `GET /api/sync/predictions` desde la copia correcta del proyecto
  (`C:\Users\marce\mundial-edge`) en `http://localhost:3004`.
- Resultado del job: `records: 106`, `status: success`, `message:
  "Predicciones recalculadas y edges reemplazados."`
- Supabase quedó con **106 edges vigentes** para partidos `scheduled/live` y
  **19 picks de calidad** según `isQualityPick`.

### Fix adicional aplicado
- `syncPredictions()` ahora borra los `edges` de los partidos recalculados antes
  de hacer `upsert`. Antes quedaban edges viejos mezclados con los nuevos cuando
  el motor dejaba de producir una combinación `match/market/outcome`.
- La página de detalle actualizó la copy de "Prob. modelo" para aclarar que ahora
  es una estimación final anclada al mercado, no Poisson crudo.

### Nota local
- El puerto `3003` estaba ocupado por un dev server viejo apuntando a la ruta de
  OneDrive. Para esta sesión se usó `3004`.
- En esta copia local `.env.local` no contiene `CRON_SECRET`; en dev el endpoint
  permite sync sin secreto, pero producción debe configurarlo.

---

## ACTUALIZACIÓN — sesión 4

### Estado: motor pre-partido de combinadas implementado
- Nuevo módulo `src/lib/parlays/` con lógica separada y testeable:
  - `parlay-types.ts`: tipos `ParlayPick`, `Parlay`, perfiles y opciones.
  - `correlation.ts`: `evaluateCorrelation()` con niveles `low/medium/high/invalid`.
  - `staking.ts`: Kelly fraccional + caps por perfil.
  - `parlay-scoring.ts`: score balanceado por EV, probabilidad, riesgo y correlación.
  - `parlay-engine.ts`: `generateParlays()` y reglas configurables por perfil.
- Nueva página `/parlays` con perfiles `conservative`, `balanced`, `aggressive`.
- Dashboard agrega vista previa de combinadas medias.
- Navegación agrega enlace "Combinadas".

### Verificación
- `npm run typecheck` pasa.
- `npm run verify:parlays` pasa. El script cubre:
  - combinada independiente,
  - correlación same-match,
  - combinada inválida,
  - Kelly/caps,
  - ranking que no premia automáticamente EV gigante con probabilidad mínima.

### Limitaciones actuales
- Solo pre-partido; no hay modo live/in-play.
- La probabilidad base de cada pick es `Edge.model_probability`, que en modo tipster
  ya representa la probabilidad anclada al mercado.
- La correlación es heurística inicial; no modela dependencias exactas tipo equipo
  gana + over con distribución conjunta de goles.
- Stake se muestra en unidades salvo que se pase bankroll a `generateParlays()`.

---

## ACTUALIZACIÓN — sesión 5

### Estado: endurecimiento y validación del motor de combinadas
- Confirmado en código: `edges.model_probability` contiene la probabilidad
  anclada (`pFair`) porque `buildEdges()` guarda `blendedProbability(...)` en ese
  campo. El adapter `edgeToParlayPick()` lo documenta explícitamente como
  `anchoredProb = edge.model_probability`.
- El adapter se movió a `src/lib/parlays/edge-adapter.ts` para separar contrato
  de datos y tipos.
- `generateParlays()` ahora filtra picks inválidos, duplicados, live/finished o
  con kickoff vencido; valida cuotas/probabilidades finitas; aplica límites por
  perfil de cuota total y risk score.
- `evaluateCorrelation()` invalida picks duplicados, selecciones contradictorias
  del mismo mercado/partido y más de dos selecciones del mismo partido.
- `suggestStake()` corta stake a cero si EV/Kelly no es positivo y devuelve
  explicación del cap Kelly aplicado.
- `ParlayCard` muestra razón de stake y explicita que usa probabilidad anclada.

### Validación real con Supabase
- Picks de calidad disponibles: 19.
- Top observado para los tres perfiles fue la misma combinada conservadora:
  `TUN-JPN: JPN @1.61` + `PAN-CRO: CRO @1.55`.
  - Cuota total: 2.4955
  - Probabilidad raw/ajustada: 47.9316% / 47.9316%
  - Correlación: low, penalty 1.00
  - EV combinado: +19.61%
  - Risk score: 14
  - Stake sugerido: 0.75u conservador, 1.5u medio, 2.5u agresivo
- No se fuerza riesgo artificial por perfil; si la mejor combinada por score es
  baja correlación y buena probabilidad, aparece también en agresivo.

### Verificación
- `npm run typecheck` pasa.
- `npm run verify:parlays` pasa.
- Se abrieron correctamente:
  - `/parlays?profile=conservative`
  - `/parlays?profile=balanced`
  - `/parlays?profile=aggressive`
  - `/`

---

## ACTUALIZACIÓN — sesión 6

### Estado: producto/UI de combinadas mejorado
- `/parlays` ahora usa `ParlayWorkspace` cliente para manejar perfil y bankroll
  local sin persistir en Supabase.
- Bankroll opcional:
  - vacío o inválido => stake en unidades;
  - número positivo => unidades + porcentaje de bankroll + monto estimado.
- `ParlayCard` muestra mejor jerarquía: perfil, riesgo, correlación, cuota,
  probabilidad ajustada, EV, stake, explicación, warnings y detalles técnicos.
- Detalles técnicos desplegables incluyen probabilidad raw, probabilidad ajustada,
  penalty factor, risk score, score, EV, cuota y número de legs.
- Dashboard mantiene solo preview balanceada y CTA al constructor completo.

### Diferenciación de perfiles
- `ProfileRules` agrega `targetOddsRange`, `preferredLegs` y `maxEV`.
- Scoring por perfil:
  - Conservadora: premia mayor probabilidad, cuota moderada y 2 legs.
  - Balanceada: premia relación valor/riesgo, cuota objetivo intermedia y 3 legs.
  - Agresiva: explora mayor cuota/legs, mantiene EV positivo, maxEV y caps de stake.
- Ejemplos reales con bankroll 100.000:
  - Conservadora: `TUN-JPN JPN @1.61` + `PAN-CRO CRO @1.55`, cuota 2.496,
    prob ajustada 47.93%, EV +19.61%, risk 14, stake 0.75u / 0.75% / 750.
  - Balanceada: agrega `GER-CIV GER @1.58`, cuota 3.943, prob ajustada 33.09%,
    EV +30.46%, risk 27, stake 1.5u / 1.5% / 1.500.
  - Agresiva: 5 legs, cuota 27.328, prob ajustada 6.43%, EV +75.64%, risk 86,
    stake 1.5u / 1.44% / 1.436,56.

### Verificación
- `npm run typecheck` pasa.
- `npm run verify:parlays` pasa.
- Se abrieron correctamente `/parlays?profile=conservative`, `balanced`,
  `aggressive` y `/` en `http://localhost:3004`.

---

## ACTUALIZACIÓN — sesión 7

### Estado: control/auditoría/calibración de combinadas
- Checkpoint recomendado antes de seguir:
  `feat: add pre-match parlay builder with bankroll and risk profiles`
  (no se hizo commit).
- `/parlays` agrega ordenamiento local por:
  score recomendado, EV, probabilidad ajustada, menor riesgo, cuota total y
  stake sugerido.
- `/parlays` agrega filtros locales:
  riesgo máximo, cuota mínima/máxima, EV mínimo, probabilidad mínima, ocultar
  correlación alta y número de selecciones.
- Nuevo modo debug interno:
  `/parlays?profile=aggressive&debug=1` o toggle "Modo debug".
  Muestra "Candidatas descartadas" con picks, motivo, cuota, probabilidad, EV,
  risk score y correlación cuando aplica.
- Motor:
  - `generateParlays()` mantiene API anterior.
  - `generateParlaysWithDebug()` devuelve `{ parlays, rejected }`.
  - `RejectedParlayCandidate` registra motivo principal de descarte.
- Staking agresivo recalibrado:
  - `suggestStake()` ahora considera `riskScore`, `totalOdds`, `legs`,
    `jointProbabilityAdjusted` y `correlationLevel`.
  - Haircuts por cuota >15, cuota >25, 5+ legs, probabilidad <7%, riskScore alto
    y correlación alta.

### Validación real de stake agresivo
- Caso real agresivo:
  5 legs, cuota 27.328, probabilidad ajustada 6.43%, EV +75.64%, riskScore 86.
- Antes: stake 1.5u / 1.44% / 1.436,56 sobre bankroll 100.000.
- Ahora: stake 0.25u / 0.085% / 84,74.
- Razón mostrada: stake reducido por alta varianza, cuota total elevada, cuota
  >25, 5 selecciones y probabilidad conjunta baja.

### Verificación
- `npm run typecheck` pasa.
- `npm run verify:parlays` pasa.
- Se abrieron correctamente:
  - `/parlays?profile=conservative`
  - `/parlays?profile=balanced`
  - `/parlays?profile=aggressive`
  - `/parlays?profile=aggressive&debug=1`
  - `/`

---

## ACTUALIZACIÓN — sesión 8

### Estado: motor estadístico avanzado de goles (Poisson matrix)
- Nuevo módulo `src/lib/stat-model/`:
  - `score-matrix.ts`: `poissonProbability()`, `createScoreMatrix()`,
    `scoreMatrixTotalProbability()`.
  - `market-probabilities.ts`: predicados, probabilidades derivadas,
    `jointProbabilityForSelections()`.
  - `market-types.ts`: selecciones/mercados internos del modelo.
  - `calibration.ts`: `anchorProbability()` con pesos configurables.
  - `expected-goals.ts`: wrapper auditable sobre `team_stats`/estimador existente.
  - `index.ts`: exports.
- Mercados soportados por matriz:
  1X2, over/under 0.5-4.5, BTTS, team totals 0.5/1.5 y doble oportunidad.
- `scripts/verify-stat-model.ts` agregado y `npm run verify:stat-model`
  registrado en `package.json`.

### Integración incremental con combinadas
- Nuevo `src/lib/parlays/stat-model-adapter.ts`.
- `generateParlaysWithDebug()` acepta opcionalmente `scoreMatricesByMatchId`.
- Si varios picks son del mismo partido y hay matriz:
  - calcula probabilidad conjunta exacta por predicados de marcador;
  - guarda `correlationMethod: "score_matrix"`;
  - guarda `correlationRatio` y `sameMatchJointProbability`;
  - detecta incompatibilidades con `jointProbability <= epsilon`.
- Si no hay matriz, se mantiene fallback heurístico actual.
- `ParlayCard` muestra en detalles técnicos si la correlación fue por matriz o
  heurística, además de ratio/joint same-match cuando existan.

### Ejemplo numérico simple
Con lambdas `home=1.5`, `away=1.1`, `maxGoals=12`:
- Masa matriz normalizada: 1.000000
- Home win: 46.42%
- Draw: 25.77%
- Away win: 27.81%
- Over 2.5: 48.16%
- BTTS yes: 51.83%
- Home win + over 2.5: 26.93%
- Correlation ratio home win + over 2.5: 1.20

### Supuestos y límites
- Todo sigue pre-partido.
- Poisson asume independencia de goles local/visita; no usa Dixon-Coles todavía.
- Expected goals usa datos internos disponibles (`team_stats`); no inventa xG
  externo ni ratings.
- El anclaje mercado/modelo vive separado en `calibration.ts`; no reutilizar
  `Edge.model_probability` como probabilidad Poisson pura porque ahí ya está
  anclada.
- No todos los mercados derivados son apostables: solo se vuelven edge si existe
  cuota real comparable.

### Verificación
- `npm run typecheck` pasa.
- `npm run verify:parlays` pasa.
- `npm run verify:stat-model` pasa.
- Smoke UI OK en `/parlays?profile=aggressive&debug=1` y `/`.

---

## ACTUALIZACIÓN — sesión 9

### Estado: matrices Poisson conectadas a partidos reales
- Auditoría de datos:
  - Disponibles: `matches`, `teams`, `team_stats`, resultados finalizados,
    goles a favor/en contra, `gf_per_game`, `ga_per_game`, `recent_form`.
  - `fifa_rank` existe en schema/tipos, pero no está poblado por el sync live.
  - No hay xG externo, Elo, SPI ni ratings de fuerza confiables todavía.
  - `team_stats` se calcula desde resultados; si una selección aún no jugó,
    queda con 0 partidos y priors neutrales. El modelo marca baja confianza.
- Nuevo `src/lib/stat-model/match-prediction.ts`:
  - `buildScoreMatrixForMatch(match, homeStats, awayStats, options)`
  - `buildScoreMatricesByMatchId(matches, teamStats, options)`
  - `MatchStatModelPrediction`
  - `StatModelCoverage`
- `src/lib/data/repository.ts` agrega `getTeamStats()`.
- Nueva página `/stat-model`:
  muestra xG local/visitante, 1X2, over/under 2.5, BTTS, doble oportunidad,
  confidence y warnings. Etiqueta claramente "Probabilidad modelo, no edge
  apostable todavía."
- `/parlays` ahora genera `scoreMatricesByMatchId` desde datos reales y lo pasa
  a `ParlayWorkspace`. Si una combinada tiene varios picks del mismo partido y
  existe matriz, usa correlación por matriz; si no, fallback heurístico.
- Diagnóstico de `/parlays` muestra cobertura:
  pre-partido, con matriz, stats suficientes, sin matriz, combinadas con matriz
  y combinadas con heurística.

### Cobertura real observada
- Partidos pre-partido: 53.
- Partidos con score matrix: 53.
- Partidos sin matriz: 0.
- Partidos con stats suficientes: 0.
- Conclusión: la cobertura técnica es completa, pero la confianza estadística
  actual es baja porque muchos equipos no tienen partidos finalizados en
  `team_stats` para esos cruces.

### Ejemplos reales del modelo
Con datos actuales, varios partidos usan priors similares por baja muestra:
- `AUT-JOR`: xG 1.44 - 1.35, Home 39.51%, Draw 25.28%, Away 35.22%,
  Over 2.5 52.92%, Under 2.5 47.08%, BTTS sí 56.60%, confidence low.
- `POR-COD`: xG 1.44 - 1.35, Home 39.51%, Draw 25.28%, Away 35.22%,
  Over 2.5 52.92%, Under 2.5 47.08%, BTTS sí 56.60%, confidence low.
- `ENG-CRO`: xG 1.44 - 1.35, Home 39.51%, Draw 25.28%, Away 35.22%,
  Over 2.5 52.92%, Under 2.5 47.08%, BTTS sí 56.60%, confidence low.

### Verificación
- `npm run typecheck` pasa.
- `npm run verify:parlays` pasa.
- `npm run verify:stat-model` pasa.
- Smoke UI OK en `/stat-model` y `/parlays?profile=aggressive&debug=1`.

---

## ACTUALIZACIÓN — sesión 10

### Estado: fase UI/UX premium sobre modelo y combinadas
- Dashboard principal rediseñado como mesa pre-partido:
  - hero con modo tipster, Poisson + mercado y avisos de muestra baja;
  - KPIs de partidos, edges, picks de calidad y matrices Poisson;
  - oportunidades destacadas con cuota, probabilidad anclada, EV, edge score,
    confianza del modelo y explicación;
  - picks individuales en tarjetas rápidas;
  - preview de combinadas balanceadas usando matrices Poisson para correlación.
- `/parlays` mantiene motor y filtros, pero mejora presentación:
  - encabezado con perfil activo;
  - `ParlayCard` muestra desglose de legs, mercado, partido, cuota, EV,
    probabilidad anclada, stake, retorno potencial, riesgo, correlación y método
    `Matriz Poisson` vs `Fallback heurístico`;
  - explicaciones y warnings aparecen en bloques auditable/legibles.
- `/stat-model` ahora usa `PoissonModelCard`:
  - xG local/visitante, score probable, probabilidad del score, 1X2, O/U 2.5,
    BTTS, doble oportunidad, confianza y warnings;
  - cobertura técnica y advertencia explícita de que el modelo no es edge
    apostable sin cuota comparable.
- Detalle de partido integra bloque Poisson compacto con score probable y
  contexto de modelo.
- Nuevo `TeamMark` evita mostrar URLs de crest como texto cuando `team.flag`
  viene desde football-data.org.

### Componentes agregados/mejorados
- Nuevos:
  `DashboardStats`, `OpportunityCard`, `PickCard`, `ExpectedValueIndicator`,
  `PoissonModelCard`, `ProbabilityBar`, `ConfidenceBadge`, `EdgeScoreBadge`,
  `StakeRecommendation`, `ExplanationBox`, `ParlayBreakdown`,
  `CorrelationWarning`, `TeamMark`.
- Mejorados:
  `ParlayCard`, `MatchCard`, dashboard `/`, `/parlays`, `/stat-model` y
  `/matches/[id]`.

### Verificación
- `npm run typecheck` pasa.
- `npm run lint` pasa sin warnings.
- `npm run verify:parlays` pasa.
- `npm run verify:stat-model` pasa.
- Smoke UI OK en:
  - `/`
  - `/parlays?profile=conservative`
  - `/parlays?profile=balanced`
  - `/parlays?profile=aggressive`
  - `/stat-model`
  - primer detalle real `/matches/[id]`

### Límites pendientes
- La confianza estadística sigue baja por falta de muestra en `team_stats`.
- No hay ratings FIFA/Elo poblados todavía.
- No se agregaron mercados apostables nuevos ni cambios de schema.
- `TeamMark` usa `<img>` para crests remotos con excepción ESLint localizada;
  si se quiere optimización de imágenes, configurar `next/image` con dominios
  remotos más adelante.

---

## ACTUALIZACIÓN — sesión 11

### Estado: filtro global de elegibilidad pre-partido
- Se corrigió el bug donde Dashboard, Ranking, Picks y Combinadas podían mostrar
  edges de partidos live/finalizados o con kickoff ya vencido.
- Nuevo helper central:
  `src/lib/matches/pre-match-eligibility.ts`
  - normaliza estados de proveedor (`SCHEDULED`, `TIMED`, `LIVE`, `FT`,
    `POSTPONED`, `SUSPENDED`, etc.);
  - exige estado pre-partido y kickoff futuro;
  - excluye fechas inválidas por seguridad;
  - expone filtros para matches, edges y parlays.
- `repository.getEdges()` ahora devuelve solo edges apostables pre-partido.
  Los datos históricos siguen en Supabase y se pueden consultar con
  `getAllEdges()` / `getAllEdgesForMatch()`.
- `parlay-engine` usa el helper central para rechazar legs no pre-partido aunque
  lleguen picks mal filtrados.
- `buildScoreMatricesByMatchId()` ahora genera cobertura pre-partido solo para
  partidos elegibles, evitando matrices para partidos vencidos con status stale.

### Superficies ajustadas
- Dashboard y Ranking de Edges heredan el filtro desde `getEdges()`.
- `/parlays` genera combinadas solo con edges elegibles y en debug muestra cuántos
  edges se excluyeron por no ser pre-match.
- `/matches/[id]`:
  - si el partido es futuro, muestra oportunidades pre-partido;
  - si está live/finalizado/no elegible, muestra marcador/estado y trata los
    edges como históricos/no apostables.
- `/matches` ahora funciona como calendario/historial:
  - secciones Próximos, En vivo, Finalizados y Otros/no elegibles;
  - cards con estado claro y marcador cuando existe;
  - no muestra oportunidades activas en partidos no elegibles.
- `EdgeTable` agrega cards móviles para mejorar legibilidad del Ranking.
- `/stat-model` explicita que el universo evaluado es pre-partido elegible y
  muestra cuántos partidos quedan fuera como live/finalizados/vencidos.

### Verificación
- Nuevo script `npm run verify:pre-match`.
- `npm run typecheck` pasa.
- `npm run lint` pasa.
- `npm run verify:pre-match` pasa.
- `npm run verify:parlays` pasa.
- `npm run verify:stat-model` pasa.
- Smoke HTTP OK en `/`, `/edges`, `/parlays?profile=balanced&debug=1`,
  `/matches` y `/stat-model`.
- Validado por HTML que `ARG-ALG`, `ESP-KSA`, `BRA-HAI` y `MAR-HAI` no aparecen
  en Dashboard, Ranking ni Combinadas.

### Nota importante
- No se borraron edges, odds ni predicciones históricas. El fix es de lectura,
  generación de combinadas y presentación pública.

---

## ACTUALIZACIÓN — sesión 12

### Estado: labels de mercados y auditoría de Over/Under 2.5
- Se creó `src/lib/markets/market-display.ts` como helper central para labels:
  - `formatMarketName()`
  - `formatSelectionName()`
  - `formatMarketWithLine()`
  - `getMarketCategoryLabel()`
  - `marketDistributionKey()`
- `components/outcome-label.tsx` quedó como wrapper compatible, pero ahora usa el
  helper central.
- Se corrigió la ambigüedad visual:
  - antes: `Más de 2.5` / `Menos de 2.5`
  - ahora: `Más de 2.5 goles` / `Menos de 2.5 goles`
- El helper ya soporta/fallbackea categorías futuras:
  1X2, doble oportunidad, total de goles, BTTS, team totals, handicap, corners,
  tarjetas y remates.

### Auditoría de sesgo hacia 2.5
- No se encontró hardcoding en el generador de combinadas que fuerce Over/Under
  2.5.
- La presencia de `over_under_2_5` viene de los datos disponibles:
  - The Odds API se consume con `markets=h2h,totals`;
  - el adapter actual solo acepta totals con `point === 2.5`;
  - el tipo apostable actual `Market` solo incluye `over_under_2_5`.
- Conclusión: la repetición de 2.5 no venía del scoring, sino de la cobertura de
  mercados/cuotas disponibles.

### Debug de distribución en `/parlays`
- En modo debug se agregó bloque `Distribución de mercados`:
  - disponibles antes de generar;
  - descartados por filtros;
  - seleccionados en combinadas;
  - agrupados por tipo/línea, por ejemplo `Total de goles 2.5`.
- Los descartes ahora muestran selección legible en español, no `market:selection`.

### Diversidad suave
- `scoreParlay()` ahora aplica una penalización suave si una combinada concentra
  demasiados picks del mismo tipo/línea de mercado.
- No descarta combinadas ni fuerza mercados peores: solo desempata/rankea mejor
  alternativas comparables con más diversidad.
- La explicación de combinadas ahora menciona si se mantiene concentración de
  mercado porque supera EV/probabilidad/riesgo, o si hay diversidad de mercados.

### Verificación
- Nuevo script `npm run verify:markets`.
- `npm run typecheck` pasa.
- `npm run lint` pasa.
- `npm run verify:markets` pasa.
- `npm run verify:parlays` pasa.
- `npm run verify:stat-model` pasa.
- `npm run verify:pre-match` pasa.
- Smoke HTTP OK en `/`, `/edges`, `/parlays?profile=balanced&debug=1` y
  `/stat-model`.
- Validado por HTML que no aparecen labels ambiguos `Más de 2.5` / `Menos de 2.5`
  sin `goles` en rutas públicas revisadas.

---

## ACTUALIZACIÓN — sesión 13

### Estado: Mundial-only, ratings base y contexto de grupos
- Se reforzó el foco de producto en Mundial 2026:
  - Dashboard habla de `Mesa pre-partido Mundial 2026`;
  - Partidos pasa a `Partidos del Mundial 2026`;
  - el modelo visible se etiqueta como `Modelo Mundial Edge`.
- Nuevo módulo `src/lib/stat-model/team-strength-ratings.ts`:
  - ratings seed manuales por selección;
  - campos `overallRating`, `attackRating`, `defenseRating`, `formRating`,
    `tournamentExperience`, `confidence`, `source`;
  - `source: "manual_seed"` y confidence prudente `medium`;
  - fallback neutral explícito `neutral_fallback`.
- `estimateExpectedGoals()` ahora usa blend:
  - rating base por selección;
  - team_stats reales del Mundial;
  - promedio global;
  - contexto de grupo cuando está disponible.
- Regla de peso:
  - poca muestra => rating base pesa más;
  - más partidos reales => team_stats gana peso;
  - rating manual nunca se presenta como precisión absoluta.
- `MatchStatModelPrediction` ahora incluye:
  - `homeRating`, `awayRating`;
  - `expectedGoalsBlend`;
  - `groupContext`;
  - warnings y source del xG.

### Contexto de grupos
- Nuevo módulo `src/lib/world-cup/group-context.ts`:
  - fases: `GROUP_STAGE`, `ROUND_OF_32`, `ROUND_OF_16`, `QUARTER_FINAL`,
    `SEMI_FINAL`, `THIRD_PLACE`, `FINAL`;
  - standings por grupo con puntos, PJ, GF, GC, DG, posición y partidos restantes;
  - inferencia de partido 1/2/3 de grupo;
  - resumen textual de contexto;
  - modificadores prudentes: urgencia, utilidad del empate, incentivo por
    diferencia de gol y riesgo de rotación.
- Los modificadores son pequeños y transparentes; no reemplazan el modelo ni
  crean edges sin cuota real.

### UI
- Nuevo componente `WorldCupContextCard` para detalle de partido.
- `PoissonModelCard` muestra:
  - `Rating + stats`;
  - rating de ambas selecciones;
  - porcentaje de blend rating/stats;
  - resumen de contexto de grupo cuando existe.
- `/matches/[id]` muestra contexto Mundial 2026 + rating/stats en el modelo.
- `/matches` muestra grupo/contexto en cards de calendario/historial.
- Dashboard usa filtro pre-partido para próximos partidos y muestra contexto de
  grupo en cards.
- Combinadas aclara que los picks usan probabilidad final anclada al mercado; el
  modelo Mundial Edge informa señal, pero no crea edges sin cuota real.

### Verificación
- Nuevos scripts:
  - `npm run verify:team-ratings`
  - `npm run verify:world-cup-context`
- `npm run typecheck` pasa.
- `npm run lint` pasa.
- `npm run verify:stat-model` pasa.
- `npm run verify:pre-match` pasa.
- `npm run verify:parlays` pasa.
- `npm run verify:markets` pasa.
- `npm run verify:team-ratings` pasa.
- `npm run verify:world-cup-context` pasa.
- Smoke HTTP OK en `/`, `/matches`, `/stat-model`,
  `/parlays?profile=balanced&debug=1` y un `/matches/[id]` real.

### Límites pendientes
- Ratings son seed manuales, no feed oficial ni Elo/FIFA live.
- Grupo/contexto usa datos disponibles en `matches` y resultados finalizados;
  si faltan grupos o resultados, muestra fallback prudente.
- No se tocó schema Supabase ni se generaron mercados apostables nuevos.

---

## ACTUALIZACIÓN — sesión 14

### Estado: probabilidad final calibrada y backtesting inicial
- Nuevo módulo `src/lib/model/final-probability.ts`.
- Calcula una `finalProbability` runtime, sin tocar Supabase, como ensemble
  prudente entre:
  - probabilidad de mercado/de-vig;
  - probabilidad Poisson/modelo Mundial Edge;
  - señal de ratings;
  - señal de stats reales;
  - contexto Mundial/grupos.
- El mercado funciona como baseline fuerte cuando hay odds reales:
  - con cuota real, mercado tiene peso alto;
  - el modelo ajusta de forma acotada;
  - la probabilidad final queda anclada para evitar saltos extremos.
- Sin odds reales:
  - mercado pesa 0;
  - no se genera edge apostable;
  - confidence nunca sube a high.
- `Edge` ahora puede llevar campos runtime opcionales:
  - `final_probability`
  - `final_edge`
  - `final_expected_value`
  - `final_tier`
  - `final_probability_confidence`
  - `final_probability_explanation`
  - `final_probability_breakdown`
- `decorateEdgesWithFinalProbability()` decora edges existentes a partir de las
  predicciones del modelo Mundial Edge.
- `edgeToParlayPick()` usa `final_probability` si existe, manteniendo fallback a
  `model_probability` anclada.

### UI
- Dashboard/Ranking/Picks/Oportunidades muestran `Probabilidad final calibrada`,
  mercado, Poisson/modelo y EV final.
- `EdgeTable` agrega columnas de Mercado, Poisson y Final.
- `/parlays?debug=1` muestra bloque `Ensemble de probabilidad final`:
  - pesos promedio mercado/Poisson/ratings/stats/contexto;
  - probabilidades por pick;
  - confidence y warnings.
- `ParlayBreakdown` indica si usa probabilidad final calibrada y muestra pesos
  del ensemble cuando están disponibles.

### Backtesting / tracking
- Nuevo `src/lib/backtesting/`:
  - `prediction-snapshot.ts`: estructura pura para snapshots de predicción;
  - `scoring.ts`: Brier score, log loss, hit rate, ROI/yield, buckets de
    calibración, average edge y warnings por muestra baja.
- No persiste en Supabase todavía; queda preparado para futura persistencia.

### Verificación
- Nuevos scripts:
  - `npm run verify:final-probability`
  - `npm run verify:backtesting`
- `npm run typecheck` pasa.
- `npm run lint` pasa.
- `npm run verify:pre-match` pasa.
- `npm run verify:markets` pasa.
- `npm run verify:team-ratings` pasa.
- `npm run verify:world-cup-context` pasa.
- `npm run verify:parlays` pasa.
- `npm run verify:stat-model` pasa.
- `npm run verify:final-probability` pasa.
- `npm run verify:backtesting` pasa.
- Smoke HTTP OK en `/`, `/edges`, `/matches`, `/stat-model`,
  `/parlays?profile=balanced&debug=1` y un `/matches/[id]` real.

### Nota importante
- No se crearon mercados nuevos.
- No se tocaron tablas ni schema Supabase.
- La probabilidad final no es edge por sí sola: edge apostable sigue requiriendo
  cuota real, comparación contra probabilidad implícita y partido pre-match
  elegible.
