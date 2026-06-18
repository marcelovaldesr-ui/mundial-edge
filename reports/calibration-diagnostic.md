# Auditoria de calibracion Platt 1X2

Corpus: 448 partidos, Mundiales 1998, 2002, 2006, 2010, 2014, 2018, 2022. Las comparaciones calibradas principales son **leave-one-world-cup-out (LOOWC)**; cada probabilidad de test usa parametros aprendidos solo con los otros seis torneos.

## Auditoria de leakage

- Interseccion de fixtures train/test: **0**.
- Predicciones OOF ausentes/duplicadas: **0/0**.
- Leakage de target detectado: **NO**.
- Features cronologicas: **SI**. En el backtest, stats/standings se calculan antes del partido y el resultado se agrega despues de emitir la prediccion.
- Caveat de features: Los snapshots son estimaciones manuales pseudo-historicas pre-torneo; no usan el target del fold en el fit Platt, pero su proceso de construccion no es una fuente externa totalmente independiente.

Conclusion: el ajuste Platt LOOWC no usa resultados del Mundial excluido. Esto evita leakage directo del calibrador, pero no convierte los ratings manuales en una fuente historica independiente.

## Comparacion global fuera de muestra

| Variante | N | Brier | Log Loss | RPS | Accuracy | Empate pred. | Empate real | Favorito pred. | Favorito real |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| legacy-neutral raw | 448 | 0.6359 | 1.0576 | 0.2193 | 47.5% | 25.0% | 26.8% | 44.9% | 55.9% |
| legacy-neutral calibrated | 448 | 0.6336 | 1.0539 | 0.2183 | 46.9% | 26.8% | 26.8% | 42.2% | 55.9% |
| prior8 raw | 448 | 0.6000 | 1.0075 | 0.2024 | 56.0% | 25.2% | 26.8% | 44.2% | 55.9% |
| prior8 Platt full | 448 | 0.5535 | 0.9374 | 0.1811 | 54.7% | 26.7% | 26.8% | 56.2% | 55.9% |
| v2.2 raw | 448 | 0.5933 | 0.9984 | 0.1993 | 55.6% | 25.1% | 26.8% | 45.1% | 55.9% |
| v2.2 + platt-blend-25 (prior8 preset) | 448 | 0.5730 | 0.9685 | 0.1902 | 56.7% | 25.2% | 26.8% | 48.3% | 55.9% |
| platt-blend-25 | 448 | 0.5792 | 0.9774 | 0.1929 | 56.9% | 25.6% | 26.8% | 47.2% | 55.9% |
| platt-blend-50 | 448 | 0.5646 | 0.9546 | 0.1862 | 56.7% | 25.9% | 26.8% | 50.2% | 55.9% |
| platt-blend-75 | 448 | 0.5560 | 0.9399 | 0.1823 | 56.0% | 26.3% | 26.8% | 53.2% | 55.9% |
| favorite-cap-65 | 448 | 0.5535 | 0.9374 | 0.1811 | 54.7% | 26.7% | 26.8% | 56.2% | 55.9% |
| favorite-max-boost-08 | 448 | 0.5706 | 0.9595 | 0.1864 | 54.7% | 31.1% | 26.8% | 49.7% | 55.9% |

Las filas Legacy/prior8 calibradas son LOOWC. La fila **v2.2 + platt-blend-25 (prior8 preset)** es exploratoria: reutiliza el preset conservador vigente, entrenado sobre prior8, y por tanto no demuestra calibracion propia ni independencia out-of-sample para v2.2.

Prior8 LOOWC: Brier 0.6000 -> 0.5535, Log Loss 1.0075 -> 0.9374, RPS 0.2024 -> 0.1811, Accuracy 56.0% -> 54.7%.

Legacy LOOWC (solo diagnostico, no preset productivo): Brier 0.6359 -> 0.6336, Log Loss 1.0576 -> 1.0539, RPS 0.2193 -> 0.2183, Accuracy 47.5% -> 46.9%.

## Parametros Platt por fold

| Mundial fuera | Modelo | Train/Test | home a/b | draw a/b | away a/b |
|---|---|---:|---:|---:|---:|
| 1998 | prior8 | 384/64 | 3.3433 / 1.0217 | 9.9208 / 9.6955 | 3.2947 / 1.1302 |
| 1998 | Legacy | 384/64 | 0.5725 / -0.1265 | 0.5338 / -0.4532 | 0.7577 / -0.2193 |
| 2002 | prior8 | 384/64 | 3.5875 / 1.0588 | 9.4816 / 9.2371 | 3.5972 / 1.3339 |
| 2002 | Legacy | 384/64 | 0.5803 / -0.1130 | 0.3368 / -0.6559 | 0.7196 / -0.2673 |
| 2006 | prior8 | 384/64 | 3.2844 / 0.9057 | 8.6372 / 8.3638 | 3.1479 / 1.1087 |
| 2006 | Legacy | 384/64 | 0.5377 / -0.1923 | 0.3834 / -0.5738 | 0.7137 / -0.2310 |
| 2010 | prior8 | 384/64 | 3.6177 / 1.0997 | 10.3518 / 10.2051 | 3.3496 / 1.1463 |
| 2010 | Legacy | 384/64 | 0.5946 / -0.0913 | 0.3961 / -0.5647 | 0.7223 / -0.3131 |
| 2014 | prior8 | 384/64 | 3.5929 / 1.0788 | 12.5877 / 12.6105 | 3.3205 / 1.1308 |
| 2014 | Legacy | 384/64 | 0.7484 / -0.0383 | 0.6254 / -0.3213 | 0.6233 / -0.3592 |
| 2018 | prior8 | 384/64 | 3.5852 / 1.0592 | 10.6963 / 10.6167 | 3.3653 / 1.1282 |
| 2018 | Legacy | 384/64 | 0.5805 / -0.1056 | 0.2427 / -0.6939 | 0.7598 / -0.3137 |
| 2022 | prior8 | 384/64 | 3.8919 / 1.1208 | 9.5020 / 9.3163 | 3.7197 / 1.3932 |
| 2022 | Legacy | 384/64 | 0.7532 / -0.0912 | 0.3979 / -0.5336 | 0.7782 / -0.2398 |

Los parametros varian por fold, especialmente draw. El preset `experimental-platt` conserva el fit global manual de prior8, pero las metricas de esta auditoria no lo usan para evaluar el torneo del que aprendio.

## Resultados por segmento

Definiciones: favorito claro = diferencia absoluta de rating >= 5; upset = gana el underdog en esos partidos; 0-2 goles usa el resultado real; grupo/eliminatoria y empate usan la etiqueta real del fixture.

| Segmento | Variante | N | Brier | Log Loss | RPS | Accuracy |
|---|---|---:|---:|---:|---:|---:|
| CLEAR_FAVORITES | legacy-neutral raw | 301 | 0.5988 | 1.0047 | 0.2067 | 55.5% |
| CLEAR_FAVORITES | legacy-neutral calibrated | 301 | 0.6013 | 1.0073 | 0.2078 | 55.1% |
| CLEAR_FAVORITES | prior8 raw | 301 | 0.5677 | 0.9625 | 0.1926 | 64.1% |
| CLEAR_FAVORITES | prior8 Platt full | 301 | 0.5029 | 0.8675 | 0.1627 | 63.8% |
| CLEAR_FAVORITES | v2.2 raw | 301 | 0.5576 | 0.9490 | 0.1879 | 63.8% |
| CLEAR_FAVORITES | v2.2 + platt-blend-25 (prior8 preset) | 301 | 0.5298 | 0.9084 | 0.1753 | 64.1% |
| CLEAR_FAVORITES | platt-blend-25 | 301 | 0.5394 | 0.9221 | 0.1794 | 64.1% |
| CLEAR_FAVORITES | platt-blend-50 | 301 | 0.5191 | 0.8911 | 0.1700 | 64.1% |
| CLEAR_FAVORITES | platt-blend-75 | 301 | 0.5070 | 0.8709 | 0.1645 | 64.1% |
| CLEAR_FAVORITES | favorite-cap-65 | 301 | 0.5029 | 0.8675 | 0.1627 | 63.8% |
| CLEAR_FAVORITES | favorite-max-boost-08 | 301 | 0.5276 | 0.8994 | 0.1703 | 63.8% |
| UPSETS | legacy-neutral raw | 35 | 0.8355 | 1.3681 | 0.3857 | 17.1% |
| UPSETS | legacy-neutral calibrated | 35 | 0.7898 | 1.2903 | 0.3587 | 17.1% |
| UPSETS | prior8 raw | 35 | 0.7778 | 1.2398 | 0.3574 | 0.0% |
| UPSETS | prior8 Platt full | 35 | 1.2184 | 2.1537 | 0.5762 | 0.0% |
| UPSETS | v2.2 raw | 35 | 0.8038 | 1.2820 | 0.3709 | 0.0% |
| UPSETS | v2.2 + platt-blend-25 (prior8 preset) | 35 | 0.9041 | 1.4392 | 0.4214 | 0.0% |
| UPSETS | platt-blend-25 | 35 | 0.8767 | 1.3928 | 0.4067 | 0.0% |
| UPSETS | platt-blend-50 | 35 | 0.9831 | 1.5771 | 0.4596 | 0.0% |
| UPSETS | platt-blend-75 | 35 | 1.0970 | 1.8119 | 0.5161 | 0.0% |
| UPSETS | favorite-cap-65 | 35 | 1.2184 | 2.1537 | 0.5762 | 0.0% |
| UPSETS | favorite-max-boost-08 | 35 | 1.1017 | 1.9104 | 0.5022 | 0.0% |
| DRAWS | legacy-neutral raw | 120 | 0.8783 | 1.3892 | 0.1606 | 3.3% |
| DRAWS | legacy-neutral calibrated | 120 | 0.8302 | 1.3240 | 0.1467 | 0.8% |
| DRAWS | prior8 raw | 120 | 0.8421 | 1.3686 | 0.1432 | 0.0% |
| DRAWS | prior8 Platt full | 120 | 0.8447 | 1.2784 | 0.1652 | 4.2% |
| DRAWS | v2.2 raw | 120 | 0.8454 | 1.3712 | 0.1443 | 0.0% |
| DRAWS | v2.2 + platt-blend-25 (prior8 preset) | 120 | 0.8413 | 1.3467 | 0.1475 | 0.0% |
| DRAWS | platt-blend-25 | 120 | 0.8356 | 1.3413 | 0.1455 | 0.0% |
| DRAWS | platt-blend-50 | 120 | 0.8339 | 1.3171 | 0.1499 | 1.7% |
| DRAWS | platt-blend-75 | 120 | 0.8369 | 1.2961 | 0.1565 | 1.7% |
| DRAWS | favorite-cap-65 | 120 | 0.8447 | 1.2784 | 0.1652 | 4.2% |
| DRAWS | favorite-max-boost-08 | 120 | 0.7551 | 1.1661 | 0.1413 | 4.2% |
| GROUP | legacy-neutral raw | 336 | 0.6351 | 1.0571 | 0.2242 | 50.9% |
| GROUP | legacy-neutral calibrated | 336 | 0.6343 | 1.0547 | 0.2235 | 48.5% |
| GROUP | prior8 raw | 336 | 0.5914 | 0.9951 | 0.2033 | 57.4% |
| GROUP | prior8 Platt full | 336 | 0.5412 | 0.9259 | 0.1809 | 56.8% |
| GROUP | v2.2 raw | 336 | 0.5836 | 0.9848 | 0.1998 | 57.1% |
| GROUP | v2.2 + platt-blend-25 (prior8 preset) | 336 | 0.5620 | 0.9536 | 0.1902 | 58.0% |
| GROUP | platt-blend-25 | 336 | 0.5693 | 0.9639 | 0.1933 | 57.7% |
| GROUP | platt-blend-50 | 336 | 0.5536 | 0.9405 | 0.1862 | 57.7% |
| GROUP | platt-blend-75 | 336 | 0.5443 | 0.9261 | 0.1821 | 57.7% |
| GROUP | favorite-cap-65 | 336 | 0.5412 | 0.9259 | 0.1809 | 56.8% |
| GROUP | favorite-max-boost-08 | 336 | 0.5637 | 0.9543 | 0.1871 | 56.8% |
| KNOCKOUT | legacy-neutral raw | 112 | 0.6386 | 1.0591 | 0.2047 | 37.5% |
| KNOCKOUT | legacy-neutral calibrated | 112 | 0.6315 | 1.0518 | 0.2026 | 42.0% |
| KNOCKOUT | prior8 raw | 112 | 0.6259 | 1.0445 | 0.1996 | 51.8% |
| KNOCKOUT | prior8 Platt full | 112 | 0.5902 | 0.9718 | 0.1816 | 48.2% |
| KNOCKOUT | v2.2 raw | 112 | 0.6223 | 1.0393 | 0.1978 | 50.9% |
| KNOCKOUT | v2.2 + platt-blend-25 (prior8 preset) | 112 | 0.6059 | 1.0131 | 0.1902 | 52.7% |
| KNOCKOUT | platt-blend-25 | 112 | 0.6090 | 1.0178 | 0.1918 | 54.5% |
| KNOCKOUT | platt-blend-50 | 112 | 0.5974 | 0.9967 | 0.1862 | 53.6% |
| KNOCKOUT | platt-blend-75 | 112 | 0.5911 | 0.9812 | 0.1828 | 50.9% |
| KNOCKOUT | favorite-cap-65 | 112 | 0.5902 | 0.9718 | 0.1816 | 48.2% |
| KNOCKOUT | favorite-max-boost-08 | 112 | 0.5911 | 0.9751 | 0.1843 | 48.2% |
| LOW_GOALS_0_2 | legacy-neutral raw | 243 | 0.6805 | 1.1163 | 0.2110 | 40.3% |
| LOW_GOALS_0_2 | legacy-neutral calibrated | 243 | 0.6708 | 1.1043 | 0.2078 | 38.3% |
| LOW_GOALS_0_2 | prior8 raw | 243 | 0.6473 | 1.0770 | 0.1947 | 46.1% |
| LOW_GOALS_0_2 | prior8 Platt full | 243 | 0.6199 | 1.0225 | 0.1856 | 46.5% |
| LOW_GOALS_0_2 | v2.2 raw | 243 | 0.6440 | 1.0721 | 0.1931 | 45.7% |
| LOW_GOALS_0_2 | v2.2 + platt-blend-25 (prior8 preset) | 243 | 0.6292 | 1.0470 | 0.1873 | 47.3% |
| LOW_GOALS_0_2 | platt-blend-25 | 243 | 0.6317 | 1.0511 | 0.1884 | 48.1% |
| LOW_GOALS_0_2 | platt-blend-50 | 243 | 0.6219 | 1.0320 | 0.1848 | 48.6% |
| LOW_GOALS_0_2 | platt-blend-75 | 243 | 0.6180 | 1.0210 | 0.1838 | 48.1% |
| LOW_GOALS_0_2 | favorite-cap-65 | 243 | 0.6199 | 1.0225 | 0.1856 | 46.5% |
| LOW_GOALS_0_2 | favorite-max-boost-08 | 243 | 0.6090 | 1.0070 | 0.1823 | 46.5% |

## Regla de seleccion conservadora

Una politica pasa solo si mejora Brier, Log Loss y RPS globales frente a raw; el Log Loss de upsets no empeora mas de 15%; Accuracy no cae mas de 1 pp; y la probabilidad media del favorito claro no supera su frecuencia real por mas de 3 pp.

| Variante | Brier/LL/RPS mejoran | Delta LL upsets | Delta Accuracy | Inflacion favorito claro | Candidata |
|---|---:|---:|---:|---:|---:|
| platt-blend-25 | SI | +12.3% | +0.9 pp | -13.4 pp | **SI** |
| platt-blend-50 | SI | +27.2% | +0.7 pp | -9.1 pp | **NO** |
| platt-blend-75 | SI | +46.1% | +0.0 pp | -4.9 pp | **NO** |
| favorite-cap-65 | SI | +73.7% | -1.3 pp | -0.6 pp | **NO** |
| favorite-max-boost-08 | SI | +54.1% | -1.3 pp | -10.0 pp | **NO** |

## De donde viene la mejora

- **Favoritos:** prior8 raw asigna 44.2% al favorito frente a 55.9% observado. Platt OOF lo lleva a 56.2%. La mejora principal corrige **subconfianza/compresion**, no sobreconfianza.
- **Empates:** prior8 raw predice 25.2%, Platt OOF 26.7% y la tasa real es 26.8%. Ayuda, pero explica menos que la expansion de favoritos.
- **Distribucion 1X2:** raw concentra casi toda la masa individual entre 20% y 60%; Platt expande la distribucion hacia probabilidades bajas y altas. La renormalizacion conserva suma 1 y mejora Brier/RPS globales.
- **Sobreconfianza:** no es el problema dominante de prior8 raw. En Legacy si aparece sobreconfianza en varios buckets altos; su calibracion diagnostica suaviza/reordena ese patron.
- **Costo en upsets:** en los 35 upsets claros prior8 pasa de Brier 0.7778 a 1.2184 y de Log Loss 1.2398 a 2.1537. La mayor separacion ayuda al promedio y a favoritos, pero penaliza fuerte cuando gana el underdog.

## High-confidence picks

La cohorte raw usa max(1X2) >= 50.0% y se evalua sobre los mismos partidos antes/despues. Tambien se informa la cohorte calibrada con max >= 70.0%.

| Modelo | N raw >=50% | Acc raw | Acc calibrada mismos picks | Retencion pick | N cal. >=70% | Acc cal. >=70% |
|---|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 178 | 53.9% | 53.9% | 100.0% | 2 | 100.0% |
| xg-v2.1-prior8 | 58 | 86.2% | 86.2% | 100.0% | 87 | 81.6% |

Accuracy prior8 global baja -1.3 pp. La cohorte raw de alta confianza no se destruye si su Accuracy y retencion se mantienen cercanas; la tabla permite auditarlo sin cambiar el umbral despues de ver el resultado.

## Reliability diagram data

Cada partido aporta tres observaciones binarias (home/draw/away). El JSON machine-readable esta en `reports/calibration-reliability.json`.

| Variante | Bucket | N | Prob. media | Frecuencia observada |
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
| legacy-neutral calibrated | 0-10% | 4 | 7.4% | 0.0% |
| legacy-neutral calibrated | 10-20% | 81 | 16.3% | 24.7% |
| legacy-neutral calibrated | 20-30% | 574 | 26.1% | 25.3% |
| legacy-neutral calibrated | 30-40% | 353 | 34.6% | 32.0% |
| legacy-neutral calibrated | 40-50% | 211 | 43.9% | 47.4% |
| legacy-neutral calibrated | 50-60% | 79 | 54.5% | 58.2% |
| legacy-neutral calibrated | 60-70% | 40 | 63.8% | 55.0% |
| legacy-neutral calibrated | 70-80% | 2 | 76.9% | 100.0% |
| legacy-neutral calibrated | 80-90% | 0 | - | - |
| legacy-neutral calibrated | 90-100% | 0 | - | - |
| prior8 raw | 0-10% | 0 | - | - |
| prior8 raw | 10-20% | 2 | 19.4% | 0.0% |
| prior8 raw | 20-30% | 643 | 25.7% | 21.6% |
| prior8 raw | 30-40% | 361 | 35.2% | 28.0% |
| prior8 raw | 40-50% | 280 | 44.5% | 56.4% |
| prior8 raw | 50-60% | 58 | 52.5% | 86.2% |
| prior8 raw | 60-70% | 0 | - | - |
| prior8 raw | 70-80% | 0 | - | - |
| prior8 raw | 80-90% | 0 | - | - |
| prior8 raw | 90-100% | 0 | - | - |
| prior8 Platt full | 0-10% | 108 | 6.7% | 8.3% |
| prior8 Platt full | 10-20% | 253 | 14.9% | 12.6% |
| prior8 Platt full | 20-30% | 334 | 25.3% | 27.2% |
| prior8 Platt full | 30-40% | 266 | 33.9% | 35.3% |
| prior8 Platt full | 40-50% | 112 | 45.0% | 43.8% |
| prior8 Platt full | 50-60% | 92 | 55.3% | 48.9% |
| prior8 Platt full | 60-70% | 92 | 64.7% | 62.0% |
| prior8 Platt full | 70-80% | 59 | 74.6% | 79.7% |
| prior8 Platt full | 80-90% | 27 | 83.4% | 85.2% |
| prior8 Platt full | 90-100% | 1 | 92.3% | 100.0% |
| v2.2 raw | 0-10% | 0 | - | - |
| v2.2 raw | 10-20% | 29 | 17.8% | 10.3% |
| v2.2 raw | 20-30% | 624 | 25.5% | 22.4% |
| v2.2 raw | 30-40% | 348 | 35.1% | 27.9% |
| v2.2 raw | 40-50% | 258 | 44.3% | 54.7% |
| v2.2 raw | 50-60% | 73 | 54.0% | 76.7% |
| v2.2 raw | 60-70% | 11 | 62.9% | 90.9% |
| v2.2 raw | 70-80% | 1 | 70.0% | 100.0% |
| v2.2 raw | 80-90% | 0 | - | - |
| v2.2 raw | 90-100% | 0 | - | - |
| v2.2 + platt-blend-25 (prior8 preset) | 0-10% | 2 | 9.1% | 0.0% |
| v2.2 + platt-blend-25 (prior8 preset) | 10-20% | 104 | 17.2% | 5.8% |
| v2.2 + platt-blend-25 (prior8 preset) | 20-30% | 629 | 25.5% | 22.9% |
| v2.2 + platt-blend-25 (prior8 preset) | 30-40% | 243 | 34.6% | 34.2% |
| v2.2 + platt-blend-25 (prior8 preset) | 40-50% | 200 | 44.7% | 47.5% |
| v2.2 + platt-blend-25 (prior8 preset) | 50-60% | 114 | 54.1% | 66.7% |
| v2.2 + platt-blend-25 (prior8 preset) | 60-70% | 45 | 64.4% | 84.4% |
| v2.2 + platt-blend-25 (prior8 preset) | 70-80% | 7 | 73.4% | 85.7% |
| v2.2 + platt-blend-25 (prior8 preset) | 80-90% | 0 | - | - |
| v2.2 + platt-blend-25 (prior8 preset) | 90-100% | 0 | - | - |
| platt-blend-25 | 0-10% | 0 | - | - |
| platt-blend-25 | 10-20% | 48 | 18.6% | 10.4% |
| platt-blend-25 | 20-30% | 687 | 25.5% | 21.3% |
| platt-blend-25 | 30-40% | 249 | 34.8% | 33.3% |
| platt-blend-25 | 40-50% | 200 | 44.8% | 48.0% |
| platt-blend-25 | 50-60% | 142 | 54.0% | 71.8% |
| platt-blend-25 | 60-70% | 18 | 62.5% | 88.9% |
| platt-blend-25 | 70-80% | 0 | - | - |
| platt-blend-25 | 80-90% | 0 | - | - |
| platt-blend-25 | 90-100% | 0 | - | - |
| platt-blend-50 | 0-10% | 0 | - | - |
| platt-blend-50 | 10-20% | 175 | 17.0% | 8.6% |
| platt-blend-50 | 20-30% | 570 | 25.4% | 23.5% |
| platt-blend-50 | 30-40% | 230 | 34.1% | 36.1% |
| platt-blend-50 | 40-50% | 147 | 44.7% | 44.9% |
| platt-blend-50 | 50-60% | 144 | 54.5% | 59.7% |
| platt-blend-50 | 60-70% | 70 | 64.2% | 81.4% |
| platt-blend-50 | 70-80% | 8 | 72.0% | 87.5% |
| platt-blend-50 | 80-90% | 0 | - | - |
| platt-blend-50 | 90-100% | 0 | - | - |
| platt-blend-75 | 0-10% | 27 | 8.8% | 11.1% |
| platt-blend-75 | 10-20% | 265 | 15.6% | 10.6% |
| platt-blend-75 | 20-30% | 422 | 25.4% | 25.4% |
| platt-blend-75 | 30-40% | 252 | 33.6% | 35.7% |
| platt-blend-75 | 40-50% | 125 | 44.7% | 43.2% |
| platt-blend-75 | 50-60% | 120 | 55.2% | 55.0% |
| platt-blend-75 | 60-70% | 84 | 64.2% | 70.2% |
| platt-blend-75 | 70-80% | 46 | 73.6% | 84.8% |
| platt-blend-75 | 80-90% | 3 | 82.3% | 66.7% |
| platt-blend-75 | 90-100% | 0 | - | - |
| favorite-cap-65 | 0-10% | 108 | 6.7% | 8.3% |
| favorite-cap-65 | 10-20% | 253 | 14.9% | 12.6% |
| favorite-cap-65 | 20-30% | 334 | 25.3% | 27.2% |
| favorite-cap-65 | 30-40% | 266 | 33.9% | 35.3% |
| favorite-cap-65 | 40-50% | 112 | 45.0% | 43.8% |
| favorite-cap-65 | 50-60% | 92 | 55.3% | 48.9% |
| favorite-cap-65 | 60-70% | 92 | 64.7% | 62.0% |
| favorite-cap-65 | 70-80% | 59 | 74.6% | 79.7% |
| favorite-cap-65 | 80-90% | 27 | 83.4% | 85.2% |
| favorite-cap-65 | 90-100% | 1 | 92.3% | 100.0% |
| favorite-max-boost-08 | 0-10% | 25 | 8.8% | 16.0% |
| favorite-max-boost-08 | 10-20% | 249 | 15.2% | 11.2% |
| favorite-max-boost-08 | 20-30% | 305 | 26.5% | 22.3% |
| favorite-max-boost-08 | 30-40% | 382 | 33.3% | 33.0% |
| favorite-max-boost-08 | 40-50% | 121 | 45.3% | 45.5% |
| favorite-max-boost-08 | 50-60% | 235 | 54.5% | 60.9% |
| favorite-max-boost-08 | 60-70% | 27 | 62.1% | 88.9% |
| favorite-max-boost-08 | 70-80% | 0 | - | - |
| favorite-max-boost-08 | 80-90% | 0 | - | - |
| favorite-max-boost-08 | 90-100% | 0 | - | - |

## Guardrails

- Valores no finitos: 0
- Probabilidades fuera de [0, 1]: 0
- Sumas 1X2 fuera de tolerancia: 0

## Recomendacion

Solo **platt-blend-25** pasa la regla conservadora y queda como candidate experimental: retiene una mejora global relevante, aumenta Accuracy y limita el deterioro de upsets a 12.3%. Mantener `legacy-neutral` y `STAT_MODEL_CALIBRATION=none` como defaults. No usar aun ninguna calibracion como base productiva de Monte Carlo; primero validar blend-25 con ratings historicos independientes y mas ventanas temporales.
