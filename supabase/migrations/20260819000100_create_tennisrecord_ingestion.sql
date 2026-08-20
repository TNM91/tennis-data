-- TennisRecord is a replaceable, low-authority source. These tables deliberately
-- isolate crawler output from public.players, public.matches, and rating tables.
create extension if not exists pgcrypto;

create table if not exists public.tennisrecord_collector_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  bootstrap_region text not null default 'St. Louis / Missouri',
  min_request_interval_ms integer not null default 3000 check (min_request_interval_ms >= 1000),
  max_requests_per_run integer not null default 25 check (max_requests_per_run between 1 and 100),
  weekly_lookback_days integer not null default 45 check (weekly_lookback_days between 7 and 365),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by_user_id uuid references public.profiles(id) on delete set null
);
insert into public.tennisrecord_collector_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.tennisrecord_sync_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_kind text not null check (trigger_kind in ('manual', 'weekly')),
  status text not null default 'running' check (status in ('running', 'completed', 'blocked', 'failed', 'disabled')),
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  pages_attempted integer not null default 0,
  pages_processed integer not null default 0,
  players_discovered integer not null default 0,
  teams_discovered integer not null default 0,
  matches_staged integer not null default 0,
  canonical_matches_created integer not null default 0,
  duplicates_detected integer not null default 0,
  conflicts_found integer not null default 0,
  blocked_requests integer not null default 0,
  parser_failures integer not null default 0,
  error_message text not null default '',
  requested_by_user_id uuid references public.profiles(id) on delete set null
);
create index if not exists tennisrecord_sync_runs_status_started_idx on public.tennisrecord_sync_runs(status, started_at desc);

create table if not exists public.tennisrecord_crawl_queue (
  id uuid primary key default gen_random_uuid(),
  source_url text not null unique,
  page_kind text not null default 'unknown' check (page_kind in ('match', 'player', 'team', 'league', 'unknown')),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'blocked', 'error')),
  discovered_from text,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  attempted_at timestamptz,
  completed_at timestamptz,
  failure_reason text not null default '',
  last_run_id uuid references public.tennisrecord_sync_runs(id) on delete set null
);
create index if not exists tennisrecord_crawl_queue_work_idx on public.tennisrecord_crawl_queue(status, first_seen_at);

create table if not exists public.tennisrecord_source_pages (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  content_hash text not null,
  http_status integer not null,
  captured_at timestamptz not null,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  blocked boolean not null default false,
  block_reason text not null default '',
  raw_html text,
  sync_run_id uuid references public.tennisrecord_sync_runs(id) on delete set null,
  unique(source_url, content_hash)
);
create index if not exists tennisrecord_source_pages_url_seen_idx on public.tennisrecord_source_pages(source_url, last_seen_at desc);

create table if not exists public.tennisrecord_staged_players (
  id uuid primary key default gen_random_uuid(),
  source_player_key text not null unique,
  name text not null,
  normalized_name text not null,
  city text,
  state text,
  ntrp_label text,
  published_rating numeric,
  source_url text not null,
  raw jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);
create index if not exists tennisrecord_staged_players_identity_idx on public.tennisrecord_staged_players(normalized_name, state, city);

create table if not exists public.tennisrecord_staged_leagues (
  id uuid primary key default gen_random_uuid(),
  source_league_key text not null unique,
  name text not null,
  flight text,
  season_year integer,
  source_url text not null,
  raw jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);
create index if not exists tennisrecord_staged_leagues_lookup_idx on public.tennisrecord_staged_leagues(name, season_year);

create table if not exists public.tennisrecord_staged_teams (
  id uuid primary key default gen_random_uuid(),
  source_team_key text not null unique,
  name text not null,
  league_name text,
  flight text,
  season_year integer,
  source_url text not null,
  raw jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);
create index if not exists tennisrecord_staged_teams_lookup_idx on public.tennisrecord_staged_teams(name, league_name, season_year);

create table if not exists public.tennisrecord_player_identities (
  staged_player_id uuid primary key references public.tennisrecord_staged_players(id) on delete cascade,
  canonical_player_id uuid references public.players(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'matched', 'ambiguous', 'rejected')),
  confidence numeric not null default 0 check (confidence between 0 and 1),
  signals jsonb not null default '[]'::jsonb,
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tennisrecord_staged_matches (
  id uuid primary key default gen_random_uuid(),
  source_match_key text not null unique,
  source_url text not null,
  page_id uuid references public.tennisrecord_source_pages(id) on delete set null,
  played_on date,
  league_name text,
  flight text,
  home_team text,
  away_team text,
  discipline text not null check (discipline in ('singles', 'doubles')),
  court_number integer not null check (court_number > 0),
  score_text text,
  winner_side text check (winner_side in ('A', 'B')),
  participants jsonb not null default '[]'::jsonb,
  fingerprint text not null,
  raw jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);
create index if not exists tennisrecord_staged_matches_fingerprint_idx on public.tennisrecord_staged_matches(fingerprint, played_on desc);

create table if not exists public.tennisrecord_match_observations (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null,
  source text not null check (source in ('admin_verified', 'captain_upload', 'player_upload', 'tenaceiq', 'tennisrecord')),
  source_priority integer not null,
  source_record_id text not null default '',
  source_url text,
  staged_match_id uuid references public.tennisrecord_staged_matches(id) on delete set null,
  canonical_match_id uuid references public.matches(id) on delete set null,
  score_text text,
  winner_side text check (winner_side in ('A', 'B')),
  participants jsonb not null default '[]'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  confidence numeric not null default 0 check (confidence between 0 and 1),
  verified_at timestamptz,
  captured_at timestamptz not null default timezone('utc', now()),
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  superseded_by uuid references public.tennisrecord_match_observations(id) on delete set null,
  content_hash text not null default '',
  unique(fingerprint, source, source_record_id)
);
create index if not exists tennisrecord_match_observations_reconcile_idx on public.tennisrecord_match_observations(fingerprint, source_priority desc, last_seen_at desc);

create table if not exists public.tennisrecord_canonical_matches (
  fingerprint text primary key,
  winning_observation_id uuid references public.tennisrecord_match_observations(id) on delete set null,
  canonical_match_id uuid references public.matches(id) on delete set null,
  winning_source text not null,
  has_conflict boolean not null default false,
  conflict_count integer not null default 0,
  reconciled_at timestamptz not null default timezone('utc', now()),
  promoted_at timestamptz,
  rating_processed_at timestamptz
);
create index if not exists tennisrecord_canonical_matches_promotion_idx on public.tennisrecord_canonical_matches(canonical_match_id, reconciled_at desc);

create or replace function public.set_tennisrecord_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = timezone('utc', now()); return new; end; $$;
drop trigger if exists tennisrecord_settings_updated_at on public.tennisrecord_collector_settings;
create trigger tennisrecord_settings_updated_at before update on public.tennisrecord_collector_settings for each row execute function public.set_tennisrecord_updated_at();
drop trigger if exists tennisrecord_identity_updated_at on public.tennisrecord_player_identities;
create trigger tennisrecord_identity_updated_at before update on public.tennisrecord_player_identities for each row execute function public.set_tennisrecord_updated_at();

alter table public.tennisrecord_collector_settings enable row level security;
alter table public.tennisrecord_sync_runs enable row level security;
alter table public.tennisrecord_crawl_queue enable row level security;
alter table public.tennisrecord_source_pages enable row level security;
alter table public.tennisrecord_staged_players enable row level security;
alter table public.tennisrecord_staged_leagues enable row level security;
alter table public.tennisrecord_staged_teams enable row level security;
alter table public.tennisrecord_player_identities enable row level security;
alter table public.tennisrecord_staged_matches enable row level security;
alter table public.tennisrecord_match_observations enable row level security;
alter table public.tennisrecord_canonical_matches enable row level security;

comment on table public.tennisrecord_staged_matches is 'Untrusted TennisRecord parser output. It never writes directly to production matches.';
comment on table public.tennisrecord_match_observations is 'Append-only match evidence. A TennisRecord refresh cannot replace higher-priority local evidence.';
comment on column public.tennisrecord_staged_players.published_rating is 'External provenance only. It must never seed or update TenAceIQ rating calculations.';
