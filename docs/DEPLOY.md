# Deploy en Vercel

## 1. Repositorio
```bash
cd mundial-edge
git init && git add . && git commit -m "Mundial Edge MVP"
# sube a GitHub/GitLab
```

## 2. Supabase
1. Crea un proyecto en https://supabase.com
2. SQL Editor → pega y ejecuta `supabase/schema.sql`
3. Settings → API: copia `URL`, `anon key` y `service_role key`

## 3. Importar en Vercel
1. https://vercel.com → **New Project** → importa el repo
2. Framework: **Next.js** (autodetectado). Root: `mundial-edge`
3. **Environment Variables** (Production + Preview):
   ```
   DATA_MODE=live
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...        # marca como "Sensitive"
   API_FOOTBALL_KEY=...                 # proveedor principal (gratis, sin tarjeta)
   API_FOOTBALL_BASE=https://v3.football.api-sports.io
   API_FOOTBALL_LEAGUE=1
   API_FOOTBALL_SEASON=2026
   ODDS_PROVIDER=api-football
   CRON_SECRET=<token-aleatorio-largo>
   # Opcional (respaldo de cuotas): ODDS_PROVIDER=the-odds-api + ODDS_API_KEY...
   ```
   > Tip: empieza con `DATA_MODE=mock` para validar el deploy sin gastar
   > cuota de APIs, luego cambia a `live`.
4. **Deploy**.

## 4. Cron jobs
`vercel.json` ya define la programación. Vercel los registra automáticamente y
añade el header `Authorization: Bearer $CRON_SECRET` en cada ejecución
(define `CRON_SECRET` en el proyecto). Schedules:

| Job | Frecuencia |
|---|---|
| fixtures | diario 04:00 UTC |
| results | cada 6 h |
| odds | cada 2 h |
| predictions | cada 2 h (+30 min) |

> Los cron jobs de Vercel requieren plan **Pro** para sub-diario. En Hobby
> puedes dejar uno diario o disparar `/api/cron` desde un cron externo
> (GitHub Actions, cron-job.org) enviando el `CRON_SECRET`.

## 5. Verificación post-deploy
- Abre `/` → dashboard con datos.
- `/admin` → ejecuta "Cuotas" y "Predicciones", revisa el historial.
- Llamada directa:
  ```bash
  curl -H "x-cron-secret: $CRON_SECRET" https://TU-APP.vercel.app/api/cron
  ```

## 6. Primer poblado de datos (modo live)
Con API-Football basta ejecutar los jobs en orden; el job **fixtures** ya trae
equipos + estadísticas + partidos en una sola corrida:

```bash
curl -H "x-cron-secret: $SECRET" https://TU-APP/api/sync/fixtures     # teams + stats + matches
curl -H "x-cron-secret: $SECRET" https://TU-APP/api/sync/odds         # cuotas
curl -H "x-cron-secret: $SECRET" https://TU-APP/api/sync/predictions  # modelo + edges
# o todo de una: /api/cron
```

> El plan free son **100 req/día**. El job `fixtures` gasta ~1 req por equipo
> (estadísticas) + 2 req (equipos y partidos), así que un poblado completo del
> Mundial (~32 equipos) consume ~35 req. Espacia las corridas para no agotar la cuota.
