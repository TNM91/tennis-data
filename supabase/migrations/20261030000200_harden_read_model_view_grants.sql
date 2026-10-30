-- Read models must never inherit browser write privileges.
-- Keeps existing public projections and signed-in recipient discovery readable.
-- Does not grant access to underlying tables or change view query definitions.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local search_path = pg_catalog, public;

do $hardening$
declare
  target record;
  relation oid;
  actual_columns text[];
  column_list text;
  before_definition text;
  expected_anon boolean;
  expected_member boolean;
begin
  if to_regprocedure('public.account_erasure_catalog_ready()') is null
     or not public.account_erasure_catalog_ready() then
    raise exception 'Account erasure catalog must be ready before view hardening';
  end if;

  for target in select * from (values
    ('internal_message_directory', array['id','role','display_name','linked_player_id','tiq_public_id','tiq_admin_id']::text[], 'member'),
    ('team_match_results', array['id','external_match_id','home_team','away_team','match_date','match_time','facility','status','match_type','winner_side','score','flight','league_name','usta_section','district_area','line_number','source','source_url','season_year']::text[], 'public'),
    ('tennisrecord_admin_coverage_summary', array['staged_player_count','filterable_team_count','filterable_league_count','filterable_flight_count','source_roster_listing_count','source_team_history_count','unpromoted_team_history_count','promoted_match_count']::text[], 'service'),
    ('tennisrecord_annual_label_candidates', array['canonical_player_id','season','ntrp','distinct_levels','unambiguous','first_captured_at','evidence_rows']::text[], 'service'),
    ('tennisrecord_public_team_context', array['source_team_key','team_name','league_name','flight','season_year','source_url','first_seen_at','last_seen_at','source']::text[], 'public'),
    ('tennisrecord_public_team_events', array['id','source_event_id','source_url','season_year','played_on','league_name','flight','home_team','away_team','home_courts','away_courts','captured_at']::text[], 'public'),
    ('tennisrecord_public_team_match_history', array['source_match_key','team_name','opponent_team','played_on','league_name','flight','discipline','court_number','score_text','winner_side','team_side','source_url','canonical_match_id','first_seen_at','last_seen_at','source']::text[], 'public'),
    ('tennisrecord_public_team_roster_context', array['team_name','normalized_team_name','player_name','canonical_player_id','source_url','first_seen_at','last_seen_at','source','season_year','league_name','flight']::text[], 'public'),
    ('tennisrecord_public_team_roster_counts', array['normalized_team_name','listed_player_count','season_year']::text[], 'public')
  ) as expected(name, columns, access)
  loop
    relation := to_regclass(format('public.%I', target.name));
    if relation is null or not exists (
      select 1 from pg_class where oid = relation and relkind = 'v'
        and pg_get_userbyid(relowner) = 'postgres'
    ) then
      raise exception 'Unexpected read-model identity: %', target.name;
    end if;
    select array_agg(attname::text order by attnum),
           string_agg(format('%I', attname), ', ' order by attnum)
      into actual_columns, column_list
      from pg_attribute where attrelid = relation and attnum > 0 and not attisdropped;
    if actual_columns is distinct from target.columns then
      raise exception 'Unexpected read-model columns: %', target.name;
    end if;
    if not has_table_privilege('service_role', relation, 'SELECT') then
      raise exception 'Existing backend read grant missing: %', target.name;
    end if;
    expected_anon := target.access = 'public';
    expected_member := target.access in ('public', 'member');
    if expected_anon and not has_table_privilege('anon', relation, 'SELECT')
       or expected_member and not has_table_privilege('authenticated', relation, 'SELECT') then
      raise exception 'Existing consumer read grant missing: %', target.name;
    end if;
    before_definition := pg_get_viewdef(relation, true);

    execute format('revoke all privileges on table public.%I from public, anon, authenticated', target.name);
    -- Table REVOKE alone does not remove column-level grants.
    execute format('revoke all privileges (%s) on table public.%I from public, anon, authenticated', column_list, target.name);
    if expected_anon then
      execute format('grant select on table public.%I to anon, authenticated', target.name);
    elsif expected_member then
      execute format('grant select on table public.%I to authenticated', target.name);
    end if;
    if target.name = 'tennisrecord_admin_coverage_summary' then
      execute format('alter view public.%I set (security_invoker = true)', target.name);
    elsif target.name = 'internal_message_directory' then
      -- Preserve the opted-in row boundary before caller-supplied predicates.
      -- Public factual projections keep their existing query-planning options.
      execute format('alter view public.%I set (security_barrier = true)', target.name);
    end if;

    if pg_get_viewdef(relation, true) is distinct from before_definition
       or has_table_privilege('anon', relation, 'SELECT') is distinct from expected_anon
       or has_table_privilege('authenticated', relation, 'SELECT') is distinct from expected_member
       or not has_table_privilege('service_role', relation, 'SELECT')
       or has_table_privilege('anon', relation, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       or has_table_privilege('authenticated', relation, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       or has_any_column_privilege('anon', relation, 'INSERT,UPDATE,REFERENCES')
       or has_any_column_privilege('authenticated', relation, 'INSERT,UPDATE,REFERENCES')
       or (not expected_anon and has_any_column_privilege('anon', relation, 'SELECT'))
       or (not expected_member and has_any_column_privilege('authenticated', relation, 'SELECT')) then
      raise exception 'Read-model permission verification failed: %', target.name;
    end if;
  end loop;
  if not public.account_erasure_catalog_ready() then
    raise exception 'Account erasure catalog changed during view hardening';
  end if;
end;
$hardening$;
commit;
