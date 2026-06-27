# Diagnostico experimental Dixon-Coles

## Resumen ejecutivo

La correccion Dixon-Coles se aplica solo a 0-0, 1-0, 0-1 y 1-1, seguida de renormalizacion. Este experimento compara rho -0.15, -0.10 y -0.05 sobre **legacy-neutral** y **xg-v2.1-prior8**. Rho 0.00 queda cubierto como identidad por tests y 0.05 permanece disponible en la funcion pura, pero no forma parte de las ocho variantes solicitadas.

La mejor variante DC sobre Legacy por Brier global es **legacy-neutral-dc-rho-0.05** (+0.0007). La mejor sobre prior8 es **xg-v2.1-prior8-dc-rho-0.05** (+0.0011 contra prior8). No aparece mejora Brier marginal; Dixon-Coles no justifica avanzar con estos rho en este corpus.

## Global

| Variante | N | Brier | Δ Legacy | Δ prior8 | LogLoss | Δ Legacy | Δ prior8 | RPS | Δ Legacy | Δ prior8 | Accuracy | Δ Legacy | Δ prior8 | CS top-1 | Δ Legacy | Δ prior8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 128 | 0.6545 | +0.0000 | +0.0542 | 1.0983 | +0.0000 | +0.0919 | 0.2413 | +0.0000 | +0.0286 | 49.2% | +0.0 pp | -7.8 pp | 12.5% | +0.0 pp | +2.3 pp |
| legacy-neutral-dc-rho-0.15 | 128 | 0.6577 | +0.0032 | +0.0574 | 1.1104 | +0.0121 | +0.1040 | 0.2419 | +0.0005 | +0.0292 | 50.8% | +1.6 pp | -6.3 pp | 10.9% | -1.6 pp | +0.8 pp |
| legacy-neutral-dc-rho-0.10 | 128 | 0.6563 | +0.0018 | +0.0560 | 1.1057 | +0.0074 | +0.0993 | 0.2416 | +0.0003 | +0.0289 | 50.8% | +1.6 pp | -6.3 pp | 10.2% | -2.3 pp | +0.0 pp |
| legacy-neutral-dc-rho-0.05 | 128 | 0.6553 | +0.0007 | +0.0550 | 1.1017 | +0.0034 | +0.0952 | 0.2415 | +0.0001 | +0.0288 | 50.0% | +0.8 pp | -7.0 pp | 10.2% | -2.3 pp | +0.0 pp |
| xg-v2.1-prior8 | 128 | 0.6003 | -0.0542 | +0.0000 | 1.0064 | -0.0919 | +0.0000 | 0.2127 | -0.0286 | +0.0000 | 57.0% | +7.8 pp | +0.0 pp | 10.2% | -2.3 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 128 | 0.6048 | -0.0498 | +0.0045 | 1.0119 | -0.0864 | +0.0055 | 0.2134 | -0.0279 | +0.0007 | 57.0% | +7.8 pp | +0.0 pp | 10.2% | -2.3 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.10 | 128 | 0.6028 | -0.0517 | +0.0026 | 1.0094 | -0.0889 | +0.0030 | 0.2131 | -0.0282 | +0.0004 | 57.0% | +7.8 pp | +0.0 pp | 10.2% | -2.3 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.05 | 128 | 0.6014 | -0.0532 | +0.0011 | 1.0076 | -0.0907 | +0.0012 | 0.2129 | -0.0285 | +0.0002 | 57.0% | +7.8 pp | +0.0 pp | 10.2% | -2.3 pp | +0.0 pp |

## Partidos de 0-2 goles

| Variante | N | Brier | Δ Legacy | Δ prior8 | LogLoss | Δ Legacy | Δ prior8 | RPS | Δ Legacy | Δ prior8 | Accuracy | Δ Legacy | Δ prior8 | CS top-1 | Δ Legacy | Δ prior8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 69 | 0.7084 | +0.0000 | +0.0692 | 1.1696 | +0.0000 | +0.1067 | 0.2469 | +0.0000 | +0.0374 | 42.0% | +0.0 pp | -7.2 pp | 20.3% | +0.0 pp | +1.4 pp |
| legacy-neutral-dc-rho-0.15 | 69 | 0.7037 | -0.0046 | +0.0645 | 1.1680 | -0.0016 | +0.1051 | 0.2461 | -0.0008 | +0.0367 | 44.9% | +2.9 pp | -4.3 pp | 17.4% | -2.9 pp | -1.4 pp |
| legacy-neutral-dc-rho-0.10 | 69 | 0.7049 | -0.0034 | +0.0657 | 1.1678 | -0.0018 | +0.1049 | 0.2463 | -0.0006 | +0.0369 | 44.9% | +2.9 pp | -4.3 pp | 15.9% | -4.3 pp | -2.9 pp |
| legacy-neutral-dc-rho-0.05 | 69 | 0.7065 | -0.0019 | +0.0673 | 1.1683 | -0.0013 | +0.1054 | 0.2465 | -0.0003 | +0.0371 | 43.5% | +1.4 pp | -5.8 pp | 15.9% | -4.3 pp | -2.9 pp |
| xg-v2.1-prior8 | 69 | 0.6392 | -0.0692 | +0.0000 | 1.0629 | -0.1067 | +0.0000 | 0.2094 | -0.0374 | +0.0000 | 49.3% | +7.2 pp | +0.0 pp | 18.8% | -1.4 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 69 | 0.6337 | -0.0746 | -0.0055 | 1.0524 | -0.1171 | -0.0104 | 0.2085 | -0.0384 | -0.0009 | 49.3% | +7.2 pp | +0.0 pp | 18.8% | -1.4 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.10 | 69 | 0.6351 | -0.0733 | -0.0041 | 1.0551 | -0.1144 | -0.0077 | 0.2087 | -0.0381 | -0.0007 | 49.3% | +7.2 pp | +0.0 pp | 18.8% | -1.4 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.05 | 69 | 0.6369 | -0.0714 | -0.0023 | 1.0586 | -0.1110 | -0.0043 | 0.2090 | -0.0378 | -0.0004 | 49.3% | +7.2 pp | +0.0 pp | 18.8% | -1.4 pp | +0.0 pp |

## Empates

| Variante | N | Brier | Δ Legacy | Δ prior8 | LogLoss | Δ Legacy | Δ prior8 | RPS | Δ Legacy | Δ prior8 | Accuracy | Δ Legacy | Δ prior8 | CS top-1 | Δ Legacy | Δ prior8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 29 | 0.8589 | +0.0000 | +0.0172 | 1.3703 | +0.0000 | +0.0015 | 0.1553 | +0.0000 | +0.0123 | 3.4% | +0.0 pp | +3.4 pp | 31.0% | +0.0 pp | -13.8 pp |
| legacy-neutral-dc-rho-0.15 | 29 | 0.7889 | -0.0700 | -0.0528 | 1.2513 | -0.1190 | -0.1176 | 0.1436 | -0.0117 | +0.0007 | 10.3% | +6.9 pp | +10.3 pp | 37.9% | +6.9 pp | -6.9 pp |
| legacy-neutral-dc-rho-0.10 | 29 | 0.8119 | -0.0471 | -0.0299 | 1.2894 | -0.0809 | -0.0795 | 0.1474 | -0.0078 | +0.0045 | 10.3% | +6.9 pp | +10.3 pp | 34.5% | +3.4 pp | -10.3 pp |
| legacy-neutral-dc-rho-0.05 | 29 | 0.8352 | -0.0237 | -0.0065 | 1.3290 | -0.0413 | -0.0398 | 0.1513 | -0.0040 | +0.0084 | 6.9% | +3.4 pp | +6.9 pp | 31.0% | +0.0 pp | -13.8 pp |
| xg-v2.1-prior8 | 29 | 0.8417 | -0.0172 | +0.0000 | 1.3688 | -0.0015 | +0.0000 | 0.1429 | -0.0123 | +0.0000 | 0.0% | -3.4 pp | +0.0 pp | 44.8% | +13.8 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 29 | 0.7628 | -0.0961 | -0.0789 | 1.2359 | -0.1344 | -0.1329 | 0.1298 | -0.0255 | -0.0132 | 0.0% | -3.4 pp | +0.0 pp | 44.8% | +13.8 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.10 | 29 | 0.7887 | -0.0702 | -0.0531 | 1.2783 | -0.0920 | -0.0905 | 0.1341 | -0.0212 | -0.0088 | 0.0% | -3.4 pp | +0.0 pp | 44.8% | +13.8 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.05 | 29 | 0.8150 | -0.0439 | -0.0267 | 1.3225 | -0.0478 | -0.0463 | 0.1385 | -0.0168 | -0.0045 | 0.0% | -3.4 pp | +0.0 pp | 44.8% | +13.8 pp | +0.0 pp |

## Calibracion de probabilidad de empate

En el corpus completo, la tasa real de empate es 22.7%. Legacy neutral predice 24.3% y prior8 25.2%.

| Variante | Draw predicho | Draw real | Gap absoluto | Δ gap Legacy | Δ gap prior8 | Draw Brier | Δ Legacy | Δ prior8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 24.3% | 22.7% | 1.7% | +0.0 pp | -0.9 pp | 0.1719 | +0.0000 | -0.0030 |
| legacy-neutral-dc-rho-0.15 | 27.4% | 22.7% | 4.7% | +3.1 pp | +2.2 pp | 0.1740 | +0.0021 | -0.0009 |
| legacy-neutral-dc-rho-0.10 | 26.4% | 22.7% | 3.7% | +2.1 pp | +1.2 pp | 0.1731 | +0.0012 | -0.0018 |
| legacy-neutral-dc-rho-0.05 | 25.3% | 22.7% | 2.7% | +1.0 pp | +0.1 pp | 0.1723 | +0.0005 | -0.0026 |
| xg-v2.1-prior8 | 25.2% | 22.7% | 2.6% | +0.9 pp | +0.0 pp | 0.1749 | +0.0030 | +0.0000 |
| xg-v2.1-prior8-dc-rho-0.15 | 28.8% | 22.7% | 6.1% | +4.5 pp | +3.6 pp | 0.1779 | +0.0060 | +0.0030 |
| xg-v2.1-prior8-dc-rho-0.10 | 27.6% | 22.7% | 4.9% | +3.3 pp | +2.4 pp | 0.1766 | +0.0047 | +0.0017 |
| xg-v2.1-prior8-dc-rho-0.05 | 26.4% | 22.7% | 3.8% | +2.1 pp | +1.2 pp | 0.1756 | +0.0037 | +0.0007 |

### Buckets de calibracion de draw

| Variante | Bucket | N | Draw medio | Draw real | Gap |
|---|---|---:|---:|---:|---:|
| legacy-neutral | 0-20% | 28 | 13.9% | 10.7% | +3.2 pp |
| legacy-neutral | 20-25% | 22 | 22.7% | 31.8% | -9.1 pp |
| legacy-neutral | 25-30% | 60 | 26.4% | 21.7% | +4.7 pp |
| legacy-neutral | 30%+ | 18 | 35.5% | 33.3% | +2.1 pp |
| legacy-neutral-dc-rho-0.15 | 0-20% | 23 | 14.3% | 13.0% | +1.3 pp |
| legacy-neutral-dc-rho-0.15 | 20-25% | 16 | 23.2% | 12.5% | +10.7 pp |
| legacy-neutral-dc-rho-0.15 | 25-30% | 53 | 28.9% | 30.2% | -1.3 pp |
| legacy-neutral-dc-rho-0.15 | 30%+ | 36 | 35.5% | 22.2% | +13.2 pp |
| legacy-neutral-dc-rho-0.10 | 0-20% | 25 | 14.3% | 12.0% | +2.3 pp |
| legacy-neutral-dc-rho-0.10 | 20-25% | 15 | 22.9% | 13.3% | +9.5 pp |
| legacy-neutral-dc-rho-0.10 | 25-30% | 58 | 27.9% | 27.6% | +0.3 pp |
| legacy-neutral-dc-rho-0.10 | 30%+ | 30 | 35.2% | 26.7% | +8.5 pp |
| legacy-neutral-dc-rho-0.05 | 0-20% | 25 | 13.7% | 12.0% | +1.7 pp |
| legacy-neutral-dc-rho-0.05 | 20-25% | 19 | 22.6% | 15.8% | +6.8 pp |
| legacy-neutral-dc-rho-0.05 | 25-30% | 60 | 27.1% | 28.3% | -1.2 pp |
| legacy-neutral-dc-rho-0.05 | 30%+ | 24 | 35.1% | 25.0% | +10.1 pp |
| xg-v2.1-prior8 | 0-20% | 0 | 0.0% | 0.0% | +0.0 pp |
| xg-v2.1-prior8 | 20-25% | 40 | 24.3% | 15.0% | +9.3 pp |
| xg-v2.1-prior8 | 25-30% | 88 | 25.6% | 26.1% | -0.5 pp |
| xg-v2.1-prior8 | 30%+ | 0 | 0.0% | 0.0% | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 0-20% | 0 | 0.0% | 0.0% | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 20-25% | 0 | 0.0% | 0.0% | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 25-30% | 123 | 28.7% | 22.0% | +6.8 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 30%+ | 5 | 30.7% | 40.0% | -9.3 pp |
| xg-v2.1-prior8-dc-rho-0.10 | 0-20% | 0 | 0.0% | 0.0% | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.10 | 20-25% | 1 | 24.9% | 0.0% | +24.9 pp |
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
