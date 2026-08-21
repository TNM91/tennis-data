-- Publicly accessible, source-labeled team context. This intentionally exposes
-- only factual team/league/flight fields from the isolated TennisRecord stage;
-- raw captures, player identities, and match evidence remain protected.
create or replace view public.tennisrecord_public_team_context
with (security_invoker = false)
as
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
from public.tennisrecord_staged_teams
where btrim(name) <> ''
  and lower(btrim(name)) not in ('match results', 'home team', 'away team', 'visiting team', 'team name', 'team', 'tbd', 'unknown', 'n/a')
  and btrim(name) !~* '^20[0-9]{2}[[:space:]]+adult([[:space:]]|$)'
  and (nullif(btrim(league_name), '') is not null or nullif(btrim(flight), '') is not null)
order by
  lower(btrim(name)),
  lower(btrim(coalesce(league_name, ''))),
  lower(btrim(coalesce(flight, ''))),
  coalesce(season_year, 0),
  last_seen_at desc;

revoke all on public.tennisrecord_public_team_context from public;
grant select on public.tennisrecord_public_team_context to anon, authenticated;

comment on view public.tennisrecord_public_team_context is
  'Safe public projection of factual TennisRecord team, league, and flight context. It never exposes raw crawler data or changes canonical matches, player identities, or ratings.';
