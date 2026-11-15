begin;
set local lock_timeout = '5s';

alter table private.native_league_scorecards
  add column individual_official_id uuid references public.tiq_individual_league_results(id) on delete set null,
  add constraint native_league_scorecard_official_format check (official_id is null or individual_official_id is null);

-- The team authorization path stays available. An individual match uses
-- exactly one of the signed-in player's approved entries on that schedule.
create function private.native_league_score_participant(
  actor uuid, l public.tiq_leagues, f public.tiq_league_schedule_items, room_a uuid, room_b uuid
) returns boolean language sql stable set search_path = '' as $$
  select case when l.league_format = 'team' then private.native_league_score_captain(actor,l,f,room_a,room_b)
    else coalesce(l.league_format = 'individual' and private.native_published_league_id(l.id)
      and private.native_published_league_fixture(l,f)
      and 1 = (select count(*) from private.native_league_schedule_roster(l.id,'individual') entry
        where entry.submitter = actor and entry.id::text in (f.participant_a_id,f.participant_b_id))
      and not exists (select 1 from public.account_deletion_requests d where d.account_id = actor and d.status <> 'completed'),false)
  end;
$$;
revoke all on function private.native_league_score_participant(uuid,public.tiq_leagues,public.tiq_league_schedule_items,uuid,uuid)
  from public, anon, authenticated, service_role;

create function private.native_league_has_official_score(f public.tiq_league_schedule_items)
returns boolean language sql stable set search_path = '' as $$
  select case when f.league_format = 'individual' then
    exists (select 1 from public.tiq_individual_league_results where schedule_item_id = f.id)
  else exists (select 1 from public.tiq_team_league_match_events where schedule_item_id = f.id) end;
$$;
revoke all on function private.native_league_has_official_score(public.tiq_league_schedule_items)
  from public, anon, authenticated, service_role;

create function private.native_individual_score_result(e public.tiq_individual_league_results, zone text)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id',e.id,'date',(e.result_date at time zone zone)::date,
    'a',btrim(e.player_a_name),'b',btrim(e.player_b_name),'winner',btrim(e.winner_player_name),
    'score',btrim(e.score),'courts','[]'::jsonb);
$$;
revoke all on function private.native_individual_score_result(public.tiq_individual_league_results,text)
  from public, anon, authenticated, service_role;

create function private.native_individual_official_score(
  l public.tiq_leagues, f public.tiq_league_schedule_items, c private.native_league_scorecards
) returns jsonb language sql stable set search_path = '' as $$
  select projected.result from public.tiq_individual_league_results e
  cross join lateral (select private.native_individual_score_result(e,coalesce(nullif(l.schedule_time_zone,''),'America/Chicago')) result) projected
  where c.individual_official_id = e.id and c.state = 'approved'
    and e.league_id = l.id and e.schedule_item_id = f.id and c.match_id = f.id
    and c.fixture_digest = private.native_league_fixture_digest(f)
    and c.result_digest = encode(sha256(convert_to(projected.result::text,'UTF8')),'hex');
$$;
revoke all on function private.native_individual_official_score(public.tiq_leagues,public.tiq_league_schedule_items,private.native_league_scorecards)
  from public, anon, authenticated, service_role;

create function public.native_individual_league_approved_results(p_league text,p_version timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(projected.result order by f.scheduled_date desc,f.id)
    filter (where projected.result is not null),'[]'::jsonb)
  from public.tiq_leagues l
  join public.tiq_league_schedule_items f on f.league_id = l.id and f.league_format = 'individual'
  join private.native_league_scorecards c on c.match_id = f.id and c.state = 'approved'
  cross join lateral (select private.native_individual_official_score(l,f,c) result) projected
  where l.id = p_league and l.updated_at = p_version and l.is_public and l.league_format = 'individual'
    and private.native_published_league_id(l.id);
$$;
revoke all on function public.native_individual_league_approved_results(text,timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.native_individual_league_approved_results(text,timestamptz) to service_role;

create function private.native_approve_individual_score(
  l public.tiq_leagues, f public.tiq_league_schedule_items, line jsonb, actor uuid
) returns public.tiq_individual_league_results language sql volatile set search_path = '' as $$
  -- The entry IDs on the fixture identify enrollment records, not player directory IDs.
  insert into public.tiq_individual_league_results(league_id,schedule_item_id,player_a_name,player_b_name,
    winner_player_name,score,result_date,created_by_user_id,updated_by_user_id)
  values (l.id,f.id,f.participant_a_name,f.participant_b_name,
    case line->>'winner' when 'A' then f.participant_a_name else f.participant_b_name end,
    case line->>'outcome' when 'walkover' then 'Walkover'
      when 'retirement' then concat_ws(' · ','Retired',nullif(line->>'score',''))
      else line->>'score' end,
    (f.scheduled_date + coalesce(f.scheduled_time,time '00:00')) at time zone
      coalesce(nullif(l.schedule_time_zone,''),'America/Chicago'),actor,actor)
  on conflict (schedule_item_id) where schedule_item_id is not null do nothing returning *;
$$;
revoke all on function private.native_approve_individual_score(public.tiq_leagues,public.tiq_league_schedule_items,jsonb,uuid)
  from public, anon, authenticated, service_role;

-- Extend the existing receipt, locking, correction, and notification flow.
do $patch$
declare
  review_sql text := pg_get_functiondef('public.native_league_score_review(uuid,text,timestamptz,uuid,boolean,uuid,uuid)'::regprocedure);
  save_sql text := pg_get_functiondef('public.native_league_save_score(uuid,text,timestamptz,uuid,timestamptz,uuid,uuid,text,jsonb,text,boolean,uuid,uuid)'::regprocedure);
  notices text := pg_get_functiondef('private.native_league_score_updates()'::regprocedure);
  league_scope constant text := $sql$and league_format = 'team' and season_status = 'active'$sql$;
  match_scope constant text := $sql$and league_format = 'team' and status in$sql$;
  participant constant text := 'private.native_league_score_captain(';
  official_queue constant text := 'not exists (select 1 from public.tiq_team_league_match_events e where e.schedule_item_id = f0.id)';
  official_save constant text := 'exists (select 1 from public.tiq_team_league_match_events result where result.schedule_item_id = p_match)';
  columns_guard constant text := 'e public.tiq_team_league_match_events; context jsonb;';
  line_guard constant text := 'if jsonb_array_length(p_lines) not between 1 and 30 or exists';
  reset_guard constant text := 'official_id=null,result_digest=null,updated_at=clock_timestamp()';
  start_team constant text := 'if (select count(*) from public.tiq_team_league_match_events result where result.league_id = p_league)';
  end_team constant text := 'event_id := e.id;';
  receipt constant text := 'note=p_note,reviewed_by=p_actor,updated_by=p_actor,official_id=event_id,';
  result_digest_guard constant text := $sql$result_digest=case when event_id is not null then encode(sha256(convert_to(private.native_league_score_result(e)::text,'UTF8')),'hex') end,$sql$;
  eligible constant text := $sql$and (league_format = 'team' or (league_format = 'individual'
    and is_public and private.native_published_league_id(id))) and season_status = 'active'$sql$;
begin
  if position(league_scope in review_sql)=0 or position(league_scope in save_sql)=0
    or position(match_scope in review_sql)=0 or position(match_scope in save_sql)=0
    or position(participant in review_sql)=0 or position(participant in save_sql)=0 or position(participant in notices)=0
    or position(official_queue in review_sql)=0 or position(official_save in save_sql)=0
    or position(columns_guard in save_sql)=0 or position(line_guard in save_sql)=0 or position(reset_guard in save_sql)=0
    or position(start_team in save_sql)=0 or position(end_team in save_sql)=0 or position(receipt in save_sql)=0
    or position(result_digest_guard in save_sql)=0 then
    raise exception 'League score source changed; check the individual league score migration';
  end if;

  review_sql := replace(review_sql,league_scope,eligible);
  review_sql := replace(review_sql,match_scope,'and league_format = l.league_format and status in');
  review_sql := replace(review_sql,official_queue,'not private.native_league_has_official_score(f0)');
  execute replace(review_sql,participant,'private.native_league_score_participant(');
  execute replace(notices,participant,'private.native_league_score_participant(');

  save_sql := replace(save_sql,league_scope,eligible);
  save_sql := replace(save_sql,match_scope,'and league_format = l.league_format and status in');
  save_sql := replace(save_sql,participant,'private.native_league_score_participant(');
  save_sql := replace(save_sql,official_save,'private.native_league_has_official_score(f)');
  save_sql := replace(save_sql,columns_guard,'e public.tiq_team_league_match_events; individual_result public.tiq_individual_league_results; context jsonb;');
  save_sql := replace(save_sql,line_guard,$sql$if jsonb_array_length(p_lines) not between 1 and 30
      or (l.league_format = 'individual' and (jsonb_array_length(p_lines) <> 1 or p_lines->0->>'format' is distinct from 'singles'))
      or exists$sql$);
  save_sql := replace(save_sql,reset_guard,'official_id=null,individual_official_id=null,result_digest=null,updated_at=clock_timestamp()');
  save_sql := replace(save_sql,start_team,$sql$if l.league_format = 'individual' then
        if (select count(*) from public.tiq_individual_league_results where league_id = p_league) >= l.max_match_events
        then return jsonb_build_object('code','capacity'); end if;
        individual_result := private.native_approve_individual_score(l,f,c.lines->0,p_actor);
        if individual_result.id is null then return jsonb_build_object('code','official'); end if;
      else
      $sql$ || start_team);
  save_sql := replace(save_sql,end_team,end_team || chr(10) || '      end if;');
  save_sql := replace(save_sql,receipt,receipt || 'individual_official_id=individual_result.id,');
  execute replace(save_sql,result_digest_guard,$sql$result_digest=case
        when individual_result.id is not null then encode(sha256(convert_to(private.native_individual_score_result(
          individual_result,coalesce(nullif(l.schedule_time_zone,''),'America/Chicago'))::text,'UTF8')),'hex')
        when event_id is not null then encode(sha256(convert_to(private.native_league_score_result(e)::text,'UTF8')),'hex') end,$sql$);
end $patch$;

-- Individual Match Day is limited to app-published seasons and scheduler-
-- attested fixtures. Participant actions reveal no score or correction text.
create function public.native_individual_league_match_day(
  p_league text,p_version timestamptz,p_matches uuid[],p_actor uuid,p_player_access boolean
) returns jsonb language sql stable security definer set search_path = '' as $$
  with league as materialized (
    select l.*,l as source,coalesce(l.season_status = 'active' and private.native_published_league_owner(l,p_actor)
      and exists (select 1 from public.profiles p where p.id=p_actor)
      and not exists (select 1 from public.account_deletion_requests d where d.account_id=p_actor and d.status<>'completed'),false) as coordinator
    from public.tiq_leagues l where l.id=p_league and l.updated_at=p_version and l.is_public
      and l.league_format='individual' and private.native_published_league_id(l.id)
      and cardinality(p_matches) between 0 and 100
  ), visible as (
    select f.id,private.native_league_score_fixture(f) || jsonb_build_object('status',f.status,'facility',btrim(f.facility)) fixture,
      private.native_individual_official_score(l.source,f,c) official,
      case when l.season_status = 'active' and not private.native_league_has_official_score(f) then
        case when c.state = 'pending' and l.coordinator then 'review'
          when p_player_access and private.native_league_score_participant(p_actor,l.source,f,null,null)
            and f.scheduled_date + coalesce(f.scheduled_time,time '00:00') <=
              now() at time zone coalesce(nullif(l.schedule_time_zone,''),'America/Chicago')
          then case c.state when 'pending' then 'pending' when 'changes_requested' then 'fix'
            when 'approved' then null else 'enter' end
        end
      end action
    from league l
    join public.tiq_league_schedule_items f on f.league_id=l.id and f.id=any(p_matches)
      and f.status in ('confirmed','coordinator_set','completed') and private.native_published_league_fixture(l.source,f)
    left join private.native_league_scorecards c on c.match_id=f.id and c.fixture_digest=private.native_league_fixture_digest(f)
  )
  select jsonb_build_object('matches',coalesce((
    select jsonb_agg(jsonb_build_object('id',m.id,'fixture',m.fixture,'action',m.action,'official',m.official) order by m.id)
    from visible m where m.action is not null or m.official is not null
  ),'[]'::jsonb),'canReview',coalesce((select coordinator from league),false));
$$;
revoke all on function public.native_individual_league_match_day(text,timestamptz,uuid[],uuid,boolean) from public, anon, authenticated, service_role;
grant execute on function public.native_individual_league_match_day(text,timestamptz,uuid[],uuid,boolean) to service_role;

notify pgrst,'reload schema';
commit;
