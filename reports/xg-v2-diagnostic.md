# Diagnostico xG v2.1: regularizacion bayesiana

## Resumen ejecutivo

La auditoria reproduce 128 partidos de los Mundiales 2018 y 2022 y mantiene **legacy-neutral** como baseline. xG v2 permanece sin promocionar. Las variantes xG v2.1 aplican shrinkage bayesiano a ataque observado, defensa observada y xG derivado.

El peso observado es `gamesPlayed / (gamesPlayed + priorStrength)`; se prueban `priorStrength` 2, 4, 6 y 8. Para el xG derivado se usa la muestra compartida conservadora (el minimo de partidos previos de ambos equipos), mientras cada tasa ofensiva/defensiva usa los partidos del equipo correspondiente.

La mejor variante experimental por Brier global es **xg-v2.1-prior8**. Supera legacy-neutral en las cuatro metricas globales evaluadas.

## Resultados globales

| Variante | N | Brier | Delta | Log Loss | Delta | RPS | Delta | Accuracy | Delta |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 128 | 0.6462 | +0.0000 | 1.0821 | +0.0000 | 0.2371 | +0.0000 | 48.4% | +0.0 pp |
| xg-v2 | 128 | 0.6581 | +0.0119 | 1.0975 | +0.0154 | 0.2402 | +0.0031 | 46.1% | -2.3 pp |
| xg-v2.1-prior2 | 128 | 0.6097 | -0.0365 | 1.0193 | -0.0627 | 0.2175 | -0.0197 | 52.3% | +3.9 pp |
| xg-v2.1-prior4 | 128 | 0.6049 | -0.0414 | 1.0124 | -0.0697 | 0.2150 | -0.0221 | 53.1% | +4.7 pp |
| xg-v2.1-prior6 | 128 | 0.6036 | -0.0427 | 1.0105 | -0.0716 | 0.2144 | -0.0227 | 56.3% | +7.8 pp |
| xg-v2.1-prior8 | 128 | 0.6030 | -0.0432 | 1.0097 | -0.0724 | 0.2141 | -0.0230 | 55.5% | +7.0 pp |

## Fase de grupos

| Variante | N | Brier | Delta | Log Loss | Delta | RPS | Delta | Accuracy | Delta |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 96 | 0.6419 | +0.0000 | 1.0767 | +0.0000 | 0.2427 | +0.0000 | 52.1% | +0.0 pp |
| xg-v2 | 96 | 0.6617 | +0.0198 | 1.1028 | +0.0261 | 0.2488 | +0.0061 | 49.0% | -3.1 pp |
| xg-v2.1-prior2 | 96 | 0.6055 | -0.0364 | 1.0123 | -0.0644 | 0.2226 | -0.0201 | 54.2% | +2.1 pp |
| xg-v2.1-prior4 | 96 | 0.5993 | -0.0426 | 1.0034 | -0.0733 | 0.2194 | -0.0233 | 56.3% | +4.2 pp |
| xg-v2.1-prior6 | 96 | 0.5974 | -0.0445 | 1.0008 | -0.0759 | 0.2185 | -0.0242 | 58.3% | +6.3 pp |
| xg-v2.1-prior8 | 96 | 0.5966 | -0.0453 | 0.9997 | -0.0771 | 0.2181 | -0.0246 | 57.3% | +5.2 pp |

## Eliminatorias

| Variante | N | Brier | Delta | Log Loss | Delta | RPS | Delta | Accuracy | Delta |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 32 | 0.6593 | +0.0000 | 1.0981 | +0.0000 | 0.2203 | +0.0000 | 37.5% | +0.0 pp |
| xg-v2 | 32 | 0.6473 | -0.0120 | 1.0815 | -0.0166 | 0.2145 | -0.0059 | 37.5% | +0.0 pp |
| xg-v2.1-prior2 | 32 | 0.6224 | -0.0369 | 1.0404 | -0.0577 | 0.2020 | -0.0183 | 46.9% | +9.4 pp |
| xg-v2.1-prior4 | 32 | 0.6217 | -0.0376 | 1.0393 | -0.0588 | 0.2018 | -0.0185 | 43.8% | +6.3 pp |
| xg-v2.1-prior6 | 32 | 0.6220 | -0.0373 | 1.0396 | -0.0585 | 0.2021 | -0.0182 | 50.0% | +12.5 pp |
| xg-v2.1-prior8 | 32 | 0.6222 | -0.0371 | 1.0398 | -0.0583 | 0.2023 | -0.0180 | 50.0% | +12.5 pp |

## Partidos con favorito

Favorito se define por una diferencia de rating overall de al menos 5 puntos, con independencia del resultado final.

| Variante | N | Brier | Delta | Log Loss | Delta | RPS | Delta | Accuracy | Delta |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 93 | 0.6238 | +0.0000 | 1.0520 | +0.0000 | 0.2310 | +0.0000 | 51.6% | +0.0 pp |
| xg-v2 | 93 | 0.6408 | +0.0170 | 1.0739 | +0.0218 | 0.2371 | +0.0061 | 50.5% | -1.1 pp |
| xg-v2.1-prior2 | 93 | 0.5925 | -0.0312 | 0.9953 | -0.0568 | 0.2145 | -0.0165 | 58.1% | +6.5 pp |
| xg-v2.1-prior4 | 93 | 0.5865 | -0.0372 | 0.9865 | -0.0655 | 0.2116 | -0.0194 | 57.0% | +5.4 pp |
| xg-v2.1-prior6 | 93 | 0.5846 | -0.0392 | 0.9838 | -0.0682 | 0.2106 | -0.0204 | 59.1% | +7.5 pp |
| xg-v2.1-prior8 | 93 | 0.5837 | -0.0401 | 0.9825 | -0.0695 | 0.2102 | -0.0208 | 59.1% | +7.5 pp |

## Upsets

Upset se define como victoria del equipo con rating overall al menos 5 puntos menor.

| Variante | N | Brier | Delta | Log Loss | Delta | RPS | Delta | Accuracy | Delta |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 19 | 0.8109 | +0.0000 | 1.3331 | +0.0000 | 0.3746 | +0.0000 | 21.1% | +0.0 pp |
| xg-v2 | 19 | 0.8799 | +0.0691 | 1.4658 | +0.1328 | 0.4092 | +0.0346 | 15.8% | -5.3 pp |
| xg-v2.1-prior2 | 19 | 0.7746 | -0.0363 | 1.2387 | -0.0944 | 0.3566 | -0.0180 | 5.3% | -15.8 pp |
| xg-v2.1-prior4 | 19 | 0.7467 | -0.0642 | 1.1953 | -0.1378 | 0.3422 | -0.0324 | 0.0% | -21.1 pp |
| xg-v2.1-prior6 | 19 | 0.7375 | -0.0734 | 1.1816 | -0.1514 | 0.3374 | -0.0372 | 0.0% | -21.1 pp |
| xg-v2.1-prior8 | 19 | 0.7334 | -0.0775 | 1.1757 | -0.1574 | 0.3353 | -0.0393 | 0.0% | -21.1 pp |

## Partidos de 0-2 goles

| Variante | N | Brier | Delta | Log Loss | Delta | RPS | Delta | Accuracy | Delta |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 69 | 0.6985 | +0.0000 | 1.1501 | +0.0000 | 0.2415 | +0.0000 | 37.7% | +0.0 pp |
| xg-v2 | 69 | 0.7279 | +0.0294 | 1.2003 | +0.0503 | 0.2535 | +0.0120 | 34.8% | -2.9 pp |
| xg-v2.1-prior2 | 69 | 0.6589 | -0.0396 | 1.0889 | -0.0611 | 0.2194 | -0.0221 | 42.0% | +4.3 pp |
| xg-v2.1-prior4 | 69 | 0.6473 | -0.0512 | 1.0733 | -0.0768 | 0.2136 | -0.0279 | 42.0% | +4.3 pp |
| xg-v2.1-prior6 | 69 | 0.6435 | -0.0550 | 1.0682 | -0.0818 | 0.2116 | -0.0299 | 46.4% | +8.7 pp |
| xg-v2.1-prior8 | 69 | 0.6417 | -0.0568 | 1.0658 | -0.0843 | 0.2107 | -0.0308 | 46.4% | +8.7 pp |

## Guardrails

- Violaciones de suma/rango 1X2: 0.
- Valores no finitos: 0.
- xG fuera de [0.2, 4.5]: 0.
- Fixtures sin sede neutral aplicada: 0.
- Ratings sin metadata de seed o fallback neutral explicito: 0.

## Recomendacion

Mantener **legacy-neutral** como baseline y todas las variantes xG v2/v2.1 como experimentales. Aunque xg-v2.1-prior8 gana este corpus, la muestra usa seeds 2026 retrospectivos y solo dos Mundiales; ampliar corpus y ratings historicos antes de cualquier promocion.
