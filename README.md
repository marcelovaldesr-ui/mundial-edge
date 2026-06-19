# ⚽ Mundial Edge

Plataforma web de **análisis estadístico** del Mundial 2026. Compara la
probabilidad estimada por un modelo propio contra la probabilidad implícita
de las cuotas del mercado, y calcula **edge** y **valor esperado (EV)**.

> **Aviso:** Es una herramienta **probabilística**. *No garantiza resultados*,
> no es asesoría financiera ni una recomendación de apuesta. Nunca se usan
> frases como "apuesta segura". Juega con responsabilidad. +18.

---

## 🧱 Stack

Next.js 14 (App Router) · TypeScript · Tailwind · shadcn/ui · Supabase/Postgres ·
Recharts · API Routes · Vercel (cron jobs).

## Estado de producción 2026

- Modelo recomendado: `calibrated-matrix` (xG v2.2 mismatch-spread, `T=0.65`).
- Simulación: 10.000 iteraciones con 12 grupos y ocho mejores terceros.
- Backtesting público: 448 partidos de siete Mundiales (1998–2022).
- Rutas públicas: [`/transparencia`](/transparencia) y [`/metodologia`](/metodologia).
- Ensayo de lanzamiento: 72 partidos sobre un pool sintético versionado de 48 ratings locales. No se presenta como sorteo oficial mientras el repositorio conserve plazas por confirmar.

## 📁 Estructura

```
mundial-edge/
├── supabase/schema.sql          # Esquema completo (7 tablas + vista + RLS)
├── vercel.json                  # Definición de cron jobs
├── .env.example                 # Variables de entorno
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Layout + nav + disclaimer global
│   │   ├── page.tsx             # 1. Dashboard (próximos + mejores oportunidades)
│   │   ├── matches/page.tsx     # 2. Listado de partidos
│   │   ├── matches/[id]/page.tsx# 3. Detalle de partido (gráfico + tabla)
│   │   ├── edges/page.tsx       # 4. Ranking de edges (tabla ordenable)
│   │   ├── transparencia/       # Métricas, baselines y fiabilidad
│   │   ├── metodologia/         # Explicación pública del pipeline
│   │   ├── admin/page.tsx       # 5. Panel admin (sync manual + logs)
│   │   └── api/
│   │       ├── sync/{fixtures,results,odds,predictions}/route.ts
│   │       └── cron/route.ts    # 6. Cron: cadena completa o ?job=
│   ├── components/              # nav, match-card, edge-table, probability-chart,
│   │   │                        #   risk-badge, disclaimer, last-updated, sync-panel
│   │   └── ui/                  # shadcn: button, card, badge, table
│   └── lib/
│       ├── types.ts             # Tipos de dominio
│       ├── utils.ts             # cn(), formato, DISCLAIMER
│       ├── auth.ts              # Validación de CRON_SECRET
│       ├── model/               # ← Modelo estadístico
│       │   ├── poisson.ts       #   PMF Poisson + matriz de marcadores
│       │   ├── expected-goals.ts#   λ por equipo (gf/ga, gd, forma, rival)
│       │   ├── odds.ts          #   implícita + corrección de overround
│       │   ├── edge.ts          #   edge, EV, clasificación por tiers
│       │   └── engine.ts        #   predicciones + edges por partido
│       ├── data/
│       │   ├── mock.ts          #   dataset de demo (sin APIs)
│       │   ├── providers.ts     #   adaptadores The Odds API / API-Football
│       │   ├── repository.ts    #   lectura (mock | live)
│       │   └── sync.ts          #   orquestación de jobs (escritura)
│       └── supabase/{client,server}.ts
├── scripts/e2e/                 # Simulacro completo de 72 partidos
├── scripts/perf/                # Benchmark Monte Carlo/predicciones/HTTP
└── data/{e2e,perf}/             # Artefactos auditables generados
```

## 🚀 Inicio rápido (modo mock, sin APIs)

```bash
cd mundial-edge
npm install            # si la carpeta trae un node_modules parcial, bórralo antes
cp .env.example .env.local   # DATA_MODE=mock ya viene por defecto
npm run dev            # http://localhost:3000
```

En **modo mock** todo funciona sin credenciales: las predicciones y edges se
computan al vuelo desde `src/lib/data/mock.ts`.

> ⚠️ Si esta carpeta llegó con un `node_modules/` incompleto, elimínalo y vuelve
> a ejecutar `npm install` para una instalación limpia.

## 🔑 Variables de entorno

| Variable | Para qué | Requerida |
|---|---|---|
| `DATA_MODE` | `mock` o `live` | sí |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | live |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | lectura cliente | live |
| `SUPABASE_SERVICE_ROLE_KEY` | escritura server (sync) | live |
| `API_FOOTBALL_KEY` | **proveedor principal** (fixtures, stats, cuotas) | live |
| `API_FOOTBALL_BASE` | host (default `v3.football.api-sports.io`) | live |
| `API_FOOTBALL_LEAGUE` / `API_FOOTBALL_SEASON` | `1` (Mundial) / `2026` | live |
| `ODDS_PROVIDER` | `api-football` (default) o `the-odds-api` | no |
| `ODDS_API_KEY` / `ODDS_API_BASE` / `ODDS_SPORT_KEY` | The Odds API (respaldo de cuotas) | opcional |
| `CRON_SECRET` | autoriza `/api/sync/*` y `/api/cron` | producción |
| `STAT_MODEL_VARIANT` | `calibrated-matrix` en producción | producción |
| `CALIBRATION_TEMPERATURE` | temperatura estructural (`0.65`) | producción |
| `SIMULATION_ITERATIONS` | iteraciones Monte Carlo (`10000`) | producción |
| `MIN_EDGE_DEFAULT` | edge mínimo (`0.02`) | no |
| `MIN_CONFIDENCE_FILTER` | confianza mínima (`low`) | no |
| `MAX_PARLAYS_PER_REQUEST` | límite de combinadas (`50`) | no |

Ver `.env.example` para el detalle.

### Proveedor de datos: 100% gratis con API-Football

Un solo proveedor cubre todo el MVP sin tarjeta de crédito:

1. Crea una cuenta en **https://dashboard.api-football.com** (plan free: 100 req/día,
   todos los endpoints, sin tarjeta).
2. Copia tu API key en `API_FOOTBALL_KEY`.
3. `ODDS_PROVIDER=api-football` usa el endpoint de cuotas del mismo proveedor;
   The Odds API queda solo como respaldo (`ODDS_PROVIDER=the-odds-api`).

> El adaptador real está en `src/lib/data/providers.ts` (mapea fixtures,
> resultados, `teams/statistics` y `odds` de API-Football a nuestros tipos).
> `sync.ts` resuelve el mapeo `external_id` del proveedor → `uuid` de la BD.

## 🗄️ Base de datos

Ejecuta `supabase/schema.sql` en el **SQL Editor** de Supabase. Crea las tablas
`teams, matches, team_stats, odds, predictions, edges, sync_logs`, la vista
`v_top_edges` y políticas RLS de **lectura pública / escritura solo service_role**.

## 🔁 Sincronización

| Endpoint | Acción |
|---|---|
| `GET/POST /api/sync/fixtures` | partidos |
| `GET/POST /api/sync/results` | resultados |
| `GET/POST /api/sync/odds` | cuotas |
| `GET/POST /api/sync/predictions` | recalcula predicciones + edges |
| `GET /api/cron` | cadena completa (o `?job=odds`) |

Todos exigen el `CRON_SECRET` en producción (`Authorization: Bearer …`,
header `x-cron-secret`, o `?secret=`). El **panel admin** (`/admin`) los dispara
manualmente. Los **cron jobs** de Vercel están en `vercel.json`.

## 📈 El modelo de producción

1. Estima goles esperados (λ) combinando rating histórico, forma observada,
   promedio del torneo y contexto de grupos, con prior bayesiano para muestras cortas.
2. Construye la matriz de marcadores (Poisson × Poisson) y deriva 1X2,
   ambos marcan y +/- 2.5.
3. `implied_probability = 1 / decimal_odds`, ajustada por **overround** cuando
   hay varias cuotas del mismo mercado (devig proporcional).
4. `edge = model_probability − implied_probability`
5. `expected_value = model_probability × decimal_odds − 1`

**Clasificación por EV:** `< 0` No apostar · `0–3%` Sin valor suficiente ·
`3–8%` Valor bajo · `8–15%` Valor medio · `> 15%` Valor alto (con advertencia).

La matriz calibrada aplica `T=0.65`, valor seleccionado sobre 448 partidos. Cada
predicción publica un waterfall xG, intervalos P10–P90 por bootstrap de lambdas
y una explicación en lenguaje natural.

## Pruebas y ensayo de lanzamiento

```bash
npm run typecheck
npm run lint
npm run e2e:full-tournament       # genera data/e2e/*.json
npm run perf:launch               # genera data/perf/performance-report.json
npm run verify:launch-robustness
npm run prelaunch                 # checklist completa, incluida build
```

Para añadir tiempos HTTP al benchmark, levanta la aplicación y ejecuta
`PERF_BASE_URL=http://localhost:3000 npm run perf:launch` (en PowerShell:
`$env:PERF_BASE_URL='http://localhost:3000'; npm run perf:launch`).

La metodología pública está en [`/metodologia`](/metodologia), los resultados
auditables en [`/transparencia`](/transparencia) y el detalle de ratings en
[`docs/ratings.md`](docs/ratings.md).

## 📦 Deploy en Vercel

Ver [`docs/DEPLOY.md`](docs/DEPLOY.md).

## 🛣️ Mejoras post-MVP

Ver [`docs/POST_MVP.md`](docs/POST_MVP.md).
