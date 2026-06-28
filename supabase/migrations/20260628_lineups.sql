-- Tabla de alineaciones confirmadas por partido.
-- Usada por el bloque A de API-Football Pro.
-- Si la columna ya existe como JSON en matches, esta tabla
-- actúa como alternativa sin necesidad de alterar la tabla principal.

create table if not exists lineups (
  match_id   uuid        not null references matches(id) on delete cascade,
  fetched_at timestamptz not null default now(),
  home_xi    text[]      not null default '{}',
  away_xi    text[]      not null default '{}',
  source     text        not null default 'api-football',
  primary key (match_id)
);
