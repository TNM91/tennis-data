alter table public.profiles
  add column if not exists player_plus_access_expires_at timestamptz,
  add column if not exists coach_access_expires_at timestamptz,
  add column if not exists captain_access_expires_at timestamptz,
  add column if not exists league_access_expires_at timestamptz;

create index if not exists profiles_player_plus_access_expires_at_idx
  on public.profiles (player_plus_access_expires_at)
  where player_plus_access_expires_at is not null;

create index if not exists profiles_coach_access_expires_at_idx
  on public.profiles (coach_access_expires_at)
  where coach_access_expires_at is not null;

create index if not exists profiles_captain_access_expires_at_idx
  on public.profiles (captain_access_expires_at)
  where captain_access_expires_at is not null;

create index if not exists profiles_league_access_expires_at_idx
  on public.profiles (league_access_expires_at)
  where league_access_expires_at is not null;
