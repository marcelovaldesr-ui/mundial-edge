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

---

## ACTUALIZACION - sesion 15

### Estado: backtesting historico de Mundiales ampliado
- Nuevo comando `npm run backtest:worldcups`.
- El runner evalua probabilidades 1X2 del modelo estadistico, sin cuotas ni
  mercados nuevos, y compara tres variantes:
  - modelo actual completo;
  - modelo sin contexto de grupo;
  - modelo sin ratings base.
- Metricas globales, por Mundial y por stage:
  - Brier Score multiclase (suma sobre home/draw/away);
  - Log Loss multiclase;
  - Ranked Probability Score (orden home/draw/away, normalizado por 2);
  - accuracy del outcome 1X2 con mayor probabilidad.
- El pipeline procesa cada torneo cronologicamente. Las stats y la tabla de
  grupo de cada prediccion solo incluyen partidos anteriores para evitar
  leakage del resultado.
- El reporte muestra deltas contra el modelo completo y el numero de partidos
  de cada bucket (`ALL`, `GROUP`, `KNOCKOUT` y cada ronda eliminatoria).

### Datos actuales
- Corpus completo y versionado desde `openfootball/worldcup.json` (CC0):
  - Mundial 2018: 64 partidos (48 de grupo + 16 eliminatorios);
  - Mundial 2022: 64 partidos (48 de grupo + 16 eliminatorios);
  - total: 128 partidos.
- Cada fixture conserva year, stage, group, equipos, marcador, fecha/orden,
  sede neutral y `scoreBasis: REGULATION_90`.
- En eliminatorias se usa el resultado a 90 minutos; prorroga y penales no
  forman parte del mercado 1X2 evaluado.
- Los fixtures declaran sede neutral, pero el estimador actual conserva sus
  factores home (`1.07` stats / `1.04` ratings). Se documenta como limitacion y
  no se cambia en esta fase para no alterar el modelo bajo evaluacion.
- `ratingSet` y `ratingSnapshotYear` dejan preparada la inyeccion futura de
  ratings pre-torneo. Hoy solo existen seeds 2026 y fallback neutral explicito,
  por lo que persiste sesgo temporal retrospectivo.
- No hay cuotas historicas, por lo que no se calculan edge, EV ni ROI.

### Interpretacion de metricas
- Brier Score: error cuadratico de las tres probabilidades 1X2; menor es mejor.
- Log Loss: penaliza especialmente probabilidades altas asignadas al resultado
  equivocado; menor es mejor.
- RPS: compara probabilidades acumuladas respetando el orden home/draw/away;
  menor es mejor.
- Accuracy: porcentaje en que el outcome con mayor probabilidad fue correcto;
  mayor es mejor, pero no mide calibracion ni calidad de toda la distribucion.

### Implementacion y verificacion
- Nuevo motor puro en `src/lib/backtesting/world-cup-backtest.ts`.
- `estimateExpectedGoals()` acepta `useBaseRatings: false` exclusivamente como
  hook opt-in de ablacion; el comportamiento productivo por defecto no cambia.
- `estimateExpectedGoals()` acepta un `ratingResolver` inyectable para futuros
  snapshots historicos; produccion conserva el resolver actual por defecto.
- `npm run verify:world-cup-backtest` cubre formulas, 128 fixtures, resultados,
  probabilidad finita/normalizada, ratings/fallback y aislamiento del contexto:
  en knockout completo y sin contexto deben ser identicos.

### Proximos pasos recomendados
- Incorporar fixtures completos 2014, 2010, 2006, 2002 y 1998.
- Conseguir snapshots pre-torneo verificables por Mundial antes de concluir
  sobre el aporte de ratings.
- Agregar intervalos de confianza o bootstrap para medir si las diferencias
  entre variantes son estadisticamente estables.
- Solo despues decidir cambios del modelo como Dixon-Coles, ratings ofensivos/
  defensivos o Elo dinamico.

---

## ACTUALIZACION - sesion 16

### Estado: xG v2 con ataque/defensa y sedes neutrales
- `TeamStrengthRating` ahora expone como contrato canonico:
  - `overall`: fuerza general;
  - `attack`: capacidad ofensiva, donde mayor rating aumenta xG propio;
  - `defense`: resistencia defensiva, donde mayor rating reduce el xG rival.
- Los aliases `overallRating`, `attackRating` y `defenseRating` se conservan
  para compatibilidad con UI y consumidores existentes.
- Los seeds se mantienen cerca del overall, normalmente dentro de +/-5 puntos.
  Los perfiles ofensivos/defensivos ya existentes se documentan como ajustes
  manuales moderados, no como datos historicos ni live.
- Equipos sin seed reciben fallback neutral explicito `74/74/74`.

### Expected Goals v2
- `estimateExpectedGoals()` permite `ratingModel`:
  - `legacy_v1`: formula congelada para baseline reproducible;
  - `attack_defense_v2`: ataque propio + defensa rival + overall, mezclados con
    stats observadas y contexto de grupo.
- v2 diferencia correctamente `0 partidos` de una tasa observada de `0 goles`;
  la formula legacy conserva el comportamiento anterior para comparacion.
- Los xG permanecen acotados a `[0.2, 4.5]`.
- `neutralVenue: true` elimina ambos factores de localia del estimador:
  - stats: `1.07 -> 1.00`;
  - componente rating: `1.04 -> 1.00`.
- `Match.neutralVenue` es metadata runtime opcional y no implica cambio de
  schema. Partidos no neutrales conservan la ventaja legacy.

### Backtest comparativo
- Cuatro variantes sobre los 128 partidos completos de 2018 y 2022:
  - modelo actual completo (`legacy_v1`, factor home, contexto);
  - actual + sede neutral (`legacy_v1`, neutral, contexto);
  - ataque/defensa v2 neutral sin contexto;
  - ataque/defensa v2 neutral con contexto.
- Resultado global contra baseline:
  - neutral: Brier `-0.0008`, Log Loss `-0.0011`, RPS `-0.0006`, Accuracy `-0.8 pp`;
  - v2 sin contexto: Brier `+0.0139`, Log Loss `+0.0199`, RPS `+0.0039`, Accuracy `-3.9 pp`;
  - v2 con contexto: Brier `+0.0111`, Log Loss `+0.0143`, RPS `+0.0026`, Accuracy `-3.1 pp`.
- v2 con contexto mejora claramente respecto de v2 sin contexto, pero no supera
  la baseline global. Por Mundial es inestable: mejora errores en 2018 y los
  empeora en 2022.
- En knockout, v2 con/sin contexto es identico, confirmando que groupContext no
  se filtra a eliminatorias.

### Guardrails y tests
- Cada prediccion valida xG finito dentro de `[0.2, 4.5]` y probabilidades 1X2
  finitas, no negativas y normalizadas.
- `verify:team-ratings` cubre aliases legacy, fallback, neutralVenue y direccion
  correcta de attack/defense.
- `verify:world-cup-backtest` cubre las cuatro variantes, flags aplicados,
  aislamiento de contexto y guardrails de xG/probabilidad.

### Limitaciones y proximos pasos
- Solo hay Mundiales 2018/2022 y seeds 2026 retrospectivos; no promover ajustes
  adicionales por estas diferencias pequenas/inestables.
- Incorporar 2014-1998 y ratings pre-torneo antes de calibrar la formula v2.
- Agregar bootstrap/intervalos de confianza y estudiar regularizacion de stats
  tempranas; despues evaluar Dixon-Coles. Elo dinamico sigue fuera de alcance.

---

## ACTUALIZACION - sesion 17

### Estado: auditoria Legacy neutral vs xG v2 con contexto
- Nuevo comando reproducible: `npm run diagnose:xg-v2`.
- Genera `reports/xg-v2-diagnostic.md` desde los 128 partidos del backtest, sin
  tocar parametros productivos, UI, schema ni mercados.
- Nuevo modulo puro `src/lib/backtesting/xg-v2-diagnostic.ts` para:
  - score por partido (Brier, Log Loss y RPS);
  - cortes por Mundial, fase, ronda, diferencia de rating, favorito/upset,
    empate, goles y muestra observada;
  - calibracion por confianza, draw y favoritos claros;
  - top 10 mejoras y top 10 deterioros;
  - diagnostico heuristico de causas y guardrails.
- La salida interna del backtest agrega metadata diagnostica por fixture:
  equipos/marcador, ratings attack/defense/overall, muestra previa, xG y flags
  de contexto/neutralidad. Esto no cambia el calculo del modelo.

### Conclusion tecnica
- Legacy neutral sigue siendo la baseline recomendada:
  - Brier `0.6462` vs `0.6581`;
  - Log Loss `1.0821` vs `1.0975`;
  - RPS `0.2371` vs `0.2402`;
  - Accuracy `48.4%` vs `46.1%`.
- xG v2 mejora 69 partidos y empeora 59 por Brier, pero sus deterioros son mas
  costosos y se concentran en grupos, favoritos claros, upsets y pocos goles.
- La causa principal probable es stats observadas sin suficiente regularizacion
  tras 1-2 partidos, especialmente tasas cero:
  - en 2018 esos casos mejoran Brier medio `-0.0188`;
  - en 2022 empeoran `+0.1044`.
- Empates: v2 no los infravalora globalmente; predice `25.8%` draw frente a
  `22.7%` real y `24.5%` Legacy. Hay cinco casos puntuales de draw reducido.
- Favoritos: la probabilidad media del favorito claro no sube globalmente, pero
  v2 empeora fuerte en upsets y tiene sobreconfianza localizada.
- Contexto es mixto y pequeno; ayuda a v2 agregado, pero no compensa la formula.
- No hay NaN, probabilidades fuera de rango, masa 1X2 incorrecta ni lambdas
  tocando los guardrails. La conversion Poisson no muestra un fallo aritmetico.

### Recomendacion
- No promover xG v2 a baseline ni modificar produccion con esta auditoria.
- Mantenerlo experimental y probar regularizacion de stats tempranas en una
  variante separada, despues de ampliar Mundiales/snapshots y agregar bootstrap.

---

## ACTUALIZACION - sesion 18

### Estado: xG v2.1 con shrinkage bayesiano
- Se agrego una variante exclusivamente experimental de xG v2. No cambia el
  modelo productivo, UI, schema ni mercados.
- `estimateExpectedGoals()` acepta el hook opt-in `priorStrength`; si se omite,
  xG v2 conserva exactamente su camino sin regularizacion.
- La regularizacion usa:
  - `weight = gamesPlayed / (gamesPlayed + priorStrength)`;
  - `blendedMetric = weight * observedMetric + (1 - weight) * priorMetric`.
- Se aplica en tres niveles:
  - tasa de ataque observada (goles a favor por partido) hacia el prior de
    ataque del rating;
  - tasa de defensa observada (goles recibidos por partido) hacia el prior de
    concesion derivado del rating defensivo;
  - xG derivado hacia el xG del rating. Para este ultimo se usa como muestra el
    minimo de partidos previos de ambos equipos, evitando que una sola muestra
    madura domine un cruce con rival sin datos.
- Se evaluan `priorStrength` 2, 4, 6 y 8. Un valor mayor conserva mas peso del
  prior: tras un partido, el peso observado es 33.3%, 20.0%, 14.3% y 11.1%,
  respectivamente.

### Variantes y baseline
- El backtest/diagnostico ahora compara exactamente:
  - `legacy-neutral` (baseline);
  - `xg-v2`;
  - `xg-v2.1-prior2`;
  - `xg-v2.1-prior4`;
  - `xg-v2.1-prior6`;
  - `xg-v2.1-prior8`.
- Todas usan sede neutral y contexto solo en fase de grupos. Los deltas se
  calculan siempre contra `legacy-neutral`.
- El reporte reproducible sigue en `reports/xg-v2-diagnostic.md` y cubre Brier,
  Log Loss, RPS y Accuracy global, grupos, eliminatorias, partidos con favorito,
  upsets y partidos de 0-2 goles.

### Resultados (128 partidos, 2018 + 2022)
- Baseline global `legacy-neutral`: Brier `0.6462`, Log Loss `1.0821`, RPS
  `0.2371`, Accuracy `48.4%`.
- xG v2 sin regularizar confirma el deterioro: deltas `+0.0119`, `+0.0154`,
  `+0.0031` y `-2.3 pp`.
- Todas las variantes v2.1 superan el baseline en las cuatro metricas globales:
  - prior2: Brier `0.6097` (`-0.0365`), Accuracy `52.3%` (`+3.9 pp`);
  - prior4: Brier `0.6049` (`-0.0414`), Accuracy `53.1%` (`+4.7 pp`);
  - prior6: Brier `0.6036` (`-0.0427`), Accuracy `56.3%` (`+7.8 pp`);
  - prior8: Brier `0.6030` (`-0.0432`), Log Loss `1.0097` (`-0.0724`),
    RPS `0.2141` (`-0.0230`) y Accuracy `55.5%` (`+7.0 pp`).
- `prior8` es el mejor por Brier/Log Loss/RPS global; `prior6` es el mejor por
  Accuracy global.
- `prior8` mejora Brier tanto en grupos (`-0.0453`) como eliminatorias
  (`-0.0371`), partidos con favorito (`-0.0401`) y 0-2 goles (`-0.0568`).
- En upsets, `prior8` reduce Brier (`-0.0775`), Log Loss (`-0.1574`) y RPS
  (`-0.0393`), pero la Accuracy cae de `21.1%` a `0.0%`: asigna una distribucion
  menos costosa sin convertir al no favorito en pick principal. Esta tension
  impide leer la mejora agregada como victoria definitiva.

### Guardrails y regresiones
- Cero probabilidades invalidas o masas 1X2 fuera de tolerancia.
- Cero valores no finitos y cero xG fuera de `[0.2, 4.5]`.
- Todos los fixtures aplican sede neutral y todo rating tiene seed o fallback
  neutral explicito.
- La regresion valida que una tasa cero tras un partido queda mas cerca del
  prior con `prior8` que con `prior2`, que `priorStrength` invalido falla de
  forma explicita y que el camino productivo/default conserva `null`.

### Recomendacion y proximos pasos
- **Si supera el baseline en este corpus:** si; las cuatro variantes v2.1 lo
  superan globalmente en las cuatro metricas y prior8 lidera los errores.
- **No promover todavia:** el corpus contiene solo dos Mundiales, usa ratings
  2026 retrospectivos y muestra una perdida de Accuracy en upsets pese a mejorar
  calibracion. Legacy neutral debe seguir como baseline y produccion no cambia.
- Siguiente paso: incorporar Mundiales 2014-1998 y snapshots pre-torneo, agregar
  bootstrap/intervalos por torneo y estudiar un criterio compuesto entre prior6
  y prior8 antes de considerar una promocion.

---

## ACTUALIZACION - sesion 19

### Estado: Dixon-Coles experimental para marcadores bajos
- Nuevo modulo puro `src/lib/stat-model/dixon-coles.ts`.
- `applyDixonColesAdjustment(matrix, rho)` devuelve una matriz nueva y metadata;
  no muta la matriz Poisson de entrada ni cambia el camino productivo.
- Implementa la correccion clasica tau solo en `0-0`, `1-0`, `0-1` y `1-1`:
  - 0-0: `1 - lambdaHome * lambdaAway * rho`;
  - 1-0: `1 + lambdaAway * rho`;
  - 0-1: `1 + lambdaHome * rho`;
  - 1-1: `1 - rho`.
- Los factores se acotan a cero para impedir probabilidades negativas y toda la
  matriz se renormaliza despues. La metadata expone `rho`, las cuatro
  `adjustedCells` y `normalizationFactor`.
- Rho permitido: `-0.15`, `-0.10`, `-0.05`, `0.00`, `0.05`. Rho cero devuelve
  probabilidades identicas y factor de normalizacion 1.

### Integracion y diagnostico
- Dixon-Coles solo se aplica en variantes de backtest. UI, schema, mercados y
  modelo productivo permanecen intactos.
- Nuevo reporte `reports/dixon-coles-diagnostic.md`, generado también por
  `npm run diagnose:xg-v2` para conservar un unico runner reproducible.
- Compara exactamente las ocho variantes solicitadas:
  - legacy-neutral y rho `-0.15/-0.10/-0.05`;
  - xG v2.1 prior8 y rho `-0.15/-0.10/-0.05`.
- Reporta Brier, Log Loss, RPS, Accuracy, correct score top-1, cortes de 0-2
  goles y empates, draw Brier, probabilidad media de empate y buckets de
  calibracion. Cada fila incluye deltas contra legacy-neutral y prior8.

### Resultados (128 partidos, 2018 + 2022)
- **Global:** ningun rho mejora Brier sobre su modelo base.
  - Mejor DC sobre Legacy: rho `-0.05`, Brier `0.6470`, delta `+0.0007`;
    Log Loss delta `+0.0028`; Accuracy mejora `+0.8 pp`.
  - Mejor DC sobre prior8: rho `-0.05`, Brier `0.6040`, delta `+0.0010`;
    Log Loss delta `+0.0012`; Accuracy no cambia.
- **Partidos de 0-2 goles:** la correccion si ayuda.
  - Legacy rho `-0.15`: Brier `-0.0051`, Log Loss `-0.0036`, Accuracy
    `+4.3 pp` frente a Legacy.
  - prior8 rho `-0.15`: Brier `-0.0055`, Log Loss `-0.0105`, RPS `-0.0009`;
    Accuracy y correct score top-1 no cambian frente a prior8.
- **Empates:** rho `-0.15` mejora mucho el score condicionado a partidos que
  terminaron empatados.
  - Legacy: Brier `-0.0727`, Log Loss `-0.1225`, Accuracy `+10.3 pp`.
  - prior8: Brier `-0.0789`, Log Loss `-0.1328`; Accuracy no cambia.
- **Calibracion global de draw:** empeora, porque el corpus ya sobrepredice
  empates.
  - Tasa real: `22.7%`.
  - Legacy: `24.5%`; con rho `-0.15`: `27.7%`.
  - prior8: `25.2%`; con rho `-0.15`: `28.8%`.
  - Draw Brier global aumenta para todos los rho negativos evaluados.
- **Correct score top-1:** no mejora globalmente. Legacy cae de `12.5%` a
  `10.2%/9.4%`; prior8 permanece en `10.2%` con los tres rho.

### Tests y guardrails
- Rho cero conserva todas las probabilidades exactamente.
- La masa ajustada suma 1 y ninguna probabilidad es negativa, incluido rho
  positivo con lambdas en el guardrail `4.5/4.5`.
- La matriz conserva dimensiones y solo las cuatro celdas bajas reciben tau;
  el resto solo cambia por el factor global de renormalizacion.
- El backtest verifica metadata DC, rho aplicados, correct score top-1 y las 8
  filas del diagnostico.

### Recomendacion
- **No promover Dixon-Coles.** Con rho negativos mejora los partidos bajos y
  los empates observados, pero degrada el rendimiento global y empeora la
  calibracion de draw por sobreprediccion.
- Si se retoma, estimar rho sobre un corpus mas amplio y out-of-sample en vez de
  elegirlo manualmente; incluir Mundiales 1998-2014 y ratings pre-torneo.
- Mantener `legacy-neutral` como baseline y prior8 como lider experimental de
  Brier, sin cambios productivos.

---

## ACTUALIZACION - sesion 20

### Feature flag y estado de modelos
- Nuevo registro canonico en `src/lib/stat-model/model-variant.ts`.
- Variantes seleccionables:
  - `legacy-neutral`: estado `production`, default y unica recomendada hoy;
  - `xg-v2.1-prior8`: estado `candidate`, disponible detras del flag;
  - `experimental-dixon-coles`: estado `experimental`, con
    `notRecommended: true`.
- Feature flag server-side: `STAT_MODEL_VARIANT`. Tambien puede pasarse
  `modelVariant` explicitamente a `buildScoreMatrixForMatch()` y
  `buildScoreMatricesByMatchId()`; la opcion explicita tiene precedencia.
- Un valor ausente o invalido falla cerrado a `legacy-neutral`.
- prior8 usa `attack_defense_v2`, `priorStrength=8`, sede neutral y no aplica
  Dixon-Coles. La variante DC experimental usa prior8 + rho `-0.15` solo para
  facilitar evaluacion; sigue expresamente no recomendada.
- No se modificaron UI, schema ni mercados.

### Confidence Score real
- Nuevo modulo puro `src/lib/stat-model/confidence-score.ts` con
  `calculatePredictionConfidence(input)`.
- Resultado:
  - `score` entero entre 0 y 100;
  - `label`: low `<45`, medium `45-69`, high `>=70`;
  - `drivers` positivos y `warnings` explicitos.
- Señales utilizadas sin leakage del resultado:
  - concentracion de probabilidades 1X2;
  - margen entre pick top y segunda opcion;
  - minimo de partidos observados de ambos equipos;
  - proporcion observada frente al peso del prior;
  - entropia normalizada de la score matrix;
  - warnings del modelo;
  - uno o dos ratings fallback;
  - contexto fuerte de fase de grupos.
- `match-prediction` conserva el campo compatible `confidence` y agrega
  `confidenceResult`, `modelVariant` y `modelVariantStatus`. Las antiguas
  funciones heuristicas exportadas se conservan por compatibilidad, pero el
  pipeline principal ya usa el score nuevo.

### Diagnostico de confidence
- Nuevo reporte reproducible `reports/confidence-diagnostic.md`, generado por
  `npm run diagnose:xg-v2`.
- Legacy neutral:
  - low: 18 partidos (14.1%), Accuracy `33.3%`, Brier `0.6710`, margen top-2
    `4.5%`;
  - medium: 65 (50.8%), Accuracy `49.2%`, Brier `0.6459`;
  - high: 45 (35.2%), Accuracy `53.3%`, Brier `0.6367`, margen `44.2%`.
- xG v2.1 prior8:
  - low: 24 (18.8%), Accuracy `45.8%`, Brier `0.6357`, margen `4.9%`;
  - medium: 98 (76.6%), Accuracy `55.1%`, Brier `0.6077`;
  - high: 6 (4.7%), Accuracy `100%`, Brier `0.3956`, margen `22.1%`.
- En ambos modelos la Accuracy no decrece al subir de bucket y low concentra
  probabilidades top/margenes menores. Es una señal favorable, no una prueba
  concluyente: high de prior8 solo tiene 6 partidos.

### Tests y limitaciones
- Tests cubren score `[0,100]`, aumento por probabilidades concentradas,
  penalizaciones por fallback, muestra corta y warnings, thresholds de labels,
  default Legacy, selección del candidate y fail-closed del flag.
- El score no es una probabilidad de acierto, no usa resultados reales y no
  reemplaza Brier/calibracion.
- Pesos y thresholds son heuristicas transparentes iniciales, todavía no
  calibradas contra varios Mundiales ni validadas out-of-sample.
- Coverage high pequeña, ratings 2026 retrospectivos y corpus de solo 2018/2022
  obligan a mantener prior8 como candidato, no como modelo productivo.
- Dixon-Coles no se promueve porque mejora empates/0-2 condicionados pero
  degrada global y agrava la sobreprediccion de draws.

---

## ACTUALIZACION - sesion 21

### Backtest historico ampliado
- Se agregaron fixtures completos de 1998, 2002, 2006, 2010 y 2014: 64
  partidos por Mundial, ademas de 2018 y 2022.
- Corpus total: **448 partidos**:
  - 336 de fase de grupos;
  - 112 eliminatorios;
  - 7 Mundiales completos.
- Cada fixture incluye `year`, `stage`, `round`, `group`, equipos, marcador,
  fecha/orden, `neutralVenue: true` y `scoreBasis: REGULATION_90`.
- Fuente: `openfootball/worldcup.json`, licencia CC0, commit
  `6d4a1b67e09ced583ecc02f5e900c69dd5ec5a2b`.
- Para knockout se usa `score.ft` a 90 minutos. La fuente separa `score.et` y
  penales, por lo que no fue necesario inferir resultados de prorroga.

### Arquitectura de rating snapshots
- Nuevo modulo `src/lib/stat-model/rating-snapshots.ts`.
- Estructura local/offline para 1998, 2002, 2006, 2010, 2014, 2018, 2022 y
  2026, con id, año, ratings, metodologia, fuente, licencia y version.
- Estado honesto de los datos:
  - 2026 contiene el seed manual actual;
  - 1998-2022 son placeholders year-scoped derivados de ese seed 2026;
  - todos declaran `isHistorical: false`;
  - todavía no se importaron Elo pre-torneo.
- El backtest resuelve por `ratingSnapshotYear`, no por un set global. Si falta
  el snapshot del año, construye un set vacio de fallback y todos los equipos
  reciben rating neutral explicito.
- Cobertura por Mundial reporta partidos con snapshot, partidos con fallback y
  equipos sin rating. Todos los torneos tienen 64 partidos con contenedor de
  snapshot; fallbacks por partido: 1998 `14`, 2002 `17`, 2006 `15`, 2010 `16`,
  2014 `13`, 2018 `13`, 2022 `3`.

### Resultados globales (448 partidos)
- legacy-neutral: Brier `0.6432`, Log Loss `1.0687`, RPS `0.2229`, Accuracy
  `46.0%`.
- xG v2.1 prior8: Brier `0.6130` (`-0.0302`), Log Loss `1.0248`
  (`-0.0439`), RPS `0.2087` (`-0.0142`), Accuracy `52.5%` (`+6.5 pp`).
- xG v2.1 prior6: Brier `0.6120` (`-0.0312`), Log Loss `1.0234`, RPS
  `0.2082`, Accuracy `52.2%`.
- experimental Dixon-Coles (prior8, rho -0.15): Brier `0.6131`, Log Loss
  `1.0226`, RPS `0.2087`, Accuracy `52.7%`.

### Estabilidad por Mundial
- Ganadores por menor Brier entre las cuatro variantes:
  - legacy-neutral: 0 Mundiales;
  - prior8: 1;
  - prior6: 3;
  - Dixon-Coles experimental: 3.
- prior8 mejora Brier frente a Legacy en los siete torneos. Mejor delta: 2022
  `-0.0703`; peor: 2002 `-0.0034`.
- Delta Brier medio por Mundial: prior8 `-0.0302`, prior6 `-0.0312`, DC
  `-0.0301`.
- prior8 mejora grupos (`-0.0363`) y knockout (`-0.0120`), pero empeora Round
  of 16 (`+0.0498`) y finales (`+0.0365`).
- En upsets reduce Brier (`-0.0428`) pero su Accuracy cae de `20.5%` a `0%`;
  sigue sin convertir al no favorito en pick top.

### Reporte, guardrails y recomendacion
- Nuevo reporte: `reports/world-cup-backtest-expanded.md`.
- Incluye Brier, Log Loss, RPS y Accuracy global, por Mundial, fase, ronda,
  favoritos claros, upsets, 0-2 goles y empates; tambien estabilidad y cobertura
  de snapshots/fallbacks.
- Guardrails mantienen probabilidades normalizadas, valores finitos, xG en
  `[0.2, 4.5]`, sede neutral y fallback explicito.
- **prior8 sigue como candidate, no default.** La mejora es consistente en
  agregado, pero prior6 queda marginalmente mejor, hay debilidad por ronda y
  el sesgo temporal de ratings no se resolvio: solo se preparo la arquitectura.
- `legacy-neutral` permanece default productivo.
- Dixon-Coles sigue `experimental/notRecommended`; sus victorias por torneo no
  compensan la evidencia previa de sobreprediccion de draws.
- Proximo paso antes de Monte Carlo: importar ratings pre-torneo verificables
  (Elo u otra fuente con licencia clara), marcar snapshots como historicos y
  repetir estabilidad/out-of-sample.

---

## ACTUALIZACION - sesion 22

### Snapshots pseudo-historicos normalizados
- Se reemplazaron los placeholders clonados desde 2026 por estimaciones
  manuales pseudo-historicas para 1998, 2002, 2006, 2010, 2014, 2018 y 2022.
- Cada snapshot contiene exactamente los 32 participantes de su Mundial y
  ratings `overall`, `attack` y `defense` normalizados en la misma escala del
  motor.
- Metadata:
  - `source: "manual-historical-estimate"`;
  - `methodology: "manual_historical_estimate"`;
  - `isHistorical: true` tanto en snapshot como en cada rating;
  - `version: "rating-snapshot-v2"`.
- Son estimaciones internas de tiers de fuerza pre-torneo y perfiles de juego;
  no usan resultados del partido evaluado, no dependen de red y no requieren
  licencia externa. No deben presentarse como Elo, FIFA ranking ni fuente
  oficial independiente.
- El snapshot 2026 conserva el seed manual actual con `isHistorical: false`.
- Cobertura 1998-2022: 448/448 partidos con snapshot, 0 partidos con fallback y
  0 equipos sin rating. El camino de fallback ausente sigue cubierto por tests.

### Resultados con ratings pseudo-historicos (448 partidos)
- legacy-neutral: Brier `0.6359`, Log Loss `1.0576`, RPS `0.2193`, Accuracy
  `47.5%`.
- prior8: Brier `0.6000` (`-0.0359`), Log Loss `1.0075` (`-0.0501`), RPS
  `0.2024` (`-0.0169`), Accuracy `56.0%` (`+8.5 pp`).
- prior6: Brier `0.5992` (`-0.0367`), Log Loss `1.0064`, RPS `0.2021`,
  Accuracy `55.1%` (`+7.6 pp`).
- Dixon-Coles experimental: Brier `0.6000`, Log Loss `1.0046`, RPS `0.2024`,
  Accuracy `56.0%`; permanece `experimental/notRecommended`.
- Grupos: prior8 Brier `-0.0437`; eliminatorias: `-0.0127` frente a Legacy.
- prior8 sigue mejorando Brier frente a Legacy en los siete Mundiales. Mejor
  delta: 2022 `-0.0673`; peor: 2002 `-0.0090`.

### prior6 vs prior8
- prior6 obtiene menor Brier en 6 de 7 Mundiales; prior8 en 1 de 7.
- Delta Brier pareado medio `prior6 - prior8`: `-0.0008`.
- Error estandar `0.0004`; IC95% aproximado `[-0.0016, +0.0001]`.
- El intervalo incluye cero: la ventaja Brier de prior6 es **marginal/no
  distinguible** en este corpus, no estadisticamente clara bajo esta
  aproximacion normal pareada.
- prior8 conserva mejor Accuracy global por `+0.9 pp` frente a prior6.

### Recomendacion actualizada
- `legacy-neutral` sigue como default productivo.
- prior8 sigue como candidate: mejora las cuatro metricas contra Legacy y gana
  Brier en los siete Mundiales, pero los ratings siguen siendo estimaciones
  manuales y no una fuente histórica independiente.
- No cambiar a prior6: su ventaja Brier es demasiado pequeña y no distinguible,
  mientras prior8 mantiene mejor Accuracy.
- No promover Dixon-Coles pese a ganar 3 Mundiales por Brier dentro de estas
  cuatro variantes; persisten sus problemas de calibracion global de draws.
- Antes de Monte Carlo o promocion: sustituir las estimaciones manuales por una
  serie Elo/ranking pre-torneo con licencia y metodología verificables, y
  repetir evaluación out-of-sample/bootstrap.

---

## ACTUALIZACION - calibracion formal por mercado

### Implementacion
- Se incorporo Platt Scaling 1X2: cada probabilidad `p` se transforma con
  `sigmoid(a * logit(p) + b)` y luego home/draw/away se renormalizan a 1.
- Hay clamps numericos para `p=0/1`, validacion de finitud/rango y metadata con
  probabilidades raw, valores calibrados antes de normalizar y factor de
  normalizacion.
- Los tipos y presets admiten `over25` y `btts`, pero no se ajustaron porque el
  backtest historico disponible tiene targets completos solo para 1X2.
- `STAT_MODEL_CALIBRATION=none | experimental-platt`; ausencia o valor invalido
  cae a `none`. El preset experimental solo se aplica a `xg-v2.1-prior8`.
- No se modificaron UI, schema ni mercados. No se implemento Monte Carlo.

### Estado y parametros
- `none` es identity/no-op y continua como default productivo.
- `experimental-platt` es un preset manual versionado desde el ajuste del corpus
  completo 1998-2022; sigue marcado experimental, no es promocionable todavia.
- Parametros `(a, b)`: homeWin `(3.5497, 1.0475)`, draw
  `(10.1698, 10.0091)`, awayWin `(3.3941, 1.1929)`.

### Diagnostico (448 partidos)
- prior8 raw: Brier `0.6000`, Log Loss `1.0075`, RPS `0.2024`, Accuracy `56.0%`.
- prior8 calibrado in-sample: Brier `0.5503`, Log Loss `0.9293`, RPS `0.1801`,
  Accuracy `56.0%`.
- Leave-one-world-cup-out agregado: Brier `0.6000 -> 0.5535`, Log Loss
  `1.0075 -> 0.9374`, RPS `0.2024 -> 0.1811`, Accuracy `56.0% -> 54.7%`.
- La calibracion mejora las metricas probabilisticas LOOWC, pero reduce Accuracy
  `1.3 pp`; en 2022 mejora Brier/RPS pero empeora ligeramente Log Loss.
- Tasa de empate prior8 raw/calibrada/real: `25.2% / 26.7% / 26.8%`.
- Probabilidad media del favorito raw/calibrada y frecuencia real:
  `44.2% / 56.2% / 55.9%`.
- Reporte reproducible: `reports/calibration-diagnostic.md` con buckets 0-100%,
  parametros por fold y guardrails.

### Recomendacion y proximos pasos
- Mantener `legacy-neutral` y calibracion `none` como defaults.
- Usar Platt solamente como experimento asociado a prior8 y decidir cualquier
  promocion por validacion temporal/out-of-sample, no por el fit global.
- Versionar un pipeline de entrenamiento, reemplazar ratings pseudo-historicos
  por una fuente independiente y medir estabilidad de coeficientes/bootstrap.
- Despues, evaluar Monte Carlo como mecanismo de simulacion/distribucion; no
  mezclarlo con el ajuste de calibracion ni crear mercados nuevos en esa fase.

---

## ACTUALIZACION - auditoria Platt previa a Monte Carlo

### Leakage y metodologia
- La comparacion principal ahora es estrictamente leave-one-world-cup-out:
  cada Mundial se evalua con parametros aprendidos solo en los otros seis.
- Auditoria automatica: 0 fixtures compartidos entre train/test, 0 predicciones
  OOF ausentes, 0 duplicadas y 448/448 partidos evaluados una vez por modelo.
- El backtest construye stats/standings cronologicamente y agrega el resultado
  solo despues de emitir la prediccion. No se detecto leakage directo de target.
- Caveat: los ratings siguen siendo estimaciones manuales pseudo-historicas.
  Esto no contamina el fit Platt con el Mundial excluido, pero tampoco demuestra
  independencia completa del proceso de features. Se requiere fuente externa.

### Comparacion LOOWC
- prior8 raw/calibrado: Brier `0.6000 -> 0.5535`, Log Loss
  `1.0075 -> 0.9374`, RPS `0.2024 -> 0.1811`, Accuracy `56.0% -> 54.7%`.
- Legacy raw/calibrado diagnostico: Brier `0.6359 -> 0.6336`, Log Loss
  `1.0576 -> 1.0539`, RPS `0.2193 -> 0.2183`, Accuracy `47.5% -> 46.9%`.
- No existe preset productivo Legacy calibrado; es solo un contrafactual.
- Los parametros `(a,b)` por modelo, mercado y fold estan en
  `reports/calibration-diagnostic.md`. Draw prior8 es el menos estable, con
  pendientes por fold entre `8.6372` y `12.5877`.

### Mecanismo y segmentos
- La mejora prior8 viene principalmente de corregir subconfianza/compresion:
  probabilidad media del favorito `44.2% raw -> 56.2% calibrada`, frente a
  `55.9%` real. No viene de reducir sobreconfianza raw.
- Draw rate: `25.2% -> 26.7%`, frente a `26.8%` real; ayuda, pero es secundario.
- Favoritos claros (301): Brier `0.5677 -> 0.5029`, Accuracy
  `64.1% -> 63.8%`.
- Upsets claros (35): Brier `0.7778 -> 1.2184`, Log Loss
  `1.2398 -> 2.1537`. Es el principal riesgo: la distribucion mas extrema
  castiga mucho cuando gana el underdog.
- Grupos: Brier `0.5914 -> 0.5412`; eliminatorias `0.6259 -> 0.5902`.
- Partidos de 0-2 goles: Brier `0.6473 -> 0.6199`; Accuracy
  `46.1% -> 46.5%`.
- Empates reales: Log Loss mejora `1.3686 -> 1.2784`, pero Brier queda casi
  igual (`0.8421 -> 0.8447`) y RPS empeora; no hay mejora uniforme en draws.

### High confidence y reliability
- Cohorte prior8 raw con max 1X2 >=50%: 58 partidos, Accuracy `86.2%` antes y
  despues, retencion de pick `100%`. No se destruyen los picks fuertes actuales.
- Cohorte calibrada >=70%: 87 partidos, Accuracy `81.6%`; es prometedora pero el
  umbral surge tras calibrar y debe validarse en mas historia.
- `reports/calibration-reliability.json` contiene las cuatro series OOF, buckets
  0-10% a 90-100%, probabilidad media, frecuencia observada y count. Cada serie
  contiene exactamente 1.344 observaciones binarias (448 x tres outcomes).

### Decision
- Mantener `legacy-neutral` y `STAT_MODEL_CALIBRATION=none` como defaults.
- No usar todavia Platt como base productiva de Monte Carlo. La mejora promedio
  OOF es real dentro de este corpus, pero la penalizacion de upsets, la
  inestabilidad de draw y los ratings manuales requieren otra ronda de datos y
  validacion temporal antes de simular escenarios.

---

## ACTUALIZACION - calibracion conservadora

### Variantes evaluadas (LOOWC)
- Se agregaron estrategias post-Platt puras: blends `25/50/75%`, condicion raw
  top `<65%` y limite de boost del favorito raw a `+8 pp`. Todas preservan suma
  1X2, rango y metadata; solo se habilitan explicitamente con prior8.
- prior8 raw: Brier `0.6000`, Log Loss `1.0075`, RPS `0.2024`, Accuracy `56.0%`.
- Platt full: `0.5535 / 0.9374 / 0.1811 / 54.7%`; Log Loss upsets `2.1537`.
- blend-25: `0.5792 / 0.9774 / 0.1929 / 56.9%`; Log Loss upsets `1.3928`.
- blend-50: `0.5646 / 0.9546 / 0.1862 / 56.7%`; Log Loss upsets `1.5771`.
- blend-75: `0.5560 / 0.9399 / 0.1823 / 56.0%`; Log Loss upsets `1.8119`.
- favorite-cap-65 coincide con Platt full: prior8 raw no tiene top picks >=65%,
  por lo que la condicion nunca corta el ajuste en este corpus.
- favorite-max-boost-08: Brier `0.5706`, Log Loss `0.9595`, RPS `0.1864`,
  Accuracy `54.7%`; sube draw medio a `31.1%` y no controla bien los upsets.

### Regla y decision
- Regla: mejorar las tres metricas probabilisticas; deterioro de Log Loss en
  upsets <=15%; Accuracy no menor a raw por mas de 1 pp; favorito claro no
  sobreestimado por mas de 3 pp.
- Solo `platt-blend-25` pasa: mejora todas las metricas globales, Accuracy sube
  `+0.9 pp` y el costo de upsets queda en `+12.3%` (`1.2398 -> 1.3928`).
- Queda marcado como **candidate experimental**, no como default. Aun deja a
  favoritos claros subestimados, pero reduce el problema principal sin perder
  capacidad de ranking.
- Defaults permanecen `legacy-neutral` y `STAT_MODEL_CALIBRATION=none`.
- No iniciar Monte Carlo todavia: validar blend-25 con ratings historicos
  independientes y mas ventanas temporales antes de usarlo como distribucion
  base de simulacion.

---

## ACTUALIZACION - Monte Carlo de fase de grupos v1

### Implementacion
- Nuevo motor puro en `src/lib/tournament/group-simulation.ts`, exportado desde
  `src/lib/tournament/index.ts`.
- Recibe grupo, cuatro equipos, partidos jugados/restantes, numero de
  simulaciones, variante, calibracion y seed opcionales.
- Los stats se reconstruyen solo desde partidos terminados. Para cada partido
  restante se reutiliza el motor de xG/matriz de marcador existente.
- Si hay calibracion 1X2, primero se muestrea home/draw/away con esas
  probabilidades y despues un marcador condicionado a ese outcome desde la
  matriz Poisson. Asi `platt-blend-25` afecta resultados sin inventar una nueva
  distribucion de goles ni un mercado.
- Las matrices se calculan una vez desde el estado real actual y se reutilizan
  en todas las iteraciones. Los resultados simulados actualizan la tabla, pero
  no reentrenan xG ni recalculan partidos posteriores.
- PRNG deterministico con seed; seed default `20260611`. Misma entrada y seed
  producen exactamente el mismo output.

### Tabla y output
- Cada simulacion actualiza puntos, GF, GC, diferencia, victorias, empates y
  derrotas para los partidos restantes, partiendo de los resultados jugados.
- Orden simplificado: puntos, diferencia de gol, goles a favor y fallback
  deterministico derivado de `seed + teamId`.
- Por equipo: puntos esperados, probabilidad de avanzar/ganar grupo/terminar
  2o/3o/4o, y promedios de diferencia, GF y GC.
- Output global: groupId, simulaciones, variante/calibracion efectivas, seed,
  warnings y version `group-monte-carlo-v1`.
- Un grupo terminado devuelve posiciones y acumulados deterministas sin
  importar cuantas simulaciones se soliciten.

### Uso y validacion
- Ejecutar `npm run verify:group-simulation`.
- El ejemplo usa 10.000 simulaciones con
  `xg-v2.1-prior8 + platt-blend-25` y valida suma de posiciones por equipo,
  exactamente dos clasificados esperados, ausencia de NaN, seed reproducible,
  equipo con seis puntos y grupo terminado.
- Defaults del motor y del producto permanecen `legacy-neutral + none`; la
  configuracion experimental debe solicitarse explicitamente.

### Limitaciones y siguientes pasos
- Solo grupos de cuatro equipos; no hay bracket, mejores terceros ni cruces.
- Desempate FIFA simplificado: faltan enfrentamientos directos, fair play y
  sorteo oficial. El fallback seeded solo garantiza reproducibilidad.
- No modela lesiones, alineaciones, correlacion entre partidos ni actualizacion
  dinamica de fuerza dentro de una trayectoria simulada.
- Siguiente paso: validar Monte Carlo contra torneos historicos completos;
  despues implementar reglas oficiales de terceros/desempate y, recien luego,
  un motor de bracket separado. No exponer en UI hasta cerrar esas validaciones.

---

## ACTUALIZACION - service/adapter de simulacion de grupos

### Que hace
- `src/lib/tournament/group-simulation-service.ts` expone
  `simulateGroupFromSchedule(input)` como frontera estable entre datos de
  calendario y el motor Monte Carlo.
- Recibe `groupId`, cuatro equipos, un unico array de partidos, simulaciones,
  seed y flags opcionales. Normaliza joins, valida pertenencia al grupo y
  separa partidos terminados/restantes por `status` antes de llamar a
  `simulateGroup`.
- Devuelve metadata lista para consumo: configuracion efectiva, seed,
  `generatedAt`, warnings, versiones y `standings` ordenado por probabilidad de
  avanzar, ganar grupo, puntos esperados y codigo como fallback estable.
- Helpers publicos: `normalizeGroupMatch`,
  `splitPlayedAndRemainingMatches` y `validateGroupSimulationInput`.

### Engine vs service
- **Engine (`group-simulation.ts`)**: matematica y Monte Carlo. Exige datos ya
  separados, construye matrices, muestrea marcadores y acumula posiciones.
- **Service (`group-simulation-service.ts`)**: adaptacion/validacion. Trabaja
  con el schedule crudo, resuelve equipos por id, genera warnings recuperables
  y forma el read model que una UI futura puede consumir.
- Ambos son puros respecto de persistencia: no leen Supabase, no escriben
  schema y no dependen de componentes React.

### Validaciones y warnings
- Falla temprano ante grupo distinto de cuatro equipos, ids duplicados,
  partidos de otro grupo/equipos ausentes, seed/simulaciones no finitos o
  partidos terminados sin marcador valido.
- Los pendientes no requieren marcador. Scores opcionales, si existen, deben
  ser enteros no negativos; partidos live se simulan completos y lo advierten.
- Emite warnings por joins ausentes resueltos por id, metadata de grupo ausente,
  menos de seis cruces unicos y limitaciones heredadas del engine/modelo.
- Valida que el output no contenga NaN/Infinity.

### Como verificar
- `npm run verify:group-simulation-service` construye un grupo demo, llama al
  service, imprime standings y comprueba reproducibilidad, suma de avance igual
  a 2, posiciones 1-4 iguales a 1 por equipo, warnings y errores controlados.
- El verificador del engine sigue separado en
  `npm run verify:group-simulation`.

### Limitaciones y proximo paso
- Mantiene las limitaciones de Monte Carlo v1: cuatro equipos, desempate FIFA
  simplificado, sin mejores terceros/bracket y sin recalculo dinamico de xG.
- No interpreta un marcador live como estado parcial; lo trata como partido
  pendiente completo con warning.
- Proximo paso recomendado: crear un componente UI de grupos que consuma este
  read model, sin duplicar logica de separacion/orden y manteniendo inicialmente
  la metadata de modelo efectiva visible para auditoria.

### Default especifico del service de simulacion
- El default **global/productivo** no cambia: `model-variant.ts` conserva
  `legacy-neutral` y la calibracion global conserva `none` como fallback.
- Solo `simulateGroupFromSchedule` aplica por defecto el modelo recomendado para
  simulaciones cuando ambos flags se omiten:
  `xg-v2.1-prior8 + platt-blend-25`.
- Un override explicito se respeta. `legacy-neutral + none` sigue disponible y
  se valida en `verify:group-simulation-service`. Si se especifica Legacy sin
  calibracion, el service completa coherentemente con `none`.
- El output expone `modelVariant`, `calibration`,
  `usesRecommendedSimulationModel` y `modelSelection`; tambien agrega un warning
  con la configuracion efectiva para que una UI futura pueda mostrarla.
- Dixon-Coles esta prohibido en este service y produce error controlado; no se
  usa como default, fallback ni alternativa Monte Carlo.

---

## ACTUALIZACION - primera UI Monte Carlo de grupos

### Ubicacion y componente
- Nuevo componente presentacional
  `src/components/group-simulation-card.tsx` integrado en `/stat-model`, antes
  de las tarjetas de partidos del modelo.
- Recibe directamente `GroupSimulationServiceResult`; no importa el engine, no
  calcula matrices ni ejecuta simulaciones.
- Muestra grupo, numero de simulaciones, modelo/calibracion efectivos, origen
  de seleccion, warnings desplegables y tabla responsive con puntos esperados,
  clasificacion y probabilidades de posiciones 1-4.
- Incluye estado vacio y prop `preview` para mostrar badge/aviso visible.

### Datos mostrados
- La primera integracion usa exclusivamente
  `src/lib/tournament/group-simulation-demo.ts`: fixture aislado de cuatro
  equipos y seis cruces, con dos resultados ilustrativos.
- Esta marcado **Demo / Preview** y declara que no representa grupos ni datos
  productivos reales del Mundial 2026. No se mezcla con `getMatches()` ni con
  datos persistidos.
- El helper llama al service sin overrides, por lo que la tarjeta muestra el
  default local recomendado: `xg-v2.1-prior8 + platt-blend-25` y
  `recommended-simulation-default`. El default global sigue Legacy + none.

### Responsive y limitaciones
- La tabla usa el componente UI existente y scroll horizontal en mobile; badges,
  porcentajes y valores usan estilos/tipografia tabular consistentes con la app.
- `Gana grupo` y `1.o` muestran hoy la misma probabilidad del contrato del
  engine; ambas columnas se conservan para expresar los dos conceptos pedidos.
- Sigue siendo una preview sincronica: no hay selector de grupo, controles de
  simulaciones, loading interactivo, cache ni conexion a calendario real.
- Warnings del modelo se presentan colapsados para no dominar la pantalla.

### Proximo paso recomendado
- Reemplazar el helper demo por un adapter de repositorio que agrupe los
  fixtures reales por `groupId` y entregue cada schedule al service; despues
  agregar selector de grupo y estados loading/error sin replicar matematica en
  React. Mantener la etiqueta Preview hasta validar el calendario real completo.
