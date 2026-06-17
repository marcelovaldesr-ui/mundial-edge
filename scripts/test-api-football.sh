#!/usr/bin/env bash
# Verifica que tu API_FOOTBALL_KEY funciona. Uso: bash scripts/test-api-football.sh
set -a; [ -f .env.local ] && . ./.env.local; set +a
if [ -z "$API_FOOTBALL_KEY" ]; then echo "Falta API_FOOTBALL_KEY en .env.local"; exit 1; fi
echo "Probando API-Football (status de la cuenta)..."
curl -fsS -H "x-apisports-key: $API_FOOTBALL_KEY" \
  "${API_FOOTBALL_BASE:-https://v3.football.api-sports.io}/status" | head -c 1500
echo
