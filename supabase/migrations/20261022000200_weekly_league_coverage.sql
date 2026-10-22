-- Opt-in, exact-source monitoring. No canonical identities or ratings change.
alter table public.tennisrecord_crawl_queue add column league_watch boolean not null default false;
create table public.tennisrecord_league_watches (
  source_url text primary key,
  label text not null,
  season_year integer not null check (season_year between 2000 and 2100),
  enabled boolean not null default true,
  mapping_verified boolean not null default false,
  checked_at timestamptz,
  next_check_at timestamptz not null default now(),
  report jsonb
);
create table public.tennisrecord_league_watch_pages (
  league_url text not null references public.tennisrecord_league_watches(source_url) on delete cascade,
  source_url text not null,
  page_kind text not null check (page_kind in ('league','team','match')),
  observed_at timestamptz,
  expected_count integer check (expected_count >= 0),
  results_pending boolean not null default false,
  primary key (league_url, source_url)
);
create index tennisrecord_watch_pages_source_idx on public.tennisrecord_league_watch_pages(source_url);
create index if not exists tennisrecord_staged_matches_source_url_idx on public.tennisrecord_staged_matches(source_url);
create index if not exists tennisrecord_memberships_source_url_idx on public.tennisrecord_staged_team_memberships(source_url);
alter table public.tennisrecord_league_watches enable row level security;
alter table public.tennisrecord_league_watch_pages enable row level security;
revoke all on public.tennisrecord_league_watches, public.tennisrecord_league_watch_pages from public, anon, authenticated;
grant select, insert, update, delete on public.tennisrecord_league_watches, public.tennisrecord_league_watch_pages to service_role;

-- Called only in one existing checkpoint slot. Does not claim, reopen holds,
-- bypass deferred retries, or increase requests/concurrency.
create function public.next_tennisrecord_watched_page()
returns setof public.tennisrecord_crawl_queue
language sql security definer set search_path=public,pg_temp as $$
  select q.* from (select distinct p.source_url from public.tennisrecord_league_watch_pages p
      join public.tennisrecord_league_watches w on w.source_url=p.league_url
      where w.enabled and w.season_year in (extract(year from now())::integer, extract(year from now())::integer+1)) watched
  cross join lateral (select candidate.* from public.tennisrecord_crawl_queue candidate
    where candidate.source_url=watched.source_url and candidate.status='pending'
      and candidate.refresh_season=extract(year from now() at time zone 'UTC')::integer
      and (candidate.deferred_retry_at is null or candidate.deferred_retry_at<=now()) limit 1) q
  order by q.refresh_due_at nulls last,q.first_seen_at,q.id limit 1;
$$;

create function public.record_tennisrecord_watch_capture(p_source_url text,p_page_id uuid,p_count integer,p_pending boolean,p_links jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare captured timestamptz;
begin
  select captured_at into captured from public.tennisrecord_source_pages
    where id=p_page_id and source_url=p_source_url and not blocked and http_status between 200 and 299;
  if captured is null then raise exception 'A successful retained capture is required'; end if;
  update public.tennisrecord_league_watch_pages set observed_at=captured,expected_count=p_count,results_pending=p_pending
    where source_url=p_source_url and (observed_at is null or observed_at<=captured);
  insert into public.tennisrecord_league_watch_pages(league_url,source_url,page_kind)
    select distinct parent.league_url,link->>'url',link->>'kind'
    from public.tennisrecord_league_watch_pages parent
    join public.tennisrecord_league_watches w on w.source_url=parent.league_url and w.enabled
    cross join jsonb_array_elements(p_links) link
    where parent.source_url=p_source_url
      and link->>'kind' in ('team','match')
      and link->>'url' ~ '^https://www[.]tennisrecord[.]com/adult/(teamprofile|matchresults)[.]aspx[?]'
      and link->>'url' ~ ('[?&]year='||w.season_year||'(&|$)')
    on conflict do nothing;
  -- Exact links from a retained monitored page join the existing paced queue.
  -- Existing holds, ownership, and refresh timestamps are never overwritten.
  insert into public.tennisrecord_crawl_queue(source_url,page_kind,status,campaign_id,refresh_season,refresh_due_at,league_watch)
    select distinct p.source_url,p.page_kind,'pending',c.id,extract(year from now())::integer,now(),true
    from public.tennisrecord_league_watch_pages p
    join public.tennisrecord_league_watch_pages parent on parent.league_url=p.league_url and parent.source_url=p_source_url
    join public.tennisrecord_campaigns c on c.slug='us-2025-current'
    on conflict(source_url) do nothing;
  update public.tennisrecord_crawl_queue q set league_watch=true,
    refresh_season=case when q.status in('pending','done') then extract(year from now())::integer else q.refresh_season end,
    refresh_due_at=case when q.status in('pending','done') then coalesce(q.refresh_due_at,q.completed_at+interval '7 days',now()) else q.refresh_due_at end
    where (not league_watch or q.refresh_season is distinct from extract(year from now())::integer or q.refresh_due_at is null)
      and exists (select 1 from public.tennisrecord_league_watch_pages p
      join public.tennisrecord_league_watch_pages parent on parent.league_url=p.league_url
      where p.source_url=q.source_url and parent.source_url=p_source_url);
end $$;

-- Only a small registered frontier is examined, once per seven days. A
-- successful checkpoint is never treated as evidence of complete coverage.
create function public.check_tennisrecord_league_coverage()
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.tennisrecord_league_watches; snapshot jsonb; checked integer:=0;
begin
  for w in select * from public.tennisrecord_league_watches
    where enabled and next_check_at<=now() order by next_check_at limit 3 for update skip locked
  loop
    with pages as (
      select p.*,q.status,
        (select count(*) from public.tennisrecord_staged_team_memberships m where m.source_url=p.source_url) roster_count,
        (select count(*) from public.tennisrecord_staged_matches m where m.source_url=p.source_url and m.parse_status='valid') court_count,
        (select count(*) from public.tennisrecord_staged_matches m
          left join public.tennisrecord_canonical_matches c on c.fingerprint=m.fingerprint
          where m.source_url=p.source_url and m.parse_status='valid' and c.canonical_match_id is null) unpromoted_count
      from public.tennisrecord_league_watch_pages p
      left join public.tennisrecord_crawl_queue q on q.source_url=p.source_url
      where p.league_url=w.source_url
    ) select jsonb_build_object(
      'scope','Known source pages; directory verification is required to establish all teams',
      'knownTeams',count(*) filter(where page_kind='team'),
      'knownScorecards',count(*) filter(where page_kind='match'),
      'missingPages',count(*) filter(where status is null),
      'stalePages',count(*) filter(where observed_at is null or observed_at<now()-interval '7 days'),
      'heldPages',count(*) filter(where status in('review','blocked','error')),
      'missingRosters',count(*) filter(where page_kind='team' and (expected_count is null or roster_count<expected_count)),
      'incompleteScorecards',count(*) filter(where page_kind='match' and expected_count>court_count),
      'unpostedResults',count(*) filter(where page_kind='match' and results_pending),
      'unpromotedCourts',coalesce(sum(unpromoted_count),0),
      'directoryVerified',coalesce(bool_or(page_kind='league' and source_url=w.source_url and expected_count>0
        and observed_at>=now()-interval '7 days' and status='done'),false),
      'missingTeams',greatest(coalesce(max(expected_count) filter(where page_kind='league' and source_url=w.source_url),0)
        -count(*) filter(where page_kind='team'),0),
      'attentionPages',coalesce(jsonb_agg(jsonb_build_object('sourceUrl',source_url,'status',status))
        filter(where status is null or status in('review','blocked','error') or observed_at is null or observed_at<now()-interval '7 days'),'[]'::jsonb),
      'mappingVerified',w.mapping_verified
    ) into snapshot from pages;
    update public.tennisrecord_league_watches set checked_at=now(),next_check_at=now()+interval '7 days',report=snapshot where source_url=w.source_url;
    checked:=checked+1;
  end loop;
  return checked;
end $$;
revoke all on function public.next_tennisrecord_watched_page(),public.record_tennisrecord_watch_capture(text,uuid,integer,boolean,jsonb),public.check_tennisrecord_league_coverage() from public,anon,authenticated;
grant execute on function public.next_tennisrecord_watched_page(),public.record_tennisrecord_watch_capture(text,uuid,integer,boolean,jsonb),public.check_tennisrecord_league_coverage() to service_role;
