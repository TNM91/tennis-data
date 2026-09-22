-- One lightweight Admin-only summary row keeps import coverage observable
-- without repeatedly loading crawler rows into the browser.
create or replace view public.tennisrecord_admin_coverage_summary
with (security_invoker = false)
as
with filter_context as (
  select team_name, league_name, flight
  from public.tennisrecord_public_team_context
)
select
  (select count(*)::integer from public.tennisrecord_staged_players) as staged_player_count,
  (select count(*)::integer from filter_context) as filterable_team_count,
  (select count(distinct lower(btrim(league_name)))::integer from filter_context where nullif(btrim(league_name), '') is not null) as filterable_league_count,
  (select count(distinct lower(btrim(flight)))::integer from filter_context where nullif(btrim(flight), '') is not null) as filterable_flight_count,
  (select count(*)::integer from public.tennisrecord_public_team_roster_context) as source_roster_listing_count,
  (select count(*)::integer from public.tennisrecord_public_team_match_history) as source_team_history_count,
  (select count(*)::integer from public.tennisrecord_public_team_match_history where canonical_match_id is null) as unpromoted_team_history_count,
  (select count(*)::integer from public.tennisrecord_canonical_matches where canonical_match_id is not null) as promoted_match_count;

revoke all on public.tennisrecord_admin_coverage_summary from public;

comment on view public.tennisrecord_admin_coverage_summary is
  'Admin-only operational counts for TennisRecord coverage. These are source and reconciliation metrics only; the view never changes canonical data or ratings.';
