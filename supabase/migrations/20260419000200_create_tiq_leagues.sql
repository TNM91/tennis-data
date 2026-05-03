create extension if not exists pgcrypto;

create table if not exists public.tiq_leagues (
  id text primary key,
  competition_layer text not null default 'tiq',
  league_format text not null check (league_format in ('team', 'individual')),
  league_name text not null,
  season_label text not null,
  flight text not null default '',
  location_label text not null default '',
  captain_team_name text not null default '',
  notes text not null default '',
  teams text[] not null default '{}',
  players text[] not null default '{}',
  is_public boolean not null default true,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tiq_leagues_competition_layer_check check (competition_layer = 'tiq'),
  constraint tiq_leagues_team_vs_individual_check check (
    (league_format = 'team' and cardinality(teams) >= 1)
    or
    (league_format = 'individual' and cardinality(players) >= 1)
  )
);

create index if not exists tiq_leagues_format_idx
  on public.tiq_leagues (league_format);

create index if not exists tiq_leagues_updated_at_idx
  on public.tiq_leagues (updated_at desc);

create index if not exists tiq_leagues_created_by_idx
  on public.tiq_leagues (created_by_user_id);

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
create policy "Public TIQ leagues are readable"
on public.tiq_leagues
for select
using (
  is_public = true
  or auth.uid() = created_by_user_id
);

drop policy if exists "Authenticated users can create TIQ leagues" on public.tiq_leagues;
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

drop policy if exists "Creators can update TIQ leagues" on public.tiq_leagues;
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

drop policy if exists "Creators can delete TIQ leagues" on public.tiq_leagues;
create policy "Creators can delete TIQ leagues"
on public.tiq_leagues
for delete
to authenticated
using (auth.uid() = created_by_user_id);
