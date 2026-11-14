begin;
set local lock_timeout='5s';

alter table private.native_group_practices
  add column revision uuid not null default gen_random_uuid(),
  add column last_edit_request uuid;
create table private.native_group_practice_change_notices (
  notification_id uuid primary key references public.internal_notifications(id) on delete cascade,
  practice_id uuid not null references private.native_group_practices(id) on delete cascade
);
create index native_group_practice_change_notice_event on private.native_group_practice_change_notices(practice_id);
alter table private.native_group_practice_change_notices enable row level security;
revoke all on private.native_group_practice_change_notices from public,anon,authenticated,service_role;

create or replace function public.native_player_chat_room_with_practice(p_owner uuid,p_room uuid,p_before_at timestamptz,p_before_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  snapshot jsonb := public.native_player_chats_read(p_owner,p_room,p_before_at,p_before_id);
  practice jsonb;
begin
  if snapshot->>'code'<>'ok' or snapshot#>>'{room,group}' is distinct from 'true' then return snapshot; end if;
  select jsonb_build_object(
    'id',event.id,'revision',event.revision,'startsAt',event.starts_at,'court',event.court,'capacity',event.capacity,
    'mine',max(r.response) filter (where r.player_id=p_owner),
    'inCount',count(*) filter (where r.response='in'),
    'players',coalesce(jsonb_agg(jsonb_build_object('id',r.player_id,'name',private.native_player_chat_name(r.player_id))
      order by r.answered_at,r.player_id) filter (where r.response='in' and private.native_player_chat_unblocked(p_owner,r.player_id)),
      '[]'::jsonb)
  ) into practice
  from private.native_group_practices event
  left join private.native_group_practice_rsvps r on r.practice_id=event.id and private.native_player_chat_account(r.player_id)
  where event.room_id=p_room and event.cancelled_at is null and event.starts_at>now()
    and private.native_player_chat_account(event.created_by)
  group by event.id order by event.starts_at limit 1;
  return jsonb_set(snapshot,'{room,practice}',coalesce(practice,'null'::jsonb));
end;
$$;

create function public.native_edit_group_practice(
  p_owner uuid,p_room uuid,p_id uuid,p_revision uuid,p_request uuid,p_starts_at timestamptz,p_court text,p_capacity integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  chat public.internal_conversations;
  event private.native_group_practices;
  schedule_changed boolean;
  headcount integer;
begin
  if not private.native_player_chat_account(p_owner) then return jsonb_build_object('code','forbidden'); end if;
  select * into chat from public.internal_conversations where id=p_room for update;
  if not found or chat.related_entity_type<>'player_group' or chat.created_by_user_id is distinct from p_owner
    or not private.native_player_chat_visible(chat,p_owner) then return jsonb_build_object('code','forbidden'); end if;
  if p_request is null or p_revision is null or p_request=p_revision or p_starts_at is null or p_capacity is null
    or p_capacity not between 2 and 32 or p_court is null or length(btrim(p_court)) not between 1 and 120
    or p_court ~ '[[:cntrl:]]' then return jsonb_build_object('code','invalid'); end if;
  select * into event from private.native_group_practices where id=p_id and room_id=p_room and created_by=p_owner;
  if not found or event.cancelled_at is not null then return jsonb_build_object('code','stale'); end if;
  if event.last_edit_request=p_request then
    if (event.starts_at,event.court,event.capacity)=(p_starts_at,p_court,p_capacity) then
      return jsonb_build_object('code','ok');
    end if;
    return jsonb_build_object('code','stale');
  end if;
  if event.revision<>p_revision or event.starts_at<=now() then return jsonb_build_object('code','stale'); end if;
  if p_starts_at<=now() or p_starts_at>now()+interval '365 days' then return jsonb_build_object('code','invalid'); end if;
  select count(*) into headcount from private.native_group_practice_rsvps r
    where r.practice_id=event.id and r.response='in' and private.native_player_chat_account(r.player_id);
  if p_capacity<headcount then return jsonb_build_object('code','capacity'); end if;
  schedule_changed := (event.starts_at,event.court) is distinct from (p_starts_at,p_court);
  if not schedule_changed and event.capacity=p_capacity then return jsonb_build_object('code','ok'); end if;

  update private.native_group_practices
    set starts_at=p_starts_at,court=p_court,capacity=p_capacity,revision=gen_random_uuid(),last_edit_request=p_request
    where id=event.id;
  if schedule_changed then
    -- One unread notice is enough. It always opens the current practice.
    with notices as (
      insert into public.internal_notifications(recipient_profile_id,actor_user_id,notification_type,title,body,href,conversation_id)
      select member.profile_id,p_owner,'schedule','Group practice changed','Open the group for the latest time and court.',
        '/chats?room='||chat.id,chat.id
      from private.native_group_practice_rsvps r
      join public.internal_conversation_participants member on member.conversation_id=r.room_id and member.profile_id=r.player_id
      left join public.internal_notification_preferences prefs on prefs.profile_id=member.profile_id
      where r.practice_id=event.id and r.response='in' and r.player_id<>p_owner and not member.muted
        and coalesce(prefs.schedule_alerts_enabled,true)
        and private.native_player_chat_account(r.player_id) and private.native_player_chat_unblocked(r.player_id,p_owner)
        and not exists (select 1 from private.native_group_practice_change_notices n join public.internal_notifications prior
          on prior.id=n.notification_id where n.practice_id=event.id
          and prior.recipient_profile_id=member.profile_id and prior.read_at is null)
      returning id
    )
    insert into private.native_group_practice_change_notices(notification_id,practice_id)
      select id,event.id from notices;
  end if;
  insert into public.team_chat_signals as signal(conversation_id) values(p_room)
    on conflict(conversation_id) do update set revision=signal.revision+1,changed_at=clock_timestamp();
  return jsonb_build_object('code','ok');
end;
$$;
revoke all on function public.native_edit_group_practice(uuid,uuid,uuid,uuid,uuid,timestamptz,text,integer) from public,anon,authenticated;
grant execute on function public.native_edit_group_practice(uuid,uuid,uuid,uuid,uuid,timestamptz,text,integer) to service_role;

create function private.native_group_practice_updates()
returns table(id uuid,recipient_profile_id uuid,notification_type text,title text,body text,href text,
  conversation_id uuid,schedule_event_id uuid,read_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select n.id,n.recipient_profile_id,'schedule','Group practice changed',chat.subject,
    '/chats?room='||chat.id,chat.id,null::uuid,n.read_at,n.created_at
  from public.internal_notifications n
  join private.native_group_practice_change_notices notice on notice.notification_id=n.id
  join private.native_group_practices event on event.id=notice.practice_id
  join public.internal_conversations chat on chat.id=event.room_id and chat.id=n.conversation_id
  where n.recipient_profile_id=(select auth.uid()) and event.cancelled_at is null and event.starts_at>now()
    and n.actor_user_id=event.created_by and private.native_player_chat_account(event.created_by)
    and private.native_player_chat_account(n.recipient_profile_id)
    and private.native_player_chat_visible(chat,n.recipient_profile_id)
    and private.native_player_chat_unblocked(n.recipient_profile_id,event.created_by);
$$;
revoke all on function private.native_group_practice_updates() from public,anon,authenticated;
grant execute on function private.native_group_practice_updates() to authenticated;
do $$
declare definition text := rtrim(pg_get_viewdef('public.native_first_party_updates'::regclass), ';' || chr(10) || ' ');
begin
  execute 'create or replace view public.native_first_party_updates with (security_invoker=true) as '
    || definition || ' union all select * from private.native_group_practice_updates()';
end;
$$;

notify pgrst,'reload schema';
commit;
