# Changelog

## 2026 Launch Candidate

### Sprint 1 — Base probabilística
- Motor Poisson, matriz de marcadores y mercados 1X2, goles y BTTS.
- Cálculo de edge, EV, overround y guardarraíles de calidad.

### Sprint 2 — Datos y operación
- Repositorio mock/live, Supabase, sincronización y endpoints cron protegidos.
- Manejo seguro de respuestas vacías o fallos del proveedor.

### Sprint 3 — Ratings y contexto
- Ratings diferenciados de ataque/defensa y contexto de fase de grupos.
- Priors prudentes para jornada 1 y selecciones sin estadísticas recientes.

### Sprint 4 — Backtesting
- Corpus de 448 partidos, siete Mundiales y evaluación sin leakage.
- Brier, Log Loss, RPS, Accuracy y segmentación por torneo/fase.

### Sprint 5 — Calibración
- Diagnósticos Platt/Dixon-Coles y calibración estructural de lambdas.
- Selección de `calibrated-matrix T=0.65` como modelo recomendado.

### Sprint 6 — Simulación 2026
- Monte Carlo de 12 grupos, 48 equipos y 72 partidos.
- Clasificación de los ocho mejores terceros y suma invariante de 32 clasificados.

### Sprint 7 — Explicabilidad
- Waterfall aditivo de xG, intervalos P10–P90 y explicación automática en español.
- Visualización integrada en el detalle de partido y la página del modelo.

### Sprint 8 — Combinadas
- Generador por perfiles, correlación exacta desde score matrix y staking prudente.
- Auditoría de rechazos, filtros y protección contra selecciones contradictorias.

### Sprint 9 — Transparencia pública
- Dashboard con métricas, baselines, desglose temporal y reliability diagram.
- Página pública de metodología, fuentes y limitaciones.

### Sprint 10 — Preparación de lanzamiento
- Simulacro e2e de 72 partidos y 10.000 iteraciones con artefactos JSON.
- Benchmark repetido, configuración de producción, pruebas de robustez y checklist automática.

### Limitación de datos del ensayo
- El repositorio todavía conserva grupos fallback con plazas por confirmar. El simulacro usa el dataset explícito `rated-pool-synthetic-groups-v1`; debe reemplazarse por el fixture oficial sincronizado antes de presentar equipos/grupos como definitivos.
