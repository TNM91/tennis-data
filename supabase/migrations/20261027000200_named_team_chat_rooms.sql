begin;
-- Named rooms are separate conversations; existing General messages stay untouched.
create table public.team_chat_rooms (
 conversation_id uuid primary key references public.internal_conversations(id) on delete cascade,
 parent_conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
 team_name text not null check(length(team_name) between 1 and 160),
 league_name text not null check(length(league_name) between 1 and 160),
 flight text not null check(length(flight)<=120),
 name text not null check (length(name) between 1 and 48 and name=btrim(name) and name !~ '[[:cntrl:]]'),
 name_key text generated always as (lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g'))) stored,
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default clock_timestamp(),
 check (conversation_id<>parent_conversation_id),
 check (name_key<>'general'),
 unique(parent_conversation_id,name_key)
);
alter table public.team_chat_rooms enable row level security;
revoke all on public.team_chat_rooms from public,anon,authenticated,service_role;
grant select,insert on public.team_chat_rooms to service_role;

-- The existing message/participant policies already call this access predicate.
-- A retained child participant, sender or creator can never bypass parent removal.
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
    and parent.metadata->>'teamName'=named.team_name and parent.metadata->>'leagueName'=named.league_name and coalesce(parent.metadata->>'flight','')=named.flight
    and parent.related_entity_id=concat_ws('__',btrim(regexp_replace(lower(coalesce(link.team_name,'')),'[^a-z0-9]+',' ','g')),btrim(regexp_replace(lower(coalesce(link.league_name,'')),'[^a-z0-9]+',' ','g')),btrim(regexp_replace(lower(coalesce(link.flight,'')),'[^a-z0-9]+',' ','g')))
    and not exists(select 1 from public.team_room_member_removals excluded where excluded.conversation_id=parent.id and excluded.profile_id=target_profile_id)
  ))
 );
$$;
-- Older reaction policies use participant rows directly; also enforce the parent boundary.
create policy "Named rooms inherit team access" on public.team_room_message_reactions
 as restrictive for all to authenticated
 using (private.can_access_team_conversation(conversation_id,auth.uid()))
 with check (private.can_access_team_conversation(conversation_id,auth.uid()));

-- Bounded badges: no message bodies or sender identities leave this aggregate.
create function private.named_room_unread(p_room uuid,p_owner uuid) returns integer
language sql stable security invoker set search_path='' as $$
 select count(*)::integer from (
  select m.id from public.internal_messages m
  where m.conversation_id=p_room and m.deleted_at is null and m.sender_user_id is distinct from p_owner
   and m.created_at>coalesce((select last_read_at from public.internal_conversation_participants where conversation_id=p_room and profile_id=p_owner),'-infinity'::timestamptz)
   and not exists(select 1 from public.team_chat_blocks b where b.owner_user_id=p_owner and b.blocked_user_id=m.sender_user_id)
  order by m.created_at desc,m.id desc limit 100
 ) bounded;
$$;
revoke all on function private.named_room_unread(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.named_room_unread(uuid,uuid) to service_role;

create or replace function public.native_team_chat_rooms(p_owner uuid,p_team text,p_league text,p_flight text,p_action text,p_id uuid default null,p_name text default null)
returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public set lock_timeout='3s'
as $$
declare
 parent public.internal_conversations%rowtype;
 child public.team_chat_rooms%rowtype;
 scope_id text; normalized text; room_list jsonb; captain boolean; room_count integer; parent_muted boolean;
begin
 if p_owner is null or p_action is null or p_action not in ('list','create','lookup','open') or p_team is null or p_league is null or p_flight is null or btrim(p_team)='' or btrim(p_league)='' or length(p_team)>160 or length(p_league)>160 or length(p_flight)>120 then return jsonb_build_object('ok',false,'status',400); end if;
 normalized:=btrim(regexp_replace(lower(p_team),'[^a-z0-9]+',' ','g'));
 scope_id:=concat_ws('__',normalized,btrim(regexp_replace(lower(p_league),'[^a-z0-9]+',' ','g')),btrim(regexp_replace(lower(p_flight),'[^a-z0-9]+',' ','g')));
 if p_action in ('create','lookup') then
 select * into parent from public.internal_conversations where related_entity_type='team_room' and related_entity_id=scope_id for update;
 else
 select * into parent from public.internal_conversations where related_entity_type='team_room' and related_entity_id=scope_id for share;
 end if;
 if parent.id is null or parent.metadata->>'teamName' is distinct from p_team or parent.metadata->>'leagueName' is distinct from p_league or coalesce(parent.metadata->>'flight','') is distinct from p_flight or parent.status<>'open' or not exists(select 1 from public.internal_conversation_participants where conversation_id=parent.id and profile_id=p_owner) or exists(select 1 from public.team_room_member_removals where conversation_id=parent.id and profile_id=p_owner) then return jsonb_build_object('ok',false,'status',403); end if;
 if exists(select 1 from public.team_chat_rooms where parent_conversation_id=parent.id and (team_name<>p_team or league_name<>p_league or flight<>p_flight)) then return jsonb_build_object('ok',false,'status',403); end if;
 if not exists(select 1 from public.team_profile_links where profile_user_id=p_owner and normalized_team_name=normalized and team_name=p_team and league_name=p_league and flight=p_flight and status='accepted' and archived_at is null) then return jsonb_build_object('ok',false,'status',403); end if;
 select exists(select 1 from public.team_profile_links where profile_user_id=p_owner and normalized_team_name=normalized and team_name=p_team and league_name=p_league and flight=p_flight and status='accepted' and archived_at is null and (case when cardinality(team_roles)>0 then team_roles else array[team_role] end) && array['captain','co_captain']::text[]) into captain;
 select muted into parent_muted from public.internal_conversation_participants where conversation_id=parent.id and profile_id=p_owner;
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',r.conversation_id,'name',r.name,'createdAt',r.created_at,'unread',private.named_room_unread(r.conversation_id,p_owner),'muted',coalesce(parent_muted,false) or coalesce((select muted from public.internal_conversation_participants where conversation_id=r.conversation_id and profile_id=p_owner),false)) order by r.created_at,r.conversation_id),'[]'::jsonb) into room_list from (select * from public.team_chat_rooms where parent_conversation_id=parent.id order by created_at,conversation_id limit 13) r;
  if jsonb_array_length(room_list)>12 then return jsonb_build_object('ok',false,'status',409); end if;
  return jsonb_build_object('ok',true,'status',200,'namedRooms',1,'parentId',parent.id,'teamMuted',coalesce(parent_muted,false),'canCreate',captain,'generalUnread',private.named_room_unread(parent.id,p_owner),'rooms',room_list);
 end if;
 if p_id is null then return jsonb_build_object('ok',false,'status',400); end if;
 select * into child from public.team_chat_rooms where conversation_id=p_id;
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
  if child.parent_conversation_id<>parent.id or child.created_by<>p_owner or child.name<>p_name then return jsonb_build_object('ok',false,'status',409); end if;
  return jsonb_build_object('ok',true,'status',200,'namedRooms',1,'parentId',parent.id,'teamMuted',coalesce(parent_muted,false),'id',child.conversation_id,'name',child.name,'replayed',true);
 end if;
 if p_action='lookup' then return jsonb_build_object('ok',false,'status',404); end if;
 select count(*) into room_count from public.team_chat_rooms where parent_conversation_id=parent.id;
 if room_count>=12 or exists(select 1 from public.team_chat_rooms where parent_conversation_id=parent.id and name_key=lower(regexp_replace(p_name,'[[:space:]]+',' ','g'))) then return jsonb_build_object('ok',false,'status',409); end if;
 if (select count(*) from (select 1 from public.internal_conversation_participants where conversation_id=parent.id limit 251) bounded)>250 then return jsonb_build_object('ok',false,'status',409); end if;
 insert into public.internal_conversations(id,conversation_type,subject,status,created_by_user_id,related_entity_type,related_entity_id,metadata)
 values(p_id,'team',p_name,'open',p_owner,'team_room_chat',p_id::text,jsonb_build_object('entityType','team_room_chat','parentConversationId',parent.id,'teamName',p_team,'leagueName',p_league,'flight',p_flight,'roomName',p_name));
 insert into public.team_chat_rooms(conversation_id,parent_conversation_id,team_name,league_name,flight,name,created_by) values(p_id,parent.id,p_team,p_league,p_flight,p_name,p_owner);
 insert into public.internal_conversation_participants(conversation_id,profile_id,participant_role)
 select p_id,part.profile_id,case when part.profile_id=p_owner then 'coordinator' else 'member' end
 from public.internal_conversation_participants part
 where part.conversation_id=parent.id
  and not exists(select 1 from public.team_room_member_removals where conversation_id=parent.id and profile_id=part.profile_id)
  and exists(select 1 from public.team_profile_links where profile_user_id=part.profile_id and normalized_team_name=normalized and team_name=p_team and league_name=p_league and flight=p_flight and status='accepted' and archived_at is null);
 return jsonb_build_object('ok',true,'status',200,'namedRooms',1,'parentId',parent.id,'teamMuted',coalesce(parent_muted,false),'id',p_id,'name',p_name,'replayed',false);
exception when unique_violation then
 return jsonb_build_object('ok',false,'status',409);
end;
$$;
revoke all on function public.native_team_chat_rooms(uuid,text,text,text,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.native_team_chat_rooms(uuid,text,text,text,text,uuid,text) to service_role;

create or replace function public.can_read_team_chat_signal(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (
  select 1 from public.internal_conversations c
  join public.internal_conversation_participants p on p.conversation_id=c.id and p.profile_id=auth.uid()
  join public.team_profile_links l on l.profile_user_id=auth.uid() and l.status='accepted'
  where c.id=p_conversation_id and c.related_entity_type='team_room'
   and c.related_entity_id =
    pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.lower(coalesce(l.team_name,'')),'[^a-z0-9]+',' ','g')) || '__' ||
    pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.lower(coalesce(l.league_name,'')),'[^a-z0-9]+',' ','g')) || '__' ||
    pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.lower(coalesce(l.flight,'')),'[^a-z0-9]+',' ','g'))
   and (not exists(select 1 from public.team_room_member_removals r where r.conversation_id=c.id and r.profile_id=auth.uid())
    or (case when cardinality(l.team_roles)>0 then l.team_roles else array[coalesce(l.team_role,'player')] end) && array['captain','co_captain'])
 ) or (auth.uid() is not null and exists(
 select 1 from public.team_chat_rooms named
 join public.internal_conversation_participants part on part.conversation_id=named.conversation_id and part.profile_id=auth.uid()
 where named.conversation_id=p_conversation_id and private.can_access_team_conversation(named.conversation_id,auth.uid())
 ));
$$;

create or replace function public.touch_team_chat_signal()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
 for target_id in select distinct targets.id from unnest(case
  when TG_OP='INSERT' then array[NEW.conversation_id]
  when TG_OP='DELETE' then array[OLD.conversation_id]
  else array[OLD.conversation_id,NEW.conversation_id] end) as targets(id)
 loop
  if exists(select 1 from public.internal_conversations c where c.id=target_id and c.related_entity_type in ('team_room','team_room_chat')) then
   insert into public.team_chat_signals as s(conversation_id) values(target_id)
    on conflict(conversation_id) do update set revision=s.revision+1,changed_at=clock_timestamp();
  end if;
 end loop;
 if TG_OP='DELETE' then return OLD; else return NEW; end if;
end;
$$;

commit;
