-- Printed team totals are source observations, never player/rating matches.
create table public.tennisrecord_team_events (
  id uuid primary key default gen_random_uuid(),
  source_event_id text not null unique check (source_event_id ~ '^tennisrecord:20[0-9]{2}:[1-9][0-9]*$'),
  source_url text not null,
  source_page_id uuid not null references public.tennisrecord_source_pages(id),
  season_year integer not null check (season_year between 2000 and 2099),
  played_on date not null,
  league_name text not null check (btrim(league_name) <> ''),
  flight text not null,
  home_team text not null check (btrim(home_team) <> ''),
  away_team text not null check (btrim(away_team) <> '' and away_team <> home_team),
  home_courts integer not null check (home_courts between 0 and 20),
  away_courts integer not null check (away_courts between 0 and 20),
  captured_at timestamptz not null,
  check (home_courts <> away_courts and home_courts + away_courts <= 20)
);
create index tennisrecord_team_events_home_idx on public.tennisrecord_team_events(home_team, played_on desc);
create index tennisrecord_team_events_away_idx on public.tennisrecord_team_events(away_team, played_on desc);
create index tennisrecord_team_events_league_idx on public.tennisrecord_team_events(league_name, flight, played_on desc);
alter table public.tennisrecord_team_events enable row level security;
revoke all on public.tennisrecord_team_events from public, anon, authenticated;
grant select, insert, update on public.tennisrecord_team_events to service_role;

-- Bind every observation to retained successful evidence. Cached replay may
-- not replace a newer total, and a reused event ID may not change opponents.
create function public.save_tennisrecord_team_event(p_event jsonb, p_page_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare capture record; prior record;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_event->>'sourceEventId',0));
  select source_url, captured_at into capture from public.tennisrecord_source_pages
    where id = p_page_id and not blocked and http_status between 200 and 299;
  if not found or capture.source_url is distinct from p_event->>'sourceUrl' then
    raise exception 'A matching successful retained scorecard is required';
  end if;
  if capture.source_url !~ '^https?://(www\.)?tennisrecord\.com/adult/matchresults\.aspx\?'
    or p_event->>'sourceEventId' is distinct from 'tennisrecord:' ||
      substring(capture.source_url from '(?i)[?&]year=([0-9]{4})(?:&|$)') || ':' ||
      ltrim(substring(capture.source_url from '(?i)[?&]mid=([0-9]+)(?:&|$)'), '0')
    or p_event->>'seasonYear' is distinct from substring(capture.source_url from '(?i)[?&]year=([0-9]{4})(?:&|$)') then
    raise exception 'Retained scorecard event locator does not match the team result';
  end if;
  select * into prior from public.tennisrecord_team_events where source_event_id = p_event->>'sourceEventId' for update;
  if found then
    if capture.captured_at < prior.captured_at then return; end if;
    if prior.played_on is distinct from (p_event->>'playedOn')::date
      or prior.home_team is distinct from p_event->>'homeTeam'
      or prior.away_team is distinct from p_event->>'awayTeam'
      or prior.season_year is distinct from (p_event->>'seasonYear')::integer
      or prior.league_name is distinct from p_event->>'leagueName' then
      raise exception 'Source event identity changed; retain scorecard for review';
    end if;
  end if;
  insert into public.tennisrecord_team_events(source_event_id,source_url,source_page_id,season_year,
    played_on,league_name,flight,home_team,away_team,home_courts,away_courts,captured_at)
  values(p_event->>'sourceEventId',capture.source_url,p_page_id,(p_event->>'seasonYear')::integer,
    (p_event->>'playedOn')::date,p_event->>'leagueName',p_event->>'flight',p_event->>'homeTeam',p_event->>'awayTeam',
    (p_event->>'homeCourts')::integer,(p_event->>'awayCourts')::integer,capture.captured_at)
  on conflict(source_event_id) do update set source_url=excluded.source_url,source_page_id=excluded.source_page_id,
    home_courts=excluded.home_courts,away_courts=excluded.away_courts,captured_at=excluded.captured_at
  where excluded.captured_at >= tennisrecord_team_events.captured_at;
end $$;
revoke all on function public.save_tennisrecord_team_event(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.save_tennisrecord_team_event(jsonb,uuid) to service_role;

create view public.tennisrecord_public_team_events with (security_invoker=false) as
select id,source_event_id,source_url,season_year,played_on,league_name,flight,home_team,away_team,
  home_courts,away_courts,captured_at from public.tennisrecord_team_events;
revoke all on public.tennisrecord_public_team_events from public,anon,authenticated;
grant select on public.tennisrecord_public_team_events to anon,authenticated,service_role;

-- Canonical reads retain the caller's RLS. Old TennisRecord parent rows are
-- individual courts and stay in matches for player history, never standings.
create view public.team_match_results with (security_invoker=true) as
select m.id,m.external_match_id,m.home_team,m.away_team,m.match_date,
  m.match_time::text as match_time,m.facility,m.status::text as status,m.match_type::text as match_type,
  m.winner_side::text as winner_side,m.score,m.flight,m.league_name,m.usta_section,m.district_area,
  m.line_number::text as line_number,m.source::text as source,null::text as source_url,null::integer as season_year
from public.matches m where m.line_number is null and m.source is distinct from 'tennisrecord'
union all
select e.id,null::text,e.home_team,e.away_team,e.played_on,null::text,null::text,'completed'::text,null::text,
  case when e.home_courts > e.away_courts then 'A' else 'B' end,
  e.home_courts::text || '-' || e.away_courts::text,e.flight,e.league_name,null::text,null::text,null::text,
  'tennisrecord'::text,e.source_url,e.season_year
from public.tennisrecord_public_team_events e
where not exists (
  -- Any same-team/day overlap is held, including renamed opponents. This is
  -- deliberately not an event-identity match: doubleheaders need review too.
  -- Keep local results; never merge or overwrite either source observation.
  select 1 from public.matches local where local.line_number is null
    and local.source is distinct from 'tennisrecord' and local.winner_side in ('A','B')
    and local.match_date = e.played_on
    and (lower(btrim(local.home_team)) in (lower(btrim(e.home_team)),lower(btrim(e.away_team)))
      or lower(btrim(local.away_team)) in (lower(btrim(e.home_team)),lower(btrim(e.away_team))))
);
revoke all on public.team_match_results from public,anon,authenticated;
grant select on public.team_match_results to anon,authenticated,service_role;
comment on view public.team_match_results is 'Team results only. Printed source totals are independent of player courts; possible local overlaps are retained in source context pending event review.';
