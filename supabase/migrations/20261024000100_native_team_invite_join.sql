-- Atomic native invite review/join. Only the existing server role may call this function.
-- No new table, policy, client grant, alert opt-in, or availability response is introduced.
create or replace function public.native_team_invite(p_owner uuid, p_token uuid, p_join boolean default false, p_expected jsonb default null)
returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public
set lock_timeout = '3s'
as $$
declare
  invitation public.team_room_invites%rowtype;
  membership public.team_profile_links%rowtype;
  person public.profiles%rowtype;
  room public.internal_conversations%rowtype;
  active boolean;
  first_team boolean;
  scope_id text;
  expected jsonb;
  review jsonb;
  display_name text;
  inserted_id uuid;
begin
  -- Serialize joins for one person, including joins through different invite links.
  if p_join then select * into person from public.profiles where id=p_owner for update;
  else select * into person from public.profiles where id=p_owner; end if;
  if person.id is null then return jsonb_build_object('ok',false,'status',503,'message','Your profile could not be checked.'); end if;
  if p_join then select * into invitation from public.team_room_invites where invite_token=p_token for update;
  else select * into invitation from public.team_room_invites where invite_token=p_token; end if;
  if invitation.id is null or invitation.revoked_at is not null or invitation.expires_at<=clock_timestamp() then
    return jsonb_build_object('ok',false,'status',404,'message','This team invite has expired or is no longer active.');
  end if;
  scope_id := concat_ws('__',btrim(regexp_replace(lower(invitation.team_name),'[^a-z0-9]+',' ','g')),btrim(regexp_replace(lower(invitation.league_name),'[^a-z0-9]+',' ','g')),btrim(regexp_replace(lower(invitation.flight),'[^a-z0-9]+',' ','g')));
  -- The room lock also orders concurrent FK-backed removal inserts before/after joining.
  if p_join then select * into room from public.internal_conversations where id=invitation.conversation_id for update;
  else select * into room from public.internal_conversations where id=invitation.conversation_id; end if;
  if room.id is null or room.related_entity_type<>'team_room' or room.related_entity_id<>scope_id or room.status='closed'
    or btrim(invitation.team_name)='' or btrim(invitation.league_name)='' or length(invitation.team_name)>160 or length(invitation.league_name)>160 or length(invitation.flight)>80
    or invitation.normalized_team_name<>btrim(regexp_replace(lower(invitation.team_name),'[^a-z0-9]+',' ','g')) then
    return jsonb_build_object('ok',false,'status',409,'message','This team invite changed. Ask your captain for a current invite.');
  end if;
  if exists(select 1 from public.team_room_member_removals where conversation_id=room.id and profile_id=p_owner) then
    return jsonb_build_object('ok',false,'status',403,'message','Ask your captain to restore your team access before joining.');
  end if;
  if p_join then perform 1 from public.team_profile_links where profile_user_id=invitation.created_by_user_id and normalized_team_name=invitation.normalized_team_name and league_name=invitation.league_name and flight=invitation.flight and status='accepted' and archived_at is null and coalesce(team_roles,array[team_role]) && array['captain','co_captain']::text[] for share;
  else perform 1 from public.team_profile_links where profile_user_id=invitation.created_by_user_id and normalized_team_name=invitation.normalized_team_name and league_name=invitation.league_name and flight=invitation.flight and status='accepted' and archived_at is null and coalesce(team_roles,array[team_role]) && array['captain','co_captain']::text[]; end if;
  if not found then
    return jsonb_build_object('ok',false,'status',404,'message','Ask your captain for a current team invite.');
  end if;
  if p_join then select * into membership from public.team_profile_links where profile_user_id=p_owner and normalized_team_name=invitation.normalized_team_name and league_name=invitation.league_name and flight=invitation.flight for update;
  else select * into membership from public.team_profile_links where profile_user_id=p_owner and normalized_team_name=invitation.normalized_team_name and league_name=invitation.league_name and flight=invitation.flight; end if;
  active := membership.id is not null and membership.status='accepted' and membership.archived_at is null;
  expected := jsonb_build_object('inviteId',invitation.id,'roomId',room.id,'teamName',invitation.team_name,'leagueName',invitation.league_name,'flight',invitation.flight,'expiresAt',invitation.expires_at,'creatorId',invitation.created_by_user_id);
  review := jsonb_build_object('teamName',invitation.team_name,'leagueName',invitation.league_name,'flight',invitation.flight,'roomId',room.id,'expiresAt',invitation.expires_at,'alreadyJoined',active,'expected',expected,'linkVersion',coalesce(membership.updated_at::text,''));
  if not p_join then return jsonb_build_object('ok',true,'status',200,'nativeTeamInvite',1,'review',review); end if;
  -- The user must confirm the same invite scope and expiry they reviewed. Active replays never change membership/settings.
  if p_expected is null or p_expected->'invite' is distinct from expected then
    return jsonb_build_object('ok',false,'status',409,'message','The invite changed. Review it again before joining.');
  end if;
  if not active and p_expected->>'linkVersion' is distinct from coalesce(membership.updated_at::text,'') then
    return jsonb_build_object('ok',false,'status',409,'message','Your team connection changed. Review the invite again.');
  end if;
  if not active then
    first_team := not exists(select 1 from public.team_profile_links where profile_user_id=p_owner and status='accepted');
    -- A player invite cannot accept a pending or previously declined captain role.
    if membership.id is null then
      insert into public.team_profile_links(profile_user_id,source_actor_user_id,team_name,normalized_team_name,league_name,flight,team_role,team_roles,declined_roles,role_accepted_at,source_type,source_record_id,status,accepted_at,unlinked_at,archived_at,is_default,updated_at)
      values(p_owner,invitation.created_by_user_id,invitation.team_name,invitation.normalized_team_name,invitation.league_name,invitation.flight,'player',array['player']::text[],array[]::text[],jsonb_build_object('player',now()),'manual_invite',invitation.id,'accepted',now(),null,null,first_team,now())
      on conflict(profile_user_id,normalized_team_name,league_name,flight) do nothing returning id into inserted_id;
      if inserted_id is null then raise exception using errcode='40001',message='Concurrent team connection'; end if;
    else
      update public.team_profile_links set source_actor_user_id=invitation.created_by_user_id,team_name=invitation.team_name,team_role='player',team_roles=array['player']::text[],declined_roles=array[]::text[],role_accepted_at=jsonb_build_object('player',now()),source_type='manual_invite',source_record_id=invitation.id,status='accepted',accepted_at=now(),unlinked_at=null,archived_at=null,is_default=first_team,updated_at=now() where id=membership.id;
    end if;
    display_name := coalesce(nullif(btrim(person.message_display_name),''),nullif(btrim(person.linked_player_name),''),'A new teammate');
    insert into public.internal_messages(conversation_id,sender_user_id,body,message_kind) values(room.id,p_owner,left(display_name,120)||' joined the Team Room.','system');
    update public.internal_conversations set updated_at=now() where id=room.id;
    update public.team_room_invites set accepted_count=accepted_count+1 where id=invitation.id;
    if first_team then update public.profiles set linked_team_name=invitation.team_name,linked_league_name=invitation.league_name,linked_flight=invitation.flight,linked_team_at=now() where id=p_owner; end if;
  end if;
  insert into public.internal_conversation_participants(conversation_id,profile_id,participant_role)
    values(room.id,p_owner,case when active and coalesce(membership.team_roles,array[membership.team_role]) && array['captain','co_captain']::text[] then 'coordinator' else 'member' end)
    on conflict(conversation_id,profile_id) do nothing;
  insert into public.team_room_member_preferences(conversation_id,profile_id) values(room.id,p_owner) on conflict(conversation_id,profile_id) do nothing;
  return jsonb_build_object('ok',true,'status',200,'nativeTeamInvite',1,'joined',true,'alreadyJoined',active,'roomId',room.id,'scope',jsonb_build_object('teamName',invitation.team_name,'leagueName',invitation.league_name,'flight',invitation.flight));
exception when others then
  -- The exception block rolls back every write above, including membership and join notices.
  raise warning 'native_team_invite failed [%]',sqlstate;
  return jsonb_build_object('ok',false,'status',503,'message','Joining could not be confirmed. Retry the same invite.');
end;
$$;
revoke all on function public.native_team_invite(uuid,uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.native_team_invite(uuid,uuid,boolean,jsonb) to service_role;
notify pgrst, 'reload schema';
