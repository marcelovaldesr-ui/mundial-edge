# Auditoría de integración y labels de modelo

## Resumen

La cadena `poisson-v1` corresponde al motor persistido de `src/lib/model/engine.ts` y puede aparecer como `source` del último sync. No representa por sí sola el stat-model runtime usado por las pantallas que construyen matrices con `predictionConfig: recommended`. El problema principal era de presentación: `LastUpdated` rotulaba el origen del sync como “Fuente”, junto al modelo, sin distinguir fuente de datos y configuración efectiva.

Se separaron cuatro conceptos:

- **Fuente de datos:** proveedor/sync; `poisson-v1` se presenta como “pipeline persistido”.
- **Modelo base persistido:** `edges.model_probability`, generado por el pipeline histórico.
- **Stat-model efectivo:** `modelVariantUsed`, `calibrationUsed` y `configSource` del cálculo runtime.
- **Probabilidad final:** ensemble mercado + señal stat-model + ratings/stats/contexto.

## Matriz de integración

| Sección | Archivo/componente | Modelo real | Calibración real | Label UI anterior | ¿Consistente? | Acción tomada |
|---|---|---|---|---|---|---|
| Dashboard | `src/app/page.tsx`, `OpportunityCard`, `EdgeTable`, `ParlayCard` | Recommended runtime para matrices/final; base persistida para `model_probability` | `platt-blend-25` en 1X2 runtime | “Modelo Mundial Edge”, “Poisson/modelo”, “Fuente: poisson-v1” | Parcial | Metadata efectiva visible; base renombrada “Modelo base persistido”; fuente renombrada “Fuente de datos”. |
| Partidos | `src/app/matches/page.tsx`, `MatchCard` | No recalcula stat-model; usa edges persistidos | Ninguna calibración runtime en la lista | “Fuente: poisson-v1” sin contexto | No | Se declara “Oportunidades: modelo base persistido”. El detalle sigue siendo la frontera de recálculo recommended. |
| Ranking de Edges | `src/app/edges/page.tsx`, `EdgeTable` | Recommended runtime para `final_probability`; `model_probability` sigue persistida | `platt-blend-25` | Columnas “Mercado”, “Poisson”, “Final” | Parcial | “Prob. mercado”, “Modelo base”, “Prob. final”; metadata recommended visible. |
| Combinadas / parlays | `src/app/parlays/page.tsx`, `ParlayWorkspace`, `ParlayCard` | Recommended runtime; score matrix para correlación same-match | `platt-blend-25` | “Poisson same-match”, “Mercado 100%”, “Final 33%” | Cálculo correcto, labels ambiguos | “Matriz de marcadores same-match”, “Peso mercado”, “Prob. final”; metadata y warnings en detalles técnicos. |
| Detalle de partido | `src/app/matches/[id]/page.tsx`, `PoissonModelCard` | Recommended runtime para matriz y ensemble final; base persistida permanece como columna separada | `platt-blend-25` | “Contexto Poisson”, gráfico “Prob. modelo”, fuente genérica | Parcial | “Modelo estadístico”, gráfico de probabilidad final, metadata efectiva y columnas base/final separadas. |
| `/stat-model` | `src/app/stat-model/page.tsx`, `PoissonModelCard` | `xg-v2.1-prior8` por `predictionConfig: recommended` | `platt-blend-25` para 1X2 | “Poisson score matrix v1” y fuente xG parcial | Técnica pero incompleta | Label legible, metadata técnica completa y warnings; “score matrix” se conserva como arquitectura, no como variante. |
| Monte Carlo grupos | `GroupSimulationCard`, `WorldCupGroupsSimulation`, `group-simulation-service.ts` | Recommended simulation model | `platt-blend-25` | Raw IDs y un string hardcodeado prior8 + blend-25 | Parcial | Label central dinámico desde `result.modelVariant/result.calibration`; config source derivada de `modelSelection`; warnings ya visibles. |

## “Mercado 100%” y “Final 33%”

Los valores eran correctos, pero no pertenecían a la misma magnitud:

- `Mercado 100%` era el **peso promedio del mercado en el ensemble**, no una probabilidad del resultado.
- `Final 33%` era la **probabilidad final de una selección**.

Ahora se muestran como `Peso mercado 100%` y `Prob. final 33%`. No cambió ningún peso ni probabilidad.

## Metadata técnica

`ModelMetadata` muestra, donde existe cálculo runtime:

- `modelVariantUsed`
- `calibrationUsed`
- `configSource`
- conteo y detalle acotado de `warnings`

Los labels legibles viven en `src/lib/stat-model/model-labels.ts`, evitando strings divergentes entre pantallas. La lista `/matches` no inventa esta metadata porque no ejecuta el stat-model: identifica explícitamente su pipeline persistido.

## Resultado

- No quedan hardcodes de `poisson-v1` en `src/app` ni `src/components`.
- Default y recommended no cambiaron.
- No se modificaron fórmulas, mercados, schema ni persistencia.
- Próximo paso recomendado: versionar metadata de modelo junto a edges persistidos para que la lista `/matches` pueda mostrar variante/calibración históricas por fila, sin inferirlas desde el último sync.
