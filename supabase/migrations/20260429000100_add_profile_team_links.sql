alter table public.profiles
  add column if not exists linked_player_id uuid references public.players(id) on delete set null,
  add column if not exists linked_player_name text,
  add column if not exists linked_team_name text,
  add column if not exists linked_league_name text,
  add column if not exists linked_flight text,
  add column if not exists linked_team_at timestamptz;

create index if not exists profiles_linked_player_id_idx
  on public.profiles (linked_player_id);

create index if not exists profiles_linked_team_scope_idx
  on public.profiles (linked_team_name, linked_league_name, linked_flight);
