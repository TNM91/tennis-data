-- Small compute provides enough database headroom for a larger, still
-- sequentially rate-limited historical checkpoint. This never changes the
-- source request interval or the weekly incremental cap.
alter table public.tennisrecord_collector_settings
  alter column max_requests_per_run set default 18;

update public.tennisrecord_collector_settings
set max_requests_per_run = 18,
    updated_at = timezone('utc', now())
where id = true
  and enabled = true
  and automation_state = 'bootstrap'
  and max_requests_per_run = 12;

-- Supabase's performance advisor confirmed these are exact duplicate indexes.
-- Keep the constraint-backed or clearly named canonical index in each pair so
-- all uniqueness and upsert guarantees remain intact while writes do less IO.
drop index if exists public.idx_matches_external_match_id;
drop index if exists public.lineup_availability_unique_idx;
drop index if exists public.user_follows_unique_idx;
