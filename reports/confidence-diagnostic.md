# Diagnostico de Prediction Confidence

## Objetivo

Evaluar si el Confidence Score separa razonablemente picks inciertos y picks concentrados. No se exige monotonicidad perfecta: el corpus contiene 128 partidos y los buckets pequeños tienen alta varianza.

## Coverage y desempeño por bucket

| Variante | Bucket | N | Coverage | Score medio | Accuracy | Brier | Prob top media | Margen top-2 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | low | 18 | 14.1% | 40.7 | 33.3% | 0.6710 | 39.2% | 4.5% |
| legacy-neutral | medium | 65 | 50.8% | 55.9 | 49.2% | 0.6459 | 42.8% | 10.7% |
| legacy-neutral | high | 45 | 35.2% | 79.5 | 53.3% | 0.6367 | 64.7% | 44.2% |
| xg-v2.1-prior8 | low | 24 | 18.8% | 39.8 | 45.8% | 0.6357 | 39.6% | 4.9% |
| xg-v2.1-prior8 | medium | 98 | 76.6% | 55.8 | 55.1% | 0.6077 | 44.0% | 13.1% |
| xg-v2.1-prior8 | high | 6 | 4.7% | 72.0 | 100.0% | 0.3956 | 48.8% | 22.1% |

## Chequeo de monotonicidad

- **legacy-neutral: cumple.** Accuracy no decrece al subir de bucket entre buckets con datos.
- **xg-v2.1-prior8: cumple.** Accuracy no decrece al subir de bucket entre buckets con datos.

## Interpretacion

- Un bucket low razonable debe mostrar menor probabilidad top y menor margen top-vs-segundo que medium/high.
- Accuracy y Brier son validaciones posteriores, no componentes calculados con el resultado real.
- El score no representa una probabilidad de acierto ni reemplaza la calibracion del modelo.
- Fallbacks, muestras pequeñas, dependencia alta del prior, warnings y contexto fuerte de grupos reducen confianza aunque el pick tenga probabilidad concentrada.
