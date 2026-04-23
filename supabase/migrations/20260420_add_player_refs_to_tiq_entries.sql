alter table public.tiq_player_league_entries
add column if not exists player_id text,
add column if not exists player_location text;

create index if not exists tiq_player_league_entries_player_id_idx
  on public.tiq_player_league_entries (player_id);
