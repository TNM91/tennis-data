-- A factual profile designation can change a confirmed TiQ USTA baseline even
-- when no new match is promoted in the same collector checkpoint. Preserve a
-- durable request so the next protected TiQ rating batch cannot miss it.
alter table public.tennisrecord_collector_settings
  add column if not exists rating_recalculation_requested_at timestamptz,
  add column if not exists rating_recalculation_reason text;

comment on column public.tennisrecord_collector_settings.rating_recalculation_requested_at is
  'Set when factual TennisRecord profile evidence changes a TiQ USTA baseline. The controlled TiQ rating batch clears it only after a successful native recalculation.';
