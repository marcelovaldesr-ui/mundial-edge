-- picks_log: registro de picks mostrados al usuario para tracking de ROI real.
-- Cada fila = un pick distinto (match_id + market + outcome). Se upserta con
-- ignoreDuplicates=true, por lo que solo se registra la primera vez que se muestra.

CREATE TABLE IF NOT EXISTS picks_log (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id      TEXT NOT NULL,
  market        TEXT NOT NULL,
  outcome       TEXT NOT NULL,
  decimal_odds  NUMERIC(6,3) NOT NULL,
  model_prob    NUMERIC(6,4) NOT NULL,
  implied_prob  NUMERIC(6,4) NOT NULL,
  ev            NUMERIC(6,4) NOT NULL,
  shown_at      TIMESTAMPTZ DEFAULT NOW(),
  result        TEXT,         -- 'win' | 'loss' | 'void' | NULL (pendiente)
  settled_at    TIMESTAMPTZ,
  pnl           NUMERIC(8,4), -- en unidades (1u por pick flat betting)
  notes         TEXT,
  UNIQUE (match_id, market, outcome)
);

COMMENT ON TABLE picks_log IS 'Picks mostrados al usuario; se liquidan automáticamente cuando el partido finaliza.';
COMMENT ON COLUMN picks_log.pnl IS 'P&L en unidades con stake flat de 1u por pick.';
