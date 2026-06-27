# Deploy en Vercel

## 1. Sync local ANTES de desplegar

Con el servidor corriendo localmente (`npm run dev`), ejecuta en orden:

```bash
SECRET=ae49004597d170da78241991d42f2ae45e8e6dcca02949584c3a07a633ecb7de

curl -X GET "http://localhost:3000/api/sync/fixtures?secret=$SECRET"
# → Puebla teams + matches + team_stats desde football-data.org

curl -X GET "http://localhost:3000/api/sync/odds?secret=$SECRET"
# → Puebla cuotas desde The Odds API

curl -X GET "http://localhost:3000/api/sync/predictions?secret=$SECRET"
# → Corre el modelo, genera predictions + edges
```

Verifica en `/admin` que los 3 jobs aparezcan como `success`.

---

## 2. Supabase

1. Crea un proyecto en https://supabase.com
2. SQL Editor → pega y ejecuta `supabase/schema.sql`
3. Settings → API: copia `URL`, `anon key` y `service_role key`

---

## 3. Variables de entorno en Vercel

| Variable | Valor |
|---|---|
| `DATA_MODE` | `live` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (**Sensitive**) |
| `FIXTURES_PROVIDER` | `football-data` |
| `FOOTBALL_DATA_TOKEN` | tu token de football-data.org |
| `FOOTBALL_DATA_COMPETITION` | `WC` |
| `ODDS_PROVIDER` | `the-odds-api` |
| `ODDS_API_KEY` | tu key de the-odds-api.com (**Sensitive**) |
| `ODDS_SPORT_KEY` | `soccer_fifa_world_cup` |
| `ODDS_API_REGIONS` | `eu,uk` |
| `CRON_SECRET` | `ae49004597d170da78241991d42f2ae45e8e6dcca02949584c3a07a633ecb7de` |

> Tip: importa directo desde `.env.local` con el CLI de Vercel:
> `vercel env pull` / `vercel env push`

---

## 4. Importar proyecto en Vercel

1. https://vercel.com → **New Project** → importa el repo
2. Framework: **Next.js** (autodetectado). Root directory: `mundial-edge`
3. Pega las variables de entorno del paso 3
4. **Deploy**

---

## 5. Cron jobs

`vercel.json` define 4 crons:

| Job | Ruta | Frecuencia |
|---|---|---|
| fixtures | `/api/sync/fixtures` | diario 04:00 UTC |
| results | `/api/sync/results` | cada 6 h |
| odds | `/api/sync/odds` | cada 2 h |
| predictions | `/api/sync/predictions` | cada 2 h (+30 min) |

> **Vercel Hobby**: solo soporta 1 cron por proyecto y frecuencia mínima diaria.
> Solución: usa el cron diario (`/api/cron` que corre todo) + dispara manualmente
> desde `/admin` o con un cron externo (GitHub Actions, cron-job.org):
> ```bash
> curl -H "x-cron-secret: $CRON_SECRET" https://TU-APP.vercel.app/api/cron
> ```
> **Vercel Pro**: los 4 crons funcionan sin cambios.

---

## 6. Verificación post-deploy

```bash
# Dispara todos los jobs a la vez
curl -H "x-cron-secret: $CRON_SECRET" https://TU-APP.vercel.app/api/cron

# O job por job
curl -H "x-cron-secret: $CRON_SECRET" https://TU-APP.vercel.app/api/sync/fixtures
curl -H "x-cron-secret: $CRON_SECRET" https://TU-APP.vercel.app/api/sync/odds
curl -H "x-cron-secret: $CRON_SECRET" https://TU-APP.vercel.app/api/sync/predictions
```

- Abre `/` → dashboard con partidos reales
- `/admin` → historial de sync con timestamps y registros
- `/edges` → oportunidades de valor con datos reales
