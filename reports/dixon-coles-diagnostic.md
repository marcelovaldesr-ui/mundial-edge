# Diagnostico experimental Dixon-Coles

## Resumen ejecutivo

La correccion Dixon-Coles se aplica solo a 0-0, 1-0, 0-1 y 1-1, seguida de renormalizacion. Este experimento compara rho -0.15, -0.10 y -0.05 sobre **legacy-neutral** y **xg-v2.1-prior8**. Rho 0.00 queda cubierto como identidad por tests y 0.05 permanece disponible en la funcion pura, pero no forma parte de las ocho variantes solicitadas.

La mejor variante DC sobre Legacy por Brier global es **legacy-neutral-dc-rho-0.05** (+0.0008). La mejor sobre prior8 es **xg-v2.1-prior8-dc-rho-0.05** (+0.0011 contra prior8). No aparece mejora Brier marginal; Dixon-Coles no justifica avanzar con estos rho en este corpus.

## Global

| Variante | N | Brier | Δ Legacy | Δ prior8 | LogLoss | Δ Legacy | Δ prior8 | RPS | Δ Legacy | Δ prior8 | Accuracy | Δ Legacy | Δ prior8 | CS top-1 | Δ Legacy | Δ prior8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 128 | 0.6416 | +0.0000 | +0.0425 | 1.0728 | +0.0000 | +0.0681 | 0.2347 | +0.0000 | +0.0226 | 49.2% | +0.0 pp | -8.6 pp | 10.9% | +0.0 pp | +0.8 pp |
| legacy-neutral-dc-rho-0.15 | 128 | 0.6450 | +0.0034 | +0.0459 | 1.0832 | +0.0104 | +0.0785 | 0.2353 | +0.0006 | +0.0232 | 51.6% | +2.3 pp | -6.3 pp | 9.4% | -1.6 pp | -0.8 pp |
| legacy-neutral-dc-rho-0.10 | 128 | 0.6435 | +0.0019 | +0.0444 | 1.0791 | +0.0063 | +0.0744 | 0.2350 | +0.0003 | +0.0229 | 50.8% | +1.6 pp | -7.0 pp | 9.4% | -1.6 pp | -0.8 pp |
| legacy-neutral-dc-rho-0.05 | 128 | 0.6424 | +0.0008 | +0.0433 | 1.0756 | +0.0028 | +0.0709 | 0.2349 | +0.0001 | +0.0228 | 50.0% | +0.8 pp | -7.8 pp | 8.6% | -2.3 pp | -1.6 pp |
| xg-v2.1-prior8 | 128 | 0.5991 | -0.0425 | +0.0000 | 1.0047 | -0.0681 | +0.0000 | 0.2121 | -0.0226 | +0.0000 | 57.8% | +8.6 pp | +0.0 pp | 10.2% | -0.8 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 128 | 0.6035 | -0.0381 | +0.0044 | 1.0101 | -0.0627 | +0.0054 | 0.2128 | -0.0219 | +0.0007 | 57.8% | +8.6 pp | +0.0 pp | 10.2% | -0.8 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.10 | 128 | 0.6016 | -0.0400 | +0.0025 | 1.0076 | -0.0651 | +0.0029 | 0.2125 | -0.0222 | +0.0004 | 57.8% | +8.6 pp | +0.0 pp | 10.2% | -0.8 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.05 | 128 | 0.6001 | -0.0415 | +0.0011 | 1.0058 | -0.0669 | +0.0011 | 0.2123 | -0.0224 | +0.0002 | 57.8% | +8.6 pp | +0.0 pp | 10.2% | -0.8 pp | +0.0 pp |

## Partidos de 0-2 goles

| Variante | N | Brier | Δ Legacy | Δ prior8 | LogLoss | Δ Legacy | Δ prior8 | RPS | Δ Legacy | Δ prior8 | Accuracy | Δ Legacy | Δ prior8 | CS top-1 | Δ Legacy | Δ prior8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 69 | 0.6931 | +0.0000 | +0.0548 | 1.1417 | +0.0000 | +0.0802 | 0.2390 | +0.0000 | +0.0300 | 40.6% | +0.0 pp | -10.1 pp | 18.8% | +0.0 pp | +0.0 pp |
| legacy-neutral-dc-rho-0.15 | 69 | 0.6881 | -0.0051 | +0.0498 | 1.1381 | -0.0036 | +0.0766 | 0.2381 | -0.0008 | +0.0291 | 44.9% | +4.3 pp | -5.8 pp | 15.9% | -2.9 pp | -2.9 pp |
| legacy-neutral-dc-rho-0.10 | 69 | 0.6894 | -0.0037 | +0.0511 | 1.1386 | -0.0032 | +0.0770 | 0.2383 | -0.0006 | +0.0294 | 43.5% | +2.9 pp | -7.2 pp | 15.9% | -2.9 pp | -2.9 pp |
| legacy-neutral-dc-rho-0.05 | 69 | 0.6911 | -0.0021 | +0.0528 | 1.1397 | -0.0020 | +0.0782 | 0.2386 | -0.0003 | +0.0296 | 42.0% | +1.4 pp | -8.7 pp | 14.5% | -4.3 pp | -4.3 pp |
| xg-v2.1-prior8 | 69 | 0.6383 | -0.0548 | +0.0000 | 1.0616 | -0.0802 | +0.0000 | 0.2090 | -0.0300 | +0.0000 | 50.7% | +10.1 pp | +0.0 pp | 18.8% | +0.0 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 69 | 0.6328 | -0.0603 | -0.0055 | 1.0511 | -0.0907 | -0.0105 | 0.2081 | -0.0309 | -0.0009 | 50.7% | +10.1 pp | +0.0 pp | 18.8% | +0.0 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.10 | 69 | 0.6342 | -0.0589 | -0.0041 | 1.0538 | -0.0879 | -0.0078 | 0.2083 | -0.0307 | -0.0007 | 50.7% | +10.1 pp | +0.0 pp | 18.8% | +0.0 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.05 | 69 | 0.6361 | -0.0571 | -0.0023 | 1.0572 | -0.0845 | -0.0043 | 0.2086 | -0.0304 | -0.0004 | 50.7% | +10.1 pp | +0.0 pp | 18.8% | +0.0 pp | +0.0 pp |

## Empates

| Variante | N | Brier | Δ Legacy | Δ prior8 | LogLoss | Δ Legacy | Δ prior8 | RPS | Δ Legacy | Δ prior8 | Accuracy | Δ Legacy | Δ prior8 | CS top-1 | Δ Legacy | Δ prior8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 29 | 0.8482 | +0.0000 | +0.0064 | 1.3584 | +0.0000 | -0.0104 | 0.1507 | +0.0000 | +0.0077 | 0.0% | +0.0 pp | +0.0 pp | 31.0% | +0.0 pp | -13.8 pp |
| legacy-neutral-dc-rho-0.15 | 29 | 0.7753 | -0.0729 | -0.0665 | 1.2356 | -0.1228 | -0.1332 | 0.1385 | -0.0122 | -0.0044 | 10.3% | +10.3 pp | +10.3 pp | 34.5% | +3.4 pp | -10.3 pp |
| legacy-neutral-dc-rho-0.10 | 29 | 0.7992 | -0.0490 | -0.0426 | 1.2749 | -0.0836 | -0.0939 | 0.1425 | -0.0082 | -0.0005 | 6.9% | +6.9 pp | +6.9 pp | 34.5% | +3.4 pp | -10.3 pp |
| legacy-neutral-dc-rho-0.05 | 29 | 0.8235 | -0.0247 | -0.0183 | 1.3158 | -0.0427 | -0.0530 | 0.1466 | -0.0041 | +0.0036 | 3.4% | +3.4 pp | +3.4 pp | 31.0% | +0.0 pp | -13.8 pp |
| xg-v2.1-prior8 | 29 | 0.8418 | -0.0064 | +0.0000 | 1.3688 | +0.0104 | +0.0000 | 0.1430 | -0.0077 | +0.0000 | 0.0% | +0.0 pp | +0.0 pp | 44.8% | +13.8 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 29 | 0.7629 | -0.0854 | -0.0789 | 1.2359 | -0.1226 | -0.1329 | 0.1298 | -0.0209 | -0.0132 | 0.0% | +0.0 pp | +0.0 pp | 44.8% | +13.8 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.10 | 29 | 0.7887 | -0.0595 | -0.0531 | 1.2783 | -0.0802 | -0.0906 | 0.1341 | -0.0165 | -0.0088 | 0.0% | +0.0 pp | +0.0 pp | 44.8% | +13.8 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.05 | 29 | 0.8151 | -0.0332 | -0.0268 | 1.3225 | -0.0359 | -0.0463 | 0.1385 | -0.0122 | -0.0045 | 0.0% | +0.0 pp | +0.0 pp | 44.8% | +13.8 pp | +0.0 pp |

## Calibracion de probabilidad de empate

En el corpus completo, la tasa real de empate es 22.7%. Legacy neutral predice 24.7% y prior8 25.2%.

| Variante | Draw predicho | Draw real | Gap absoluto | Δ gap Legacy | Δ gap prior8 | Draw Brier | Δ Legacy | Δ prior8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 24.7% | 22.7% | 2.0% | +0.0 pp | -0.5 pp | 0.1721 | +0.0000 | -0.0027 |
| legacy-neutral-dc-rho-0.15 | 27.9% | 22.7% | 5.3% | +3.2 pp | +2.7 pp | 0.1744 | +0.0023 | -0.0004 |
| legacy-neutral-dc-rho-0.10 | 26.8% | 22.7% | 4.2% | +2.2 pp | +1.6 pp | 0.1734 | +0.0013 | -0.0014 |
| legacy-neutral-dc-rho-0.05 | 25.8% | 22.7% | 3.1% | +1.1 pp | +0.6 pp | 0.1726 | +0.0005 | -0.0022 |
| xg-v2.1-prior8 | 25.2% | 22.7% | 2.5% | +0.5 pp | +0.0 pp | 0.1749 | +0.0027 | +0.0000 |
| xg-v2.1-prior8-dc-rho-0.15 | 28.8% | 22.7% | 6.1% | +4.1 pp | +3.6 pp | 0.1778 | +0.0057 | +0.0030 |
| xg-v2.1-prior8-dc-rho-0.10 | 27.6% | 22.7% | 4.9% | +2.9 pp | +2.4 pp | 0.1765 | +0.0044 | +0.0017 |
| xg-v2.1-prior8-dc-rho-0.05 | 26.4% | 22.7% | 3.7% | +1.7 pp | +1.2 pp | 0.1756 | +0.0034 | +0.0007 |

### Buckets de calibracion de draw

| Variante | Bucket | N | Draw medio | Draw real | Gap |
|---|---|---:|---:|---:|---:|
| legacy-neutral | 0-20% | 25 | 15.6% | 12.0% | +3.6 pp |
| legacy-neutral | 20-25% | 24 | 22.9% | 25.0% | -2.1 pp |
| legacy-neutral | 25-30% | 63 | 26.4% | 22.2% | +4.2 pp |
| legacy-neutral | 30%+ | 16 | 34.7% | 37.5% | -2.8 pp |
| legacy-neutral-dc-rho-0.15 | 0-20% | 22 | 17.0% | 13.6% | +3.4 pp |
| legacy-neutral-dc-rho-0.15 | 20-25% | 13 | 23.6% | 15.4% | +8.2 pp |
| legacy-neutral-dc-rho-0.15 | 25-30% | 57 | 28.8% | 28.1% | +0.8 pp |
| legacy-neutral-dc-rho-0.15 | 30%+ | 36 | 34.7% | 22.2% | +12.5 pp |
| legacy-neutral-dc-rho-0.10 | 0-20% | 23 | 16.5% | 13.0% | +3.5 pp |
| legacy-neutral-dc-rho-0.10 | 20-25% | 15 | 23.3% | 13.3% | +10.0 pp |
| legacy-neutral-dc-rho-0.10 | 25-30% | 59 | 27.9% | 27.1% | +0.8 pp |
| legacy-neutral-dc-rho-0.10 | 30%+ | 31 | 34.1% | 25.8% | +8.3 pp |
| legacy-neutral-dc-rho-0.05 | 0-20% | 23 | 15.9% | 13.0% | +2.8 pp |
| legacy-neutral-dc-rho-0.05 | 20-25% | 17 | 22.6% | 11.8% | +10.9 pp |
| legacy-neutral-dc-rho-0.05 | 25-30% | 67 | 27.2% | 26.9% | +0.3 pp |
| legacy-neutral-dc-rho-0.05 | 30%+ | 21 | 34.6% | 28.6% | +6.0 pp |
| xg-v2.1-prior8 | 0-20% | 0 | 0.0% | 0.0% | +0.0 pp |
| xg-v2.1-prior8 | 20-25% | 43 | 24.4% | 14.0% | +10.4 pp |
| xg-v2.1-prior8 | 25-30% | 85 | 25.6% | 27.1% | -1.4 pp |
| xg-v2.1-prior8 | 30%+ | 0 | 0.0% | 0.0% | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 0-20% | 0 | 0.0% | 0.0% | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 20-25% | 0 | 0.0% | 0.0% | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 25-30% | 123 | 28.7% | 22.0% | +6.8 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 30%+ | 5 | 30.7% | 40.0% | -9.3 pp |
| xg-v2.1-prior8-dc-rho-0.10 | 0-20% | 0 | 0.0% | 0.0% | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.10 | 20-25% | 1 | 24.8% | 0.0% | +24.8 pp |
| xg-v2.1-prior8-dc-rho-0.10 | 25-30% | 126 | 27.6% | 23.0% | +4.6 pp |
| xg-v2.1-prior8-dc-rho-0.10 | 30%+ | 1 | 31.3% | 0.0% | +31.3 pp |
| xg-v2.1-prior8-dc-rho-0.05 | 0-20% | 0 | 0.0% | 0.0% | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.05 | 20-25% | 7 | 24.6% | 0.0% | +24.6 pp |
| xg-v2.1-prior8-dc-rho-0.05 | 25-30% | 121 | 26.5% | 24.0% | +2.5 pp |
| xg-v2.1-prior8-dc-rho-0.05 | 30%+ | 0 | 0.0% | 0.0% | +0.0 pp |

## Lectura y recomendacion

- Delta negativo mejora Brier, Log Loss, RPS, error de calibracion draw y draw Brier; delta positivo mejora Accuracy y correct score top-1.
- La comparacion contra legacy-neutral permite medir el resultado total; la comparacion contra prior8 aísla el aporte marginal de Dixon-Coles sobre el mejor xG previo.
- Mantener Dixon-Coles como experimento. Incluso una mejora en empates o marcadores bajos no justifica promocion con solo 128 partidos y ratings retrospectivos.
