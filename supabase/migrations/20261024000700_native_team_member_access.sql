-- Atomic chat access changes. Official roster links and player roles are never changed.
create table if not exists public.team_room_access_operations (
 id uuid primary key,
 conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
 actor_id uuid not null references public.profiles(id) on delete cascade,
 target_id uuid not null references public.profiles(id) on delete cascade,
 action text not null check(action in ('remove','restore')),
 expected jsonb not null,
 after_version jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 check(actor_id<>target_id),
 check(jsonb_typeof(expected)='object' and jsonb_typeof(after_version)='object')
);
alter table public.team_room_access_operations enable row level security;
revoke all on public.team_room_access_operations from public,anon,authenticated,service_role;
grant select,insert on public.team_room_access_operations to service_role;
create index if not exists team_room_access_operations_room_idx on public.team_room_access_operations(conversation_id,created_at);
alter table public.team_room_member_removals add column if not exists saved_last_read_at timestamptz;
alter table public.team_room_member_removals add column if not exists saved_muted boolean;

-- Keep the existing team-conversation rule and add Team Room exclusions. This also
-- prevents a removed creator/sender from bypassing exclusion through direct RLS or self-insertion.
create or replace function private.can_access_team_conversation(target_conversation_id uuid,target_profile_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.internal_conversations conversation where conversation.id=target_conversation_id
 and (conversation.related_entity_type<>'team' or private.is_profile_team_member(target_profile_id,conversation.metadata->>'teamName',conversation.metadata->>'leagueName',conversation.metadata->>'flight'))
 and (conversation.related_entity_type<>'team_room' or not exists(select 1 from public.team_room_member_removals r where r.conversation_id=conversation.id and r.profile_id=target_profile_id)));
$$;

-- Apply exclusions atomically for legacy entry points too, preserving the player's choices.
create or replace function private.apply_team_room_exclusion()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.internal_conversations c where c.id=NEW.conversation_id and c.related_entity_type='team_room' for update;
 if found then
  if NEW.saved_muted is null then
   select p.last_read_at,p.muted into NEW.saved_last_read_at,NEW.saved_muted from public.internal_conversation_participants p where p.conversation_id=NEW.conversation_id and p.profile_id=NEW.profile_id for update;
  end if;
  delete from public.internal_conversation_participants where conversation_id=NEW.conversation_id and profile_id=NEW.profile_id;
 end if;
 return NEW;
end;
$$;
revoke all on function private.apply_team_room_exclusion() from public,anon,authenticated,service_role;
drop trigger if exists apply_team_room_exclusion on public.team_room_member_removals;
create trigger apply_team_room_exclusion before insert or update on public.team_room_member_removals for each row execute function private.apply_team_room_exclusion();

create or replace function private.guard_excluded_team_participant()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Serialize legacy joins with native removal/restore before checking the marker.
 perform 1 from public.internal_conversations c where c.id=NEW.conversation_id and c.related_entity_type='team_room' for update;
 if exists(select 1 from public.team_room_member_removals r join public.internal_conversations c on c.id=r.conversation_id and c.related_entity_type='team_room' where r.conversation_id=NEW.conversation_id and r.profile_id=NEW.profile_id) then
  raise exception 'Team chat access must be restored before joining' using errcode='42501';
 end if;
 return NEW;
end;
$$;
revoke all on function private.guard_excluded_team_participant() from public,anon,authenticated,service_role;
drop trigger if exists guard_excluded_team_participant_insert on public.internal_conversation_participants;
create trigger guard_excluded_team_participant_insert before insert on public.internal_conversation_participants for each row execute function private.guard_excluded_team_participant();
drop trigger if exists guard_excluded_team_participant_update on public.internal_conversation_participants;
create trigger guard_excluded_team_participant_update before update of conversation_id,profile_id,participant_role on public.internal_conversation_participants for each row execute function private.guard_excluded_team_participant();

create or replace function private.native_team_member_review(p_owner uuid,p_room uuid,p_normalized text,p_league text,p_flight text,p_target uuid)
returns jsonb language sql stable security invoker set search_path=pg_catalog,public as $$
 with person as (
 select p.id,left(coalesce(nullif(btrim(p.message_display_name),''),nullif(btrim(p.linked_player_name),''),'Team member'),120) name,
 left(coalesce(p.tiq_public_id,''),40) public_id,p.role='admin' admin,
 l.id link_id,l.updated_at link_updated,l.status link_status,l.archived_at,
 case when cardinality(l.team_roles)>0 then l.team_roles else array[l.team_role] end roles,
 part.profile_id participant,part.participant_role,part.created_at participant_created,
 r.profile_id removed,r.removed_at,r.removed_by_user_id
 from public.profiles p
 left join public.team_profile_links l on l.profile_user_id=p.id and l.normalized_team_name=p_normalized and l.league_name=p_league and l.flight=p_flight
 left join public.internal_conversation_participants part on part.conversation_id=p_room and part.profile_id=p.id
 left join public.team_room_member_removals r on r.conversation_id=p_room and r.profile_id=p.id
 where p.id=p_target), evaluated as (
 select *,coalesce(admin,false) or p_target=p_owner or participant_role='coordinator' or (roles && array['captain','co_captain']::text[]) protected,
 link_status='accepted' and archived_at is null and roles && array['player']::text[] player_link from person)
 select jsonb_build_object('id',id,'name',name,'publicId',public_id,
 'role',case when admin then 'Administrator' when roles && array['captain']::text[] then 'Captain' when roles && array['co_captain']::text[] then 'Co-captain' else 'Player' end,
 'state',case when removed is not null then 'removed' when participant is not null then 'connected' else 'not_joined' end,
 'canRemove',not coalesce(protected,false) and participant is not null and removed is null,
 'canRestore',not coalesce(protected,false) and coalesce(player_link,false) and removed is not null,
 'reason',case when p_target=p_owner then 'You cannot change your own chat access here.' when coalesce(protected,false) then 'Captain and administrator access is managed through team connections.' when removed is not null and not coalesce(player_link,false) then 'An accepted player connection is required before restoring chat.' when participant is null and removed is null then 'This player has not joined team chat.' else '' end,
 'expected',jsonb_build_object('linkId',link_id,'linkUpdatedAt',link_updated,'participantCreatedAt',participant_created,'participantRole',participant_role,'removedAt',removed_at,'removedBy',removed_by_user_id,'name',name,'publicId',public_id)) from evaluated;
$$;
revoke all on function private.native_team_member_review(uuid,uuid,text,text,text,uuid) from public,anon,authenticated,service_role;
grant usage on schema private to service_role;
grant execute on function private.native_team_member_review(uuid,uuid,text,text,text,uuid) to service_role;

create or replace function public.native_team_member_access(p_owner uuid,p_team text,p_league text,p_flight text,p_action text,p_target uuid default null,p_operation uuid default null,p_expected jsonb default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public set lock_timeout='3s' as $$
declare
 room public.internal_conversations%rowtype;
 actor public.team_profile_links%rowtype;
 participant public.internal_conversation_participants%rowtype;
 removal public.team_room_member_removals%rowtype;
 operation public.team_room_access_operations%rowtype;
 normalized text;scope_id text;review jsonb;after_review jsonb;members jsonb;total integer;
begin
 if p_action is null or p_action not in ('list','remove','restore') or p_team is null or p_league is null or p_flight is null or btrim(p_team)='' or btrim(p_league)='' or length(p_team)>160 or length(p_league)>160 or length(p_flight)>80 or (p_action<>'list' and (p_target is null or p_operation is null or p_expected is null or p_target=p_owner)) then return jsonb_build_object('ok',false,'status',400); end if;
 normalized:=btrim(regexp_replace(lower(p_team),'[^a-z0-9]+',' ','g'));
 scope_id:=concat_ws('__',normalized,btrim(regexp_replace(lower(p_league),'[^a-z0-9]+',' ','g')),btrim(regexp_replace(lower(p_flight),'[^a-z0-9]+',' ','g')));
 -- Match native join lock order: target profile first, then room and team links.
 if p_action<>'list' then perform 1 from public.profiles where id=p_target for update; end if;
 if p_action='list' then select * into room from public.internal_conversations where related_entity_type='team_room' and related_entity_id=scope_id;
 else select * into room from public.internal_conversations where related_entity_type='team_room' and related_entity_id=scope_id for update; end if;
 if room.id is null or room.status='closed' then return jsonb_build_object('ok',false,'status',403); end if;
 select * into actor from public.team_profile_links where profile_user_id=p_owner and normalized_team_name=normalized and league_name=p_league and flight=p_flight and status='accepted' and archived_at is null and coalesce(team_roles,array[team_role]) && array['captain','co_captain']::text[] for share;
 if actor.id is null or exists(select 1 from public.team_room_member_removals where conversation_id=room.id and profile_id=p_owner) or not exists(select 1 from public.internal_conversation_participants where conversation_id=room.id and profile_id=p_owner) then return jsonb_build_object('ok',false,'status',403); end if;
 if p_action='list' then
  with ids as (select profile_id id from public.internal_conversation_participants where conversation_id=room.id union select profile_id from public.team_room_member_removals where conversation_id=room.id union select profile_user_id from public.team_profile_links where normalized_team_name=normalized and league_name=p_league and flight=p_flight and status='accepted' and archived_at is null), reviews as (select private.native_team_member_review(p_owner,room.id,normalized,p_league,p_flight,id) value from ids), limited as (select value from reviews where value is not null order by value->>'name',value->>'id' limit 251)
  select coalesce(jsonb_agg(value order by value->>'name',value->>'id') filter(where ordinal<=250),'[]'::jsonb),count(*) into members,total from (select value,row_number() over(order by value->>'name',value->>'id') ordinal from limited) numbered;
  return jsonb_build_object('ok',true,'status',200,'nativeMemberAccess',1,'action','list','scope',jsonb_build_object('teamName',p_team,'leagueName',p_league,'flight',p_flight),'members',members,'more',total>250);
 end if;
 select * into operation from public.team_room_access_operations where id=p_operation;
 if operation.id is not null then
  if operation.actor_id<>p_owner or operation.conversation_id<>room.id or operation.target_id<>p_target or operation.action<>p_action or operation.expected is distinct from p_expected then return jsonb_build_object('ok',false,'status',409); end if;
  review:=private.native_team_member_review(p_owner,room.id,normalized,p_league,p_flight,p_target);
  return jsonb_build_object('ok',true,'status',200,'nativeMemberAccess',1,'action',p_action,'scope',jsonb_build_object('teamName',p_team,'leagueName',p_league,'flight',p_flight),'targetId',p_target,'operationId',p_operation,'applied',true,'replayed',true,'superseded',review is null or review->'expected' is distinct from operation.after_version);
 end if;
 perform 1 from public.team_profile_links where profile_user_id=p_target and normalized_team_name=normalized and league_name=p_league and flight=p_flight for update;
 select * into participant from public.internal_conversation_participants where conversation_id=room.id and profile_id=p_target for update;
 select * into removal from public.team_room_member_removals where conversation_id=room.id and profile_id=p_target for update;
 review:=private.native_team_member_review(p_owner,room.id,normalized,p_league,p_flight,p_target);
 if review is null then return jsonb_build_object('ok',false,'status',404); end if;
 if review->'expected' is distinct from p_expected then return jsonb_build_object('ok',false,'status',409); end if;
 if not coalesce((review->>case when p_action='remove' then 'canRemove' else 'canRestore' end)::boolean,false) then return jsonb_build_object('ok',false,'status',403); end if;
 if p_action='remove' then
  insert into public.team_room_member_removals(conversation_id,profile_id,removed_by_user_id,removed_at,saved_last_read_at,saved_muted) values(room.id,p_target,p_owner,clock_timestamp(),participant.last_read_at,participant.muted);
  delete from public.internal_conversation_participants where conversation_id=room.id and profile_id=p_target;
 else
  delete from public.team_room_member_removals where conversation_id=room.id and profile_id=p_target;
  insert into public.internal_conversation_participants(conversation_id,profile_id,participant_role,last_read_at,muted) values(room.id,p_target,'member',removal.saved_last_read_at,coalesce(removal.saved_muted,true)) on conflict(conversation_id,profile_id) do nothing;
 end if;
 after_review:=private.native_team_member_review(p_owner,room.id,normalized,p_league,p_flight,p_target);
 -- One content-free invalidation per committed human action; none on replay or idle.
 insert into public.team_chat_signals as s(conversation_id) values(room.id) on conflict(conversation_id) do update set revision=s.revision+1,changed_at=clock_timestamp();
 insert into public.team_room_access_operations(id,conversation_id,actor_id,target_id,action,expected,after_version) values(p_operation,room.id,p_owner,p_target,p_action,p_expected,after_review->'expected');
 return jsonb_build_object('ok',true,'status',200,'nativeMemberAccess',1,'action',p_action,'scope',jsonb_build_object('teamName',p_team,'leagueName',p_league,'flight',p_flight),'targetId',p_target,'operationId',p_operation,'applied',true,'replayed',false,'superseded',false);
exception when others then
 raise warning 'native_team_member_access failed [%]',sqlstate;
 return jsonb_build_object('ok',false,'status',503);
end;
$$;
revoke all on function public.native_team_member_access(uuid,text,text,text,text,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.native_team_member_access(uuid,text,text,text,text,uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
