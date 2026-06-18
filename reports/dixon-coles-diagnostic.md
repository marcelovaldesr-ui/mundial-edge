# Diagnostico experimental Dixon-Coles

## Resumen ejecutivo

La correccion Dixon-Coles se aplica solo a 0-0, 1-0, 0-1 y 1-1, seguida de renormalizacion. Este experimento compara rho -0.15, -0.10 y -0.05 sobre **legacy-neutral** y **xg-v2.1-prior8**. Rho 0.00 queda cubierto como identidad por tests y 0.05 permanece disponible en la funcion pura, pero no forma parte de las ocho variantes solicitadas.

La mejor variante DC sobre Legacy por Brier global es **legacy-neutral-dc-rho-0.05** (+0.0007). La mejor sobre prior8 es **xg-v2.1-prior8-dc-rho-0.05** (+0.0010 contra prior8). No aparece mejora Brier marginal; Dixon-Coles no justifica avanzar con estos rho en este corpus.

## Global

| Variante | N | Brier | Δ Legacy | Δ prior8 | LogLoss | Δ Legacy | Δ prior8 | RPS | Δ Legacy | Δ prior8 | Accuracy | Δ Legacy | Δ prior8 | CS top-1 | Δ Legacy | Δ prior8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 128 | 0.6462 | +0.0000 | +0.0432 | 1.0821 | +0.0000 | +0.0724 | 0.2371 | +0.0000 | +0.0230 | 48.4% | +0.0 pp | -7.0 pp | 12.5% | +0.0 pp | +2.3 pp |
| legacy-neutral-dc-rho-0.15 | 128 | 0.6495 | +0.0033 | +0.0465 | 1.0926 | +0.0105 | +0.0829 | 0.2377 | +0.0005 | +0.0235 | 50.8% | +2.3 pp | -4.7 pp | 10.2% | -2.3 pp | +0.0 pp |
| legacy-neutral-dc-rho-0.10 | 128 | 0.6480 | +0.0018 | +0.0451 | 1.0884 | +0.0064 | +0.0787 | 0.2374 | +0.0003 | +0.0233 | 49.2% | +0.8 pp | -6.3 pp | 10.2% | -2.3 pp | +0.0 pp |
| legacy-neutral-dc-rho-0.05 | 128 | 0.6470 | +0.0007 | +0.0440 | 1.0849 | +0.0028 | +0.0752 | 0.2372 | +0.0001 | +0.0231 | 49.2% | +0.8 pp | -6.3 pp | 9.4% | -3.1 pp | -0.8 pp |
| xg-v2.1-prior8 | 128 | 0.6030 | -0.0432 | +0.0000 | 1.0097 | -0.0724 | +0.0000 | 0.2141 | -0.0230 | +0.0000 | 55.5% | +7.0 pp | +0.0 pp | 10.2% | -2.3 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 128 | 0.6074 | -0.0388 | +0.0044 | 1.0151 | -0.0670 | +0.0054 | 0.2149 | -0.0222 | +0.0007 | 55.5% | +7.0 pp | +0.0 pp | 10.2% | -2.3 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.10 | 128 | 0.6055 | -0.0407 | +0.0025 | 1.0126 | -0.0694 | +0.0030 | 0.2146 | -0.0225 | +0.0004 | 55.5% | +7.0 pp | +0.0 pp | 10.2% | -2.3 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.05 | 128 | 0.6040 | -0.0422 | +0.0010 | 1.0108 | -0.0712 | +0.0012 | 0.2143 | -0.0228 | +0.0002 | 55.5% | +7.0 pp | +0.0 pp | 10.2% | -2.3 pp | +0.0 pp |

## Partidos de 0-2 goles

| Variante | N | Brier | Δ Legacy | Δ prior8 | LogLoss | Δ Legacy | Δ prior8 | RPS | Δ Legacy | Δ prior8 | Accuracy | Δ Legacy | Δ prior8 | CS top-1 | Δ Legacy | Δ prior8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 69 | 0.6985 | +0.0000 | +0.0568 | 1.1501 | +0.0000 | +0.0843 | 0.2415 | +0.0000 | +0.0308 | 37.7% | +0.0 pp | -8.7 pp | 20.3% | +0.0 pp | +1.4 pp |
| legacy-neutral-dc-rho-0.15 | 69 | 0.6934 | -0.0051 | +0.0518 | 1.1465 | -0.0036 | +0.0807 | 0.2407 | -0.0008 | +0.0299 | 42.0% | +4.3 pp | -4.3 pp | 15.9% | -4.3 pp | -2.9 pp |
| legacy-neutral-dc-rho-0.10 | 69 | 0.6948 | -0.0037 | +0.0531 | 1.1469 | -0.0031 | +0.0811 | 0.2409 | -0.0006 | +0.0302 | 39.1% | +1.4 pp | -7.2 pp | 15.9% | -4.3 pp | -2.9 pp |
| legacy-neutral-dc-rho-0.05 | 69 | 0.6964 | -0.0021 | +0.0548 | 1.1481 | -0.0020 | +0.0823 | 0.2412 | -0.0003 | +0.0304 | 39.1% | +1.4 pp | -7.2 pp | 14.5% | -5.8 pp | -4.3 pp |
| xg-v2.1-prior8 | 69 | 0.6417 | -0.0568 | +0.0000 | 1.0658 | -0.0843 | +0.0000 | 0.2107 | -0.0308 | +0.0000 | 46.4% | +8.7 pp | +0.0 pp | 18.8% | -1.4 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 69 | 0.6362 | -0.0623 | -0.0055 | 1.0553 | -0.0948 | -0.0105 | 0.2098 | -0.0317 | -0.0009 | 46.4% | +8.7 pp | +0.0 pp | 18.8% | -1.4 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.10 | 69 | 0.6376 | -0.0609 | -0.0041 | 1.0580 | -0.0921 | -0.0078 | 0.2100 | -0.0315 | -0.0007 | 46.4% | +8.7 pp | +0.0 pp | 18.8% | -1.4 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.05 | 69 | 0.6394 | -0.0591 | -0.0023 | 1.0615 | -0.0886 | -0.0043 | 0.2103 | -0.0312 | -0.0004 | 46.4% | +8.7 pp | +0.0 pp | 18.8% | -1.4 pp | +0.0 pp |

## Empates

| Variante | N | Brier | Δ Legacy | Δ prior8 | LogLoss | Δ Legacy | Δ prior8 | RPS | Δ Legacy | Δ prior8 | Accuracy | Δ Legacy | Δ prior8 | CS top-1 | Δ Legacy | Δ prior8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 29 | 0.8507 | +0.0000 | +0.0115 | 1.3626 | +0.0000 | -0.0052 | 0.1513 | +0.0000 | +0.0094 | 0.0% | +0.0 pp | +0.0 pp | 31.0% | +0.0 pp | -13.8 pp |
| legacy-neutral-dc-rho-0.15 | 29 | 0.7780 | -0.0727 | -0.0612 | 1.2401 | -0.1225 | -0.1277 | 0.1392 | -0.0121 | -0.0027 | 10.3% | +10.3 pp | +10.3 pp | 34.5% | +3.4 pp | -10.3 pp |
| legacy-neutral-dc-rho-0.10 | 29 | 0.8019 | -0.0488 | -0.0373 | 1.2793 | -0.0833 | -0.0885 | 0.1431 | -0.0081 | +0.0013 | 3.4% | +3.4 pp | +3.4 pp | 34.5% | +3.4 pp | -10.3 pp |
| legacy-neutral-dc-rho-0.05 | 29 | 0.8261 | -0.0246 | -0.0131 | 1.3201 | -0.0426 | -0.0477 | 0.1472 | -0.0041 | +0.0053 | 3.4% | +3.4 pp | +3.4 pp | 31.0% | +0.0 pp | -13.8 pp |
| xg-v2.1-prior8 | 29 | 0.8392 | -0.0115 | +0.0000 | 1.3678 | +0.0052 | +0.0000 | 0.1419 | -0.0094 | +0.0000 | 0.0% | +0.0 pp | +0.0 pp | 44.8% | +13.8 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 29 | 0.7603 | -0.0904 | -0.0789 | 1.2350 | -0.1276 | -0.1328 | 0.1287 | -0.0226 | -0.0132 | 0.0% | +0.0 pp | +0.0 pp | 44.8% | +13.8 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.10 | 29 | 0.7862 | -0.0645 | -0.0530 | 1.2773 | -0.0853 | -0.0905 | 0.1330 | -0.0182 | -0.0088 | 0.0% | +0.0 pp | +0.0 pp | 44.8% | +13.8 pp | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.05 | 29 | 0.8125 | -0.0382 | -0.0267 | 1.3215 | -0.0411 | -0.0463 | 0.1374 | -0.0139 | -0.0045 | 0.0% | +0.0 pp | +0.0 pp | 44.8% | +13.8 pp | +0.0 pp |

## Calibracion de probabilidad de empate

En el corpus completo, la tasa real de empate es 22.7%. Legacy neutral predice 24.5% y prior8 25.2%.

| Variante | Draw predicho | Draw real | Gap absoluto | Δ gap Legacy | Δ gap prior8 | Draw Brier | Δ Legacy | Δ prior8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 24.5% | 22.7% | 1.9% | +0.0 pp | -0.7 pp | 0.1720 | +0.0000 | -0.0027 |
| legacy-neutral-dc-rho-0.15 | 27.7% | 22.7% | 5.1% | +3.2 pp | +2.5 pp | 0.1742 | +0.0022 | -0.0005 |
| legacy-neutral-dc-rho-0.10 | 26.7% | 22.7% | 4.0% | +2.1 pp | +1.5 pp | 0.1732 | +0.0012 | -0.0015 |
| legacy-neutral-dc-rho-0.05 | 25.6% | 22.7% | 2.9% | +1.1 pp | +0.4 pp | 0.1725 | +0.0005 | -0.0022 |
| xg-v2.1-prior8 | 25.2% | 22.7% | 2.5% | +0.7 pp | +0.0 pp | 0.1747 | +0.0027 | +0.0000 |
| xg-v2.1-prior8-dc-rho-0.15 | 28.8% | 22.7% | 6.1% | +4.2 pp | +3.6 pp | 0.1776 | +0.0056 | +0.0029 |
| xg-v2.1-prior8-dc-rho-0.10 | 27.6% | 22.7% | 4.9% | +3.1 pp | +2.4 pp | 0.1764 | +0.0044 | +0.0017 |
| xg-v2.1-prior8-dc-rho-0.05 | 26.4% | 22.7% | 3.7% | +1.9 pp | +1.2 pp | 0.1754 | +0.0034 | +0.0007 |

### Buckets de calibracion de draw

| Variante | Bucket | N | Draw medio | Draw real | Gap |
|---|---|---:|---:|---:|---:|
| legacy-neutral | 0-20% | 25 | 15.0% | 12.0% | +3.0 pp |
| legacy-neutral | 20-25% | 23 | 22.8% | 21.7% | +1.1 pp |
| legacy-neutral | 25-30% | 64 | 26.4% | 23.4% | +2.9 pp |
| legacy-neutral | 30%+ | 16 | 34.6% | 37.5% | -2.9 pp |
| legacy-neutral-dc-rho-0.15 | 0-20% | 22 | 16.2% | 13.6% | +2.5 pp |
| legacy-neutral-dc-rho-0.15 | 20-25% | 13 | 23.6% | 15.4% | +8.2 pp |
| legacy-neutral-dc-rho-0.15 | 25-30% | 58 | 28.8% | 27.6% | +1.2 pp |
| legacy-neutral-dc-rho-0.15 | 30%+ | 35 | 34.8% | 22.9% | +12.0 pp |
| legacy-neutral-dc-rho-0.10 | 0-20% | 23 | 15.7% | 13.0% | +2.7 pp |
| legacy-neutral-dc-rho-0.10 | 20-25% | 16 | 23.5% | 12.5% | +11.0 pp |
| legacy-neutral-dc-rho-0.10 | 25-30% | 58 | 27.9% | 27.6% | +0.3 pp |
| legacy-neutral-dc-rho-0.10 | 30%+ | 31 | 34.1% | 25.8% | +8.3 pp |
| legacy-neutral-dc-rho-0.05 | 0-20% | 23 | 15.2% | 13.0% | +2.1 pp |
| legacy-neutral-dc-rho-0.05 | 20-25% | 19 | 22.9% | 10.5% | +12.4 pp |
| legacy-neutral-dc-rho-0.05 | 25-30% | 64 | 27.2% | 28.1% | -1.0 pp |
| legacy-neutral-dc-rho-0.05 | 30%+ | 22 | 34.3% | 27.3% | +7.1 pp |
| xg-v2.1-prior8 | 0-20% | 0 | 0.0% | 0.0% | +0.0 pp |
| xg-v2.1-prior8 | 20-25% | 41 | 24.4% | 12.2% | +12.2 pp |
| xg-v2.1-prior8 | 25-30% | 87 | 25.6% | 27.6% | -2.0 pp |
| xg-v2.1-prior8 | 30%+ | 0 | 0.0% | 0.0% | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 0-20% | 0 | 0.0% | 0.0% | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 20-25% | 0 | 0.0% | 0.0% | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 25-30% | 125 | 28.7% | 22.4% | +6.3 pp |
| xg-v2.1-prior8-dc-rho-0.15 | 30%+ | 3 | 31.1% | 33.3% | -2.2 pp |
| xg-v2.1-prior8-dc-rho-0.10 | 0-20% | 0 | 0.0% | 0.0% | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.10 | 20-25% | 0 | 0.0% | 0.0% | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.10 | 25-30% | 127 | 27.6% | 22.8% | +4.7 pp |
| xg-v2.1-prior8-dc-rho-0.10 | 30%+ | 1 | 31.5% | 0.0% | +31.5 pp |
| xg-v2.1-prior8-dc-rho-0.05 | 0-20% | 0 | 0.0% | 0.0% | +0.0 pp |
| xg-v2.1-prior8-dc-rho-0.05 | 20-25% | 3 | 24.7% | 0.0% | +24.7 pp |
| xg-v2.1-prior8-dc-rho-0.05 | 25-30% | 124 | 26.4% | 23.4% | +3.0 pp |
| xg-v2.1-prior8-dc-rho-0.05 | 30%+ | 1 | 30.2% | 0.0% | +30.2 pp |

## Lectura y recomendacion

- Delta negativo mejora Brier, Log Loss, RPS, error de calibracion draw y draw Brier; delta positivo mejora Accuracy y correct score top-1.
- La comparacion contra legacy-neutral permite medir el resultado total; la comparacion contra prior8 aísla el aporte marginal de Dixon-Coles sobre el mejor xG previo.
- Mantener Dixon-Coles como experimento. Incluso una mejora en empates o marcadores bajos no justifica promocion con solo 128 partidos y ratings retrospectivos.
