-- The production collector is now a self-running, auditable pipeline. This
-- one-time activation only starts an unfinished historical mission; Admin may
-- still pause it at any time by setting enabled = false.
update public.tennisrecord_collector_settings
set enabled = true,
    automation_state = 'bootstrap',
    bootstrap_started_at = coalesce(bootstrap_started_at, timezone('utc', now())),
    bootstrap_completed_at = null,
    updated_at = timezone('utc', now())
where id = true
  and bootstrap_completed_at is null;
