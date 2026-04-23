-- TIQ team match events: one row per team-vs-team matchup
create table if not exists public.tiq_team_league_match_events (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.tiq_leagues(id) on delete cascade,
  team_a_name text not null default '',
  team_a_id text,
  team_b_name text not null default '',
  team_b_id text,
  match_date date not null,
  facility text not null default '',
  notes text not null default '',
  winner_team_name text,
  winner_team_id text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists tiq_team_events_league_idx
  on public.tiq_team_league_match_events (league_id, match_date desc);

-- TIQ team match lines: individual singles/doubles matches within an event
create table if not exists public.tiq_team_league_match_lines (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.tiq_team_league_match_events(id) on delete cascade,
  line_number int not null,
  match_type text not null check (match_type in ('singles', 'doubles')),
  side_a_player_1_name text not null default '',
  side_a_player_1_id text,
  side_a_player_2_name text not null default '',
  side_a_player_2_id text,
  side_b_player_1_name text not null default '',
  side_b_player_1_id text,
  side_b_player_2_name text not null default '',
  side_b_player_2_id text,
  winner_side text check (winner_side in ('A', 'B')),
  score text not null default '',
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tiq_team_match_lines_unique unique (event_id, line_number)
);

create index if not exists tiq_team_lines_event_idx
  on public.tiq_team_league_match_lines (event_id, line_number);

-- Updated-at triggers
create or replace function public.set_tiq_team_event_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = timezone('utc', now()); return new; end; $$;

create or replace function public.set_tiq_team_line_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = timezone('utc', now()); return new; end; $$;

drop trigger if exists set_tiq_team_event_updated_at on public.tiq_team_league_match_events;
create trigger set_tiq_team_event_updated_at
  before update on public.tiq_team_league_match_events
  for each row execute function public.set_tiq_team_event_updated_at();

drop trigger if exists set_tiq_team_line_updated_at on public.tiq_team_league_match_lines;
create trigger set_tiq_team_line_updated_at
  before update on public.tiq_team_league_match_lines
  for each row execute function public.set_tiq_team_line_updated_at();

-- RLS
alter table public.tiq_team_league_match_events enable row level security;
alter table public.tiq_team_league_match_lines enable row level security;

drop policy if exists "Public TIQ team events are readable" on public.tiq_team_league_match_events;
create policy "Public TIQ team events are readable"
  on public.tiq_team_league_match_events for select
  using (exists (
    select 1 from public.tiq_leagues
    where tiq_leagues.id = tiq_team_league_match_events.league_id
      and (tiq_leagues.is_public = true or tiq_leagues.created_by_user_id = auth.uid())
  ));

drop policy if exists "Authenticated users can create TIQ team events" on public.tiq_team_league_match_events;
create policy "Authenticated users can create TIQ team events"
  on public.tiq_team_league_match_events for insert to authenticated
  with check (auth.uid() is not null and created_by_user_id = auth.uid() and updated_by_user_id = auth.uid());

drop policy if exists "Creators can update TIQ team events" on public.tiq_team_league_match_events;
create policy "Creators can update TIQ team events"
  on public.tiq_team_league_match_events for update to authenticated
  using (auth.uid() = created_by_user_id)
  with check (auth.uid() = created_by_user_id and updated_by_user_id = auth.uid());

drop policy if exists "Creators can delete TIQ team events" on public.tiq_team_league_match_events;
create policy "Creators can delete TIQ team events"
  on public.tiq_team_league_match_events for delete to authenticated
  using (auth.uid() = created_by_user_id);

drop policy if exists "Public TIQ team lines are readable" on public.tiq_team_league_match_lines;
create policy "Public TIQ team lines are readable"
  on public.tiq_team_league_match_lines for select
  using (exists (
    select 1 from public.tiq_team_league_match_events e
    join public.tiq_leagues l on l.id = e.league_id
    where e.id = tiq_team_league_match_lines.event_id
      and (l.is_public = true or l.created_by_user_id = auth.uid())
  ));

drop policy if exists "Authenticated users can create TIQ team lines" on public.tiq_team_league_match_lines;
create policy "Authenticated users can create TIQ team lines"
  on public.tiq_team_league_match_lines for insert to authenticated
  with check (auth.uid() is not null and created_by_user_id = auth.uid() and updated_by_user_id = auth.uid());

drop policy if exists "Creators can update TIQ team lines" on public.tiq_team_league_match_lines;
create policy "Creators can update TIQ team lines"
  on public.tiq_team_league_match_lines for update to authenticated
  using (auth.uid() = created_by_user_id)
  with check (auth.uid() = created_by_user_id and updated_by_user_id = auth.uid());

drop policy if exists "Creators can delete TIQ team lines" on public.tiq_team_league_match_lines;
create policy "Creators can delete TIQ team lines"
  on public.tiq_team_league_match_lines for delete to authenticated
  using (auth.uid() = created_by_user_id);
