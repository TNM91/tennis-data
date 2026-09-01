-- Preserve every stated NTRP designation as source evidence. These are
-- factual annual-rating observations, not TennisRecord estimated ratings and
-- never directly overwrite a local TiQ dynamic rating.
create table if not exists public.tennisrecord_ntrp_observations (
  id uuid primary key default gen_random_uuid(),
  observation_key text not null unique,
  staged_player_id uuid not null references public.tennisrecord_staged_players(id) on delete cascade,
  canonical_player_id uuid references public.players(id) on delete set null,
  ntrp numeric not null check (ntrp between 1 and 7),
  ntrp_label text not null,
  effective_date date,
  observed_at timestamptz not null default timezone('utc', now()),
  source_url text not null,
  source_page_id uuid references public.tennisrecord_source_pages(id) on delete set null,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);

create index if not exists tennisrecord_ntrp_observations_canonical_date_idx
  on public.tennisrecord_ntrp_observations(canonical_player_id, effective_date desc);
create index if not exists tennisrecord_ntrp_observations_staged_date_idx
  on public.tennisrecord_ntrp_observations(staged_player_id, effective_date desc);

alter table public.tennisrecord_ntrp_observations enable row level security;

comment on table public.tennisrecord_ntrp_observations is
  'Append-only factual NTRP observations from public TennisRecord profile pages. Used to back-test TiQ projections against annual official outcomes; never stores or uses TennisRecord estimated dynamic ratings.';
