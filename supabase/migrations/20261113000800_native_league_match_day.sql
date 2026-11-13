begin;
set local lock_timeout = '5s';

-- One bounded read over the schedule the caller already has permission to see.
-- Private scorecards contribute status only, never scores or correction notes.
create function public.native_league_match_day(
  p_league text, p_version timestamptz, p_matches uuid[], p_actor uuid,
  p_captain_access boolean, p_rooms jsonb
) returns jsonb language sql stable security definer set search_path = '' as $$
  with league as materialized (
    select l.*, l as source, (l.created_by_user_id = p_actor and exists (
      select 1 from public.profiles p where p.id = p_actor and (
        private.native_testflight_score_league(l,p_actor) or p.role = 'admin' or (
          (p.tiq_team_league_entry_enabled or p.tiq_individual_league_creator_enabled)
          and (p.league_access_expires_at is null or p.league_access_expires_at > now())
        ))
      ) and not exists (select 1 from public.account_deletion_requests d where d.account_id=p_actor and d.status<>'completed')) as coordinator
    from public.tiq_leagues l where l.id = p_league and l.updated_at = p_version
      and l.league_format = 'team' and (l.is_public or private.native_testflight_score_league(l,p_actor))
      and cardinality(p_matches) between 0 and 100 and jsonb_typeof(p_rooms)='object'
  ), linked as (
    select f.id,
      private.native_league_score_fixture(f) || jsonb_build_object('status',f.status,'facility',btrim(f.facility)) as fixture,
      e.id as result_id,
      case when e.id is null and l.season_status = 'active' then
        case when sc.state='pending' and l.coordinator then 'review'
          when p_captain_access and private.native_league_score_captain(
            p_actor, l.source, f,
            (p_rooms->>btrim(f.participant_a_name))::uuid, (p_rooms->>btrim(f.participant_b_name))::uuid
          ) and f.scheduled_date + coalesce(f.scheduled_time,time '00:00')
            <= now() at time zone coalesce(nullif(l.schedule_time_zone,''),'America/Chicago')
          then case sc.state when 'pending' then 'pending' when 'changes_requested' then 'fix'
            when 'approved' then null else 'enter' end
        end
      end as action
    from league l
    join public.tiq_league_schedule_items f on f.league_id=l.id and f.id=any(p_matches)
      and f.league_format='team' and f.status in ('confirmed','coordinator_set','completed')
    left join public.tiq_team_league_match_events e on e.schedule_item_id=f.id and e.league_id=l.id
      and btrim(e.team_a_name)=btrim(f.participant_a_name) and btrim(e.team_b_name)=btrim(f.participant_b_name)
      and e.match_date=f.scheduled_date
    left join private.native_league_scorecards sc on sc.match_id=f.id and sc.fixture_digest=private.native_league_fixture_digest(f)
    where not exists (
      select 1 from public.tiq_team_league_match_events other
      where other.schedule_item_id=f.id and e.id is null
    )
  )
  select jsonb_build_object('matches',coalesce(
    (select jsonb_agg(jsonb_build_object('id',m.id,'fixture',m.fixture,'action',m.action,
      'official',case when e.id is not null then private.native_league_score_result(e) end) order by m.id)
      from linked m left join public.tiq_team_league_match_events e on e.id=m.result_id
      where m.action is not null or m.result_id is not null),'[]'::jsonb),
    'canReview',coalesce((select coordinator from league where season_status='active'),false));
$$;

revoke all on function public.native_league_match_day(text,timestamptz,uuid[],uuid,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.native_league_match_day(text,timestamptz,uuid[],uuid,boolean,jsonb) to service_role;

notify pgrst,'reload schema';
commit;
