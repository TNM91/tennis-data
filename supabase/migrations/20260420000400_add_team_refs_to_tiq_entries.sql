alter table public.tiq_team_league_entries
  add column if not exists team_entity_id text,
  add column if not exists source_league_name text not null default '',
  add column if not exists source_flight text not null default '';

create index if not exists tiq_team_league_entries_team_entity_idx
  on public.tiq_team_league_entries (team_entity_id);
