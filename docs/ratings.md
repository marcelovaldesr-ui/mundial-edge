# Ratings de selecciones

## Fuente externa

Los snapshots históricos 1998–2022 usan las tablas pretorneo de
[World Football Elo Ratings](https://www.eloratings.net/). Se congelaron los 32 participantes de cada edición desde:

- [1998](https://www.eloratings.net/1998_World_Cup_start.tsv)
- [2002](https://www.eloratings.net/2002_World_Cup_start.tsv)
- [2006](https://www.eloratings.net/2006_World_Cup_start.tsv)
- [2010](https://www.eloratings.net/2010_World_Cup_start.tsv)
- [2014](https://www.eloratings.net/2014_World_Cup_start.tsv)
- [2018](https://www.eloratings.net/2018_World_Cup_start.tsv)
- [2022](https://www.eloratings.net/2022_World_Cup_start.tsv)

`data/elo-ratings.json` contiene 224 registros con URL de procedencia por fila.
Se regenera mediante `scripts/fetch-elo-ratings.ts`. Los TSV son públicos; el
proyecto conserva atribución y no presupone una licencia adicional no publicada.

## Validación

Comparación de los antiguos snapshots manuales con Elo, sobre los 224 pares:

| Métrica | Resultado |
|---|---:|
| Pearson | 0.8958 |
| Spearman | 0.8960 |
| RMSE | 6.1958 |
| Sesgo manual − Elo normalizado | −5.5301 |
| Pearson después del híbrido | 0.9131 |
| RMSE después del híbrido | 6.0749 |

La normalización inicial lleva Elo 1200–2200 al rango 60–100. Después se aplica
el mapeo OLS `1.0196 × EloNormalizado − 7.1915` para compatibilizar escalas.

## Estrategia adoptada

Se usa **10% Elo externo + 90% perfil histórico propio**. Elo no separa ataque y
defensa, por lo que ese 90% conserva el perfil. Pesos Elo mayores se descartaron
porque deterioraron Brier de forma monotónica en el corpus de 448 partidos.

| Estrategia | Brier | Log Loss | RPS | Accuracy | Moda 1-1 |
|---|---:|---:|---:|---:|---:|
| Manual + Temperature T=0.65 | 0.590090 | 1.002081 | 0.195207 | 55.58% | 1.79% |
| Elo10/Own90 + Temperature | 0.591955 | 1.004713 | 0.196098 | 55.80% | 1.79% |
| Manual + Platt25 | 0.572987 | 0.968503 | 0.190233 | 56.70% | n/a |
| Elo10/Own90 + Platt25 | 0.574840 | 0.971197 | 0.191066 | 55.80% | n/a |

El pequeño coste Brier se acepta como intercambio por trazabilidad externa; el
modelo `platt-blend-25` sigue siendo la referencia predictiva más fuerte.

## Rating base 2026

El seed 2026 no se modificó: a 18 de junio el Mundial ya está en curso y usar el
ranking Elo actual introduciría resultados posteriores al inicio. Se mantendrá
`TEAM_STRENGTH_RATINGS` hasta disponer de un snapshot Elo pretorneo congelado y
versionado. Esto evita leakage en producción y en futuras comparaciones.
