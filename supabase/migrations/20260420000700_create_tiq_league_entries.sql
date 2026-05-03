create table if not exists public.tiq_team_league_entries (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.tiq_leagues(id) on delete cascade,
  team_name text not null,
  entry_status text not null default 'active',
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tiq_team_league_entries_status_check check (entry_status in ('active', 'removed')),
  constraint tiq_team_league_entries_unique unique (league_id, team_name)
);

create table if not exists public.tiq_player_league_entries (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.tiq_leagues(id) on delete cascade,
  player_name text not null,
  entry_status text not null default 'active',
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tiq_player_league_entries_status_check check (entry_status in ('active', 'removed')),
  constraint tiq_player_league_entries_unique unique (league_id, player_name)
);

create index if not exists tiq_team_league_entries_league_idx
  on public.tiq_team_league_entries (league_id);

create index if not exists tiq_player_league_entries_league_idx
  on public.tiq_player_league_entries (league_id);

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
create policy "Public TIQ team entries are readable"
on public.tiq_team_league_entries
for select
using (
  exists (
    select 1
    from public.tiq_leagues
    where tiq_leagues.id = tiq_team_league_entries.league_id
      and (
        tiq_leagues.is_public = true
        or tiq_leagues.created_by_user_id = auth.uid()
      )
  )
);

drop policy if exists "Authenticated users can enter TIQ teams" on public.tiq_team_league_entries;
create policy "Authenticated users can enter TIQ teams"
on public.tiq_team_league_entries
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
  and entry_status = 'active'
);

drop policy if exists "Entrants can update TIQ team entries" on public.tiq_team_league_entries;
create policy "Entrants can update TIQ team entries"
on public.tiq_team_league_entries
for update
to authenticated
using (created_by_user_id = auth.uid())
with check (
  created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
);

drop policy if exists "Public TIQ player entries are readable" on public.tiq_player_league_entries;
create policy "Public TIQ player entries are readable"
on public.tiq_player_league_entries
for select
using (
  exists (
    select 1
    from public.tiq_leagues
    where tiq_leagues.id = tiq_player_league_entries.league_id
      and (
        tiq_leagues.is_public = true
        or tiq_leagues.created_by_user_id = auth.uid()
      )
  )
);

drop policy if exists "Authenticated users can join TIQ player leagues" on public.tiq_player_league_entries;
create policy "Authenticated users can join TIQ player leagues"
on public.tiq_player_league_entries
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
  and entry_status = 'active'
);

drop policy if exists "Entrants can update TIQ player entries" on public.tiq_player_league_entries;
create policy "Entrants can update TIQ player entries"
on public.tiq_player_league_entries
for update
to authenticated
using (created_by_user_id = auth.uid())
with check (
  created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
);
