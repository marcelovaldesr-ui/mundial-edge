-- Agregar campos Kelly Criterion a picks_log para análisis de ROI por rango de stake.
ALTER TABLE picks_log
  ADD COLUMN IF NOT EXISTS kelly_pct   NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS stake_pct   NUMERIC(6,4);

COMMENT ON COLUMN picks_log.kelly_pct IS 'Kelly% bruto (sin fraccionar). NULL si EV insuficiente.';
COMMENT ON COLUMN picks_log.stake_pct IS 'Stake% recomendado (25% Kelly, capeado a 3%). NULL si EV insuficiente.';
