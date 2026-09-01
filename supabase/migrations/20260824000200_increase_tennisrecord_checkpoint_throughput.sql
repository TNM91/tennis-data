-- Raise only the original default. Explicit Admin tuning remains untouched.
-- Source requests remain sequential and use the existing configured pacing.
update public.tennisrecord_collector_settings
set max_requests_per_run = 10
where id = true
  and max_requests_per_run = 8;
