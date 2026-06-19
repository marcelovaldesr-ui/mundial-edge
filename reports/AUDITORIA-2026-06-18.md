# Auditoría Mundial Edge — 18 jun 2026 (Mundial en marcha)

> Auditoría de estado y plan de acción. Proyecto auditado: `C:\Users\marce\mundial-edge`
> (la copia en OneDrive `…\Tipster\mundial-edge` es un snapshot viejo del 16-jun, MVP poisson-v1; **no usarla**).

---

## 0. Estado general

**OK con reservas operativas.** El código real coincide con la descripción del Sprint 10 (a diferencia de la copia en OneDrive). La base técnica es sólida y defendible:

- `tsc --noEmit` pasa con **0 errores**.
- Tests de torneo (`best-third-places`) en verde.
- 8 páginas presentes en el nav: Dashboard, Partidos, Edges, Combinadas, Modelo, Transparencia, Metodología, Admin.
- La simulación **fija correctamente los partidos jugados** y solo simula los restantes (diseño correcto).
- Lenguaje responsable y disclaimers en su sitio.

El problema **no es el código, es la operación de datos en vivo**: con el Mundial ya en jornada 2 de grupos (18-jun), la prioridad es confirmar que los resultados reales estén sincronizados y que la configuración de producción active el modelo recomendado. No pude verificar Supabase desde el entorno de auditoría (red no habilitada hacia el proyecto; HTTP 000), así que los puntos de datos en vivo deben confirmarse desde `/admin` o el panel de Supabase.

---

## 1. Hallazgos críticos (bloquean "predicciones fiables ahora")

### C1 — No se puede confirmar que los resultados reales del Mundial estén cargados
Todo el flujo depende de que el cron `syncResults` (football-data.org) haya corrido. Si no corrió, los grupos caen a **fallback sintético**: `source: "local-fallback"`, `dataStatus: "demo"/"preview"`, con "equipos por confirmar". El propio CHANGELOG lo admite:

> *"El repositorio todavía conserva grupos fallback con plazas por confirmar… debe reemplazarse por el fixture oficial sincronizado antes de presentar equipos/grupos como definitivos."*

**Cómo verificar:** abrir `/stat-model` y confirmar que cada grupo muestra badge **"Datos actuales"** (no "Demo"/"Preview"). En Supabase, `sync_logs` debe tener `results` reciente con ≥ partidos finalizados reales.

### C2 — El modelo recomendado no está activo por configuración (fail-closed a legacy)
`DEFAULT_STAT_MODEL_VARIANT = "legacy-neutral"`. `.env.local` **no define** `STAT_MODEL_VARIANT` ni `CALIBRATION_TEMPERATURE`. Cualquier consumidor que lea el flag de entorno usará **legacy-neutral**, no `calibrated-matrix T=0.65`.

Matiz importante: las páginas clave (`/edges`, `/stat-model`, dashboard) **fuerzan** `getRecommendedPredictionConfig()`, así que la UI sí muestra calibrated-matrix. La simulación de grupos también usa el modelo recomendado por defecto. Aun así, **falta declarar la variable en Vercel** para cerrar el gap y evitar que cualquier ruta futura caiga a legacy silenciosamente.

### C3 — Doble motor: el cron persiste con el motor legacy, la UI recalcula
`syncPredictions` escribe `predictions`/`edges` en Supabase usando el motor **legacy `poisson-v1`** (`@/lib/model/engine`). En lectura, la UI **ignora** ese `model_probability` legacy y recalcula con `decorateEdgesWithFinalProbability` (blend anclado al mercado + stat-model calibrado). Consecuencia: la columna `edges.model_probability`/`predictions` en Supabase es **dato muerto y engañoso** (el `MODEL_VERSION` guardado no es el que se muestra). De la tabla persistida solo se usan de verdad `decimal_odds` e `implied_probability`. No es visible para el usuario, pero es deuda técnica y fuente de confusión.

---

## 2. Hallazgos importantes

### I1 — No hay actualización dinámica de ratings (Elo) con resultados 2026
No existe `elo-updater.ts`. Los ratings 2026 son un **seed manual estático** (`current_2026_manual_seed`). La única adaptación al torneo viene de `team_stats` (recalculado en cada `syncResults`). Con 1–2 partidos jugados, el peso de stats reales es bajo (`lowStats < 2` → peso 0.02–0.08), así que las predicciones siguen dominadas por el seed manual + mercado. Es defendible (evita sobre-reaccionar), pero hay que comunicarlo y subir el peso de stats reales a medida que avanza el torneo.

### I2 — Edges fuertemente ancladas al mercado (decisión de producto, no bug)
`decorateEdgesWithFinalProbability` da **56% de peso al mercado** y clampa la probabilidad final a **±0.12** alrededor de la implícita. Esto reduce los edges grandes — coherente con la filosofía responsable, pero el "Ranking de Edges" mostrará pocos/pequeños edges. Verificar que no quede vacío con datos reales.

### I3 — Matching de cuotas frágil por nombre de equipo
Las cuotas (the-odds-api) se emparejan con partidos (football-data) por nombre normalizado (`normTeam`/`TEAM_ALIASES`). Si no emparejan → tabla `edges` vacía → `/edges` y dashboard sin oportunidades. Además the-odds-api: 500 créditos/mes y **no soporta btts**.

### I4 — Rendimiento de la simulación en cada request
`/stat-model` corre Monte Carlo de 12 grupos × `SIMULATION_ITERATIONS` (10.000) en **cada** request (`force-dynamic`, sin cache). Bajo tráfico puede ser lento y costoso.

### I5 — Bracket de eliminatorias y campeón: no implementados
Existe `best-third-places` (define los 32 clasificados, con test verde), pero **no** hay cruce R32→final ni probabilidad de campeón. El usuario los pide como prioridad.

### I6 — Seguridad de `/admin` y secreto de cron
`CRON_SECRET` ausente de `.env.local`. Confirmar que `/admin` proteja la vista, no solo el secret de los jobs.

---

## 3. Lo que está bien (no tocar)

- Resolución de variantes con **fail-closed** bien diseñada (`resolveStatModelVariant`).
- Simulación que **siembra la tabla con resultados jugados** y solo simula lo pendiente.
- `best-third-places`: invariante de 32 clasificados, desempate sembrado reproducible.
- Backtesting de 7 mundiales (448 partidos), transparencia pública, metodología, reliability diagram.
- Capa de datos con fallback mock seguro y caché de lecturas live.

---

## 4. Plan priorizado

### HOY (operación en vivo)
1. **Forzar y verificar el sync real.** `/admin` → pegar `CRON_SECRET` → ejecutar en orden `fixtures → results → odds → predictions`. Confirmar en `sync_logs`: `results` con los finalizados reales y `odds` con "emparejadas X / sin partido Y". Validar que `/stat-model` muestre **"Datos actuales"** en los grupos (no "Demo").
2. **Configurar variables en Vercel** y redeploy: `DATA_MODE=live`, `STAT_MODEL_VARIANT=calibrated-matrix`, `CALIBRATION_TEMPERATURE=0.65`, `SIMULATION_ITERATIONS=3000` (latencia), `CRON_SECRET`, claves Supabase y de proveedores.
3. **Subir la frecuencia del cron.** `vercel.json` tiene 1 cron diario (`0 4 * * *`) — insuficiente con partidos varias veces al día. Usar el GitHub Action cada 2h que ya existe (o Vercel Pro), priorizando `?job=results` y `?job=odds`.

### ESTA SEMANA
4. **Unificar motor (C3):** que `syncPredictions` use el stat-model calibrado, o dejar de persistir `model_probability` legacy y documentar que la probabilidad final se calcula en lectura. Elimina dato muerto.
5. **Endurecer matching de cuotas (I3):** ampliar `TEAM_ALIASES` y exponer en `/admin` el conteo emparejadas/sin-match.
6. **Cachear la simulación Monte Carlo (I4):** `revalidate` por algunos minutos.
7. **Subir peso de stats reales (I1)** conforme avanza el torneo; reflejarlo en metodología.

### PRÓXIMOS DÍAS — Bracket + campeón (MVP viable, ~1–2 días)
8. Reutilizar `selectBestThirdPlacedTeams` (32 clasificados ya resueltos) + `buildScoreMatrixForMatch` + `createSeededRandom`:
   - Construir el cruce R32 determinista según el formato 2026, arrastrar ganadores por ronda con Monte Carlo (en KO: prob 1X2 sin empate o desempate ponderado).
   - Calcular prob de avanzar por ronda y **prob de campeón** por selección.
9. Página `/bracket` con probabilidades por ronda y campeón, con badge de confianza y disclaimer.

---

## 5. Nota sobre la copia en OneDrive
La carpeta `…\OneDrive\Documentos\Claude\Projects\Tipster\mundial-edge` es un MVP del 16-jun (solo `src/lib/model/`, sin stat-model/tournament/parlays). El propio HANDOFF recomendaba sacar el proyecto de OneDrive — ya está hecho en `C:\Users\marce\mundial-edge`. Recomendación: **borrar o archivar** la copia de OneDrive para evitar editar la versión equivocada.
