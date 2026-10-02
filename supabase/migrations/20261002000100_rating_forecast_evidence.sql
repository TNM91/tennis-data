-- Apply before the collector code: no production rating or identity is changed.
create table if not exists public.tennisrecord_estimate_observations (
  id uuid primary key default gen_random_uuid(),
  observation_key text not null unique,
  staged_player_id uuid not null references public.tennisrecord_staged_players(id),
  canonical_player_id uuid references public.players(id),
  source_page_id uuid not null references public.tennisrecord_source_pages(id),
  source_url text not null,
  estimate numeric not null check (estimate between 1 and 7),
  estimate_date date,
  projected_level numeric check (projected_level between 1.5 and 7),
  captured_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists tennisrecord_estimate_player_capture_idx
  on public.tennisrecord_estimate_observations(canonical_player_id,captured_at);
alter table public.tennisrecord_estimate_observations enable row level security;
revoke all on public.tennisrecord_estimate_observations from anon, authenticated;
revoke all on public.tennisrecord_estimate_observations from service_role;
grant select, insert on public.tennisrecord_estimate_observations to service_role;
comment on table public.tennisrecord_estimate_observations is
  'Dated, immutable public source estimates for comparison only. Never a TiQ rating input.';

-- Conflicting labels remain retained as evidence and explicitly excluded.
-- These are source-reported labels; independent USTA verification remains required.
create or replace view public.tennisrecord_annual_label_candidates
with (security_invoker=true) as
select canonical_player_id, extract(year from effective_date)::integer as season,
  min(ntrp) as ntrp, count(distinct ntrp) as distinct_levels,
  count(distinct ntrp)=1 as unambiguous,
  min(first_seen_at) as first_captured_at, count(*) as evidence_rows
from public.tennisrecord_ntrp_observations
where canonical_player_id is not null and designation='computer'
  and extract(month from effective_date)=12 and extract(day from effective_date)=31
group by canonical_player_id, extract(year from effective_date);
revoke all on public.tennisrecord_annual_label_candidates from anon, authenticated;
grant select on public.tennisrecord_annual_label_candidates to service_role;
