alter table public.tiq_tournaments
  add column if not exists entrant_player_ids jsonb not null default '{}'::jsonb;
