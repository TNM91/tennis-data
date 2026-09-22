-- Private, reversible evidence for explicitly authorized result/derived-rating
-- maintenance. This schema is not exposed through PostgREST.
begin;
create schema if not exists tiq_maintenance;
revoke all on schema tiq_maintenance from public, anon, authenticated;
create table if not exists tiq_maintenance.result_repair_backups (
  run_id text not null,
  record_kind text not null,
  record_key text not null,
  before_value jsonb not null,
  captured_at timestamptz not null default now(),
  primary key (run_id, record_kind, record_key)
);
revoke all on tiq_maintenance.result_repair_backups from public, anon, authenticated;
-- Service-only transport for reviewed replay manifests; no browser/user policy.
create table if not exists public.tennisrecord_result_repair_evidence (
  run_id text not null,
  fingerprint text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (run_id, fingerprint)
);
alter table public.tennisrecord_result_repair_evidence enable row level security;
revoke all on public.tennisrecord_result_repair_evidence from public, anon, authenticated;
grant select, insert, update, delete on public.tennisrecord_result_repair_evidence to service_role;
commit;
