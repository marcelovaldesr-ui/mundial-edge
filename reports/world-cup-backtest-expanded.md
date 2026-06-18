# Backtest ampliado de Mundiales

## Resumen

Corpus completo de **448 partidos** en 7 Mundiales (1998, 2002, 2006, 2010, 2014, 2018, 2022); 336 de grupos y 112 eliminatorios. Los resultados de knockout usan `score.ft` a 90 minutos; prorroga y penales quedan fuera del 1X2.

Los fixtures provienen de openfootball/worldcup.json, CC0, commit `6d4a1b67e09ced583ecc02f5e900c69dd5ec5a2b`.

## Ratings y cobertura

| Mundial | Snapshot | Pseudo-historico | Partidos con snapshot | Partidos con fallback | Equipos | Equipos sin rating |
|---:|---|---|---:|---:|---:|---:|
| 1998 | 1998 | si | 64 | 0 | 32 | 0 |
| 2002 | 2002 | si | 64 | 0 | 32 | 0 |
| 2006 | 2006 | si | 64 | 0 | 32 | 0 |
| 2010 | 2010 | si | 64 | 0 | 32 | 0 |
| 2014 | 2014 | si | 64 | 0 | 32 | 0 |
| 2018 | 2018 | si | 64 | 0 | 32 | 0 |
| 2022 | 2022 | si | 64 | 0 | 32 | 0 |

**Limitacion principal:** los snapshots 1998-2022 son estimaciones manuales pseudo-historicas de fuerza pre-torneo. Ya no derivan del seed 2026 y cubren los 32 equipos de cada edicion, pero no son Elo externo, ranking oficial ni mediciones independientes. No requieren licencia de terceros.

## Metricas globales

| Bucket | Variante | N | Brier | Delta | Log Loss | Delta | RPS | Delta | Accuracy | Delta |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| GLOBAL | legacy-neutral | 448 | 0.6359 | +0.0000 | 1.0576 | +0.0000 | 0.2193 | +0.0000 | 47.5% | +0.0 pp |
| GLOBAL | xg-v2.1-prior8 | 448 | 0.6000 | -0.0359 | 1.0075 | -0.0501 | 0.2024 | -0.0169 | 56.0% | +8.5 pp |
| GLOBAL | experimental-dixon-coles | 448 | 0.6000 | -0.0359 | 1.0046 | -0.0530 | 0.2024 | -0.0169 | 56.0% | +8.5 pp |
| GLOBAL | xg-v2.1-prior6 | 448 | 0.5992 | -0.0367 | 1.0064 | -0.0512 | 0.2021 | -0.0173 | 55.1% | +7.6 pp |

## Por Mundial

| Bucket | Variante | N | Brier | Delta | Log Loss | Delta | RPS | Delta | Accuracy | Delta |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1998 | legacy-neutral | 64 | 0.6450 | +0.0000 | 1.0744 | +0.0000 | 0.2097 | +0.0000 | 46.9% | +0.0 pp |
| 1998 | xg-v2.1-prior8 | 64 | 0.6007 | -0.0443 | 1.0114 | -0.0630 | 0.1918 | -0.0179 | 51.6% | +4.7 pp |
| 1998 | experimental-dixon-coles | 64 | 0.5959 | -0.0492 | 0.9997 | -0.0747 | 0.1910 | -0.0187 | 51.6% | +4.7 pp |
| 1998 | xg-v2.1-prior6 | 64 | 0.6000 | -0.0450 | 1.0103 | -0.0641 | 0.1913 | -0.0183 | 50.0% | +3.1 pp |
| 2002 | legacy-neutral | 64 | 0.6250 | +0.0000 | 1.0421 | +0.0000 | 0.2079 | +0.0000 | 43.8% | +0.0 pp |
| 2002 | xg-v2.1-prior8 | 64 | 0.6160 | -0.0090 | 1.0309 | -0.0112 | 0.2035 | -0.0044 | 51.6% | +7.8 pp |
| 2002 | experimental-dixon-coles | 64 | 0.6127 | -0.0123 | 1.0233 | -0.0189 | 0.2029 | -0.0050 | 51.6% | +7.8 pp |
| 2002 | xg-v2.1-prior6 | 64 | 0.6137 | -0.0113 | 1.0279 | -0.0143 | 0.2024 | -0.0054 | 50.0% | +6.3 pp |
| 2006 | legacy-neutral | 64 | 0.5962 | +0.0000 | 0.9949 | +0.0000 | 0.2009 | +0.0000 | 56.3% | +0.0 pp |
| 2006 | xg-v2.1-prior8 | 64 | 0.5686 | -0.0276 | 0.9647 | -0.0303 | 0.1880 | -0.0129 | 62.5% | +6.3 pp |
| 2006 | experimental-dixon-coles | 64 | 0.5687 | -0.0275 | 0.9603 | -0.0346 | 0.1880 | -0.0129 | 62.5% | +6.3 pp |
| 2006 | xg-v2.1-prior6 | 64 | 0.5666 | -0.0296 | 0.9618 | -0.0332 | 0.1871 | -0.0137 | 62.5% | +6.3 pp |
| 2010 | legacy-neutral | 64 | 0.6415 | +0.0000 | 1.0662 | +0.0000 | 0.2198 | +0.0000 | 40.6% | +0.0 pp |
| 2010 | xg-v2.1-prior8 | 64 | 0.6088 | -0.0327 | 1.0191 | -0.0470 | 0.2034 | -0.0163 | 53.1% | +12.5 pp |
| 2010 | experimental-dixon-coles | 64 | 0.6075 | -0.0340 | 1.0143 | -0.0519 | 0.2032 | -0.0165 | 53.1% | +12.5 pp |
| 2010 | xg-v2.1-prior6 | 64 | 0.6084 | -0.0331 | 1.0185 | -0.0477 | 0.2033 | -0.0165 | 51.6% | +10.9 pp |
| 2014 | legacy-neutral | 64 | 0.6607 | +0.0000 | 1.0799 | +0.0000 | 0.2278 | +0.0000 | 46.9% | +0.0 pp |
| 2014 | xg-v2.1-prior8 | 64 | 0.6079 | -0.0528 | 1.0167 | -0.0633 | 0.2060 | -0.0217 | 57.8% | +10.9 pp |
| 2014 | experimental-dixon-coles | 64 | 0.6084 | -0.0522 | 1.0144 | -0.0655 | 0.2061 | -0.0216 | 57.8% | +10.9 pp |
| 2014 | xg-v2.1-prior6 | 64 | 0.6066 | -0.0540 | 1.0148 | -0.0651 | 0.2053 | -0.0224 | 57.8% | +10.9 pp |
| 2018 | legacy-neutral | 64 | 0.6106 | +0.0000 | 1.0299 | +0.0000 | 0.2233 | +0.0000 | 53.1% | +0.0 pp |
| 2018 | xg-v2.1-prior8 | 64 | 0.5928 | -0.0178 | 0.9942 | -0.0356 | 0.2106 | -0.0127 | 59.4% | +6.3 pp |
| 2018 | experimental-dixon-coles | 64 | 0.5982 | -0.0124 | 1.0005 | -0.0294 | 0.2115 | -0.0118 | 59.4% | +6.3 pp |
| 2018 | xg-v2.1-prior6 | 64 | 0.5922 | -0.0183 | 0.9935 | -0.0364 | 0.2104 | -0.0130 | 59.4% | +6.3 pp |
| 2022 | legacy-neutral | 64 | 0.6726 | +0.0000 | 1.1157 | +0.0000 | 0.2461 | +0.0000 | 45.3% | +0.0 pp |
| 2022 | xg-v2.1-prior8 | 64 | 0.6053 | -0.0673 | 1.0152 | -0.1005 | 0.2136 | -0.0325 | 56.3% | +10.9 pp |
| 2022 | experimental-dixon-coles | 64 | 0.6088 | -0.0638 | 1.0197 | -0.0960 | 0.2142 | -0.0320 | 56.3% | +10.9 pp |
| 2022 | xg-v2.1-prior6 | 64 | 0.6072 | -0.0654 | 1.0179 | -0.0978 | 0.2145 | -0.0316 | 54.7% | +9.4 pp |

## Por fase

| Bucket | Variante | N | Brier | Delta | Log Loss | Delta | RPS | Delta | Accuracy | Delta |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| GROUP | legacy-neutral | 336 | 0.6351 | +0.0000 | 1.0571 | +0.0000 | 0.2242 | +0.0000 | 50.9% | +0.0 pp |
| GROUP | xg-v2.1-prior8 | 336 | 0.5914 | -0.0437 | 0.9951 | -0.0620 | 0.2033 | -0.0209 | 57.4% | +6.5 pp |
| GROUP | experimental-dixon-coles | 336 | 0.5935 | -0.0415 | 0.9958 | -0.0613 | 0.2037 | -0.0205 | 57.4% | +6.5 pp |
| GROUP | xg-v2.1-prior6 | 336 | 0.5911 | -0.0440 | 0.9947 | -0.0624 | 0.2032 | -0.0210 | 56.8% | +6.0 pp |
| KNOCKOUT | legacy-neutral | 112 | 0.6386 | +0.0000 | 1.0591 | +0.0000 | 0.2047 | +0.0000 | 37.5% | +0.0 pp |
| KNOCKOUT | xg-v2.1-prior8 | 112 | 0.6259 | -0.0127 | 1.0445 | -0.0146 | 0.1996 | -0.0051 | 51.8% | +14.3 pp |
| KNOCKOUT | experimental-dixon-coles | 112 | 0.6196 | -0.0190 | 1.0311 | -0.0281 | 0.1986 | -0.0062 | 51.8% | +14.3 pp |
| KNOCKOUT | xg-v2.1-prior6 | 112 | 0.6237 | -0.0149 | 1.0414 | -0.0177 | 0.1986 | -0.0061 | 50.0% | +12.5 pp |

## Por ronda

| Bucket | Variante | N | Brier | Delta | Log Loss | Delta | RPS | Delta | Accuracy | Delta |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| FINAL | legacy-neutral | 7 | 0.6575 | +0.0000 | 1.1043 | +0.0000 | 0.1907 | +0.0000 | 42.9% | +0.0 pp |
| FINAL | xg-v2.1-prior8 | 7 | 0.6978 | +0.0403 | 1.1534 | +0.0491 | 0.1798 | -0.0108 | 42.9% | +0.0 pp |
| FINAL | experimental-dixon-coles | 7 | 0.6645 | +0.0070 | 1.0973 | -0.0071 | 0.1743 | -0.0164 | 42.9% | +0.0 pp |
| FINAL | xg-v2.1-prior6 | 7 | 0.6946 | +0.0371 | 1.1474 | +0.0430 | 0.1794 | -0.0112 | 28.6% | -14.3 pp |
| GROUP_STAGE | legacy-neutral | 336 | 0.6351 | +0.0000 | 1.0571 | +0.0000 | 0.2242 | +0.0000 | 50.9% | +0.0 pp |
| GROUP_STAGE | xg-v2.1-prior8 | 336 | 0.5914 | -0.0437 | 0.9951 | -0.0620 | 0.2033 | -0.0209 | 57.4% | +6.5 pp |
| GROUP_STAGE | experimental-dixon-coles | 336 | 0.5935 | -0.0415 | 0.9958 | -0.0613 | 0.2037 | -0.0205 | 57.4% | +6.5 pp |
| GROUP_STAGE | xg-v2.1-prior6 | 336 | 0.5911 | -0.0440 | 0.9947 | -0.0624 | 0.2032 | -0.0210 | 56.8% | +6.0 pp |
| QUARTER_FINAL | legacy-neutral | 28 | 0.7727 | +0.0000 | 1.2540 | +0.0000 | 0.2690 | +0.0000 | 17.9% | +0.0 pp |
| QUARTER_FINAL | xg-v2.1-prior8 | 28 | 0.6717 | -0.1010 | 1.1066 | -0.1474 | 0.2160 | -0.0530 | 28.6% | +10.7 pp |
| QUARTER_FINAL | experimental-dixon-coles | 28 | 0.6623 | -0.1104 | 1.0905 | -0.1635 | 0.2144 | -0.0546 | 28.6% | +10.7 pp |
| QUARTER_FINAL | xg-v2.1-prior6 | 28 | 0.6748 | -0.0979 | 1.1103 | -0.1437 | 0.2177 | -0.0513 | 28.6% | +10.7 pp |
| ROUND_OF_16 | legacy-neutral | 56 | 0.5541 | +0.0000 | 0.9311 | +0.0000 | 0.1619 | +0.0000 | 50.0% | +0.0 pp |
| ROUND_OF_16 | xg-v2.1-prior8 | 56 | 0.6056 | +0.0515 | 1.0171 | +0.0861 | 0.1874 | +0.0255 | 58.9% | +8.9 pp |
| ROUND_OF_16 | experimental-dixon-coles | 56 | 0.5980 | +0.0439 | 1.0003 | +0.0692 | 0.1862 | +0.0243 | 58.9% | +8.9 pp |
| ROUND_OF_16 | xg-v2.1-prior6 | 56 | 0.6001 | +0.0460 | 1.0096 | +0.0786 | 0.1848 | +0.0229 | 58.9% | +8.9 pp |
| SEMI_FINAL | legacy-neutral | 14 | 0.7183 | +0.0000 | 1.1848 | +0.0000 | 0.2381 | +0.0000 | 21.4% | +0.0 pp |
| SEMI_FINAL | xg-v2.1-prior8 | 14 | 0.6056 | -0.1127 | 1.0182 | -0.1666 | 0.1997 | -0.0385 | 57.1% | +35.7 pp |
| SEMI_FINAL | experimental-dixon-coles | 14 | 0.6049 | -0.1134 | 1.0129 | -0.1718 | 0.1996 | -0.0386 | 57.1% | +35.7 pp |
| SEMI_FINAL | xg-v2.1-prior6 | 14 | 0.6085 | -0.1098 | 1.0224 | -0.1624 | 0.2006 | -0.0375 | 50.0% | +28.6 pp |
| THIRD_PLACE | legacy-neutral | 7 | 0.5994 | +0.0000 | 1.0081 | +0.0000 | 0.2376 | +0.0000 | 42.9% | +0.0 pp |
| THIRD_PLACE | xg-v2.1-prior8 | 7 | 0.5739 | -0.0255 | 0.9595 | -0.0486 | 0.2517 | +0.0141 | 85.7% | +42.9 pp |
| THIRD_PLACE | experimental-dixon-coles | 7 | 0.6058 | +0.0064 | 1.0099 | +0.0018 | 0.2571 | +0.0194 | 85.7% | +42.9 pp |
| THIRD_PLACE | xg-v2.1-prior6 | 7 | 0.5678 | -0.0316 | 0.9525 | -0.0556 | 0.2478 | +0.0102 | 85.7% | +42.9 pp |

## Favoritos claros, upsets, pocos goles y empates

Favorito claro = diferencia de rating >=9; upset = victoria del equipo con rating al menos 5 puntos menor.

| Bucket | Variante | N | Brier | Delta | Log Loss | Delta | RPS | Delta | Accuracy | Delta |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| CLEAR_FAVORITES | legacy-neutral | 181 | 0.5422 | +0.0000 | 0.9246 | +0.0000 | 0.1964 | +0.0000 | 66.3% | +0.0 pp |
| CLEAR_FAVORITES | xg-v2.1-prior8 | 181 | 0.5172 | -0.0250 | 0.8912 | -0.0334 | 0.1853 | -0.0112 | 72.4% | +6.1 pp |
| CLEAR_FAVORITES | experimental-dixon-coles | 181 | 0.5268 | -0.0155 | 0.9018 | -0.0228 | 0.1868 | -0.0096 | 72.4% | +6.1 pp |
| CLEAR_FAVORITES | xg-v2.1-prior6 | 181 | 0.5162 | -0.0260 | 0.8899 | -0.0348 | 0.1847 | -0.0117 | 72.4% | +6.1 pp |
| UPSETS | legacy-neutral | 35 | 0.8355 | +0.0000 | 1.3681 | +0.0000 | 0.3857 | +0.0000 | 17.1% | +0.0 pp |
| UPSETS | xg-v2.1-prior8 | 35 | 0.7778 | -0.0577 | 1.2398 | -0.1283 | 0.3574 | -0.0283 | 0.0% | -17.1 pp |
| UPSETS | experimental-dixon-coles | 35 | 0.8065 | -0.0289 | 1.3036 | -0.0645 | 0.3622 | -0.0236 | 0.0% | -17.1 pp |
| UPSETS | xg-v2.1-prior6 | 35 | 0.7819 | -0.0536 | 1.2460 | -0.1221 | 0.3594 | -0.0263 | 0.0% | -17.1 pp |
| LOW_GOALS_0_2 | legacy-neutral | 243 | 0.6805 | +0.0000 | 1.1163 | +0.0000 | 0.2110 | +0.0000 | 40.3% | +0.0 pp |
| LOW_GOALS_0_2 | xg-v2.1-prior8 | 243 | 0.6473 | -0.0332 | 1.0770 | -0.0394 | 0.1947 | -0.0163 | 46.1% | +5.8 pp |
| LOW_GOALS_0_2 | experimental-dixon-coles | 243 | 0.6336 | -0.0469 | 1.0518 | -0.0645 | 0.1924 | -0.0186 | 46.1% | +5.8 pp |
| LOW_GOALS_0_2 | xg-v2.1-prior6 | 243 | 0.6469 | -0.0336 | 1.0763 | -0.0401 | 0.1945 | -0.0165 | 45.3% | +4.9 pp |
| DRAWS | legacy-neutral | 120 | 0.8783 | +0.0000 | 1.3892 | +0.0000 | 0.1606 | +0.0000 | 3.3% | +0.0 pp |
| DRAWS | xg-v2.1-prior8 | 120 | 0.8421 | -0.0362 | 1.3686 | -0.0206 | 0.1432 | -0.0174 | 0.0% | -3.3 pp |
| DRAWS | experimental-dixon-coles | 120 | 0.7632 | -0.1151 | 1.2357 | -0.1535 | 0.1300 | -0.0305 | 0.0% | -3.3 pp |
| DRAWS | xg-v2.1-prior6 | 120 | 0.8420 | -0.0362 | 1.3679 | -0.0214 | 0.1433 | -0.0173 | 0.0% | -3.3 pp |

## Estabilidad

| Variante | Mundiales ganados | Delta Brier medio | Mejor Mundial | Delta | Peor Mundial | Delta |
|---|---:|---:|---:|---:|---:|---:|
| legacy-neutral | 0 | +0.0000 | 1998 | +0.0000 | 2022 | +0.0000 |
| xg-v2.1-prior8 | 1 | -0.0359 | 2022 | -0.0673 | 2002 | -0.0090 |
| experimental-dixon-coles | 3 | -0.0359 | 2022 | -0.0638 | 2002 | -0.0123 |
| xg-v2.1-prior6 | 3 | -0.0367 | 2022 | -0.0654 | 2002 | -0.0113 |

Los Mundiales ganados se cuentan por menor Brier entre las cuatro variantes. Mejor/peor Mundial se define por delta Brier contra legacy-neutral.

## prior6 vs prior8

En 448 comparaciones pareadas, el delta Brier medio prior6 - prior8 es -0.0008 (EE 0.0004, IC95% [-0.0016, +0.0001]). **prior6** lidera el promedio, pero la diferencia incluye cero y debe considerarse marginal/no distinguible. prior6 gana 6 Mundiales frente a prior8 y prior8 gana 1. prior8 sigue mejorando Brier frente a Legacy en todos los Mundiales.

## Recomendacion

prior8 mantiene una mejora agregada en las cuatro metricas del corpus ampliado, pero debe seguir como **candidate**, no default: los snapshots reducen el sesgo temporal grueso, aunque siguen siendo estimaciones manuales y prior6 conserva una ventaja Brier marginal.

Dixon-Coles continúa experimental/notRecommended. No se implementa Monte Carlo en esta fase.
