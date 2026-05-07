create table if not exists public.tiq_individual_league_results (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.tiq_leagues(id) on delete cascade,
  schedule_item_id uuid references public.tiq_league_schedule_items(id) on delete set null,
  player_a_name text not null,
  player_a_id text,
  player_b_name text not null,
  player_b_id text,
  winner_player_name text not null,
  winner_player_id text,
  score text not null default '',
  result_date timestamptz not null default timezone('utc', now()),
  notes text not null default '',
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.tiq_individual_league_results
  add column if not exists schedule_item_id uuid references public.tiq_league_schedule_items(id) on delete set null;

create table if not exists public.tiq_individual_league_suggestions (
  id text primary key,
  league_id text not null references public.tiq_leagues(id) on delete cascade,
  individual_competition_format text not null default 'standard',
  suggestion_type text not null,
  pair_key text not null,
  title text not null,
  body text not null default '',
  player_a_name text not null,
  player_a_id text not null default '',
  player_b_name text not null,
  player_b_id text not null default '',
  claimed_by_user_id uuid references auth.users(id) on delete set null,
  claimed_by_label text not null default '',
  claimed_at timestamptz,
  status text not null default 'open',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  updated_by_user_id uuid not null references auth.users(id) on delete cascade,
  constraint tiq_individual_suggestions_format_check
    check (individual_competition_format in ('standard', 'ladder', 'round_robin', 'challenge')),
  constraint tiq_individual_suggestions_status_check
    check (status in ('open', 'completed', 'dismissed'))
);

alter table public.tiq_individual_league_suggestions
  add column if not exists claimed_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists claimed_by_label text not null default '',
  add column if not exists claimed_at timestamptz;

create table if not exists public.tiq_team_league_match_events (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.tiq_leagues(id) on delete cascade,
  schedule_item_id uuid references public.tiq_league_schedule_items(id) on delete set null,
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

alter table public.tiq_team_league_match_events
  add column if not exists schedule_item_id uuid references public.tiq_league_schedule_items(id) on delete set null;

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

create index if not exists tiq_individual_league_results_league_idx
  on public.tiq_individual_league_results (league_id, result_date desc);
create unique index if not exists tiq_individual_results_schedule_item_unique
  on public.tiq_individual_league_results(schedule_item_id)
  where schedule_item_id is not null;
create index if not exists tiq_individual_results_schedule_item_idx
  on public.tiq_individual_league_results(schedule_item_id);

create index if not exists tiq_individual_suggestions_league_idx
  on public.tiq_individual_league_suggestions (league_id, status, updated_at desc);
create unique index if not exists tiq_individual_suggestions_open_pair_idx
  on public.tiq_individual_league_suggestions (league_id, suggestion_type, pair_key)
  where status = 'open';
create index if not exists tiq_individual_suggestions_claimed_by_idx
  on public.tiq_individual_league_suggestions (claimed_by_user_id, status, updated_at desc);

create index if not exists tiq_team_events_league_idx
  on public.tiq_team_league_match_events (league_id, match_date desc);
create unique index if not exists tiq_team_events_schedule_item_unique
  on public.tiq_team_league_match_events(schedule_item_id)
  where schedule_item_id is not null;
create index if not exists tiq_team_events_schedule_item_idx
  on public.tiq_team_league_match_events(schedule_item_id);
create index if not exists tiq_team_lines_event_idx
  on public.tiq_team_league_match_lines (event_id, line_number);

create or replace function public.set_tiq_individual_result_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.set_tiq_individual_suggestion_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.set_tiq_team_event_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = timezone('utc', now()); return new; end; $$;

create or replace function public.set_tiq_team_line_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = timezone('utc', now()); return new; end; $$;

drop trigger if exists set_tiq_individual_result_updated_at on public.tiq_individual_league_results;
create trigger set_tiq_individual_result_updated_at
before update on public.tiq_individual_league_results
for each row
execute function public.set_tiq_individual_result_updated_at();

drop trigger if exists set_tiq_individual_suggestion_updated_at on public.tiq_individual_league_suggestions;
create trigger set_tiq_individual_suggestion_updated_at
before update on public.tiq_individual_league_suggestions
for each row
execute function public.set_tiq_individual_suggestion_updated_at();

drop trigger if exists set_tiq_team_event_updated_at on public.tiq_team_league_match_events;
create trigger set_tiq_team_event_updated_at
  before update on public.tiq_team_league_match_events
  for each row execute function public.set_tiq_team_event_updated_at();

drop trigger if exists set_tiq_team_line_updated_at on public.tiq_team_league_match_lines;
create trigger set_tiq_team_line_updated_at
  before update on public.tiq_team_league_match_lines
  for each row execute function public.set_tiq_team_line_updated_at();

alter table public.tiq_individual_league_results enable row level security;
alter table public.tiq_individual_league_suggestions enable row level security;
alter table public.tiq_team_league_match_events enable row level security;
alter table public.tiq_team_league_match_lines enable row level security;

grant select, insert, update, delete on public.tiq_individual_league_results to anon, authenticated, service_role;
grant select, insert, update, delete on public.tiq_individual_league_suggestions to anon, authenticated, service_role;
grant select, insert, update, delete on public.tiq_team_league_match_events to anon, authenticated, service_role;
grant select, insert, update, delete on public.tiq_team_league_match_lines to anon, authenticated, service_role;

drop policy if exists "Public TIQ individual results are readable" on public.tiq_individual_league_results;
create policy "Public TIQ individual results are readable"
on public.tiq_individual_league_results
for select
using (
  exists (
    select 1
    from public.tiq_leagues
    where tiq_leagues.id = tiq_individual_league_results.league_id
      and (
        tiq_leagues.is_public = true
        or tiq_leagues.created_by_user_id = auth.uid()
      )
  )
);

drop policy if exists "Authenticated users can insert TIQ individual results" on public.tiq_individual_league_results;
create policy "Authenticated users can insert TIQ individual results"
on public.tiq_individual_league_results
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
);

drop policy if exists "Result creators can update TIQ individual results" on public.tiq_individual_league_results;
create policy "Result creators can update TIQ individual results"
on public.tiq_individual_league_results
for update
to authenticated
using (created_by_user_id = auth.uid())
with check (
  created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
);

drop policy if exists "Authenticated users can read TIQ individual suggestions" on public.tiq_individual_league_suggestions;
create policy "Authenticated users can read TIQ individual suggestions"
  on public.tiq_individual_league_suggestions
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can create TIQ individual suggestions" on public.tiq_individual_league_suggestions;
create policy "Authenticated users can create TIQ individual suggestions"
  on public.tiq_individual_league_suggestions
  for insert
  to authenticated
  with check (auth.uid() = created_by_user_id and auth.uid() = updated_by_user_id);

drop policy if exists "Suggestion owners can update TIQ individual suggestions" on public.tiq_individual_league_suggestions;
create policy "Suggestion owners can update TIQ individual suggestions"
  on public.tiq_individual_league_suggestions
  for update
  to authenticated
  using (auth.uid() = created_by_user_id or auth.uid() = updated_by_user_id)
  with check (auth.uid() = updated_by_user_id);

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

notify pgrst, 'reload schema';
