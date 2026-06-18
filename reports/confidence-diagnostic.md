# Diagnostico de Prediction Confidence

## Objetivo

Evaluar si el Confidence Score separa razonablemente picks inciertos y picks concentrados. No se exige monotonicidad perfecta: el corpus contiene 128 partidos y los buckets pequeños tienen alta varianza.

## Coverage y desempeño por bucket

| Variante | Bucket | N | Coverage | Score medio | Accuracy | Brier | Prob top media | Margen top-2 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | low | 13 | 10.2% | 42.1 | 53.8% | 0.6446 | 39.0% | 3.4% |
| legacy-neutral | medium | 69 | 53.9% | 55.9 | 46.4% | 0.6461 | 42.9% | 11.1% |
| legacy-neutral | high | 46 | 35.9% | 80.9 | 52.2% | 0.6340 | 63.4% | 42.3% |
| xg-v2.1-prior8 | low | 13 | 10.2% | 41.3 | 46.2% | 0.6569 | 39.1% | 3.9% |
| xg-v2.1-prior8 | medium | 105 | 82.0% | 56.4 | 58.1% | 0.5992 | 44.3% | 13.8% |
| xg-v2.1-prior8 | high | 10 | 7.8% | 73.2 | 70.0% | 0.5228 | 48.8% | 22.1% |

## Chequeo de monotonicidad

- **legacy-neutral: no cumple.** La relacion no es monotona en este corpus limitado; usar el score como señal, no como garantia.
- **xg-v2.1-prior8: cumple.** Accuracy no decrece al subir de bucket entre buckets con datos.

## Interpretacion

- Un bucket low razonable debe mostrar menor probabilidad top y menor margen top-vs-segundo que medium/high.
- Accuracy y Brier son validaciones posteriores, no componentes calculados con el resultado real.
- El score no representa una probabilidad de acierto ni reemplaza la calibracion del modelo.
- Fallbacks, muestras pequeñas, dependencia alta del prior, warnings y contexto fuerte de grupos reducen confianza aunque el pick tenga probabilidad concentrada.
