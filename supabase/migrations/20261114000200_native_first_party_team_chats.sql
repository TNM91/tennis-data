begin;

-- First-party chats share General's roster and have their own message history.
alter table public.team_chat_rooms add column first_party boolean not null default false;

-- Names are unique within each team's chats for the same release scope.
alter table public.team_chat_rooms drop constraint team_chat_rooms_parent_conversation_id_name_key_key;
alter table public.team_chat_rooms add unique (parent_conversation_id, first_party, name_key);

create or replace function private.can_access_team_conversation(target_conversation_id uuid,target_profile_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.internal_conversations conversation where conversation.id=target_conversation_id
 and (conversation.related_entity_type<>'team' or private.is_profile_team_member(target_profile_id,conversation.metadata->>'teamName',conversation.metadata->>'leagueName',conversation.metadata->>'flight'))
 and (conversation.related_entity_type<>'team_room' or not exists(select 1 from public.team_room_member_removals r where r.conversation_id=conversation.id and r.profile_id=target_profile_id))
 and ((conversation.related_entity_type<>'team_room_chat' and not exists(select 1 from public.team_chat_rooms named where named.conversation_id=conversation.id))
  or exists(
   select 1 from public.team_chat_rooms named
   join public.internal_conversations parent on parent.id=named.parent_conversation_id and parent.related_entity_type='team_room' and parent.status='open'
   join public.internal_conversation_participants member on member.conversation_id=parent.id and member.profile_id=target_profile_id
   join public.team_profile_links link on link.profile_user_id=target_profile_id and link.status='accepted' and link.archived_at is null
   where named.conversation_id=conversation.id and conversation.related_entity_type='team_room_chat' and conversation.status='open'
    and named.team_name=link.team_name and named.league_name=link.league_name and named.flight=link.flight
    and (case when named.first_party
      then link.source_type in ('manual_invite','tiq_entry')
        and (left(named.league_name,13)<>'Private team ' or exists (
          select 1 from public.native_private_teams native
          where native.room_id=parent.id and native.team_name=named.team_name and native.flight=named.flight
           and named.league_name='Private team ' || native.room_id::text))
      else parent.metadata->>'teamName'=named.team_name and parent.metadata->>'leagueName'=named.league_name
        and coalesce(parent.metadata->>'flight','')=named.flight end)
    and parent.related_entity_id=concat_ws('__',btrim(regexp_replace(lower(coalesce(link.team_name,'')),'[^a-z0-9]+',' ','g')),btrim(regexp_replace(lower(coalesce(link.league_name,'')),'[^a-z0-9]+',' ','g')),btrim(regexp_replace(lower(coalesce(link.flight,'')),'[^a-z0-9]+',' ','g')))
    and not exists(select 1 from public.team_room_member_removals excluded where excluded.conversation_id=parent.id and excluded.profile_id=target_profile_id)
  ))
 );
$$;
create function private.first_party_named_room_unread(p_room uuid,p_owner uuid) returns integer
language sql stable security invoker set search_path='' as $$
 select count(*)::integer from (
  select m.id from public.internal_messages m
  where m.conversation_id=p_room and m.deleted_at is null and m.message_kind='message' and m.metadata='{}'::jsonb and m.sender_user_id is distinct from p_owner
   and m.created_at>coalesce((select last_read_at from public.internal_conversation_participants where conversation_id=p_room and profile_id=p_owner),'-infinity'::timestamptz)
   and not exists(select 1 from public.team_chat_blocks b where b.owner_user_id=p_owner and b.blocked_user_id=m.sender_user_id)
  order by m.created_at desc,m.id desc limit 100
 ) bounded;
$$;
revoke all on function private.first_party_named_room_unread(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.first_party_named_room_unread(uuid,uuid) to service_role;

create function private.team_chat_room_action(p_owner uuid,p_team text,p_league text,p_flight text,p_action text,p_id uuid,p_name text,p_parent uuid)
returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public set lock_timeout='3s'
as $$
declare
 parent public.internal_conversations%rowtype;
 child public.team_chat_rooms%rowtype;
 scope_id text; normalized text; first_party_scope boolean := p_parent is not null; room_list jsonb; captain boolean; room_count integer; parent_muted boolean;
begin
 if p_owner is null or p_action is null or p_action not in ('list','create','lookup','open') or p_team is null or p_league is null or p_flight is null or btrim(p_team)='' or btrim(p_league)='' or length(p_team)>160 or length(p_league)>160 or length(p_flight)>120 then return jsonb_build_object('ok',false,'status',400); end if;
 normalized:=btrim(regexp_replace(lower(p_team),'[^a-z0-9]+',' ','g'));
 scope_id:=concat_ws('__',normalized,btrim(regexp_replace(lower(p_league),'[^a-z0-9]+',' ','g')),btrim(regexp_replace(lower(p_flight),'[^a-z0-9]+',' ','g')));
 if p_action in ('create','lookup') then
 select * into parent from public.internal_conversations where related_entity_type='team_room' and related_entity_id=scope_id and (p_parent is null or id=p_parent) for update;
 else
 select * into parent from public.internal_conversations where related_entity_type='team_room' and related_entity_id=scope_id and (p_parent is null or id=p_parent) for share;
 end if;
 if parent.id is null or (not first_party_scope and (parent.metadata->>'teamName' is distinct from p_team or parent.metadata->>'leagueName' is distinct from p_league or coalesce(parent.metadata->>'flight','') is distinct from p_flight)) or parent.status<>'open' or not exists(select 1 from public.internal_conversation_participants where conversation_id=parent.id and profile_id=p_owner) or exists(select 1 from public.team_room_member_removals where conversation_id=parent.id and profile_id=p_owner) then return jsonb_build_object('ok',false,'status',403); end if;
 if first_party_scope and left(p_league,13)='Private team ' and not exists (
  select 1 from public.native_private_teams native where native.room_id=parent.id and native.team_name=p_team
   and native.flight=p_flight and p_league='Private team ' || native.room_id::text
 ) then return jsonb_build_object('ok',false,'status',403); end if;
 if exists(select 1 from public.team_chat_rooms where parent_conversation_id=parent.id and first_party=first_party_scope and (team_name<>p_team or league_name<>p_league or flight<>p_flight)) then return jsonb_build_object('ok',false,'status',403); end if;
 if not exists(select 1 from public.team_profile_links where profile_user_id=p_owner and normalized_team_name=normalized and team_name=p_team and league_name=p_league and flight=p_flight and status='accepted' and archived_at is null and (not first_party_scope or source_type in ('manual_invite','tiq_entry'))) then return jsonb_build_object('ok',false,'status',403); end if;
 select exists(select 1 from public.team_profile_links where profile_user_id=p_owner and normalized_team_name=normalized and team_name=p_team and league_name=p_league and flight=p_flight and status='accepted' and archived_at is null and (not first_party_scope or source_type in ('manual_invite','tiq_entry')) and (case when cardinality(team_roles)>0 then team_roles else array[team_role] end) && array['captain','co_captain']::text[]) into captain;
 select muted into parent_muted from public.internal_conversation_participants where conversation_id=parent.id and profile_id=p_owner;
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object(
   'id',r.conversation_id,'name',r.name,'createdAt',r.created_at,'activityAt',r.updated_at,'hasLogo',r.has_logo,
   'unread',case when first_party_scope then private.first_party_named_room_unread(r.conversation_id,p_owner)
    else private.named_room_unread(r.conversation_id,p_owner) end,
   'muted',coalesce(parent_muted,false) or coalesce((select muted from public.internal_conversation_participants
    where conversation_id=r.conversation_id and profile_id=p_owner),false)
  ) order by r.created_at,r.conversation_id),'[]'::jsonb) into room_list from (
   select named.*, conversation.updated_at, coalesce(conversation.metadata ? 'teamLogo',false) has_logo
   from public.team_chat_rooms named
   join public.internal_conversations conversation on conversation.id=named.conversation_id
   where named.parent_conversation_id=parent.id and conversation.related_entity_type='team_room_chat' and conversation.status='open'
    and named.first_party=first_party_scope
   order by named.created_at,named.conversation_id limit 13
  ) r;
  if jsonb_array_length(room_list)>12 then return jsonb_build_object('ok',false,'status',409); end if;
  return jsonb_build_object('ok',true,'status',200,'namedRooms',1,'parentId',parent.id,'teamMuted',coalesce(parent_muted,false),'canCreate',captain,'generalUnread',case when first_party_scope then private.first_party_named_room_unread(parent.id,p_owner) else private.named_room_unread(parent.id,p_owner) end,'rooms',room_list);
 end if;
 if p_id is null then return jsonb_build_object('ok',false,'status',400); end if;
 select * into child from public.team_chat_rooms where conversation_id=p_id;
 if child.conversation_id is not null and not exists (
  select 1 from public.internal_conversations conversation where conversation.id=child.conversation_id
   and conversation.related_entity_type='team_room_chat' and conversation.status='open'
   and child.first_party=first_party_scope
 ) then return jsonb_build_object('ok',false,'status',case when p_action='create' then 409 else 404 end); end if;
 if p_action='open' then
  if child.conversation_id is null or child.parent_conversation_id<>parent.id then return jsonb_build_object('ok',false,'status',404); end if;
  -- Current access is proved above; no caller can copy stale participants into a child.
  if not exists(select 1 from public.internal_conversation_participants where conversation_id=child.conversation_id and profile_id=p_owner) then
  insert into public.internal_conversation_participants(conversation_id,profile_id,participant_role)
   values(child.conversation_id,p_owner,case when captain then 'coordinator' else 'member' end)
   on conflict(conversation_id,profile_id) do nothing;
  end if;
  return jsonb_build_object('ok',true,'status',200,'namedRooms',1,'parentId',parent.id,'teamMuted',coalesce(parent_muted,false),'id',child.conversation_id,'name',child.name);
 end if;
 if not captain then return jsonb_build_object('ok',false,'status',403); end if;
 if p_name is null or length(p_name)<1 or length(p_name)>48 or p_name<>btrim(p_name) or p_name ~ '[[:cntrl:]]' or lower(regexp_replace(p_name,'[[:space:]]+',' ','g'))='general' then return jsonb_build_object('ok',false,'status',400); end if;
 if child.conversation_id is not null then
  if child.parent_conversation_id<>parent.id or child.created_by is distinct from p_owner or child.name<>p_name then return jsonb_build_object('ok',false,'status',409); end if;
  return jsonb_build_object('ok',true,'status',200,'namedRooms',1,'parentId',parent.id,'teamMuted',coalesce(parent_muted,false),'id',child.conversation_id,'name',child.name,'replayed',true);
 end if;
 if p_action='lookup' then return jsonb_build_object('ok',false,'status',404); end if;
 select count(*) into room_count from public.team_chat_rooms where parent_conversation_id=parent.id and first_party=first_party_scope;
 if room_count>=12 or exists(select 1 from public.team_chat_rooms where parent_conversation_id=parent.id and first_party=first_party_scope and name_key=lower(regexp_replace(p_name,'[[:space:]]+',' ','g'))) then return jsonb_build_object('ok',false,'status',409); end if;
 if (select count(*) from (select 1 from public.internal_conversation_participants where conversation_id=parent.id limit 251) bounded)>250 then return jsonb_build_object('ok',false,'status',409); end if;
 insert into public.internal_conversations(id,conversation_type,subject,status,created_by_user_id,related_entity_type,related_entity_id,metadata)
 values(p_id,'team',p_name,'open',p_owner,'team_room_chat',p_id::text,jsonb_build_object('entityType','team_room_chat','parentConversationId',parent.id,'teamName',p_team,'leagueName',p_league,'flight',p_flight,'roomName',p_name));
 insert into public.team_chat_rooms(conversation_id,parent_conversation_id,team_name,league_name,flight,name,created_by,first_party) values(p_id,parent.id,p_team,p_league,p_flight,p_name,p_owner,first_party_scope);
 insert into public.internal_conversation_participants(conversation_id,profile_id,participant_role)
 select p_id,part.profile_id,case when part.profile_id=p_owner then 'coordinator' else 'member' end
 from public.internal_conversation_participants part
 where part.conversation_id=parent.id
  and not exists(select 1 from public.team_room_member_removals where conversation_id=parent.id and profile_id=part.profile_id)
  and exists(select 1 from public.team_profile_links where profile_user_id=part.profile_id and normalized_team_name=normalized and team_name=p_team and league_name=p_league and flight=p_flight and status='accepted' and archived_at is null and (not first_party_scope or source_type in ('manual_invite','tiq_entry')));
 return jsonb_build_object('ok',true,'status',200,'namedRooms',1,'parentId',parent.id,'teamMuted',coalesce(parent_muted,false),'id',p_id,'name',p_name,'replayed',false);
exception when unique_violation then
 return jsonb_build_object('ok',false,'status',409);
end;
$$;
revoke all on function private.team_chat_room_action(uuid,text,text,text,text,uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function private.team_chat_room_action(uuid,text,text,text,text,uuid,text,uuid) to service_role;

create or replace function public.native_team_chat_rooms(
 p_owner uuid,p_team text,p_league text,p_flight text,p_action text,p_id uuid default null,p_name text default null
) returns jsonb language sql security invoker set search_path='' as $$
 select private.team_chat_room_action(p_owner,p_team,p_league,p_flight,p_action,p_id,p_name,null);
$$;

create function public.native_first_party_team_chat_rooms(
 p_owner uuid,p_team text,p_league text,p_flight text,p_action text,p_id uuid,p_name text,p_parent uuid
) returns jsonb language sql security invoker set search_path='' as $$
 select case when p_parent is null then jsonb_build_object('ok',false,'status',400)
 else private.team_chat_room_action(p_owner,p_team,p_league,p_flight,p_action,p_id,p_name,p_parent) end;
$$;
revoke all on function public.native_first_party_team_chat_rooms(uuid,text,text,text,text,uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.native_first_party_team_chat_rooms(uuid,text,text,text,text,uuid,text,uuid) to service_role;

notify pgrst, 'reload schema';
commit;
