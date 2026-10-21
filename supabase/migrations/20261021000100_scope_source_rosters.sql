-- A team can retain the same name in several championship seasons. Preserve
-- each source team page rather than overwriting last season's membership.
do $$
declare legacy_constraint text;
begin
  for legacy_constraint in
    select c.conname from pg_constraint c
    where c.conrelid = 'public.tennisrecord_staged_team_memberships'::regclass
      and c.contype = 'u'
      and (select array_agg(a.attname::text order by a.attname)
           from unnest(c.conkey) k(attnum)
           join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum)
          = array['normalized_team_name', 'source_player_key']
  loop
    execute format('alter table public.tennisrecord_staged_team_memberships drop constraint %I', legacy_constraint);
  end loop;
end $$;

create unique index if not exists tennisrecord_membership_source_unique
  on public.tennisrecord_staged_team_memberships(normalized_team_name, source_player_key, source_url);

create or replace view public.tennisrecord_public_team_roster_context
with (security_invoker = false) as
select
  membership.team_name,
  membership.normalized_team_name,
  membership.player_name,
  identity.canonical_player_id,
  membership.source_url,
  membership.first_seen_at,
  membership.last_seen_at,
  'tennisrecord'::text as source,
  substring(membership.source_url from '[?&]year=(20[0-9]{2})(?:&|$)')::integer as season_year,
  nullif(btrim(membership.raw->>'leagueName'), '') as league_name,
  nullif(btrim(membership.raw->>'flight'), '') as flight
from public.tennisrecord_staged_team_memberships membership
join public.tennisrecord_staged_players player on player.source_player_key = membership.source_player_key
left join public.tennisrecord_player_identities identity
  on identity.staged_player_id = player.id and identity.status = 'matched'
where btrim(membership.team_name) <> '' and btrim(membership.player_name) <> '';

create or replace view public.tennisrecord_public_team_roster_counts
with (security_invoker = false) as
select
  membership.normalized_team_name,
  count(distinct membership.source_player_key)::integer as listed_player_count,
  substring(membership.source_url from '[?&]year=(20[0-9]{2})(?:&|$)')::integer as season_year
from public.tennisrecord_staged_team_memberships membership
where btrim(membership.normalized_team_name) <> ''
group by membership.normalized_team_name,
  substring(membership.source_url from '[?&]year=(20[0-9]{2})(?:&|$)')::integer;

revoke all on public.tennisrecord_public_team_roster_context from public;
revoke all on public.tennisrecord_public_team_roster_counts from public;
grant select on public.tennisrecord_public_team_roster_context to anon, authenticated, service_role;
grant select on public.tennisrecord_public_team_roster_counts to anon, authenticated, service_role;
grant select, insert, update on public.tennisrecord_staged_team_memberships to service_role;

comment on view public.tennisrecord_public_team_roster_context is
  'Source roster observations scoped by explicit source team season and retained league/flight. They do not establish canonical team membership.';
