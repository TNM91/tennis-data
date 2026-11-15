begin;
set local lock_timeout = '5s';

-- Operators can add one signed-in player to a rehearsal. The coordinator
-- check used for scheduling and review still requires the original owner.
alter table private.native_league_entry_rehearsals
  add column player_id uuid references public.profiles(id) on delete set null,
  add constraint native_league_rehearsal_distinct_player check (player_id <> owner_id),
  add constraint native_league_rehearsal_one_invite_per_player unique (player_id);

create function private.native_league_rehearsal_player(target text, actor uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from private.native_league_entry_rehearsals r
    join auth.users u on u.id=r.player_id and u.email_confirmed_at is not null
    where r.league_id=target and r.player_id=actor
      and private.native_league_entry_rehearsal_open(r.league_id,r.owner_id)
      and not exists (select 1 from public.account_deletion_requests d
        where d.account_id=actor and d.status <> 'completed')
  );
$$;
revoke all on function private.native_league_rehearsal_player(text,uuid) from public,anon,authenticated,service_role;

-- Visible league metadata lets the invited account read its own entry under
-- the existing roster policy. Direct fixture and result policies stay scoped.
create function private.native_league_rehearsal_player_visible(target text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.native_league_rehearsal_player(target,(select auth.uid()));
$$;
revoke all on function private.native_league_rehearsal_player_visible(text) from public,anon,authenticated,service_role;
grant execute on function private.native_league_rehearsal_player_visible(text) to anon,authenticated;
alter policy "Entry rehearsals are visible to their owner" on public.tiq_leagues
  using (id not like 'tiq-native-league-e79ec308-8b38-4bf8-aac9-%'
    or created_by_user_id = (select auth.uid()) or private.native_league_rehearsal_player_visible(id));
create policy "Invited rehearsal players can see their league" on public.tiq_leagues
  for select to authenticated using (id like 'tiq-native-league-e79ec308-8b38-4bf8-aac9-%'
    and private.native_league_rehearsal_player_visible(id));

create function pg_temp.patch_paired_match_day(source text, marker text, replacement text)
returns text language plpgsql as $$
begin
  source := replace(source,chr(13),'');
  if length(source)-length(replace(source,marker,'')) <> length(marker) then
    raise exception 'Paired Match Day source changed: %',marker;
  end if;
  return replace(source,marker,replacement);
end;
$$;

do $patch$
declare
  source text;
  routine regprocedure;
  review constant regprocedure := 'public.native_league_score_review(uuid,text,timestamptz,uuid,boolean,uuid,uuid)'::regprocedure;
  save constant regprocedure := 'public.native_league_save_score(uuid,text,timestamptz,uuid,timestamptz,uuid,uuid,text,jsonb,text,boolean,uuid,uuid)'::regprocedure;
  owner_check constant text := 'private.native_league_entry_rehearsal_open(p_league,p_actor)';
  player_check constant text := 'private.native_league_rehearsal_player(p_league,p_actor)';
  score_scope constant text := '(is_public or private.native_testflight_score_league(tiq_leagues,p_actor)) or ' || owner_check;
  individual_scope constant text := '(is_public and private.native_published_league_id(id)) or ' || owner_check;
  entry_notice_actor constant text := 'private.native_league_entry_rehearsal_open(league.id,n.recipient_profile_id)';
begin
  source := pg_get_functiondef('public.native_first_party_league_entry(uuid,text,text,timestamptz,jsonb)'::regprocedure);
  execute pg_temp.patch_paired_match_day(source,'or private.native_league_entry_rehearsal_open(id,p_actor)',
    'or private.native_league_entry_rehearsal_open(id,p_actor) or private.native_league_rehearsal_player(id,p_actor)');

  source := pg_get_functiondef('private.native_league_entry_updates()'::regprocedure);
  source := pg_temp.patch_paired_match_day(source,'league.is_public or ' || entry_notice_actor,
    'league.is_public or ' || entry_notice_actor || ' or private.native_league_rehearsal_player(league.id,n.recipient_profile_id)');
  execute pg_temp.patch_paired_match_day(source,'private.native_league_registration_open(league.id) or ' || entry_notice_actor,
    'private.native_league_registration_open(league.id) or ' || entry_notice_actor || ' or private.native_league_rehearsal_player(league.id,n.recipient_profile_id)');

  source := pg_get_functiondef('public.native_first_party_save_league_match(uuid,text,timestamptz,uuid,uuid,timestamptz,uuid,uuid,date,time,text,text,integer,boolean)'::regprocedure);
  source := pg_temp.patch_paired_match_day(source,'if p_notify and not ' || owner_check || ' then',
    'if p_notify and (not ' || owner_check || $sql$ or exists (
      select 1 from private.native_league_schedule_recipients(p_league,l.league_format,array[p_a,p_b]) r
      where private.native_league_rehearsal_player(p_league,r.recipient)
    )) then$sql$);
  execute pg_temp.patch_paired_match_day(source,'case when l.is_public then recipient <> p_actor else recipient = p_actor end',
    'case when l.is_public then recipient <> p_actor when ' || owner_check ||
    ' then private.native_league_rehearsal_player(p_league,recipient) else recipient = p_actor end');

  source := pg_get_functiondef('private.native_league_match_updates()'::regprocedure);
  execute pg_temp.patch_paired_match_day(source,'l.is_public or private.native_testflight_score_league(l,n.recipient_profile_id)',
    'l.is_public or private.native_testflight_score_league(l,n.recipient_profile_id) or private.native_league_rehearsal_player(l.id,n.recipient_profile_id)');

  foreach routine in array array[review,save] loop
    source := pg_temp.patch_paired_match_day(pg_get_functiondef(routine),score_scope,score_scope || ' or ' || player_check);
    source := pg_temp.patch_paired_match_day(source,individual_scope,individual_scope || ' or ' || player_check);
    if routine = review then
      source := pg_temp.patch_paired_match_day(source,'(' || owner_check || ' or (f.scheduled_date',
        '(' || owner_check || ' or ' || player_check || ' or (f.scheduled_date');
    else
      source := pg_temp.patch_paired_match_day(source,'recipient is not null and not ' || owner_check || ' and',
        $sql$recipient is not null and (not private.native_league_entry_rehearsal_open(l.id,l.created_by_user_id)
          or (p_actor = l.created_by_user_id and private.native_league_rehearsal_player(l.id,recipient))
          or (recipient = l.created_by_user_id and private.native_league_rehearsal_player(l.id,p_actor))) and$sql$);
    end if;
    execute source;
  end loop;

  source := pg_get_functiondef('public.native_individual_league_match_day(text,timestamptz,uuid[],uuid,boolean)'::regprocedure);
  source := pg_temp.patch_paired_match_day(source,'(l.is_public or ' || owner_check || ')',
    '(l.is_public or ' || owner_check || ' or ' || player_check || ')');
  source := pg_temp.patch_paired_match_day(source,'f.id=any(p_matches)',
    $sql$f.id=any(p_matches) and (l.is_public or l.coordinator
      or private.native_league_score_participant(p_actor,l.source,f,null,null))$sql$);
  execute pg_temp.patch_paired_match_day(source,'(' || owner_check || ' or f.scheduled_date',
    '(' || owner_check || ' or ' || player_check || ' or f.scheduled_date');

  source := pg_get_functiondef('private.native_league_score_updates()'::regprocedure);
  execute pg_temp.patch_paired_match_day(source,'l.is_public or private.native_testflight_score_league(l,n.recipient_profile_id)',
    $sql$l.is_public or private.native_testflight_score_league(l,n.recipient_profile_id)
      or (private.native_league_entry_rehearsal_open(l.id,n.recipient_profile_id)
        and private.native_league_rehearsal_player(l.id,n.actor_user_id))
      or (private.native_league_entry_rehearsal_open(l.id,n.actor_user_id)
        and private.native_league_rehearsal_player(l.id,n.recipient_profile_id))$sql$);
end
$patch$;
drop function pg_temp.patch_paired_match_day(text,text,text);

create function private.native_league_rehearsal_match_day(l public.tiq_leagues,actor uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'fixtures',coalesce(jsonb_agg(jsonb_build_object(
      'match',private.native_league_scheduled_match(f,o.court,o.duration_minutes),'original',o.original_fixture
    ) order by f.scheduled_date desc,f.id),'[]'::jsonb),
    'results',coalesce(jsonb_agg(score.result order by f.scheduled_date desc,f.id)
      filter (where score.result is not null),'[]'::jsonb))
  from public.tiq_league_schedule_items f
  join private.native_league_match_operations o on o.match_id=f.id and o.match_version=f.updated_at
    and o.match_digest=private.native_league_fixture_digest(f)
  left join private.native_league_scorecards c on c.match_id=f.id and c.state='approved'
  cross join lateral (select private.native_individual_official_score(l,f,c) result) score
  where f.league_id=l.id and f.status='coordinator_set' and private.native_published_league_fixture(l,f)
    and (private.native_league_entry_rehearsal_open(l.id,actor)
      or private.native_league_score_participant(actor,l,f,null,null));
$$;
revoke all on function private.native_league_rehearsal_match_day(public.tiq_leagues,uuid)
  from public,anon,authenticated,service_role;

create or replace function public.native_league_entry_rehearsal(p_league text)
returns jsonb language sql stable security definer set search_path = ''
set statement_timeout = '5s' as $$
  with viewer as (select auth.uid() actor)
  select to_jsonb(source) from (
    select l.id,l.created_by_user_id,l.league_name,l.league_format,l.season_label,l.season_status,
      l.flight,l.location_label,l.starts_on,l.ends_on,l.schedule_time_zone,l.updated_at,
      l.scoring_system,l.competition_rules,l.is_public,l.third_set_rule,viewer.actor as viewer_id,
      (select entry_status from public.tiq_player_league_entries e
        where e.league_id=l.id and e.created_by_user_id=viewer.actor order by e.id limit 1) as viewer_entry_status,
      case when p_league is not null then private.native_league_rehearsal_match_day(l,viewer.actor) end as match_day
    from private.native_league_entry_rehearsals rehearsal
    join public.tiq_leagues l on l.id=rehearsal.league_id
    cross join viewer
    where (p_league is null or p_league=l.id)
      and ((rehearsal.owner_id=viewer.actor and private.native_league_entry_rehearsal_open(l.id,viewer.actor))
        or (rehearsal.player_id=viewer.actor and private.native_league_rehearsal_player(l.id,viewer.actor)))
    order by (rehearsal.owner_id=viewer.actor) desc
    limit 1
  ) source;
$$;
drop function private.native_league_rehearsal_match_day(public.tiq_leagues);

notify pgrst,'reload schema';
commit;
