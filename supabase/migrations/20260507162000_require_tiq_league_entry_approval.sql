create extension if not exists pgcrypto;

create table if not exists public.tiq_leagues (
  id text primary key,
  competition_layer text not null default 'tiq',
  league_format text not null check (league_format in ('team', 'individual')),
  individual_competition_format text not null default 'standard',
  scoring_system text not null default 'standard',
  league_name text not null,
  season_label text not null,
  season_status text not null default 'draft',
  starts_on date,
  ends_on date,
  max_weeks int not null default 12,
  max_match_events int not null default 120,
  is_public boolean not null default true,
  scheduling_mode text not null default 'coordinator_fixed',
  default_match_day text not null default '',
  default_match_time text not null default '',
  default_facility text not null default '',
  scheduling_notes text not null default '',
  flight text not null default '',
  location_label text not null default '',
  photo_url text not null default '',
  captain_team_name text not null default '',
  notes text not null default '',
  teams text[] not null default '{}',
  players text[] not null default '{}',
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tiq_leagues_competition_layer_check check (competition_layer = 'tiq'),
  constraint tiq_leagues_team_vs_individual_check check (
    (league_format = 'team' and cardinality(teams) >= 1)
    or
    (league_format = 'individual' and cardinality(players) >= 1)
  ),
  constraint tiq_leagues_individual_competition_format_check
    check (individual_competition_format in ('standard', 'ladder', 'round_robin', 'challenge')),
  constraint tiq_leagues_scoring_system_check
    check (scoring_system in ('standard', 'dynamic_points')),
  constraint tiq_leagues_season_status_check
    check (season_status in ('draft', 'active', 'completed', 'archived')),
  constraint tiq_leagues_season_window_check
    check (starts_on is null or ends_on is null or ends_on >= starts_on),
  constraint tiq_leagues_season_limits_check
    check (max_weeks between 1 and 12 and max_match_events between 1 and 500),
  constraint tiq_leagues_scheduling_mode_check
    check (scheduling_mode in ('coordinator_fixed', 'player_arranged'))
);

alter table public.tiq_leagues
  add column if not exists individual_competition_format text not null default 'standard',
  add column if not exists scoring_system text not null default 'standard',
  add column if not exists season_status text not null default 'draft',
  add column if not exists starts_on date,
  add column if not exists ends_on date,
  add column if not exists max_weeks int not null default 12,
  add column if not exists max_match_events int not null default 120,
  add column if not exists scheduling_mode text not null default 'coordinator_fixed',
  add column if not exists default_match_day text not null default '',
  add column if not exists default_match_time text not null default '',
  add column if not exists default_facility text not null default '',
  add column if not exists scheduling_notes text not null default '',
  add column if not exists photo_url text not null default '';

alter table public.tiq_leagues
  drop constraint if exists tiq_leagues_individual_competition_format_check,
  drop constraint if exists tiq_leagues_scoring_system_check,
  drop constraint if exists tiq_leagues_season_status_check,
  drop constraint if exists tiq_leagues_season_window_check,
  drop constraint if exists tiq_leagues_season_limits_check,
  drop constraint if exists tiq_leagues_scheduling_mode_check;

update public.tiq_leagues
  set
    max_weeks = 12,
    ends_on = case
      when starts_on is not null then starts_on + interval '83 days'
      else ends_on
    end
  where max_weeks > 12;

alter table public.tiq_leagues
  add constraint tiq_leagues_individual_competition_format_check
  check (individual_competition_format in ('standard', 'ladder', 'round_robin', 'challenge'));

alter table public.tiq_leagues
  add constraint tiq_leagues_scoring_system_check
  check (scoring_system in ('standard', 'dynamic_points'));

alter table public.tiq_leagues
  add constraint tiq_leagues_season_status_check
  check (season_status in ('draft', 'active', 'completed', 'archived'));

alter table public.tiq_leagues
  add constraint tiq_leagues_season_window_check
  check (starts_on is null or ends_on is null or ends_on >= starts_on);

alter table public.tiq_leagues
  add constraint tiq_leagues_season_limits_check
  check (max_weeks between 1 and 12 and max_match_events between 1 and 500);

alter table public.tiq_leagues
  add constraint tiq_leagues_scheduling_mode_check
  check (scheduling_mode in ('coordinator_fixed', 'player_arranged'));

create index if not exists tiq_leagues_format_idx
  on public.tiq_leagues (league_format);

create index if not exists tiq_leagues_updated_at_idx
  on public.tiq_leagues (updated_at desc);

create index if not exists tiq_leagues_created_by_idx
  on public.tiq_leagues (created_by_user_id);

create index if not exists tiq_leagues_status_updated_idx
  on public.tiq_leagues (season_status, updated_at desc);

create or replace function public.set_tiq_leagues_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_tiq_leagues_updated_at on public.tiq_leagues;
create trigger set_tiq_leagues_updated_at
before update on public.tiq_leagues
for each row
execute function public.set_tiq_leagues_updated_at();

alter table public.tiq_leagues enable row level security;

drop policy if exists "Public TIQ leagues are readable" on public.tiq_leagues;
drop policy if exists "Authenticated users can create TIQ leagues" on public.tiq_leagues;
drop policy if exists "Creators can update TIQ leagues" on public.tiq_leagues;
drop policy if exists "Creators can delete TIQ leagues" on public.tiq_leagues;

create policy "Public TIQ leagues are readable"
on public.tiq_leagues
for select
using (
  is_public = true
  or auth.uid() = created_by_user_id
);

create policy "Authenticated users can create TIQ leagues"
on public.tiq_leagues
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
  and competition_layer = 'tiq'
);

create policy "Creators can update TIQ leagues"
on public.tiq_leagues
for update
to authenticated
using (auth.uid() = created_by_user_id)
with check (
  auth.uid() = created_by_user_id
  and updated_by_user_id = auth.uid()
  and competition_layer = 'tiq'
);

create policy "Creators can delete TIQ leagues"
on public.tiq_leagues
for delete
to authenticated
using (auth.uid() = created_by_user_id);

create table if not exists public.tiq_team_league_entries (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.tiq_leagues(id) on delete cascade,
  team_name text not null,
  team_entity_id text,
  source_league_name text not null default '',
  source_flight text not null default '',
  entry_status text not null default 'pending',
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tiq_team_league_entries_status_check check (entry_status in ('pending', 'active', 'rejected', 'removed')),
  constraint tiq_team_league_entries_unique unique (league_id, team_name)
);

create table if not exists public.tiq_player_league_entries (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.tiq_leagues(id) on delete cascade,
  player_name text not null,
  player_id text,
  player_location text,
  entry_status text not null default 'pending',
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tiq_player_league_entries_status_check check (entry_status in ('pending', 'active', 'rejected', 'removed')),
  constraint tiq_player_league_entries_unique unique (league_id, player_name)
);

alter table public.tiq_team_league_entries
  add column if not exists team_entity_id text,
  add column if not exists source_league_name text not null default '',
  add column if not exists source_flight text not null default '';

alter table public.tiq_player_league_entries
  add column if not exists player_id text,
  add column if not exists player_location text;

alter table public.tiq_team_league_entries
  drop constraint if exists tiq_team_league_entries_status_check;

alter table public.tiq_team_league_entries
  add constraint tiq_team_league_entries_status_check
  check (entry_status in ('pending', 'active', 'rejected', 'removed'));

alter table public.tiq_team_league_entries
  alter column entry_status set default 'pending';

alter table public.tiq_player_league_entries
  drop constraint if exists tiq_player_league_entries_status_check;

alter table public.tiq_player_league_entries
  add constraint tiq_player_league_entries_status_check
  check (entry_status in ('pending', 'active', 'rejected', 'removed'));

alter table public.tiq_player_league_entries
  alter column entry_status set default 'pending';

create index if not exists tiq_team_league_entries_league_idx
  on public.tiq_team_league_entries (league_id);

create index if not exists tiq_team_league_entries_team_entity_idx
  on public.tiq_team_league_entries (team_entity_id);

create index if not exists tiq_player_league_entries_league_idx
  on public.tiq_player_league_entries (league_id);

create index if not exists tiq_player_league_entries_player_id_idx
  on public.tiq_player_league_entries (player_id);

create or replace function public.set_tiq_entry_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_tiq_team_entry_updated_at on public.tiq_team_league_entries;
create trigger set_tiq_team_entry_updated_at
before update on public.tiq_team_league_entries
for each row
execute function public.set_tiq_entry_updated_at();

drop trigger if exists set_tiq_player_entry_updated_at on public.tiq_player_league_entries;
create trigger set_tiq_player_entry_updated_at
before update on public.tiq_player_league_entries
for each row
execute function public.set_tiq_entry_updated_at();

alter table public.tiq_team_league_entries enable row level security;
alter table public.tiq_player_league_entries enable row level security;

drop policy if exists "Public TIQ team entries are readable" on public.tiq_team_league_entries;
drop policy if exists "Authenticated users can enter TIQ teams" on public.tiq_team_league_entries;
drop policy if exists "Authenticated users can request TIQ team entry" on public.tiq_team_league_entries;
drop policy if exists "Entrants can update TIQ team entries" on public.tiq_team_league_entries;
drop policy if exists "Entrants can update TIQ team requests" on public.tiq_team_league_entries;
drop policy if exists "League creators can approve TIQ team entries" on public.tiq_team_league_entries;

create policy "Public TIQ team entries are readable"
on public.tiq_team_league_entries
for select
using (
  exists (
    select 1
    from public.tiq_leagues
    where tiq_leagues.id = tiq_team_league_entries.league_id
      and (
        (tiq_leagues.is_public = true and tiq_team_league_entries.entry_status = 'active')
        or tiq_leagues.created_by_user_id = auth.uid()
        or tiq_team_league_entries.created_by_user_id = auth.uid()
      )
  )
);

create policy "Authenticated users can request TIQ team entry"
on public.tiq_team_league_entries
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
  and entry_status = 'pending'
);

create policy "Entrants can update TIQ team requests"
on public.tiq_team_league_entries
for update
to authenticated
using (created_by_user_id = auth.uid())
with check (
  created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
  and entry_status in ('pending', 'removed')
);

create policy "League creators can approve TIQ team entries"
on public.tiq_team_league_entries
for update
to authenticated
using (
  exists (
    select 1
    from public.tiq_leagues
    where tiq_leagues.id = tiq_team_league_entries.league_id
      and tiq_leagues.created_by_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tiq_leagues
    where tiq_leagues.id = tiq_team_league_entries.league_id
      and tiq_leagues.created_by_user_id = auth.uid()
  )
);

drop policy if exists "Public TIQ player entries are readable" on public.tiq_player_league_entries;
drop policy if exists "Authenticated users can join TIQ player leagues" on public.tiq_player_league_entries;
drop policy if exists "Authenticated users can request TIQ player entry" on public.tiq_player_league_entries;
drop policy if exists "Entrants can update TIQ player entries" on public.tiq_player_league_entries;
drop policy if exists "Entrants can update TIQ player requests" on public.tiq_player_league_entries;
drop policy if exists "League creators can approve TIQ player entries" on public.tiq_player_league_entries;

create policy "Public TIQ player entries are readable"
on public.tiq_player_league_entries
for select
using (
  exists (
    select 1
    from public.tiq_leagues
    where tiq_leagues.id = tiq_player_league_entries.league_id
      and (
        (tiq_leagues.is_public = true and tiq_player_league_entries.entry_status = 'active')
        or tiq_leagues.created_by_user_id = auth.uid()
        or tiq_player_league_entries.created_by_user_id = auth.uid()
      )
  )
);

create policy "Authenticated users can request TIQ player entry"
on public.tiq_player_league_entries
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
  and entry_status = 'pending'
);

create policy "Entrants can update TIQ player requests"
on public.tiq_player_league_entries
for update
to authenticated
using (created_by_user_id = auth.uid())
with check (
  created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
  and entry_status in ('pending', 'removed')
);

create policy "League creators can approve TIQ player entries"
on public.tiq_player_league_entries
for update
to authenticated
using (
  exists (
    select 1
    from public.tiq_leagues
    where tiq_leagues.id = tiq_player_league_entries.league_id
      and tiq_leagues.created_by_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tiq_leagues
    where tiq_leagues.id = tiq_player_league_entries.league_id
      and tiq_leagues.created_by_user_id = auth.uid()
  )
);
