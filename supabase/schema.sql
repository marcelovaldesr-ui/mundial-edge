-- ============================================================
--  Mundial Edge — Esquema Supabase / Postgres
--  Ejecutar en Supabase SQL Editor. Idempotente (IF NOT EXISTS).
-- ============================================================

-- Extensiones
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ─── teams ──────────────────────────────────────────────────
create table if not exists teams (
  id          uuid primary key default gen_random_uuid(),
  external_id text unique,                  -- id del proveedor (API-Football)
  name        text not null,
  code        text not null,                -- ISO-3 aprox. (ARG, BRA, ...)
  "group"     text,
  flag        text,
  fifa_rank   int,
  created_at  timestamptz not null default now()
);
-- Para instalaciones previas: añade la columna si la tabla ya existía.
alter table teams add column if not exists external_id text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'teams_external_id_key') then
    alter table teams add constraint teams_external_id_key unique (external_id);
  end if;
end $$;

-- ─── matches ────────────────────────────────────────────────
create table if not exists matches (
  id            uuid primary key default gen_random_uuid(),
  external_id   text unique,               -- id del proveedor (fixtures)
  home_team_id  uuid not null references teams(id) on delete cascade,
  away_team_id  uuid not null references teams(id) on delete cascade,
  stage         text not null,             -- 'Group A', 'Round of 32', ...
  kickoff       timestamptz not null,
  venue         text,
  status        text not null default 'scheduled'
                check (status in ('scheduled','live','finished','postponed')),
  home_score    int,
  away_score    int,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_matches_kickoff on matches(kickoff);
create index if not exists idx_matches_status  on matches(status);

-- ─── team_stats ─────────────────────────────────────────────
create table if not exists team_stats (
  team_id        uuid primary key references teams(id) on delete cascade,
  matches_played int  not null default 0,
  goals_for      int  not null default 0,
  goals_against  int  not null default 0,
  goal_diff      int  generated always as (goals_for - goals_against) stored,
  gf_per_game    numeric(5,3) not null default 0,
  ga_per_game    numeric(5,3) not null default 0,
  recent_form    text[] not null default '{}',   -- {'W','D','L'} reciente primero
  updated_at     timestamptz not null default now()
);

-- ─── odds ───────────────────────────────────────────────────
create table if not exists odds (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null references matches(id) on delete cascade,
  bookmaker     text not null,
  market        text not null check (market in ('1x2','btts','over_under_2_5')),
  outcome       text not null,             -- home/draw/away/yes/no/over/under
  decimal_odds  numeric(7,3) not null check (decimal_odds > 1),
  source        text not null default 'mock',
  fetched_at    timestamptz not null default now(),
  unique (match_id, bookmaker, market, outcome)
);
create index if not exists idx_odds_match on odds(match_id);

-- ─── predictions ────────────────────────────────────────────
create table if not exists predictions (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references matches(id) on delete cascade,
  market            text not null,
  outcome           text not null,
  model_probability numeric(6,5) not null check (model_probability between 0 and 1),
  model_version     text not null,
  source            text not null,
  created_at        timestamptz not null default now(),
  unique (match_id, market, outcome, model_version)
);
create index if not exists idx_predictions_match on predictions(match_id);

-- ─── edges ──────────────────────────────────────────────────
create table if not exists edges (
  id                  uuid primary key default gen_random_uuid(),
  match_id            uuid not null references matches(id) on delete cascade,
  market              text not null,
  outcome             text not null,
  decimal_odds        numeric(7,3) not null,
  implied_probability numeric(6,5) not null,
  model_probability   numeric(6,5) not null,
  edge                numeric(7,5) not null,
  expected_value      numeric(7,5) not null,
  tier                text not null check (tier in ('no_bet','no_value','low','medium','high')),
  bookmaker           text not null,
  source              text not null,
  updated_at          timestamptz not null default now(),
  unique (match_id, market, outcome)
);
create index if not exists idx_edges_ev    on edges(expected_value desc);
create index if not exists idx_edges_match on edges(match_id);
create index if not exists idx_edges_tier  on edges(tier);

-- ─── sync_logs ──────────────────────────────────────────────
create table if not exists sync_logs (
  id               uuid primary key default gen_random_uuid(),
  job              text not null check (job in ('fixtures','results','odds','predictions')),
  status           text not null check (status in ('success','error','running')),
  source           text not null,
  records_affected int  not null default 0,
  message          text,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz
);
create index if not exists idx_sync_logs_job on sync_logs(job, started_at desc);

-- ─── Vista: mejores oportunidades (para el dashboard) ───────
create or replace view v_top_edges as
select
  e.*,
  m.kickoff, m.stage, m.status,
  ht.name as home_name, ht.code as home_code, ht.flag as home_flag,
  at.name as away_name, at.code as away_code, at.flag as away_flag
from edges e
join matches m on m.id = e.match_id
join teams ht on ht.id = m.home_team_id
join teams at on at.id = m.away_team_id
where m.status = 'scheduled'
order by e.expected_value desc;

-- ============================================================
--  Row Level Security (lectura pública, escritura solo server)
-- ============================================================
alter table teams       enable row level security;
alter table matches     enable row level security;
alter table team_stats  enable row level security;
alter table odds        enable row level security;
alter table predictions enable row level security;
alter table edges       enable row level security;
alter table sync_logs   enable row level security;

-- Lectura anónima (datos públicos del análisis)
do $$
declare t text;
begin
  foreach t in array array['teams','matches','team_stats','odds','predictions','edges']
  loop
    execute format('drop policy if exists "public_read_%1$s" on %1$s;', t);
    execute format('create policy "public_read_%1$s" on %1$s for select using (true);', t);
  end loop;
end$$;

-- La escritura se hace con la service_role key (omite RLS).
-- No se crean políticas de insert/update para anon: queda bloqueado por defecto.
