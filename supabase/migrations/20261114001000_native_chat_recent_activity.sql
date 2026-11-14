begin;
set local lock_timeout = '5s';

-- Expose the visible message timestamp from the existing player inbox read.
create or replace function public.native_player_chats_read(p_owner uuid,p_room uuid,p_before_at timestamptz,p_before_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  c public.internal_conversations;
  messages jsonb;
  more boolean;
begin
  if p_room is null and not private.native_player_chat_account(p_owner) then
    if exists(select 1 from auth.users u where u.id=p_owner and u.email_confirmed_at is not null and nullif(u.email,'') is not null)
      and not exists(select 1 from public.account_deletion_requests d where d.account_id=p_owner and d.status<>'completed')
    then return jsonb_build_object('code','ok','contacts','[]'::jsonb,'rooms','[]'::jsonb); end if;
  end if;
  if not private.native_player_chat_account(p_owner) then return jsonb_build_object('code','forbidden'); end if;
  if p_room is null then
    return jsonb_build_object('code','ok','contacts',coalesce((
      select jsonb_agg(jsonb_build_object('id',p.player_id,'name',p.name) order by p.name,p.player_id)
      from (select x.player_id,private.native_player_chat_name(x.player_id) as name from private.native_player_contacts x
        where x.owner_id=p_owner and private.native_player_chat_account(x.player_id)
        and private.native_player_chat_unblocked(p_owner,x.player_id) order by name,x.player_id limit 100) p
    ),'[]'::jsonb),'rooms',coalesce((
      select jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'group',r.is_group,'unread',r.unread,'activityAt',r.message_at) order by r.activity desc,r.id)
      from (select room.id,private.native_player_chat_title(room,p_owner) as title,room.related_entity_type='player_group' as is_group,
        coalesce(latest.created_at,room.created_at) as activity, latest.created_at as message_at,
        coalesce(latest.sender_user_id<>p_owner and latest.created_at>coalesce(member.last_read_at,'-infinity'::timestamptz),false) as unread
        from public.internal_conversation_participants member join public.internal_conversations room on room.id=member.conversation_id
        left join lateral (select m.created_at,m.sender_user_id from public.internal_messages m
          where m.conversation_id=room.id and m.message_kind='message' and m.deleted_at is null
            and private.native_player_chat_unblocked(p_owner,m.sender_user_id)
          order by m.created_at desc,m.id desc limit 1) latest on true
        where member.profile_id=p_owner and private.native_player_chat_visible(room,p_owner)
        order by activity desc,room.id limit 100) r
    ),'[]'::jsonb));
  end if;

  select * into c from public.internal_conversations where id=p_room;
  if not found or not private.native_player_chat_visible(c,p_owner) then return jsonb_build_object('code','forbidden'); end if;
  if (p_before_at is null) <> (p_before_id is null) then return jsonb_build_object('code','invalid'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'author',m.sender_user_id,'name',private.native_player_chat_name(m.sender_user_id),
    'body',m.body,'createdAt',m.created_at) order by m.created_at,m.id) filter (where m.position<=40),'[]'::jsonb),count(*)>40
  into messages,more from (
    select m.*,row_number() over(order by m.created_at desc,m.id desc) as position
    from public.internal_messages m where m.conversation_id=c.id and m.message_kind='message' and m.deleted_at is null
      and private.native_player_chat_unblocked(p_owner,m.sender_user_id)
      and (p_before_at is null or (m.created_at,m.id)<(p_before_at,p_before_id))
    order by m.created_at desc,m.id desc limit 41
  ) m;
  return jsonb_build_object('code','ok','room',jsonb_build_object('id',c.id,'title',private.native_player_chat_title(c,p_owner),
    'group',c.related_entity_type='player_group','manage',c.related_entity_type='player_group' and coalesce(c.created_by_user_id=p_owner,false),
    'messages',messages,'more',more,'members',coalesce((
      select jsonb_agg(jsonb_build_object('id',p.profile_id,'name',private.native_player_chat_name(p.profile_id)) order by p.profile_id)
      from public.internal_conversation_participants p where p.conversation_id=c.id and p.profile_id<>p_owner
        and private.native_player_chat_account(p.profile_id) and private.native_player_chat_unblocked(p_owner,p.profile_id)
    ),'[]'::jsonb)));
end;
$$;

-- Use the latest message a member can see, including messages they sent.
create function private.first_party_team_chat_activity(p_room uuid,p_owner uuid)
returns timestamptz language sql stable security invoker set search_path='' as $$
  select message.created_at
  from public.internal_messages message
  where message.conversation_id=p_room and message.deleted_at is null
    and message.message_kind='message' and message.metadata='{}'::jsonb
    and not exists (
      select 1 from public.team_chat_blocks block
      where block.owner_user_id=p_owner and block.blocked_user_id=message.sender_user_id
    )
  order by message.created_at desc,message.id desc limit 1;
$$;
revoke all on function private.first_party_team_chat_activity(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.first_party_team_chat_activity(uuid,uuid) to service_role;

create or replace function public.native_first_party_team_chat_rooms(
  p_owner uuid,p_team text,p_league text,p_flight text,p_action text,p_id uuid,p_name text,p_parent uuid
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  result jsonb;
  rooms jsonb;
begin
  if p_parent is null then return jsonb_build_object('ok',false,'status',400); end if;
  result:=private.team_chat_room_action(p_owner,p_team,p_league,p_flight,p_action,p_id,p_name,p_parent);
  if p_action is distinct from 'list' or result->'ok' is distinct from 'true'::jsonb then return result; end if;
  select coalesce(jsonb_agg(item.value || jsonb_build_object(
    'activityAt',private.first_party_team_chat_activity((item.value->>'id')::uuid,p_owner)
  ) order by item.ordinality),'[]'::jsonb) into rooms
  from jsonb_array_elements(result->'rooms') with ordinality item(value,ordinality);
  return result || jsonb_build_object(
    'generalActivityAt',private.first_party_team_chat_activity(p_parent,p_owner),'rooms',rooms
  );
end;
$$;

commit;
