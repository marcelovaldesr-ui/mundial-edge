# Diagnostico de calibracion Platt 1X2

Corpus: 448 partidos, Mundiales 1998, 2002, 2006, 2010, 2014, 2018, 2022. El ajuste es binario uno-contra-resto por mercado y luego renormaliza home/draw/away a 1.

## Comparacion global (ajuste descriptivo sobre corpus completo)

| Variante | N | Brier | Log Loss | RPS | Accuracy | Empate pred. | Empate real | Favorito pred. | Favorito real |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral raw | 448 | 0.6359 | 1.0576 | 0.2193 | 47.5% | 25.0% | 26.8% | 44.9% | 55.9% |
| xg-v2.1-prior8 raw | 448 | 0.6000 | 1.0075 | 0.2024 | 56.0% | 25.2% | 26.8% | 44.2% | 55.9% |
| xg-v2.1-prior8 calibrated | 448 | 0.5503 | 0.9293 | 0.1801 | 56.0% | 26.7% | 26.8% | 56.2% | 55.9% |

## Parametros ajustados

| Mercado | a | b |
|---|---:|---:|
| homeWin | 3.5497 | 1.0475 |
| draw | 10.1698 | 10.0091 |
| awayWin | 3.3941 | 1.1929 |

El preset `experimental-platt` esta marcado **experimental/manual**. No se activa por defecto y no constituye una estimacion fuera de muestra.

## Leave-one-world-cup-out

Cada fila ajusta los parametros con los otros seis Mundiales y evalua exclusivamente el torneo excluido.

| Mundial fuera | Train/Test | Brier raw | Brier cal. | LogLoss raw | LogLoss cal. | RPS raw | RPS cal. | Acc raw | Acc cal. |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1998 | 384/64 | 0.6007 | 0.5335 | 1.0114 | 0.9004 | 0.1918 | 0.1620 | 51.6% | 53.1% |
| 2002 | 384/64 | 0.6160 | 0.5830 | 1.0309 | 0.9765 | 0.2035 | 0.1914 | 51.6% | 48.4% |
| 2006 | 384/64 | 0.5686 | 0.4692 | 0.9647 | 0.8046 | 0.1880 | 0.1450 | 62.5% | 62.5% |
| 2010 | 384/64 | 0.6088 | 0.5703 | 1.0191 | 0.9488 | 0.2034 | 0.1858 | 53.1% | 51.6% |
| 2014 | 384/64 | 0.6079 | 0.5821 | 1.0167 | 0.9666 | 0.2060 | 0.1875 | 57.8% | 56.3% |
| 2018 | 384/64 | 0.5928 | 0.5568 | 0.9942 | 0.9344 | 0.2106 | 0.1906 | 59.4% | 56.3% |
| 2022 | 384/64 | 0.6053 | 0.5796 | 1.0152 | 1.0304 | 0.2136 | 0.2053 | 56.3% | 54.7% |

Agregado fuera de muestra: Brier 0.6000 -> 0.5535, Log Loss 1.0075 -> 0.9374, RPS 0.2024 -> 0.1811, Accuracy 56.0% -> 54.7%.

## Buckets de calibracion

Cada partido aporta tres observaciones binarias (home/draw/away).

| Variante | Bucket | N | Prob. media | Frecuencia real |
|---|---|---:|---:|---:|
| legacy-neutral raw | 0-10% | 27 | 8.1% | 18.5% |
| legacy-neutral raw | 10-20% | 187 | 15.9% | 21.4% |
| legacy-neutral raw | 20-30% | 457 | 25.3% | 27.8% |
| legacy-neutral raw | 30-40% | 312 | 34.8% | 29.2% |
| legacy-neutral raw | 40-50% | 183 | 44.0% | 48.6% |
| legacy-neutral raw | 50-60% | 80 | 54.3% | 50.0% |
| legacy-neutral raw | 60-70% | 52 | 64.0% | 53.8% |
| legacy-neutral raw | 70-80% | 42 | 74.4% | 57.1% |
| legacy-neutral raw | 80-90% | 3 | 85.7% | 100.0% |
| legacy-neutral raw | 90-100% | 1 | 92.4% | 100.0% |
| xg-v2.1-prior8 raw | 0-10% | 0 | - | - |
| xg-v2.1-prior8 raw | 10-20% | 2 | 19.4% | 0.0% |
| xg-v2.1-prior8 raw | 20-30% | 643 | 25.7% | 21.6% |
| xg-v2.1-prior8 raw | 30-40% | 361 | 35.2% | 28.0% |
| xg-v2.1-prior8 raw | 40-50% | 280 | 44.5% | 56.4% |
| xg-v2.1-prior8 raw | 50-60% | 58 | 52.5% | 86.2% |
| xg-v2.1-prior8 raw | 60-70% | 0 | - | - |
| xg-v2.1-prior8 raw | 70-80% | 0 | - | - |
| xg-v2.1-prior8 raw | 80-90% | 0 | - | - |
| xg-v2.1-prior8 raw | 90-100% | 0 | - | - |
| xg-v2.1-prior8 calibrated | 0-10% | 109 | 6.8% | 6.4% |
| xg-v2.1-prior8 calibrated | 10-20% | 250 | 14.9% | 13.2% |
| xg-v2.1-prior8 calibrated | 20-30% | 330 | 25.2% | 26.4% |
| xg-v2.1-prior8 calibrated | 30-40% | 266 | 33.6% | 36.5% |
| xg-v2.1-prior8 calibrated | 40-50% | 117 | 44.7% | 41.9% |
| xg-v2.1-prior8 calibrated | 50-60% | 92 | 55.1% | 48.9% |
| xg-v2.1-prior8 calibrated | 60-70% | 95 | 64.7% | 64.2% |
| xg-v2.1-prior8 calibrated | 70-80% | 58 | 75.0% | 77.6% |
| xg-v2.1-prior8 calibrated | 80-90% | 26 | 83.5% | 88.5% |
| xg-v2.1-prior8 calibrated | 90-100% | 1 | 92.1% | 100.0% |

## Guardrails

- Valores no finitos: 0
- Probabilidades fuera de [0, 1]: 0
- Sumas 1X2 fuera de tolerancia: 0

## Recomendacion

Mantener `STAT_MODEL_CALIBRATION=none` y `legacy-neutral` como defaults productivos. El preset Platt solo debe usarse con `xg-v2.1-prior8` para experimentacion. Antes de promocion: versionar el entrenamiento, ampliar/validar ratings historicos, evaluar estabilidad temporal y decidir usando el resultado LOOWC, no la mejora in-sample. Monte Carlo sigue como paso posterior y separado; no es necesario para calibrar 1X2.
