-- TennisRecord supplies factual match evidence only. Its proprietary rating is
-- never used, and its low-authority observations must not move the USTA track.
alter table public.matches
  drop constraint if exists matches_match_source_check;
alter table public.matches
  add constraint matches_match_source_check
    check (match_source in ('usta', 'tiq_team', 'tiq_individual', 'tennisrecord'));

update public.matches
set match_source = 'tennisrecord'
where source = 'tennisrecord'
  and match_source = 'usta';

update public.tennisrecord_collector_settings
set weekly_lookback_days = 7
where id = true;

comment on column public.tennisrecord_collector_settings.weekly_lookback_days is
  'Rolling historical window for scheduled TennisRecord evidence refreshes; configured to the prior seven days.';
