create table if not exists public.team_summary_teams (
  id uuid primary key default gen_random_uuid(),
  team_name text not null,
  normalized_team_name text not null,
  league_name text not null default '',
  flight text not null default '',
  usta_section text,
  district_area text,
  source text,
  wins numeric,
  losses numeric,
  raw_capture_json jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists team_summary_teams_unique_scope_idx
  on public.team_summary_teams (normalized_team_name, league_name, flight);

create index if not exists team_summary_teams_lookup_idx
  on public.team_summary_teams (normalized_team_name, league_name, flight);

create or replace function public.set_team_summary_teams_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists team_summary_teams_set_updated_at on public.team_summary_teams;

create trigger team_summary_teams_set_updated_at
before update on public.team_summary_teams
for each row
execute function public.set_team_summary_teams_updated_at();

alter table public.team_summary_teams enable row level security;

drop policy if exists "Public can read team summary teams" on public.team_summary_teams;
create policy "Public can read team summary teams"
on public.team_summary_teams
for select
using (true);

drop policy if exists "Admins can manage team summary teams" on public.team_summary_teams;
create policy "Admins can manage team summary teams"
on public.team_summary_teams
for all
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);
