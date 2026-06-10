alter table public.player_calendar_items
  add column if not exists location text not null default '';
