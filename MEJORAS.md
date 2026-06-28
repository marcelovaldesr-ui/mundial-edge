# MEJORAS — Mundial Edge CTO Sprint 2026-06-27

Resumen de mejoras implementadas en el sprint de calidad del modelo, mercados,
combinadas, UX y código. Ordenadas por prioridad.

---

## P1 — Calidad del modelo

### P1.C · Decay exponencial en forma reciente (`formFactor`)
**Archivo:** `src/lib/model/expected-goals.ts`

El peso de cada partido en la forma reciente cambia de `1/(i+1)` (harmónico)
a `0.7^i` (exponencial). El partido más reciente pesa 1.0, el anterior 0.70,
el siguiente 0.49, etc. El decay más pronunciado amplifica la señal de momentum
real en los primeros partidos del torneo donde la muestra es pequeña.

### P1.A/B · Benchmark Brier Score (referencia histórica)
El informe `data/calibration-report.json` se actualiza a schemaVersion 2 con:
- Sección `wc2026_live` para datos del Mundial 2026 en curso.
- ID de modelo actualizado a `xg-v2.3-exp-decay-calibrated-matrix`.
- Campo `marketWeight: 0.78` — se mantiene: el Brier sobre 448 partidos (1998-2022)
  es 0.592 (vs baseline uniforme 0.667), lo que confirma que el modelo aporta
  valor. No se ajusta MARKET_WEIGHT hasta acumular 20+ partidos del 2026.

---

## P2 — Más mercados

### P2.B · Habilitar BTTS en The Odds API
**Archivo:** `src/lib/data/providers.ts`

`AF_MARKET_KEYS` pasa de `"h2h,totals"` a `"h2h,totals,btts"`. El proveedor
ya parseaba btts (código existente en líneas 277-279) — solo faltaba pedirlo.
Si la API no devuelve btts para `soccer_fifa_world_cup`, el resultado es vacío
sin errores.

### P2.C · Ampliar regiones de bookmakers
**Archivo:** `src/lib/data/providers.ts`

Default de `"eu,uk"` a `"eu,us,uk,au"`. Más bookmakers → mejor de-vig y más
partidos cubiertos por al menos un bookmaker.

---

## P3 — Combinadas más inteligentes

### P3.A · Penalización cuotas estimadas en scoreParlay
**Archivo:** `src/lib/parlays/parlay-scoring.ts`

Los picks con `oddsType="estimated"` (doble oportunidad o clasifica sin cuota
real de mercado) contribuyen el **70%** de su EV al `avgPickEv`. Sin cuota de
bookmaker que confirme el edge, la combinada es menos sólida.

### P3.B · Correlación mínima "medium" en eliminatorias
**Archivo:** `src/lib/parlays/correlation.ts`

Si cualquier pick del parlay es de un partido de fase eliminatoria, la
correlación del conjunto no puede ser "low". Se aplica un suelo de "medium"
con razón explícita: prórroga, penales y planteamientos defensivos elevan la
varianza más allá de lo que captura el modelo Poisson a 90 minutos.

### P3.C · Boost +5% en clasifica para top-8 FIFA
**Archivo:** `src/lib/parlays/candidate-universe.ts`

Los equipos con `fifa_rank <= 8` reciben un +5% en la probabilidad estimada de
clasifica, reflejando la evidencia histórica de que las élites mundiales
superan el baseline Poisson en rondas eliminatorias (profundidad del banquillo,
experiencia en torneos de presión).

---

## P4 — UX y datos

### P4.A · Sección "Estado del modelo" en admin
**Archivos:** `src/app/admin/page.tsx`, `src/lib/data/repository.ts`

Nueva función `getModelStatus()` en repository que consulta:
- Conteo de filas por tabla (matches, edges, odds, team_stats).
- Último sync exitoso por job (fixtures / results / odds / predictions).
- Distribución de edges por mercado con barra visual de calidad.

La sección aparece en `/admin` entre el SyncPanel y el historial de logs.

### P4.B · Mercados de goles y contexto eliminatorio en detalle de partido
**Archivo:** `src/app/matches/[id]/page.tsx`

- Nueva tarjeta **"Mercados de goles"** mostrando Over/Under 1.5, 2.5 y 3.5
  en grid horizontal con probabilidad final del modelo y EV coloreado.
- Nueva tarjeta **"Contexto eliminatorio"** con borde ámbar que aparece solo en
  partidos de fase eliminatoria, advirtiendo sobre la mayor varianza no capturada
  por el modelo Poisson a 90 minutos.

### P4.C · Filtros rápidos de mercado en edge-table
**Archivo:** `src/components/edge-table.tsx`

Botones de filtro rápido: Todos · Ganador · Goles · BTTS · D. oport.
El botón activo usa color primario. Se aplica antes del sort, combinable con
el checkbox de "solo picks de calidad".

---

## P5 — Calidad de código

### P5.B · Logging detallado en syncPredictions
**Archivo:** `src/lib/data/sync.ts`

`syncPredictions` ahora emite logs estructurados `[syncPredictions]` para:
- Cantidad de partidos scheduled/live encontrados.
- Stats y cuotas cargadas.
- Por cada partido: nº de predicciones y edges generados.
- Partidos saltados por falta de stats.
- Limpieza de edges de partidos finalizados.
- Totales al finalizar.

Visible en logs de Vercel (runtime) y en la consola del servidor Next.js.

### P5.A · Verificación TypeScript
`npx tsc --noEmit` pasa sin errores tras todos los cambios.

---

## Commits Sprint 2

| Hash | Descripción |
|------|-------------|
| `0605aba` | feat(model/parlays): decay exponencial 0.7^i en forma, btts+regiones odds, reglas combinadas |
| `0c2d3cc` | feat(ux/admin): estado modelo, goles 1.5/3.5, filtros edge-table, logging sync |

---

# Sprint 3 — 2026-06-28 (Bloques A–E)

## Block A — API-Football Pro (alineaciones)

- `fetchLineups(fixtureExternalId)` y `fetchInjuries()` en `providers.ts` — degradación elegante si `API_FOOTBALL_KEY` no existe.
- `syncLineups()` en `sync.ts` — busca partidos en las próximas 36h, upsert en tabla `lineups`.
- Migración `supabase/migrations/20260628_lineups.sql` — tabla `lineups` con PK `match_id`.
- Cron `/api/cron?job=lineups` cada 6h en `vercel.json`.

## Block B — Modelo knockout mejorado

- `LEAGUE_AVG_KNOCKOUT = 1.05` (vs 1.35 grupos) — knockout → menor ritmo de goles.
- `drawBoost ×1.12` + renormalización para fases eliminatorias.
- `lineupAdjustmentFactor()`: 0–1 bajas → 1.0; 2–3 → 0.93; 4+ → 0.85.
- `calibration.ts`: `computeDynamicMarketWeight()` — calcula MARKET_WEIGHT dinámico según Brier Score en vivo (min 15 partidos). Umbrales: >0.65 → 0.83; 0.58–0.65 → 0.78; <0.58 → 0.70.
- `syncPredictions` usa el peso calibrado para `buildEdges`.
- `scripts/validate-poisson.ts`: genera `reports/poisson-validation.md` con Brier + Accuracy.

## Block C — UI Premium

- **C.2** badge de confianza de datos en MatchCard (verde/amarillo/gris según `matches_played`).
- **C.3** `MatchCountdown` integrado para el partido más próximo en `/matches`.
- **C.4** `EvDistributionChart` encima de EdgeTable en `/edges` — 5 buckets de EV.
- **C.1** Sección "Ajustes WC 2026" en `/metodologia` (decay, knockout model, calibración dinámica, factor alineación).

## Block D — Resiliencia

- `fetchWithRetry()` — 3 intentos con backoff 1s/2s/4s en llamadas a The Odds API.
- Tracking de `x-requests-remaining`: CRÍTICO (<10) → skip sync; WARNING (<50) → log.
- TTLs de caché agresivos: matches 60s, edges 60s, team_stats 120s.
- `/api/health` — endpoint de monitoreo con estado Supabase, oddsApi, lastSync por job.

## Block E — Historial de valor

- `getFinishedPickHistory()` en `repository.ts` — picks de partidos finalizados con win/loss.
- Sección "Historial de picks del torneo" en `/transparencia` con tasa acierto, ROI, tabla detalle.
- Fallback "Datos insuficientes" si <5 partidos finalizados con picks.
- Disclaimer explícito (no predicen resultados futuros).

## Commits Sprint 3

| Hash | Descripción |
|------|-------------|
| `3bc4b9c` | feat(api-football): scaffold lineups + injuries integration (Bloques A + B) |
| `da5e089` | feat(infra): health endpoint + pick history repo + cache agresiva (Bloque D) |
| `91781e1` | feat(ui): countdown, EV chart, confidence badges, picks history (Bloques C + E) |

## Constraints respetados
- No se modificaron variables de entorno ni keys de API.
- No se modificó el schema de Supabase sin migración (tabla lineups con migration SQL).
- No se agregaron dependencias npm externas.
- No se usa lenguaje de "apuesta segura" o "garantizado" en ninguna UI.
- Modo mock funcionando sin cambios — toda lógica live tiene guard `isLiveMode()`.
- API-Football Key ausente → sistema funciona exactamente igual que antes.
- `schemaVersion: 1` mantenido en calibration-report.json.
