begin;
set local lock_timeout = '5s';

create table private.native_league_scorecards (
  match_id uuid primary key references public.tiq_league_schedule_items(id) on delete cascade,
  fixture_digest text not null,
  revision uuid not null unique,
  request_digest text not null,
  submitted_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  state text not null check (state in ('pending','changes_requested','approved')),
  lines jsonb not null,
  note text not null default '',
  room_a uuid,
  room_b uuid,
  official_id uuid references public.tiq_team_league_match_events(id) on delete set null,
  result_digest text,
  updated_at timestamptz not null default now()
);
alter table private.native_league_scorecards enable row level security;
revoke all on private.native_league_scorecards from public, anon, authenticated, service_role;
create index native_league_scorecards_pending on private.native_league_scorecards(updated_at) where state = 'pending';

create table private.native_league_score_notices (
  notification_id uuid primary key references public.internal_notifications(id) on delete cascade,
  match_id uuid not null references private.native_league_scorecards(match_id) on delete cascade,
  revision uuid not null
);
alter table private.native_league_score_notices enable row level security;
revoke all on private.native_league_score_notices from public, anon, authenticated, service_role;

create function private.native_league_score_captain(
  p_owner uuid, l public.tiq_leagues, f public.tiq_league_schedule_items, p_room_a uuid, p_room_b uuid
) returns boolean language sql stable set search_path = '' as $$
  with sides as (
    select * from (values (f.participant_a_name, f.participant_a_id, p_room_a),
                          (f.participant_b_name, f.participant_b_id, p_room_b)) v(team_name, entry_id, room_id)
  )
  select count(*) = 1 from sides s where exists (
    -- Use the same approved-entry fallback as Schedule Match when no captain is linked.
    select 1 from private.native_league_schedule_roster(l.id, 'team') r
    join private.native_league_schedule_recipients(l.id, 'team', array[r.id]) target on target.entry_id = r.id
    where r.id::text = s.entry_id and r.name = s.team_name and target.recipient = p_owner
  ) or exists (
    select 1 from public.team_profile_links link
    where link.profile_user_id = p_owner and link.team_name = s.team_name
      and link.league_name = l.league_name and link.flight = l.flight and link.status = 'accepted'
      and link.archived_at is null and link.team_roles && array['captain','co_captain']
      and (
        (link.source_type = 'tiq_entry' and exists (
          select 1 from private.native_league_schedule_roster(l.id, 'team') r
          where r.id = link.source_record_id and r.name = s.team_name
            and (nullif(s.entry_id,'') is null or s.entry_id = r.id::text)
        ))
        or (link.source_type in ('tiq_entry','manual_invite') and exists (
          select 1 from public.internal_conversations room
          join public.internal_conversation_participants member on member.conversation_id = room.id
          where room.id = s.room_id and room.status = 'open' and room.related_entity_type = 'team_room'
            and member.profile_id = p_owner and not exists (select 1 from public.team_room_member_removals gone
              where gone.conversation_id = room.id and gone.profile_id = p_owner)
        ))
      )
  )
  and not exists (select 1 from public.account_deletion_requests d where d.account_id = p_owner and d.status <> 'completed');
$$;
revoke all on function private.native_league_score_captain(uuid,public.tiq_leagues,public.tiq_league_schedule_items,uuid,uuid) from public, anon, authenticated;

create function private.native_league_score_card(c private.native_league_scorecards)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('revision',c.revision,'state',c.state,'lines',c.lines,'note',c.note);
$$;
revoke all on function private.native_league_score_card(private.native_league_scorecards) from public, anon, authenticated;

create function private.native_league_score_fixture(f public.tiq_league_schedule_items)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id',f.id,'a',btrim(f.participant_a_name),'b',btrim(f.participant_b_name),
    'date',f.scheduled_date,'time',coalesce(to_char(f.scheduled_time,'HH24:MI'),''));
$$;
revoke all on function private.native_league_score_fixture(public.tiq_league_schedule_items) from public, anon, authenticated;

create function private.native_league_score_result(e public.tiq_team_league_match_events)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id',e.id,'date',e.match_date,'a',btrim(e.team_a_name),'b',btrim(e.team_b_name),
    'winner',coalesce(btrim(e.winner_team_name),''),'score','',
    'courts',coalesce((select jsonb_agg(jsonb_build_object(
      'label','Line ' || n.line_number || ' · ' || case when n.match_type = 'singles' then 'Singles' else 'Doubles' end,
      'a',concat_ws(' & ',nullif(btrim(n.side_a_player_1_name),''),nullif(btrim(n.side_a_player_2_name),'')),
      'b',concat_ws(' & ',nullif(btrim(n.side_b_player_1_name),''),nullif(btrim(n.side_b_player_2_name),'')),
      'winner',case when n.winner_side is null then '' else 'Side ' || n.winner_side end,'score',btrim(n.score)
    ) order by n.line_number) from public.tiq_team_league_match_lines n where n.event_id = e.id),'[]'::jsonb));
$$;
revoke all on function private.native_league_score_result(public.tiq_team_league_match_events) from public, anon, authenticated;

create function public.native_league_approved_results(p_league text, p_version timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(projected.result order by e.match_date desc,e.id),'[]'::jsonb)
  from public.tiq_leagues l join public.tiq_team_league_match_events e on e.league_id = l.id
  join private.native_league_scorecards c on c.official_id = e.id and c.match_id = e.schedule_item_id
  join public.tiq_league_schedule_items f on f.id = c.match_id and f.league_id = l.id
  cross join lateral (select private.native_league_score_result(e) as result) projected
  where l.id = p_league and l.updated_at = p_version and l.is_public and l.league_format = 'team'
    and c.state = 'approved' and c.fixture_digest = private.native_league_fixture_digest(f)
    and c.result_digest = encode(sha256(convert_to(projected.result::text,'UTF8')),'hex');
$$;
revoke all on function public.native_league_approved_results(text,timestamptz) from public, anon, authenticated;
grant execute on function public.native_league_approved_results(text,timestamptz) to service_role;

create function public.native_league_score_review(
  p_actor uuid, p_league text, p_version timestamptz, p_match uuid, p_captain_access boolean, p_room_a uuid, p_room_b uuid
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  l public.tiq_leagues; f public.tiq_league_schedule_items; c private.native_league_scorecards;
  coordinator boolean; captain boolean;
begin
  select * into l from public.tiq_leagues where id = p_league and updated_at = p_version and is_public
    and league_format = 'team' and season_status = 'active';
  if not found then return null; end if;
  coordinator := l.created_by_user_id = p_actor and exists (select 1 from public.profiles p
    where p.id = p_actor and (p.role = 'admin' or ((p.tiq_team_league_entry_enabled or p.tiq_individual_league_creator_enabled)
      and (p.league_access_expires_at is null or p.league_access_expires_at > now()))))
    and not exists (select 1 from public.account_deletion_requests d where d.account_id = p_actor and d.status <> 'completed');
  if p_match is null then
    if coordinator is not true then return null; end if;
    return jsonb_build_object('matches', coalesce((select jsonb_agg(queued.match order by queued.submitted_at) from (
      select private.native_league_score_fixture(f0) as match, c0.updated_at as submitted_at
      from private.native_league_scorecards c0 join public.tiq_league_schedule_items f0 on f0.id = c0.match_id
      where f0.league_id = p_league and f0.status in ('confirmed','coordinator_set','completed') and c0.state = 'pending'
        and c0.fixture_digest = private.native_league_fixture_digest(f0)
        and not exists (select 1 from public.tiq_team_league_match_events e where e.schedule_item_id = f0.id)
      order by c0.updated_at, f0.id limit 100
    ) queued),'[]'::jsonb));
  end if;

  select * into f from public.tiq_league_schedule_items where id = p_match and league_id = p_league
    and league_format = 'team' and status in ('confirmed','coordinator_set','completed');
  if not found then return null; end if;
  captain := p_captain_access and private.native_league_score_captain(p_actor,l,f,p_room_a,p_room_b);
  if coordinator is not true and captain is not true then return null; end if;
  select * into c from private.native_league_scorecards where match_id = f.id and fixture_digest = private.native_league_fixture_digest(f);
  return jsonb_build_object('match',private.native_league_score_fixture(f),'fixtureVersion',f.updated_at,
    'card',case when c.match_id is null then null else private.native_league_score_card(c) end,
    'canReview',coalesce(coordinator,false),
    'canSubmit',coalesce(captain,false) and c.state is distinct from 'approved'
      and (f.scheduled_date + coalesce(f.scheduled_time,time '00:00')) <= now() at time zone coalesce(nullif(l.schedule_time_zone,''),'America/Chicago')
      and not exists (select 1 from public.tiq_team_league_match_events e where e.schedule_item_id = f.id));
end;
$$;
revoke all on function public.native_league_score_review(uuid,text,timestamptz,uuid,boolean,uuid,uuid) from public, anon, authenticated;
grant execute on function public.native_league_score_review(uuid,text,timestamptz,uuid,boolean,uuid,uuid) to service_role;

create function public.native_league_save_score(
  p_actor uuid, p_league text, p_version timestamptz, p_match uuid, p_fixture_version timestamptz,
  p_revision uuid, p_request uuid, p_action text, p_lines jsonb, p_note text, p_captain_access boolean,
  p_room_a uuid, p_room_b uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l public.tiq_leagues; f public.tiq_league_schedule_items; c private.native_league_scorecards;
  e public.tiq_team_league_match_events; context jsonb; change_digest text; locked_fixture_digest text;
  a_wins int; b_wins int; winner text; event_id uuid; notice_id uuid; recipient uuid;
begin
  if p_action is null or p_action not in ('submit','return','approve') or p_request is null or p_note is null
    or length(p_note) > 500 or (p_action = 'return') <> (length(btrim(p_note)) > 0)
    or jsonb_typeof(p_lines) is distinct from 'array'
  then return jsonb_build_object('code','invalid'); end if;
  select * into l from public.tiq_leagues where id = p_league and updated_at = p_version and is_public
    and league_format = 'team' and season_status = 'active' for update;
  if not found then return jsonb_build_object('code','stale'); end if;
  select * into f from public.tiq_league_schedule_items where id = p_match and league_id = p_league
    and updated_at = p_fixture_version and league_format = 'team' and status in ('confirmed','coordinator_set','completed') for update;
  if not found then return jsonb_build_object('code','stale'); end if;
  locked_fixture_digest := private.native_league_fixture_digest(f);
  context := public.native_league_score_review(p_actor,p_league,p_version,p_match,p_captain_access,p_room_a,p_room_b);
  if context is null or (p_action <> 'submit' and not (context->>'canReview')::boolean)
    or (p_action = 'submit' and (p_captain_access is not true or not private.native_league_score_captain(p_actor,l,f,p_room_a,p_room_b)))
  then return jsonb_build_object('code','forbidden'); end if;

  change_digest := encode(sha256(convert_to(jsonb_build_array(p_actor,p_action,p_revision,
    case when p_action = 'submit' then p_lines else '[]'::jsonb end,p_note)::text,'UTF8')),'hex');
  select * into c from private.native_league_scorecards where match_id = p_match;
  if c.revision = p_request then
    if c.fixture_digest = locked_fixture_digest and c.updated_by = p_actor and c.request_digest = change_digest
    then return jsonb_build_object('code','saved','card',private.native_league_score_card(c)); end if;
    return jsonb_build_object('code','stale');
  end if;
  if exists (select 1 from public.tiq_team_league_match_events result where result.schedule_item_id = p_match)
  then return jsonb_build_object('code','official'); end if;
  if (case when c.fixture_digest = locked_fixture_digest then c.revision end) is distinct from p_revision
  then return jsonb_build_object('code','stale'); end if;

  if p_action = 'submit' then
    if not (context->>'canSubmit')::boolean then return jsonb_build_object('code','early'); end if;
    if c.fixture_digest = locked_fixture_digest and c.state <> 'changes_requested'
    then return jsonb_build_object('code','pending'); end if;
    if jsonb_array_length(p_lines) not between 1 and 30 or exists (
      select 1 from jsonb_array_elements(p_lines) line
      where coalesce(line->>'format','') not in ('singles','doubles') or coalesce(line->>'winner','') not in ('A','B')
        or length(coalesce(line->>'score','')) not between 1 and 64 or line->>'score' ~ '[[:cntrl:]]'
    ) then return jsonb_build_object('code','invalid'); end if;
    insert into private.native_league_scorecards (match_id,fixture_digest,revision,request_digest,submitted_by,updated_by,state,lines,room_a,room_b)
    values (p_match,locked_fixture_digest,p_request,change_digest,p_actor,p_actor,'pending',p_lines,p_room_a,p_room_b)
    on conflict (match_id) do update set fixture_digest=excluded.fixture_digest,revision=excluded.revision,
      request_digest=excluded.request_digest,submitted_by=excluded.submitted_by,updated_by=excluded.updated_by,
      reviewed_by=null,state='pending',lines=excluded.lines,note='',room_a=excluded.room_a,room_b=excluded.room_b,
      official_id=null,result_digest=null,updated_at=clock_timestamp()
    returning * into c;
  else
    if c.revision is null or c.fixture_digest <> locked_fixture_digest or c.state <> 'pending'
    then return jsonb_build_object('code','stale'); end if;
    if p_action = 'approve' then
      if p_lines <> c.lines then return jsonb_build_object('code','stale'); end if;
      if (select count(*) from public.tiq_team_league_match_events result where result.league_id = p_league) >= l.max_match_events
      then return jsonb_build_object('code','capacity'); end if;
      select count(*) filter (where line->>'winner' = 'A'), count(*) filter (where line->>'winner' = 'B')
        into a_wins,b_wins from jsonb_array_elements(c.lines) line;
      winner := case when a_wins>b_wins then f.participant_a_name when b_wins>a_wins then f.participant_b_name end;
      insert into public.tiq_team_league_match_events (league_id,schedule_item_id,team_a_name,team_a_id,team_b_name,team_b_id,
        match_date,facility,winner_team_name,winner_team_id,created_by_user_id,updated_by_user_id)
      values (p_league,p_match,f.participant_a_name,f.participant_a_id,f.participant_b_name,f.participant_b_id,
        f.scheduled_date,f.facility,winner,case when a_wins>b_wins then f.participant_a_id when b_wins>a_wins then f.participant_b_id end,p_actor,p_actor)
      on conflict (schedule_item_id) where schedule_item_id is not null do nothing returning * into e;
      if not found then return jsonb_build_object('code','official'); end if;
      insert into public.tiq_team_league_match_lines(event_id,line_number,match_type,winner_side,score,created_by_user_id,updated_by_user_id)
      select e.id, n::int, line->>'format', line->>'winner', line->>'score', p_actor,p_actor
      from jsonb_array_elements(c.lines) with ordinality ordered(line,n);
      event_id := e.id;
    end if;
    update private.native_league_scorecards set revision=p_request,request_digest=change_digest,
      state=case when p_action='approve' then 'approved' else 'changes_requested' end,
      note=p_note,reviewed_by=p_actor,updated_by=p_actor,official_id=event_id,
      result_digest=case when event_id is not null then encode(sha256(convert_to(private.native_league_score_result(e)::text,'UTF8')),'hex') end,
      updated_at=clock_timestamp()
      where match_id=p_match returning * into c;
  end if;
  recipient := case when p_action = 'submit' then l.created_by_user_id else c.submitted_by end;
  if recipient is not null and recipient <> p_actor and exists (select 1 from public.profiles p where p.id = recipient)
    and not exists (select 1 from public.account_deletion_requests d where d.account_id = recipient and d.status <> 'completed')
    and not exists (select 1 from public.team_chat_blocks b where (b.owner_user_id=recipient and b.blocked_user_id=p_actor)
      or (b.owner_user_id=p_actor and b.blocked_user_id=recipient))
  then
    insert into public.internal_notifications(recipient_profile_id,actor_user_id,notification_type,title,body,href)
    values (recipient,p_actor,'system',case p_action when 'submit' then 'League score ready for review'
      when 'return' then 'League score needs corrections' else 'League score approved' end,
      f.participant_a_name || ' vs ' || f.participant_b_name,
      '/explore/leagues/tiq/' || p_league || '?scoreMatch=' || p_match || '#league-scores')
    returning id into notice_id;
    insert into private.native_league_score_notices values(notice_id,p_match,c.revision);
  end if;
  return jsonb_build_object('code','saved','card',private.native_league_score_card(c));
end;
$$;
revoke all on function public.native_league_save_score(uuid,text,timestamptz,uuid,timestamptz,uuid,uuid,text,jsonb,text,boolean,uuid,uuid) from public, anon, authenticated;
grant execute on function public.native_league_save_score(uuid,text,timestamptz,uuid,timestamptz,uuid,uuid,text,jsonb,text,boolean,uuid,uuid) to service_role;

create function private.native_league_score_updates()
returns table (id uuid, recipient_profile_id uuid, notification_type text, title text, body text,
  href text, conversation_id uuid, schedule_event_id uuid, read_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id,n.recipient_profile_id,'system',
    case c.state when 'pending' then 'League score ready for review'
      when 'changes_requested' then 'League score needs corrections' else 'League score approved' end,
    f.participant_a_name || ' vs ' || f.participant_b_name,
    '/explore/leagues/tiq/' || l.id || '?scoreMatch=' || f.id || '#league-scores',null::uuid,null::uuid,n.read_at,n.created_at
  from public.internal_notifications n
  join private.native_league_score_notices notice on notice.notification_id = n.id
  join private.native_league_scorecards c on c.match_id = notice.match_id and c.revision = notice.revision
  join public.tiq_league_schedule_items f on f.id = c.match_id
  join public.tiq_leagues l on l.id = f.league_id and l.is_public and l.season_status = 'active'
  where n.recipient_profile_id = (select auth.uid()) and n.actor_user_id = c.updated_by and n.notification_type='system'
    and c.fixture_digest = private.native_league_fixture_digest(f)
    and not exists (select 1 from public.account_deletion_requests d where d.account_id = n.recipient_profile_id and d.status <> 'completed')
    and not exists (select 1 from public.team_chat_blocks b where (b.owner_user_id=n.recipient_profile_id and b.blocked_user_id=n.actor_user_id)
      or (b.owner_user_id=n.actor_user_id and b.blocked_user_id=n.recipient_profile_id))
    and ((c.state = 'pending' and n.recipient_profile_id = l.created_by_user_id)
      or (c.state <> 'pending' and n.actor_user_id = l.created_by_user_id and n.recipient_profile_id = c.submitted_by
        and private.native_league_score_captain(n.recipient_profile_id,l,f,c.room_a,c.room_b)));
$$;
revoke all on function private.native_league_score_updates() from public, anon, authenticated;
grant execute on function private.native_league_score_updates() to authenticated;

do $$
declare definition text := rtrim(pg_get_viewdef('public.native_first_party_updates'::regclass), ';' || chr(10) || ' ');
begin
  execute 'create or replace view public.native_first_party_updates with (security_invoker=true) as '
    || definition || ' union all select * from private.native_league_score_updates()';
end;
$$;

notify pgrst, 'reload schema';
commit;
