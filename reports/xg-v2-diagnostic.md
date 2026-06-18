# Diagnostico xG v2.1: regularizacion bayesiana

## Resumen ejecutivo

La auditoria reproduce 128 partidos de los Mundiales 2018 y 2022 y mantiene **legacy-neutral** como baseline. xG v2 permanece sin promocionar. Las variantes xG v2.1 aplican shrinkage bayesiano a ataque observado, defensa observada y xG derivado.

El peso observado es `gamesPlayed / (gamesPlayed + priorStrength)`; se prueban `priorStrength` 2, 4, 6 y 8. Para el xG derivado se usa la muestra compartida conservadora (el minimo de partidos previos de ambos equipos), mientras cada tasa ofensiva/defensiva usa los partidos del equipo correspondiente.

La mejor variante experimental por Brier global es **xg-v2.1-prior8**. Supera legacy-neutral en las cuatro metricas globales evaluadas.

## Resultados globales

| Variante | N | Brier | Delta | Log Loss | Delta | RPS | Delta | Accuracy | Delta |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 128 | 0.6416 | +0.0000 | 1.0728 | +0.0000 | 0.2347 | +0.0000 | 49.2% | +0.0 pp |
| xg-v2 | 128 | 0.6550 | +0.0134 | 1.0926 | +0.0199 | 0.2386 | +0.0039 | 46.9% | -2.3 pp |
| xg-v2.1-prior2 | 128 | 0.6065 | -0.0351 | 1.0153 | -0.0574 | 0.2158 | -0.0189 | 54.7% | +5.5 pp |
| xg-v2.1-prior4 | 128 | 0.6012 | -0.0404 | 1.0078 | -0.0650 | 0.2132 | -0.0216 | 56.3% | +7.0 pp |
| xg-v2.1-prior6 | 128 | 0.5997 | -0.0419 | 1.0057 | -0.0671 | 0.2124 | -0.0223 | 57.0% | +7.8 pp |
| xg-v2.1-prior8 | 128 | 0.5991 | -0.0425 | 1.0047 | -0.0681 | 0.2121 | -0.0226 | 57.8% | +8.6 pp |

## Fase de grupos

| Variante | N | Brier | Delta | Log Loss | Delta | RPS | Delta | Accuracy | Delta |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 96 | 0.6360 | +0.0000 | 1.0648 | +0.0000 | 0.2396 | +0.0000 | 52.1% | +0.0 pp |
| xg-v2 | 96 | 0.6579 | +0.0219 | 1.0968 | +0.0320 | 0.2468 | +0.0072 | 49.0% | -3.1 pp |
| xg-v2.1-prior2 | 96 | 0.6010 | -0.0350 | 1.0069 | -0.0578 | 0.2203 | -0.0193 | 56.3% | +4.2 pp |
| xg-v2.1-prior4 | 96 | 0.5944 | -0.0417 | 0.9975 | -0.0673 | 0.2170 | -0.0226 | 58.3% | +6.3 pp |
| xg-v2.1-prior6 | 96 | 0.5924 | -0.0436 | 0.9947 | -0.0700 | 0.2160 | -0.0236 | 58.3% | +6.3 pp |
| xg-v2.1-prior8 | 96 | 0.5915 | -0.0445 | 0.9935 | -0.0713 | 0.2156 | -0.0240 | 59.4% | +7.3 pp |

## Eliminatorias

| Variante | N | Brier | Delta | Log Loss | Delta | RPS | Delta | Accuracy | Delta |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 32 | 0.6582 | +0.0000 | 1.0968 | +0.0000 | 0.2201 | +0.0000 | 40.6% | +0.0 pp |
| xg-v2 | 32 | 0.6462 | -0.0120 | 1.0801 | -0.0167 | 0.2142 | -0.0059 | 40.6% | +0.0 pp |
| xg-v2.1-prior2 | 32 | 0.6229 | -0.0353 | 1.0405 | -0.0563 | 0.2022 | -0.0179 | 50.0% | +9.4 pp |
| xg-v2.1-prior4 | 32 | 0.6217 | -0.0365 | 1.0387 | -0.0580 | 0.2016 | -0.0185 | 50.0% | +9.4 pp |
| xg-v2.1-prior6 | 32 | 0.6217 | -0.0365 | 1.0386 | -0.0582 | 0.2016 | -0.0185 | 53.1% | +12.5 pp |
| xg-v2.1-prior8 | 32 | 0.6216 | -0.0365 | 1.0385 | -0.0583 | 0.2017 | -0.0184 | 53.1% | +12.5 pp |

## Partidos con favorito

Favorito se define por una diferencia de rating overall de al menos 5 puntos, con independencia del resultado final.

| Variante | N | Brier | Delta | Log Loss | Delta | RPS | Delta | Accuracy | Delta |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 87 | 0.6078 | +0.0000 | 1.0252 | +0.0000 | 0.2259 | +0.0000 | 54.0% | +0.0 pp |
| xg-v2 | 87 | 0.6286 | +0.0208 | 1.0557 | +0.0305 | 0.2333 | +0.0075 | 52.9% | -1.1 pp |
| xg-v2.1-prior2 | 87 | 0.5796 | -0.0282 | 0.9780 | -0.0472 | 0.2104 | -0.0155 | 62.1% | +8.0 pp |
| xg-v2.1-prior4 | 87 | 0.5745 | -0.0332 | 0.9706 | -0.0546 | 0.2078 | -0.0181 | 62.1% | +8.0 pp |
| xg-v2.1-prior6 | 87 | 0.5732 | -0.0346 | 0.9686 | -0.0566 | 0.2071 | -0.0187 | 63.2% | +9.2 pp |
| xg-v2.1-prior8 | 87 | 0.5726 | -0.0352 | 0.9677 | -0.0575 | 0.2068 | -0.0190 | 63.2% | +9.2 pp |

## Upsets

Upset se define como victoria del equipo con rating overall al menos 5 puntos menor.

| Variante | N | Brier | Delta | Log Loss | Delta | RPS | Delta | Accuracy | Delta |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 15 | 0.8460 | +0.0000 | 1.3838 | +0.0000 | 0.3917 | +0.0000 | 20.0% | +0.0 pp |
| xg-v2 | 15 | 0.9455 | +0.0995 | 1.5745 | +0.1906 | 0.4401 | +0.0484 | 13.3% | -6.7 pp |
| xg-v2.1-prior2 | 15 | 0.8477 | +0.0017 | 1.3474 | -0.0364 | 0.3934 | +0.0017 | 0.0% | -20.0 pp |
| xg-v2.1-prior4 | 15 | 0.8136 | -0.0324 | 1.2933 | -0.0906 | 0.3761 | -0.0156 | 0.0% | -20.0 pp |
| xg-v2.1-prior6 | 15 | 0.8012 | -0.0448 | 1.2745 | -0.1094 | 0.3698 | -0.0219 | 0.0% | -20.0 pp |
| xg-v2.1-prior8 | 15 | 0.7952 | -0.0508 | 1.2654 | -0.1185 | 0.3668 | -0.0250 | 0.0% | -20.0 pp |

## Partidos de 0-2 goles

| Variante | N | Brier | Delta | Log Loss | Delta | RPS | Delta | Accuracy | Delta |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 69 | 0.6931 | +0.0000 | 1.1417 | +0.0000 | 0.2390 | +0.0000 | 40.6% | +0.0 pp |
| xg-v2 | 69 | 0.7225 | +0.0294 | 1.1921 | +0.0504 | 0.2509 | +0.0119 | 39.1% | -1.4 pp |
| xg-v2.1-prior2 | 69 | 0.6551 | -0.0380 | 1.0845 | -0.0572 | 0.2176 | -0.0214 | 46.4% | +5.8 pp |
| xg-v2.1-prior4 | 69 | 0.6438 | -0.0493 | 1.0690 | -0.0727 | 0.2118 | -0.0271 | 47.8% | +7.2 pp |
| xg-v2.1-prior6 | 69 | 0.6401 | -0.0530 | 1.0640 | -0.0777 | 0.2099 | -0.0290 | 49.3% | +8.7 pp |
| xg-v2.1-prior8 | 69 | 0.6383 | -0.0548 | 1.0616 | -0.0802 | 0.2090 | -0.0300 | 50.7% | +10.1 pp |

## Guardrails

- Violaciones de suma/rango 1X2: 0.
- Valores no finitos: 0.
- xG fuera de [0.2, 4.5]: 0.
- Fixtures sin sede neutral aplicada: 0.
- Ratings sin metadata de seed o fallback neutral explicito: 0.

## Recomendacion

Mantener **legacy-neutral** como baseline y todas las variantes xG v2/v2.1 como experimentales. Aunque xg-v2.1-prior8 gana este corpus, la muestra usa seeds 2026 retrospectivos y solo dos Mundiales; ampliar corpus y ratings historicos antes de cualquier promocion.
