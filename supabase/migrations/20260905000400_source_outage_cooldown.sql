-- Additive operational state only. No queue/result/rating repairs or retry resets.
alter table public.tennisrecord_collector_settings
  add column if not exists source_outage_state jsonb not null default '{}'::jsonb
  check (jsonb_typeof(source_outage_state) = 'object');

comment on column public.tennisrecord_collector_settings.source_outage_state is
  'Shared bounded source-connection cooldown. Collector writes under the sync-run lock; does not bypass access restrictions.';
