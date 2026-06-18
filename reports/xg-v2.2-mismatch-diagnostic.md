# Diagnóstico xG v2.2 mismatch spread

## Diseño experimental

`xg-v2.2-mismatch-spread` conserva el shrinkage `prior8`, pero elimina exclusivamente el segundo blend del componente ya regularizado contra el mismo rating. Después aplica una transferencia de xG underdog → favorito, sin aumentar el total:

- ratingDiff <=10: 0.
- 10-15: +0.012 por punto sobre 10 (hasta 0.06 transferido).
- 15-20: +0.018 por punto adicional (hasta 0.15 acumulado).
- 20+: +0.025 por punto adicional, cap 0.30.
- xG final permanece en [0.2, 4.5].

La comparación histórica usa 1X2 raw derivado de cada score matrix, sin recalibrar Platt. Esto aísla el efecto de lambdas; reutilizar el calibrador entrenado para prior8 contaminaría la comparación.

## Resultado automático: CANDIDATE

- Delta Brier vs prior8 -0.0067 (límite +0.005).
- Delta Log Loss vs prior8 -0.0090 (límite +0.010).
- Delta Accuracy vs prior8 -0.4 pp (límite -1.0 pp).
- abs(xgDiff) 0.2959 -> 0.3372; modal 1-1 99.6% -> 92.4%.

El resultado es una recomendación diagnóstica. No cambia defaults ni promueve código productivo automáticamente.

## Métricas históricas

| Segmento | Variante | N | Brier | Log Loss | RPS | Accuracy | abs(xgDiff) | Modal 1-1 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| GLOBAL | legacy-neutral | 448 | 0.6359 | 1.0576 | 0.2193 | 47.5% | 0.5880 | 45.8% |
| GLOBAL | xg-v2.1-prior8 | 448 | 0.6000 | 1.0075 | 0.2024 | 56.0% | 0.2959 | 99.6% |
| GLOBAL | xg-v2.2-mismatch-spread | 448 | 0.5933 | 0.9984 | 0.1993 | 55.6% | 0.3372 | 92.4% |
| CLEAR_FAVORITES | legacy-neutral | 156 | 0.5271 | 0.9038 | 0.1950 | 67.9% | 0.7433 | 43.6% |
| CLEAR_FAVORITES | xg-v2.1-prior8 | 156 | 0.5024 | 0.8705 | 0.1823 | 75.0% | 0.5097 | 98.7% |
| CLEAR_FAVORITES | xg-v2.2-mismatch-spread | 156 | 0.4843 | 0.8461 | 0.1740 | 75.0% | 0.6096 | 78.2% |
| UPSETS | legacy-neutral | 35 | 0.8355 | 1.3681 | 0.3857 | 17.1% | 0.5973 | 45.7% |
| UPSETS | xg-v2.1-prior8 | 35 | 0.7778 | 1.2398 | 0.3574 | 0.0% | 0.3689 | 100.0% |
| UPSETS | xg-v2.2-mismatch-spread | 35 | 0.8038 | 1.2820 | 0.3709 | 0.0% | 0.4183 | 88.6% |
| DRAWS | legacy-neutral | 120 | 0.8783 | 1.3892 | 0.1606 | 3.3% | 0.5165 | 44.2% |
| DRAWS | xg-v2.1-prior8 | 120 | 0.8421 | 1.3686 | 0.1432 | 0.0% | 0.2425 | 100.0% |
| DRAWS | xg-v2.2-mismatch-spread | 120 | 0.8454 | 1.3712 | 0.1443 | 0.0% | 0.2614 | 99.2% |
| LOW_GOALS_0_2 | legacy-neutral | 243 | 0.6805 | 1.1163 | 0.2110 | 40.3% | 0.5718 | 44.0% |
| LOW_GOALS_0_2 | xg-v2.1-prior8 | 243 | 0.6473 | 1.0770 | 0.1947 | 46.1% | 0.2877 | 99.6% |
| LOW_GOALS_0_2 | xg-v2.2-mismatch-spread | 243 | 0.6440 | 1.0721 | 0.1931 | 45.7% | 0.3232 | 93.4% |

Favorito claro = ratingDiff >=10. Upset = victoria del equipo con rating al menos 5 puntos menor. Empates y partidos de 0-2 goles se segmentan por resultado real.

## Casos 2026

| Partido | ratingDiff | xG anterior | xG nuevo | Top anterior | Top nuevo | Delta total |
|---|---:|---|---|---|---|---:|
| BRA–HAI (Brazil – Haiti) | 16.0000 | 1.638–1.127 (Δ 0.511, T 2.766) | 1.700–1.040 (Δ 0.661, T 2.740) | 1-1 11.6%, 1-0 10.3%, 2-1 9.5%, 2-0 8.4%, 0-1 7.1% | 1-1 11.4%, 1-0 11.0%, 2-1 9.7%, 2-0 9.3%, 0-1 6.7% | -0.0255 |
| FRA–IRQ (France – Iraq) | 18.0000 | 1.731–1.112 (Δ 0.620, T 2.843) | 1.895–0.991 (Δ 0.904, T 2.886) | 1-1 11.2%, 1-0 10.1%, 2-1 9.7%, 2-0 8.7%, 0-1 6.5% | 1-0 10.6%, 1-1 10.5%, 2-0 10.0%, 2-1 9.9%, 3-0 6.3% | +0.0428 |
| ARG–NZL (escenario control sin fixture pre-match) | 24.0000 | 1.833–0.993 (Δ 0.840, T 2.826) | 2.112–0.742 (Δ 1.370, T 2.854) | 1-0 10.9%, 1-1 10.8%, 2-0 10.0%, 2-1 9.9%, 3-0 6.1% | 2-0 12.9%, 1-0 12.2%, 2-1 9.5%, 3-0 9.0%, 1-1 9.0% | +0.0275 |
| FRA–UND (control: France – Jordan) | 24.0000 | 1.873–1.010 (Δ 0.863, T 2.883) | 2.161–0.752 (Δ 1.409, T 2.913) | 1-1 10.6%, 1-0 10.5%, 2-1 9.9%, 2-0 9.8%, 3-1 6.2% | 2-0 12.7%, 1-0 11.7%, 2-1 9.5%, 3-0 9.1%, 1-1 8.8% | +0.0296 |
| JOR–ARG (Jordan – Argentina) | 24.0000 | 1.044–1.859 (Δ 0.815, T 2.902) | 0.780–2.148 (Δ 1.368, T 2.928) | 1-1 10.6%, 0-1 10.2%, 1-2 9.9%, 0-2 9.5%, 1-3 6.1% | 0-2 12.3%, 0-1 11.5%, 1-2 9.6%, 1-1 9.0%, 0-3 8.8% | +0.0253 |
| PAN–ENG (Panama – England) | 19.0000 | 1.103–1.742 (Δ 0.639, T 2.845) | 0.961–1.901 (Δ 0.940, T 2.862) | 1-1 11.2%, 0-1 10.1%, 1-2 9.7%, 0-2 8.8%, 1-0 6.4% | 0-1 10.9%, 1-1 10.4%, 0-2 10.3%, 1-2 9.9%, 0-3 6.5% | +0.0175 |
| ESP–KSA (Spain – Saudi Arabia) | 17.0000 | 1.659–1.070 (Δ 0.589, T 2.728) | 1.731–0.966 (Δ 0.766, T 2.697) | 1-1 11.6%, 1-0 10.8%, 2-1 9.6%, 2-0 9.0%, 0-1 7.0% | 1-0 11.7%, 1-1 11.3%, 2-0 10.1%, 2-1 9.8%, 0-0 6.7% | -0.0316 |
| SCO–BRA (Scotland – Brazil) | 16.0000 | 1.140–1.714 (Δ 0.574, T 2.855) | 1.069–1.768 (Δ 0.699, T 2.837) | 1-1 11.3%, 0-1 9.9%, 1-2 9.6%, 0-2 8.5%, 1-0 6.6% | 1-1 11.1%, 0-1 10.4%, 1-2 9.8%, 0-2 9.2%, 1-0 6.3% | -0.0173 |

## Guardrails

- Brier no puede empeorar más de 0.005: PASS.
- Log Loss no puede empeorar más de 0.01: PASS.
- Accuracy no puede caer más de 1 pp: PASS.

## Interpretación

La causa confirmada era doble: `bayesianObservedExpectedGoals` atraía tasas y lambda derivado al prior de rating, y luego `estimateExpectedGoals` volvía a mezclar ese resultado con `ratingExpectedGoals`. v2.2 elimina sólo la segunda atracción. El spread posterior es simétrico: aumenta separación, conserva total salvo redondeo y respeta guardrails.
