begin;
set local lock_timeout='5s';

create table private.native_group_practices (
  id uuid primary key,
  room_id uuid not null references public.internal_conversations(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  court text not null check (length(btrim(court)) between 1 and 120 and court !~ '[[:cntrl:]]'),
  capacity integer not null check (capacity between 2 and 32),
  cancelled_at timestamptz,
  unique (id,room_id)
);
create index native_group_practices_current on private.native_group_practices(room_id,starts_at) where cancelled_at is null;
create index native_group_practices_creator on private.native_group_practices(created_by);

create table private.native_group_practice_rsvps (
  practice_id uuid not null,
  room_id uuid not null,
  player_id uuid not null,
  response text not null check (response in ('in','out')),
  answered_at timestamptz not null default clock_timestamp(),
  primary key (practice_id,player_id),
  foreign key (practice_id,room_id) references private.native_group_practices(id,room_id) on delete cascade,
  foreign key (room_id,player_id) references public.internal_conversation_participants(conversation_id,profile_id) on delete cascade
);
create index native_group_practice_rsvps_member on private.native_group_practice_rsvps(room_id,player_id);
alter table private.native_group_practices enable row level security;
alter table private.native_group_practice_rsvps enable row level security;
revoke all on private.native_group_practices,private.native_group_practice_rsvps from public,anon,authenticated,service_role;

-- A group removal frees a spot through the membership FK. Refresh the other
-- members' cards when the removed player held a spot in the upcoming practice.
create function private.signal_removed_group_practice_rsvp()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.response='in' and exists(select 1 from private.native_group_practices e
    where e.id=old.practice_id and e.cancelled_at is null and e.starts_at>now()) then
    insert into public.team_chat_signals as signal(conversation_id) values(old.room_id)
      on conflict(conversation_id) do update set revision=signal.revision+1,changed_at=clock_timestamp();
  end if;
  return old;
end;
$$;
revoke all on function private.signal_removed_group_practice_rsvp() from public,anon,authenticated,service_role;
create trigger group_practice_rsvp_removed after delete on private.native_group_practice_rsvps
  for each row execute function private.signal_removed_group_practice_rsvp();

create function public.native_player_chat_room_with_practice(p_owner uuid,p_room uuid,p_before_at timestamptz,p_before_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  snapshot jsonb := public.native_player_chats_read(p_owner,p_room,p_before_at,p_before_id);
  practice jsonb;
begin
  if snapshot->>'code'<>'ok' or snapshot#>>'{room,group}' is distinct from 'true' then return snapshot; end if;
  select jsonb_build_object(
    'id',event.id,'startsAt',event.starts_at,'court',event.court,'capacity',event.capacity,
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

create function public.native_group_practice_action(
  p_owner uuid,p_room uuid,p_id uuid,p_action text,p_starts_at timestamptz,p_court text,p_capacity integer,p_response text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  chat public.internal_conversations;
  event private.native_group_practices;
  existing_reply text;
begin
  if p_id is null or not private.native_player_chat_account(p_owner) then return jsonb_build_object('code','forbidden'); end if;
  -- Use the same room lock as player-chat membership changes. Only one player
  -- can take the last spot and removed players lose their sign-up atomically.
  select * into chat from public.internal_conversations where id=p_room for update;
  if not found or chat.related_entity_type<>'player_group' or not private.native_player_chat_visible(chat,p_owner) then
    return jsonb_build_object('code','forbidden');
  end if;
  if p_action in ('practice_create','practice_cancel') and chat.created_by_user_id is distinct from p_owner then
    return jsonb_build_object('code','forbidden');
  end if;
  select * into event from private.native_group_practices where id=p_id and room_id=p_room;
  if p_action='practice_create' then
    if event.id is not null then
      if event.starts_at=p_starts_at and event.court=p_court and event.capacity=p_capacity and event.cancelled_at is null then
        return jsonb_build_object('code','ok');
      end if;
      return jsonb_build_object('code','stale');
    end if;
    if p_starts_at is null or p_starts_at<=now() or p_starts_at>now()+interval '365 days' or
      p_court is null or length(btrim(p_court)) not between 1 and 120 or p_court ~ '[[:cntrl:]]' or
      p_capacity is null or p_capacity not between 2 and 32 then return jsonb_build_object('code','invalid'); end if;
    if exists(select 1 from private.native_group_practices e where e.room_id=p_room and e.cancelled_at is null and e.starts_at>now()) then
      return jsonb_build_object('code','stale');
    end if;
    insert into private.native_group_practices(id,room_id,created_by,starts_at,court,capacity)
      values(p_id,p_room,p_owner,p_starts_at,p_court,p_capacity) on conflict(id) do nothing;
    if not found then return jsonb_build_object('code','stale'); end if;
  elsif p_action='practice_cancel' then
    if event.cancelled_at is not null then return jsonb_build_object('code','ok'); end if;
    if event.id is null or event.starts_at<=now() then return jsonb_build_object('code','stale'); end if;
    update private.native_group_practices set cancelled_at=now() where id=event.id;
  elsif p_action='practice_reply' then
    if event.id is null or event.cancelled_at is not null or event.starts_at<=now() or
      not private.native_player_chat_account(event.created_by) then return jsonb_build_object('code','stale'); end if;
    if p_response is null or p_response not in ('in','out') then return jsonb_build_object('code','invalid'); end if;
    select response into existing_reply from private.native_group_practice_rsvps where practice_id=event.id and player_id=p_owner;
    if existing_reply=p_response then return jsonb_build_object('code','ok'); end if;
    if p_response='in' and (select count(*) from private.native_group_practice_rsvps r
      where r.practice_id=event.id and r.response='in' and private.native_player_chat_account(r.player_id))>=event.capacity then
      return jsonb_build_object('code','full');
    end if;
    insert into private.native_group_practice_rsvps(practice_id,room_id,player_id,response) values(event.id,p_room,p_owner,p_response)
      on conflict(practice_id,player_id) do update set response=excluded.response,answered_at=clock_timestamp();
  else
    return jsonb_build_object('code','invalid');
  end if;
  insert into public.team_chat_signals as signal(conversation_id) values(p_room)
    on conflict(conversation_id) do update set revision=signal.revision+1,changed_at=clock_timestamp();
  return jsonb_build_object('code','ok');
end;
$$;

revoke all on function public.native_player_chat_room_with_practice(uuid,uuid,timestamptz,uuid),
  public.native_group_practice_action(uuid,uuid,uuid,text,timestamptz,text,integer,text) from public,anon,authenticated;
grant execute on function public.native_player_chat_room_with_practice(uuid,uuid,timestamptz,uuid),
  public.native_group_practice_action(uuid,uuid,uuid,text,timestamptz,text,integer,text) to service_role;

notify pgrst,'reload schema';
commit;
