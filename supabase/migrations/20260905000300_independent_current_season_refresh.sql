-- Additive only: retain historical queues, review holds and all source evidence.
alter table public.tennisrecord_crawl_queue
  add column if not exists refresh_season integer,
  add column if not exists refresh_due_at timestamptz,
  add column if not exists current_refreshed_at timestamptz;
create index if not exists tennisrecord_current_pending_idx on public.tennisrecord_crawl_queue(refresh_season,first_seen_at) where status='pending';
create index if not exists tennisrecord_current_due_idx on public.tennisrecord_crawl_queue(refresh_season,refresh_due_at) where status='done';
alter table public.tennisrecord_collector_settings
  add column if not exists current_refresh_enabled boolean not null default false,
  add column if not exists current_refresh_seeded_at timestamptz,
  add column if not exists current_refresh_player_cursor uuid,
  add column if not exists current_refresh_seed_cycle_at timestamptz;

-- A rating job participates in the existing one-running-job unique lock.
alter table public.tennisrecord_sync_runs drop constraint if exists tennisrecord_sync_runs_trigger_kind_check;
alter table public.tennisrecord_sync_runs add constraint tennisrecord_sync_runs_trigger_kind_check check(trigger_kind in('manual','bootstrap','weekly','ratings'));

create or replace function public.prepare_tennisrecord_current_refresh(p_run_id uuid, p_seed boolean default false)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare season integer := extract(year from now() at time zone 'UTC'); affected integer;
begin
  -- Caller must already hold the collector's unique active-run lock.
  if not exists(select 1 from public.tennisrecord_sync_runs where id=p_run_id and status='running' and trigger_kind='weekly') then
    raise exception 'An active weekly checkpoint is required';
  end if;
  if not exists(select 1 from public.tennisrecord_collector_settings where id=true and enabled and current_refresh_enabled) then return 0; end if;
  if p_seed then
    -- Server-side set selection avoids the previous 100-court API truncation.
    -- Only known Missouri competitions qualify; Missouri Valley alone does not.
    with candidates as (
      select source_url from public.tennisrecord_staged_teams where season_year=season and league_name ~* 'Missouri[ /_-]+Valley[ /_-]+Missouri\M'
      union select source_url from public.tennisrecord_staged_leagues where season_year=season and name ~* 'Missouri[ /_-]+Valley[ /_-]+Missouri\M'
      union select source_url from public.tennisrecord_staged_matches where played_on >= greatest(make_date(season,1,1),current_date-45) and played_on<=current_date and league_name ~* 'Missouri[ /_-]+Valley[ /_-]+Missouri\M'
    ) update public.tennisrecord_crawl_queue q set refresh_season=season,
      refresh_due_at=coalesce(q.refresh_due_at,q.completed_at+interval '7 days',now())
      from candidates c where q.source_url=c.source_url and (q.refresh_season is distinct from season or q.refresh_due_at is null);
    update public.tennisrecord_collector_settings set current_refresh_seeded_at=now(),current_refresh_player_cursor=null,current_refresh_seed_cycle_at=null where id=true;
  end if;
  -- Bounded release with a persistent due-date cursor: no row is silently
  -- dropped because a cycle has >100 pages. Never reopen review/blocked/error.
  with due as (
    select id from public.tennisrecord_crawl_queue where refresh_season=season
      and status='done' and refresh_due_at<=now()
      and (completed_at is null or completed_at<=now()-interval '7 days')
      and (deferred_retry_at is null or deferred_retry_at<=now())
    order by refresh_due_at,id limit 100 for update skip locked
  ) update public.tennisrecord_crawl_queue q set status='pending' from due where q.id=due.id;
  get diagnostics affected=row_count;
  return affected;
end $$;
revoke all on function public.prepare_tennisrecord_current_refresh(uuid,boolean) from public,anon,authenticated;
grant execute on function public.prepare_tennisrecord_current_refresh(uuid,boolean) to service_role;

-- Roll out explicitly after code + migration checks; an older deployment sees
-- no behavior change and the current lane remains off until enabled by admin.
