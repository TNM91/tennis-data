-- Record the completion timestamp of the existing TiQ rating engine so Admin
-- can distinguish a queued source update from a completed cohort refresh.
alter table public.tennisrecord_collector_settings
  add column if not exists rating_recalculated_at timestamptz;

comment on column public.tennisrecord_collector_settings.rating_recalculated_at is
  'Timestamp of the most recent successful controlled TiQ rating recalculation.';
