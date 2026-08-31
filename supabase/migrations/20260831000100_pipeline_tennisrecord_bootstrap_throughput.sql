-- The collector still keeps one source request in flight and honors the
-- configured request interval. Its local parser/stager now overlaps with the
-- next already-paced fetch, so a larger historical checkpoint is safe on
-- Small compute without changing weekly incremental behavior.
alter table public.tennisrecord_collector_settings
  alter column max_requests_per_run set default 24;

update public.tennisrecord_collector_settings
set max_requests_per_run = 24,
    updated_at = timezone('utc', now())
where id = true
  and enabled = true
  and automation_state = 'bootstrap'
  and max_requests_per_run = 18;
