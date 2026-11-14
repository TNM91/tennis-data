begin;
set local lock_timeout = '5s';

create table private.native_chat_hits (
  id uuid primary key,
  room_id uuid not null references public.internal_conversations(id) on delete cascade,
  proposed_by uuid not null references public.profiles(id) on delete cascade,
  invited_player uuid not null references public.profiles(id) on delete cascade,
  club_id text not null check (club_id ~ '^[a-z][a-z0-9-]{0,79}$'),
  play_date date not null,
  play_time time not null,
  starts_at timestamptz not null,
  status text not null default 'proposed' check (status in ('proposed','accepted','declined','cancelled')),
  created_at timestamptz not null default clock_timestamp(),
  check (proposed_by <> invited_player)
);
create index native_chat_hits_room on private.native_chat_hits(room_id,created_at desc,id);
create index native_chat_hits_proposer on private.native_chat_hits(proposed_by,play_date) where status='accepted';
create index native_chat_hits_invitee on private.native_chat_hits(invited_player,play_date) where status='accepted';
alter table private.native_chat_hits enable row level security;
revoke all on private.native_chat_hits from public,anon,authenticated,service_role;

create table private.native_chat_hit_notices (
  notification_id uuid primary key references public.internal_notifications(id) on delete cascade,
  hit_id uuid not null references private.native_chat_hits(id) on delete cascade,
  status text not null
);
create index native_chat_hit_notices_hit on private.native_chat_hit_notices(hit_id);
alter table private.native_chat_hit_notices enable row level security;
revoke all on private.native_chat_hit_notices from public,anon,authenticated,service_role;

create function private.chat_hit_json(hit private.native_chat_hits) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('id',hit.id,'room',hit.room_id,'proposedBy',hit.proposed_by,
    'clubId',hit.club_id,'date',hit.play_date,'time',to_char(hit.play_time,'HH24:MI'),
    'startsAt',hit.starts_at,'status',hit.status);
$$;

create function private.can_read_native_chat_hit(hit private.native_chat_hits, p_owner uuid) returns boolean
language sql stable set search_path='' as $$
  select p_owner in (hit.proposed_by,hit.invited_player) and exists (
    select 1 from public.internal_conversations c
    where c.id=hit.room_id and c.related_entity_type='player_chat' and c.status='open'
      and private.native_player_chat_account(hit.proposed_by)
      and private.native_player_chat_account(hit.invited_player)
      and private.native_player_chat_unblocked(hit.proposed_by,hit.invited_player)
      and exists(select 1 from public.internal_conversation_participants p where p.conversation_id=c.id and p.profile_id=hit.proposed_by)
      and exists(select 1 from public.internal_conversation_participants p where p.conversation_id=c.id and p.profile_id=hit.invited_player)
  );
$$;

create function public.native_chat_hit_for_room(p_owner uuid,p_room uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select private.chat_hit_json(hit)
  from private.native_chat_hits hit
  where hit.room_id=p_room and hit.starts_at>now() and private.can_read_native_chat_hit(hit,p_owner)
  order by (hit.status in ('proposed','accepted')) desc,hit.created_at desc,hit.id
  limit 1;
$$;

create function public.native_chat_hits_for_calendar(p_owner uuid,p_from date,p_to date) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(visible.hit order by visible.play_date,visible.play_time,visible.id),'[]'::jsonb)
  from (
    select hit.id,hit.play_date,hit.play_time,private.chat_hit_json(hit) || jsonb_build_object(
      'partner',private.native_player_chat_name(case when hit.proposed_by=p_owner then hit.invited_player else hit.proposed_by end)
    ) as hit
    from private.native_chat_hits hit
    where hit.status='accepted' and p_to-p_from between 0 and 61 and hit.play_date between p_from and p_to
      and (hit.proposed_by=p_owner or hit.invited_player=p_owner)
      and private.can_read_native_chat_hit(hit,p_owner)
    order by hit.play_date,hit.play_time,hit.id limit 100
  ) visible;
$$;

create function public.native_write_chat_hit(
  p_owner uuid,p_room uuid,p_hit uuid,p_action text,p_club text,p_date date,p_time time,p_starts timestamptz,p_response text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  chat public.internal_conversations;
  hit private.native_chat_hits;
  other_player uuid;
  other_members uuid[];
  next_status text;
  notice_id uuid;
  wall_time timestamp;
begin
  -- Serialize with chat membership and block changes.
  select * into chat from public.internal_conversations where id=p_room for update;
  if not found or chat.related_entity_type<>'player_chat' or not private.native_player_chat_account(p_owner)
      or not private.native_player_chat_visible(chat,p_owner) then return jsonb_build_object('code','forbidden'); end if;
  select array(select p.profile_id from public.internal_conversation_participants p
    where p.conversation_id=p_room and p.profile_id<>p_owner limit 2) into other_members;
  if cardinality(other_members)<>1 then return jsonb_build_object('code','forbidden'); end if;
  other_player := other_members[1];
  if p_hit is null then return jsonb_build_object('code','invalid'); end if;
  select * into hit from private.native_chat_hits where id=p_hit and room_id=p_room;

  if p_action='hit_propose' then
    if p_club is null or p_club !~ '^[a-z][a-z0-9-]{0,79}$' or p_date is null or p_time is null or p_starts is null
        or extract(second from p_time) <> 0 then return jsonb_build_object('code','invalid'); end if;
    wall_time := p_starts at time zone 'America/Chicago';
    if wall_time::date<>p_date or wall_time::time<>p_time then return jsonb_build_object('code','invalid'); end if;
    if hit.id is not null then
      if hit.proposed_by=p_owner and hit.invited_player=other_player and
        (hit.club_id,hit.play_date,hit.play_time,hit.starts_at)=(p_club,p_date,p_time,p_starts)
        then return jsonb_build_object('code','ok'); end if;
      return jsonb_build_object('code','hit_stale');
    end if;
    if p_starts<=now() or p_starts>now()+interval '365 days' then return jsonb_build_object('code','invalid'); end if;
    if exists(select 1 from private.native_chat_hits where room_id=p_room and starts_at>now() and status in ('proposed','accepted'))
      then return jsonb_build_object('code','hit_stale'); end if;
    insert into private.native_chat_hits(id,room_id,proposed_by,invited_player,club_id,play_date,play_time,starts_at)
      values(p_hit,p_room,p_owner,other_player,p_club,p_date,p_time,p_starts)
      on conflict (id) do nothing returning * into hit;
    if not found then return jsonb_build_object('code','hit_stale'); end if;
    next_status := hit.status;
  else
    if hit.id is null or not private.can_read_native_chat_hit(hit,p_owner) then return jsonb_build_object('code','hit_stale'); end if;
    if p_action='hit_reply' and p_response in ('accepted','declined') then
      if p_owner<>hit.invited_player then return jsonb_build_object('code','forbidden'); end if;
      next_status := p_response;
      if hit.status<>next_status and hit.status<>'proposed' then return jsonb_build_object('code','hit_stale'); end if;
    elsif p_action='hit_cancel' then
      next_status := 'cancelled';
      if hit.status='proposed' and p_owner<>hit.proposed_by then return jsonb_build_object('code','forbidden'); end if;
      if hit.status='declined' then return jsonb_build_object('code','hit_stale'); end if;
    else return jsonb_build_object('code','invalid');
    end if;
    if hit.status=next_status then return jsonb_build_object('code','ok'); end if;
    if hit.starts_at<=now() then return jsonb_build_object('code','hit_stale'); end if;
    update private.native_chat_hits set status=next_status where id=hit.id;
  end if;

  if exists(select 1 from public.internal_conversation_participants p
      left join public.internal_notification_preferences prefs on prefs.profile_id=p.profile_id
      where p.conversation_id=p_room and p.profile_id=other_player and not p.muted and coalesce(prefs.schedule_alerts_enabled,true)) then
    insert into public.internal_notifications(recipient_profile_id,actor_user_id,notification_type,title,body,href,conversation_id)
      values(other_player,p_owner,'schedule',
        case next_status when 'proposed' then 'New hitting plan' when 'accepted' then 'Hitting plan accepted'
          when 'declined' then 'Hitting plan declined' else 'Hitting plan cancelled' end,
        'Open your chat to see the plan.', '/chats?room='||p_room,p_room)
      returning id into notice_id;
    insert into private.native_chat_hit_notices values(notice_id,p_hit,next_status);
  end if;
  insert into public.team_chat_signals as signal(conversation_id) values(p_room)
    on conflict(conversation_id) do update set revision=signal.revision+1,changed_at=clock_timestamp();
  return jsonb_build_object('code','ok');
end;
$$;

create function private.native_chat_hit_updates()
returns table(id uuid,recipient_profile_id uuid,notification_type text,title text,body text,href text,
  conversation_id uuid,schedule_event_id uuid,read_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select n.id,n.recipient_profile_id,'schedule',n.title,n.body,n.href,n.conversation_id,null::uuid,n.read_at,n.created_at
  from public.internal_notifications n
  join private.native_chat_hit_notices notice on notice.notification_id=n.id
  join private.native_chat_hits hit on hit.id=notice.hit_id and hit.room_id=n.conversation_id and hit.status=notice.status
  where n.recipient_profile_id=(select auth.uid()) and hit.starts_at>now()
    and private.can_read_native_chat_hit(hit,n.recipient_profile_id);
$$;

revoke all on function private.chat_hit_json(private.native_chat_hits),
  private.can_read_native_chat_hit(private.native_chat_hits,uuid),private.native_chat_hit_updates()
  from public,anon,authenticated,service_role;
grant execute on function private.native_chat_hit_updates() to authenticated;
revoke all on function public.native_chat_hit_for_room(uuid,uuid),
  public.native_chat_hits_for_calendar(uuid,date,date),
  public.native_write_chat_hit(uuid,uuid,uuid,text,text,date,time,timestamptz,text) from public,anon,authenticated,service_role;
grant execute on function public.native_chat_hit_for_room(uuid,uuid),
  public.native_chat_hits_for_calendar(uuid,date,date),
  public.native_write_chat_hit(uuid,uuid,uuid,text,text,date,time,timestamptz,text) to service_role;

do $$
declare definition text := rtrim(pg_get_viewdef('public.native_first_party_updates'::regclass), ';' || chr(10) || ' ');
begin
  execute 'create or replace view public.native_first_party_updates with (security_invoker=true) as '
    || definition || ' union all select * from private.native_chat_hit_updates()';
end;
$$;

notify pgrst,'reload schema';
commit;
