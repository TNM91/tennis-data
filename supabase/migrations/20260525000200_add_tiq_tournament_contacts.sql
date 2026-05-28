alter table public.tiq_tournaments
  add column if not exists contacts jsonb not null default '{}'::jsonb;
