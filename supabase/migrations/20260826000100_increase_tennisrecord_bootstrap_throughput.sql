-- The collector has sustained clean, sequentially rate-limited checkpoints.
-- Move the historical bootstrap from the old three-page default to eight
-- pages per checkpoint. Weekly refreshes retain their smaller application cap.
alter table public.tennisrecord_collector_settings
  alter column max_requests_per_run set default 8;

update public.tennisrecord_collector_settings
set max_requests_per_run = 8,
    updated_at = timezone('utc', now())
where id = true
  and enabled = true
  and automation_state = 'bootstrap'
  and max_requests_per_run = 3;
