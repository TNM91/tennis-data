-- The collector is opt-in at two levels: the existing enabled switch and this
-- automation state. Cron invocations are inert while automation_state is manual.
alter table public.tennisrecord_collector_settings
  add column if not exists automation_state text not null default 'manual'
    check (automation_state in ('manual', 'bootstrap', 'weekly')),
  add column if not exists bootstrap_started_at timestamptz,
  add column if not exists bootstrap_completed_at timestamptz,
  add column if not exists weekly_refresh_started_at timestamptz;

comment on column public.tennisrecord_collector_settings.automation_state is
  'manual means scheduled invocations do nothing; bootstrap drains only approved match/team pages; weekly reprocesses recent match evidence.';

alter table public.tennisrecord_sync_runs
  drop constraint if exists tennisrecord_sync_runs_trigger_kind_check;
alter table public.tennisrecord_sync_runs
  add constraint tennisrecord_sync_runs_trigger_kind_check
    check (trigger_kind in ('manual', 'bootstrap', 'weekly'));

-- Prevent concurrent cron/manual workers from claiming the same queue pages.
create unique index if not exists tennisrecord_sync_runs_one_active_idx
  on public.tennisrecord_sync_runs ((1))
  where status = 'running';
