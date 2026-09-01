-- TennisRecord's proprietary rating is staging-only metadata. Its factual
-- match outcomes continue through TenAceIQ's own rating calculation.
update public.tennisrecord_collector_settings
set weekly_lookback_days = 7
where id = true;

comment on column public.tennisrecord_collector_settings.weekly_lookback_days is
  'Rolling historical window for scheduled TennisRecord evidence refreshes; configured to the prior seven days.';
