-- Network retries are operationally different from parser failures. Preserve
-- both so Admin can distinguish a temporary source condition from malformed
-- source evidence without changing the collector's fail-closed behavior.
alter table public.tennisrecord_sync_runs
  add column if not exists transient_retries integer not null default 0,
  add column if not exists source_failures integer not null default 0;
