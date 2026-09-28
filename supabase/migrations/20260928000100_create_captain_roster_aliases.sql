create table if not exists public.captain_roster_aliases (
  id uuid primary key default gen_random_uuid(),
  normalized_captain_team_name text not null,
  scheduled_team_name text not null,
  normalized_scheduled_team_name text not null,
  source_team_name text not null,
  normalized_source_team_name text not null,
  league_name text not null,
  flight text not null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_captain_team_name, normalized_scheduled_team_name, league_name, flight)
);

create index if not exists captain_roster_aliases_scope_idx
  on public.captain_roster_aliases (normalized_captain_team_name, league_name, flight);

alter table public.captain_roster_aliases enable row level security;

drop policy if exists "Admins can manage captain roster aliases" on public.captain_roster_aliases;
create policy "Admins can manage captain roster aliases"
on public.captain_roster_aliases
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

comment on table public.captain_roster_aliases is
  'Captain-confirmed links from a scheduled opponent name to an uploaded roster in the same league and flight.';
