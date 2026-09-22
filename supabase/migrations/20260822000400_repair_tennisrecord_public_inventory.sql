-- Corrected TennisRecord facts already exist in isolated staging, but early
-- parser output left matching public parent events quarantined. Re-project
-- only source-owned, parser-valid records; local uploads and verified data are
-- intentionally outside this migration's scope.
with valid_source_matches as (
  select distinct on (canonical.fingerprint)
    canonical.fingerprint,
    canonical.canonical_match_id,
    staged.played_on,
    staged.home_team,
    staged.away_team,
    staged.league_name,
    staged.flight,
    staged.discipline,
    staged.score_text,
    staged.winner_side
  from public.tennisrecord_canonical_matches canonical
  join public.matches rated_line
    on rated_line.id = canonical.canonical_match_id
    and rated_line.source = 'tennisrecord'
  join public.tennisrecord_staged_matches staged
    on staged.fingerprint = canonical.fingerprint
    and staged.parse_status = 'valid'
  where nullif(btrim(staged.home_team), '') is not null
    and nullif(btrim(staged.away_team), '') is not null
    and lower(btrim(staged.home_team)) not in ('match results', 'home team', 'away team', 'visiting team', 'team name', 'team', 'tbd', 'unknown', 'n/a')
    and lower(btrim(staged.away_team)) not in ('match results', 'home team', 'away team', 'visiting team', 'team name', 'team', 'tbd', 'unknown', 'n/a')
  order by canonical.fingerprint, staged.last_seen_at desc
)
insert into public.matches as existing (
  external_match_id,
  match_date,
  home_team,
  away_team,
  league_name,
  flight,
  source,
  status,
  match_source,
  match_type,
  winner_side,
  score,
  rating_eligible
)
select
  'tennisrecord:' || fingerprint,
  played_on,
  home_team,
  away_team,
  league_name,
  flight,
  'tennisrecord',
  'completed',
  'usta',
  discipline,
  winner_side,
  score_text,
  false
from valid_source_matches
on conflict (external_match_id) do update
set
  match_date = excluded.match_date,
  home_team = excluded.home_team,
  away_team = excluded.away_team,
  league_name = excluded.league_name,
  flight = excluded.flight,
  source = 'tennisrecord',
  status = 'completed',
  match_source = 'usta',
  match_type = excluded.match_type,
  winner_side = excluded.winner_side,
  score = excluded.score,
  rating_eligible = false
where existing.source in ('tennisrecord', 'tennisrecord_quarantined')
  and existing.line_number is null;

-- Preserve the same factual team context on the rated court line. This is
-- metadata only: the match, participants, score, and TenAceIQ rating result
-- remain the existing canonical record.
with valid_source_matches as (
  select distinct on (canonical.fingerprint)
    canonical.canonical_match_id,
    staged.home_team,
    staged.away_team,
    staged.league_name,
    staged.flight
  from public.tennisrecord_canonical_matches canonical
  join public.matches rated_line
    on rated_line.id = canonical.canonical_match_id
    and rated_line.source = 'tennisrecord'
  join public.tennisrecord_staged_matches staged
    on staged.fingerprint = canonical.fingerprint
    and staged.parse_status = 'valid'
  where nullif(btrim(staged.home_team), '') is not null
    and nullif(btrim(staged.away_team), '') is not null
    and lower(btrim(staged.home_team)) not in ('match results', 'home team', 'away team', 'visiting team', 'team name', 'team', 'tbd', 'unknown', 'n/a')
    and lower(btrim(staged.away_team)) not in ('match results', 'home team', 'away team', 'visiting team', 'team name', 'team', 'tbd', 'unknown', 'n/a')
  order by canonical.fingerprint, staged.last_seen_at desc
)
update public.matches rated_line
set
  home_team = source.home_team,
  away_team = source.away_team,
  league_name = source.league_name,
  flight = source.flight
from valid_source_matches source
where rated_line.id = source.canonical_match_id
  and rated_line.source = 'tennisrecord';

-- Team filters should reflect valid team/league/flight facts even while a
-- source record is awaiting canonical promotion. The raw page and identities
-- remain private; this is a narrow, source-labelled discovery projection.
create or replace view public.tennisrecord_public_team_context
with (security_invoker = false)
as
with team_observations as (
  select
    source_team_key,
    name,
    league_name,
    flight,
    season_year,
    source_url,
    first_seen_at,
    last_seen_at
  from public.tennisrecord_staged_teams
  union all
  select
    'match:' || source_match_key || ':home',
    home_team,
    league_name,
    flight,
    extract(year from played_on)::integer,
    source_url,
    first_seen_at,
    last_seen_at
  from public.tennisrecord_staged_matches
  where parse_status = 'valid'
  union all
  select
    'match:' || source_match_key || ':away',
    away_team,
    league_name,
    flight,
    extract(year from played_on)::integer,
    source_url,
    first_seen_at,
    last_seen_at
  from public.tennisrecord_staged_matches
  where parse_status = 'valid'
)
select distinct on (
  lower(btrim(name)),
  lower(btrim(coalesce(league_name, ''))),
  lower(btrim(coalesce(flight, ''))),
  coalesce(season_year, 0)
)
  source_team_key,
  name as team_name,
  nullif(btrim(league_name), '') as league_name,
  nullif(btrim(flight), '') as flight,
  season_year,
  source_url,
  first_seen_at,
  last_seen_at,
  'tennisrecord'::text as source
from team_observations
where btrim(name) <> ''
  and lower(btrim(name)) not in ('match results', 'home team', 'away team', 'visiting team', 'team name', 'team', 'tbd', 'unknown', 'n/a')
  and btrim(name) !~* '^20[0-9]{2}[[:space:]]+adult([[:space:]]|$)'
  and (nullif(btrim(league_name), '') is not null or nullif(btrim(flight), '') is not null)
  and lower(btrim(name)) <> lower(btrim(coalesce(league_name, '')))
order by
  lower(btrim(name)),
  lower(btrim(coalesce(league_name, ''))),
  lower(btrim(coalesce(flight, ''))),
  coalesce(season_year, 0),
  last_seen_at desc;

revoke all on public.tennisrecord_public_team_context from public;
grant select on public.tennisrecord_public_team_context to anon, authenticated;

comment on view public.tennisrecord_public_team_context is
  'Safe public projection of factual TennisRecord team, league, and flight context from parser-valid team and match observations. It never exposes raw crawler data or changes local records, player identities, or ratings.';
