begin;
set local lock_timeout = '5s';

alter table public.tiq_league_schedule_items drop constraint if exists tiq_league_schedule_items_status_check;
alter table public.tiq_league_schedule_items add constraint tiq_league_schedule_items_status_check
  check (status in ('proposed','confirmed','coordinator_set','completed','cancelled','postponed'));

create policy "Postponement requires the coordinator scheduler" on public.tiq_league_schedule_items
  as restrictive for insert to anon, authenticated with check (status <> 'postponed');
create policy "Postponed matches move through the coordinator scheduler" on public.tiq_league_schedule_items
  as restrictive for update to anon, authenticated using (status <> 'postponed') with check (status <> 'postponed');

create function private.native_league_can_postpone(f public.tiq_league_schedule_items)
returns boolean language sql stable set search_path = '' as $$
  select f.league_format = 'team' and f.status in ('confirmed','coordinator_set')
    and not exists (select 1 from private.native_league_scorecards c where c.match_id = f.id
      and c.fixture_digest = private.native_league_fixture_digest(f))
    and not exists (select 1 from public.native_captain_court_results r where r.fixture_id = f.id)
    and not exists (select 1 from public.tiq_team_league_match_events e
      where e.schedule_item_id = f.id or (e.schedule_item_id is null and e.league_id = f.league_id and e.match_date = f.scheduled_date
        and ((lower(btrim(e.team_a_name)) = lower(btrim(f.participant_a_name)) and lower(btrim(e.team_b_name)) = lower(btrim(f.participant_b_name)))
          or (lower(btrim(e.team_b_name)) = lower(btrim(f.participant_a_name)) and lower(btrim(e.team_a_name)) = lower(btrim(f.participant_b_name))))));
$$;
revoke all on function private.native_league_can_postpone(public.tiq_league_schedule_items) from public, anon, authenticated;

create function public.native_first_party_postpone_league_match(
  p_actor uuid, p_league text, p_version timestamptz, p_request uuid, p_match uuid, p_match_version timestamptz, p_fixture jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l public.tiq_leagues;
  f public.tiq_league_schedule_items;
  op private.native_league_match_operations;
  prior private.native_league_match_operations;
  original jsonb;
  digest text;
  a_id uuid;
  b_id uuid;
  sent integer;
  uncovered integer;
begin
  if p_request is null or p_match is null or p_match_version is null or p_fixture is null then
    return jsonb_build_object('code','invalid');
  end if;
  select * into l from public.tiq_leagues where id = p_league for update;
  if not found or not private.native_league_attention_coordinator(l,p_actor) then return jsonb_build_object('code','forbidden'); end if;
  if l.updated_at is distinct from p_version then return jsonb_build_object('code','stale'); end if;
  select * into f from public.tiq_league_schedule_items where id = p_match and league_id = p_league for update;
  if not found then return jsonb_build_object('code','stale'); end if;

  digest := encode(sha256(convert_to(jsonb_build_array('postpone',p_actor,p_match,extract(epoch from p_match_version),p_fixture)::text,'UTF8')),'hex');
  select * into op from private.native_league_match_operations where request_id = p_request;
  if found then
    if op.match_id <> f.id or op.request_digest <> digest or op.match_digest <> private.native_league_fixture_digest(f) then
      return jsonb_build_object('code','stale');
    end if;
    return jsonb_build_object('code','saved','match',private.native_league_scheduled_match(f,op.court,op.duration_minutes),
      'notified',op.notified_count,'unreachable',op.unreachable_sides);
  end if;
  if f.updated_at is distinct from p_match_version or p_fixture is distinct from
    (private.native_league_score_fixture(f) || jsonb_build_object('status',f.status,'facility',btrim(f.facility))) then
    return jsonb_build_object('code','stale');
  end if;
  if not private.native_league_can_postpone(f) then return jsonb_build_object('code','played'); end if;

  perform 1 from public.tiq_team_league_entries e where e.league_id=l.id
    and lower(btrim(e.team_name)) in (lower(btrim(f.participant_a_name)),lower(btrim(f.participant_b_name)))
    order by e.id for share;
  select case when count(*) = 1 then min(r.id::text)::uuid end into a_id
    from private.native_league_schedule_roster(l.id,'team') r
    where r.name = btrim(f.participant_a_name) and coalesce(nullif(f.participant_a_id,''),r.id::text) = r.id::text;
  select case when count(*) = 1 then min(r.id::text)::uuid end into b_id
    from private.native_league_schedule_roster(l.id,'team') r
    where r.name = btrim(f.participant_b_name) and coalesce(nullif(f.participant_b_id,''),r.id::text) = r.id::text;
  if a_id is null or b_id is null or a_id = b_id or exists (
    select 1 from private.native_league_schedule_roster(l.id,'team') r
    where (lower(r.name) = lower(btrim(f.participant_a_name)) and r.id <> a_id)
       or (lower(r.name) = lower(btrim(f.participant_b_name)) and r.id <> b_id)
  ) then return jsonb_build_object('code','roster'); end if;

  select * into prior from private.native_league_match_operations o
    where o.match_id = f.id and o.match_version = f.updated_at and o.match_digest = private.native_league_fixture_digest(f);
  if found then original := prior.original_fixture;
  else original := jsonb_build_object('id',f.id,'date',f.scheduled_date,'time',coalesce(f.scheduled_time::text,''),
    'facility',btrim(f.facility),'a',btrim(f.participant_a_name),'b',btrim(f.participant_b_name),'status',f.status);
  end if;

  update public.tiq_league_schedule_items set status='postponed',participant_a_id=a_id::text,participant_b_id=b_id::text,
    participant_a_name=btrim(f.participant_a_name),participant_b_name=btrim(f.participant_b_name),
    updated_by_user_id=p_actor,updated_at=clock_timestamp() where id=f.id returning * into f;
  insert into private.native_league_match_operations(request_id,match_id,request_digest,match_version,match_digest,
    venue_id,court,duration_minutes,original_fixture,rescheduled)
  values(p_request,f.id,digest,f.updated_at,private.native_league_fixture_digest(f),coalesce(prior.venue_id,''),
    coalesce(prior.court,''),coalesce(prior.duration_minutes,120),original,false)
  returning * into op;

  with targets as materialized (
    select r.recipient, array_agg(r.entry_id order by r.entry_id) as entries
    from private.native_league_schedule_recipients(l.id,'team',array[a_id,b_id]) r
    where (case when l.is_public then r.recipient <> p_actor else r.recipient = p_actor end)
      and not exists (select 1 from public.internal_notification_preferences pref where pref.profile_id=r.recipient and not pref.schedule_alerts_enabled)
      and not exists (select 1 from public.team_chat_blocks b
        where (b.owner_user_id=r.recipient and b.blocked_user_id=p_actor) or (b.owner_user_id=p_actor and b.blocked_user_id=r.recipient))
    group by r.recipient
  ), notices as (
    insert into public.internal_notifications(recipient_profile_id,actor_user_id,notification_type,title,body,href)
    select t.recipient,p_actor,'schedule','League match postponed',
      f.participant_a_name || ' vs ' || f.participant_b_name || ' · New date pending',
      '/explore/leagues/tiq/' || l.id || '?scheduledMatch=' || f.id || '#league-schedule'
    from targets t returning id,recipient_profile_id
  ), receipts as (
    insert into private.native_league_match_notices(notification_id,request_id,entry_ids)
    select n.id,p_request,t.entries from notices n join targets t on t.recipient=n.recipient_profile_id returning notification_id
  )
  select (select count(*) from receipts), (select count(*) from unnest(array[a_id,b_id]) side(id)
    where not exists (select 1 from targets t where side.id = any(t.entries))
      and not exists (select 1 from private.native_league_schedule_recipients(l.id,'team',array[side.id]) r where r.recipient=p_actor))
  into sent,uncovered;
  update private.native_league_match_operations set notified_count=sent,unreachable_sides=uncovered where request_id=p_request;
  return jsonb_build_object('code','saved','match',private.native_league_scheduled_match(f,op.court,op.duration_minutes),
    'notified',sent,'unreachable',uncovered);
end;
$$;
revoke all on function public.native_first_party_postpone_league_match(uuid,text,timestamptz,uuid,uuid,timestamptz,jsonb)
  from public, anon, authenticated;
grant execute on function public.native_first_party_postpone_league_match(uuid,text,timestamptz,uuid,uuid,timestamptz,jsonb)
  to service_role;

-- Reuse the slot validation, overlap checks, and receipts from Schedule Match.
-- The guarded replacements apply only to the known 00400 definitions.
do $patch$
declare
  save_sql text := replace(pg_get_functiondef('public.native_first_party_save_league_match(uuid,text,timestamptz,uuid,uuid,timestamptz,uuid,uuid,date,time,text,text,integer,boolean)'::regprocedure),chr(13),'');
  review_sql text := replace(pg_get_functiondef('public.native_first_party_league_schedule_review(uuid,text,timestamptz)'::regprocedure),chr(13),'');
  publish_sql text := pg_get_functiondef('public.native_first_party_league_matches(text,timestamptz)'::regprocedure);
  updates_sql text := pg_get_functiondef('private.native_league_match_updates()'::regprocedure);
  prior_status constant text := 'or previous.status not in (''confirmed'',''coordinator_set'')';
  prior_date constant text := 'or previous.scheduled_date + coalesce(previous.scheduled_time,time ''00:00'') <= clock_timestamp() at time zone zone';
  review_window constant text := $sql$f.status in ('confirmed','coordinator_set')
        and f.scheduled_date + coalesce(f.scheduled_time,time '00:00') > local_now$sql$;
  published_status constant text := 'f.status = ''coordinator_set''';
  notice_title constant text := 'case when o.rescheduled then ''League match rescheduled'' else ''League match scheduled'' end';
  notice_body constant text := $sql$f.participant_a_name || ' vs ' || f.participant_b_name || ' · ' || to_char(f.scheduled_date,'Dy, Mon FMDD')$sql$;
  review_details constant text := $sql$'aId',a.id,'bId',b.id,'version',f.updated_at$sql$;
  active_visibility constant text := 'and is_public and season_status';
  inbox_visibility constant text := 'and l.is_public and l.season_status';
  unchanged_guard constant text := 'if previous.scheduled_date = p_date';
  notice_recipient constant text := 'where recipient <> p_actor and not exists';
  access_guard constant text := 'id = p_actor and (role = ''admin'' or (';
  notice_end constant text := $sql$|| ') · ' || f.facility,$sql$;
begin
  if position(prior_status in save_sql)=0 or position(prior_date in save_sql)=0 or position(review_window in review_sql)=0
    or position(published_status in publish_sql)=0 or position(published_status in updates_sql)=0
    or position(notice_title in updates_sql)=0 or position(notice_body in updates_sql)=0 or position(notice_end in updates_sql)=0
    or position(review_details in review_sql)=0 or position(active_visibility in review_sql)=0
    or position(active_visibility in save_sql)=0 or position(inbox_visibility in updates_sql)=0
    or position(unchanged_guard in save_sql)=0 or position(notice_recipient in save_sql)=0 or position(access_guard in save_sql)=0 then
    raise exception 'Schedule Match source changed; check the postponement migration';
  end if;
  execute replace(publish_sql,published_status,'f.status in (''coordinator_set'',''postponed'')');
  review_sql := replace(review_sql,review_window,$sql$(f.status = 'postponed' or private.native_league_can_postpone(f)
        or (f.status in ('confirmed','coordinator_set') and f.scheduled_date + coalesce(f.scheduled_time,time '00:00') > local_now))$sql$);
  review_sql := replace(review_sql,review_details,$sql$'canPostpone',private.native_league_can_postpone(f),$sql$ || review_details);
  execute replace(review_sql,active_visibility,
    'and (is_public or private.native_testflight_score_league(tiq_leagues,p_actor)) and season_status');

  save_sql := replace(save_sql,prior_status,'or previous.status not in (''confirmed'',''coordinator_set'',''postponed'')');
  save_sql := replace(save_sql,prior_date,'or (previous.status <> ''postponed'' and ' || substr(prior_date,4) || ')');
  save_sql := replace(save_sql,unchanged_guard,
    'if previous.status <> ''postponed'' and previous.scheduled_date = p_date');
  save_sql := replace(save_sql,access_guard,
    'id = p_actor and (p_league = ''tiq-testflight-scores-'' || p_actor::text or role = ''admin'' or (');
  save_sql := replace(save_sql,active_visibility,
    'and (is_public or (p_match is not null and private.native_testflight_score_league(tiq_leagues,p_actor))) and season_status');
  save_sql := replace(save_sql,'or previous.status not in (''confirmed'',''coordinator_set'',''postponed'')',
    $sql$or previous.status not in ('confirmed','coordinator_set','postponed')
      or (previous.status = 'postponed' and not p_notify)
      or (not l.is_public and previous.status <> 'postponed'
        and not exists (select 1 from private.native_league_match_operations r where r.match_id=p_match and r.rescheduled))$sql$);
  save_sql := replace(save_sql,notice_recipient,
    'where (case when l.is_public then recipient <> p_actor else recipient = p_actor end) and not exists');
  execute save_sql;

  updates_sql := replace(updates_sql,published_status,'f.status in (''coordinator_set'',''postponed'')');
  updates_sql := replace(updates_sql,inbox_visibility,
    'and (l.is_public or private.native_testflight_score_league(l,n.recipient_profile_id)) and l.season_status');
  updates_sql := replace(updates_sql,notice_title,$sql$case when f.status = 'postponed' then 'League match postponed'
    when o.rescheduled then 'League match rescheduled' else 'League match scheduled' end$sql$);
  updates_sql := replace(updates_sql,notice_body,$sql$f.participant_a_name || ' vs ' || f.participant_b_name ||
    case when f.status = 'postponed' then ' · New date pending' else ' · ' || to_char(f.scheduled_date,'Dy, Mon FMDD')$sql$);
  execute replace(updates_sql,notice_end,$sql$|| ') · ' || f.facility end,$sql$);
end $patch$;

notify pgrst,'reload schema';
commit;
