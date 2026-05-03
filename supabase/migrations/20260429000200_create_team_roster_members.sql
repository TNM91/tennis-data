create table if not exists public.team_roster_members (
  id uuid primary key default gen_random_uuid(),
  team_name text not null,
  normalized_team_name text not null,
  player_id uuid not null references public.players(id) on delete cascade,
  player_name text not null,
  league_name text not null default '',
  flight text not null default '',
  usta_section text,
  district_area text,
  source text,
  ntrp numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists team_roster_members_unique_scope_idx
  on public.team_roster_members (normalized_team_name, player_id, league_name, flight);

create index if not exists team_roster_members_team_scope_idx
  on public.team_roster_members (normalized_team_name, league_name, flight);

create or replace function public.set_team_roster_members_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists team_roster_members_set_updated_at on public.team_roster_members;

create trigger team_roster_members_set_updated_at
before update on public.team_roster_members
for each row
execute function public.set_team_roster_members_updated_at();
