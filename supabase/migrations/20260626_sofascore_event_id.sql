-- ============================================================
--  Mundial Edge — Migración: Sofascore integration
--  Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Añadir sofascore_event_id a matches
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS sofascore_event_id TEXT;

CREATE INDEX IF NOT EXISTS idx_matches_sofascore_event_id
  ON matches (sofascore_event_id)
  WHERE sofascore_event_id IS NOT NULL;

COMMENT ON COLUMN matches.sofascore_event_id IS
  'ID del evento en Sofascore (API no oficial, api.sofascore.app). Usado para obtener cuotas extendidas.';

-- 2. Añadir columna line a odds (línea de mercado: 1.5, 2.5, 3.5 para over/under)
ALTER TABLE odds
  ADD COLUMN IF NOT EXISTS line NUMERIC(4,1);

COMMENT ON COLUMN odds.line IS
  'Línea del mercado: 1.5, 2.5, 3.5 para over_under_X_5; NULL para otros mercados.';

-- 3. Ampliar el CHECK de market para admitir los nuevos mercados de Sofascore
--    (los existentes son: 1x2, btts, over_under_2_5)
ALTER TABLE odds DROP CONSTRAINT IF EXISTS odds_market_check;
ALTER TABLE odds
  ADD CONSTRAINT odds_market_check
  CHECK (market IN (
    '1x2',
    'btts',
    'over_under_2_5',
    'over_under_1_5',
    'over_under_3_5',
    'double_chance'
  ));
