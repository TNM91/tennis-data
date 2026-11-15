begin;
set local lock_timeout = '5s';

-- App-published seasons use the same scheduler and score desk as reviewed
-- leagues. Protect their inputs from generic league and score editors.
create policy "Published league fixtures require the app scheduler" on public.tiq_league_schedule_items
  as restrictive for insert to anon, authenticated with check (league_id not like 'tiq-native-league-%');
create policy "Published league fixture revisions require the app scheduler" on public.tiq_league_schedule_items
  as restrictive for update to anon, authenticated
  using (league_id not like 'tiq-native-league-%') with check (league_id not like 'tiq-native-league-%');
create policy "Published league fixture deletion is scoped" on public.tiq_league_schedule_items
  as restrictive for delete to anon, authenticated using (league_id not like 'tiq-native-league-%');

do $policies$
declare
  result_table text;
  scope constant text := $sql$league_id not like 'tiq-native-league-%'$sql$;
begin
  foreach result_table in array array['tiq_team_league_match_events','tiq_individual_league_results'] loop
    execute format('create policy "Published league results require the app" on public.%I as restrictive for insert to anon, authenticated with check (%s)',result_table,scope);
    execute format('create policy "Published league result revisions require the app" on public.%I as restrictive for update to anon, authenticated using (%s) with check (%s)',result_table,scope,scope);
    execute format('create policy "Published league result deletion is scoped" on public.%I as restrictive for delete to anon, authenticated using (%s)',result_table,scope);
  end loop;
end $policies$;

-- The foreign key references a match ID, so also reject a cross-league score
-- even when the caller cannot see the protected match through RLS.
create function private.guard_published_league_score_match()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.schedule_item_id is not null and exists (
    select 1 from public.tiq_league_schedule_items f where f.id = new.schedule_item_id
      and f.league_id like 'tiq-native-league-%' and f.league_id is distinct from new.league_id
  ) then raise exception 'Result must belong to the scheduled league' using errcode = '23514'; end if;
  return new;
end;
$$;
revoke all on function private.guard_published_league_score_match() from public, anon, authenticated, service_role;
create trigger guard_published_team_league_score_match
  before insert or update of schedule_item_id,league_id on public.tiq_team_league_match_events
  for each row execute function private.guard_published_league_score_match();
create trigger guard_published_individual_league_score_match
  before insert or update of schedule_item_id,league_id on public.tiq_individual_league_results
  for each row execute function private.guard_published_league_score_match();

create policy "Published court results require the app" on public.tiq_team_league_match_lines
  as restrictive for insert to anon, authenticated with check (not exists (
    select 1 from public.tiq_team_league_match_events e where e.id = event_id and e.league_id like 'tiq-native-league-%'
  ));
create policy "Published court result revisions require the app" on public.tiq_team_league_match_lines
  as restrictive for update to anon, authenticated using (not exists (
    select 1 from public.tiq_team_league_match_events e where e.id = event_id and e.league_id like 'tiq-native-league-%'
  )) with check (not exists (
    select 1 from public.tiq_team_league_match_events e where e.id = event_id and e.league_id like 'tiq-native-league-%'
  ));
create policy "Published court result deletion is scoped" on public.tiq_team_league_match_lines
  as restrictive for delete to anon, authenticated using (not exists (
    select 1 from public.tiq_team_league_match_events e where e.id = event_id and e.league_id like 'tiq-native-league-%'
  ));

create function private.native_published_league_id(id text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(id ~ '^tiq-native-league-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$',false);
$$;
revoke all on function private.native_published_league_id(text) from public, anon, authenticated, service_role;

create function private.native_published_league_owner(l public.tiq_leagues, actor uuid)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(private.native_published_league_id(l.id) and l.is_public and l.created_by_user_id = actor,false);
$$;
revoke all on function private.native_published_league_owner(public.tiq_leagues,uuid)
  from public, anon, authenticated, service_role;

create function private.native_published_league_fixture(l public.tiq_leagues, f public.tiq_league_schedule_items)
returns boolean language sql stable set search_path = '' as $$
  select l.is_public and f.league_id = l.id and f.league_format = l.league_format
    and f.updated_by_user_id = l.created_by_user_id
    and exists (select 1 from private.native_league_match_operations o
      where o.match_id = f.id and o.match_version = f.updated_at and o.match_digest = private.native_league_fixture_digest(f))
    and 2 = (select count(*) from private.native_league_schedule_roster(l.id,l.league_format) r
      where (r.id::text = f.participant_a_id and r.name = f.participant_a_name)
         or (r.id::text = f.participant_b_id and r.name = f.participant_b_name));
$$;
revoke all on function private.native_published_league_fixture(public.tiq_leagues,public.tiq_league_schedule_items)
  from public, anon, authenticated, service_role;

-- Patch the deployed functions at their capability checks so fixes for scores,
-- postponements and the existing TestFlight fixtures keep their current paths.
do $patch$
declare
  schedule_save text := pg_get_functiondef('public.native_first_party_save_league_match(uuid,text,timestamptz,uuid,uuid,timestamptz,uuid,uuid,date,time,text,text,integer,boolean)'::regprocedure);
  public_schedule text := pg_get_functiondef('public.native_first_party_league_matches(text,timestamptz)'::regprocedure);
  score_review text := pg_get_functiondef('public.native_league_score_review(uuid,text,timestamptz,uuid,boolean,uuid,uuid)'::regprocedure);
  score_captain text := pg_get_functiondef('private.native_league_score_captain(uuid,public.tiq_leagues,public.tiq_league_schedule_items,uuid,uuid)'::regprocedure);
  attention text := pg_get_functiondef('private.native_league_attention_coordinator(public.tiq_leagues,uuid)'::regprocedure);
  match_day text := pg_get_functiondef('public.native_league_match_day(text,timestamptz,uuid[],uuid,boolean,jsonb)'::regprocedure);
  season_archive text := pg_get_functiondef('public.archive_finished_tiq_league_season()'::regprocedure);
  save_grant constant text := 'id = p_actor and (p_league = ';
  schedule_state constant text := 'l.is_public and l.season_status = ''active''';
  review_grant constant text := 'private.native_testflight_score_league(l,p_actor) or p.role = ''admin''';
  followup_grant constant text := 'private.native_testflight_score_league(l,actor) or p.role = ''admin''';
  review_fixture constant text := 'captain := p_captain_access';
  queued_fixture constant text := 'where f0.league_id = p_league and f0.status';
  room_fallback constant text := 'or (link.source_type in (''tiq_entry'',''manual_invite'') and exists (';
  exact_capture constant text := 'and (nullif(s.entry_id,'''') is null or s.entry_id = r.id::text)';
  archive_guard constant text := 'if new.league_id is null then return new; end if;';
  archive_scope constant text := 'and lower(trim(league_name)) = lower(trim(target_league_name))';
begin
  if position(save_grant in schedule_save)=0 or position(schedule_state in public_schedule)=0
    or position(review_grant in score_review)=0 or position(review_grant in match_day)=0
    or position(followup_grant in attention)=0 or position(review_fixture in score_review)=0
    or position(queued_fixture in score_review)=0 or position(room_fallback in score_captain)=0
    or position(exact_capture in score_captain)=0
    or position(archive_guard in season_archive)=0 or position(archive_scope in season_archive)=0 then
    raise exception 'League operations source changed; check the published league migration';
  end if;

  execute replace(schedule_save,save_grant,$sql$id = p_actor and (
    exists (select 1 from public.tiq_leagues owned where owned.id = p_league
      and private.native_published_league_owner(owned,p_actor))
    or p_league = $sql$);
  execute replace(public_schedule,schedule_state,$sql$l.is_public and (
    l.season_status = 'active' or (private.native_published_league_id(l.id) and l.season_status in ('completed','archived'))
  )$sql$);
  score_review := replace(score_review,review_grant,'private.native_published_league_owner(l,p_actor) or ' || review_grant);
  score_review := replace(score_review,review_fixture,$sql$if private.native_published_league_id(l.id)
    and not coalesce(private.native_published_league_fixture(l,f),false) then return null; end if;
  $sql$ || review_fixture);
  execute replace(score_review,queued_fixture,$sql$where f0.league_id = p_league
        and (not private.native_published_league_id(l.id) or private.native_published_league_fixture(l,f0)) and f0.status$sql$);
  execute replace(match_day,review_grant,'private.native_published_league_owner(l,p_actor) or ' || review_grant);
  execute replace(attention,followup_grant,'private.native_published_league_owner(l,actor) or ' || followup_grant);

  -- A published match uses the exact approved team entries on its fixture.
  -- Name-only room links cannot grant authority to submit a score in it.
  score_captain := replace(score_captain,exact_capture,$sql$and (s.entry_id = r.id::text
            or (not private.native_published_league_id(l.id) and nullif(s.entry_id,'') is null))$sql$);
  execute replace(score_captain,room_fallback,$sql$or (not private.native_published_league_id(l.id)
          and link.source_type in ('tiq_entry','manual_invite') and exists ($sql$);

  -- The older trigger groups team links by league name. A published season
  -- can share a name with another season and can schedule one match at a time.
  season_archive := replace(season_archive,archive_guard,
    'if new.league_id is null or private.native_published_league_id(new.league_id) then return new; end if;');
  execute replace(season_archive,archive_scope,archive_scope || $sql$
      and not exists (select 1 from public.tiq_team_league_entries entry
        where team_profile_links.source_type = 'tiq_entry' and entry.id = team_profile_links.source_record_id
          and private.native_published_league_id(entry.league_id))$sql$);
end $patch$;

notify pgrst, 'reload schema';
commit;
