alter table public.tiq_tournament_alerts
  add column if not exists queued_at timestamptz,
  add column if not exists delivery_note text not null default '';
