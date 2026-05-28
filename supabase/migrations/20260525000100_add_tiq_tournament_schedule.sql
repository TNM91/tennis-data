alter table public.tiq_tournaments
  add column if not exists schedule jsonb not null default '{}'::jsonb;
