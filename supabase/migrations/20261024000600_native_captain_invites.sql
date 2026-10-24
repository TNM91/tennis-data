-- Existing service role only. Each create identity is its invite row; revocation targets one reviewed row.
create or replace function public.native_captain_invites(p_owner uuid,p_team text,p_league text,p_flight text,p_action text,p_id uuid default null)
returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public set lock_timeout='3s'
as $$
declare
 room public.internal_conversations%rowtype;
 link public.team_profile_links%rowtype;
 invitation public.team_room_invites%rowtype;
 scope_id text;
 normalized text;
 rows jsonb;
 total integer;
begin
 if p_action is null or p_action not in ('list','create','revoke') or p_team is null or p_league is null or p_flight is null or btrim(p_team)='' or btrim(p_league)='' or length(p_team)>160 or length(p_league)>160 or length(p_flight)>80 or (p_action<>'list' and p_id is null) then
  return jsonb_build_object('ok',false,'status',400);
 end if;
 normalized:=btrim(regexp_replace(lower(p_team),'[^a-z0-9]+',' ','g'));
 scope_id:=concat_ws('__',normalized,btrim(regexp_replace(lower(p_league),'[^a-z0-9]+',' ','g')),btrim(regexp_replace(lower(p_flight),'[^a-z0-9]+',' ','g')));
 -- Lock the room before checking removal and captain authority, matching the join flow's room boundary.
 if p_action='list' then select * into room from public.internal_conversations where related_entity_type='team_room' and related_entity_id=scope_id;
 else select * into room from public.internal_conversations where related_entity_type='team_room' and related_entity_id=scope_id for update; end if;
 if room.id is null or room.status='closed' then return jsonb_build_object('ok',false,'status',403); end if;
 select * into link from public.team_profile_links where profile_user_id=p_owner and normalized_team_name=normalized and league_name=p_league and flight=p_flight and status='accepted' and archived_at is null and coalesce(team_roles,array[team_role]) && array['captain','co_captain']::text[] for share;
 if link.id is null or exists(select 1 from public.team_room_member_removals where conversation_id=room.id and profile_id=p_owner) or not exists(select 1 from public.internal_conversation_participants where conversation_id=room.id and profile_id=p_owner) then return jsonb_build_object('ok',false,'status',403); end if;
 if p_action<>'list' then
  select * into invitation from public.team_room_invites where id=p_id for update;
  if invitation.id is not null and (invitation.created_by_user_id<>p_owner or invitation.conversation_id<>room.id or invitation.normalized_team_name<>normalized or invitation.team_name<>p_team or invitation.league_name<>p_league or invitation.flight<>p_flight) then return jsonb_build_object('ok',false,'status',409); end if;
  if p_action='create' and invitation.id is null then
   if (select count(*) from public.team_room_invites where created_by_user_id=p_owner and conversation_id=room.id and revoked_at is null and expires_at>clock_timestamp())>=5 then return jsonb_build_object('ok',false,'status',409,'message','Revoke an unused link before creating another.'); end if;
   insert into public.team_room_invites(id,created_by_user_id,conversation_id,team_name,normalized_team_name,league_name,flight,expires_at)
   values(p_id,p_owner,room.id,p_team,normalized,p_league,p_flight,clock_timestamp()+interval '30 days') returning * into invitation;
  elsif p_action='revoke' then
   if invitation.id is null then return jsonb_build_object('ok',false,'status',404); end if;
   update public.team_room_invites set revoked_at=coalesce(revoked_at,clock_timestamp()) where id=p_id returning * into invitation;
  end if;
  return jsonb_build_object('ok',true,'status',200,'nativeCaptainInvites',1,'action',p_action,'operationId',p_id,'scope',jsonb_build_object('teamName',p_team,'leagueName',p_league,'flight',p_flight),'invite',jsonb_build_object('id',invitation.id,'token',invitation.invite_token,'expiresAt',invitation.expires_at,'revokedAt',invitation.revoked_at,'acceptedCount',invitation.accepted_count,'active',invitation.revoked_at is null and invitation.expires_at>clock_timestamp()));
 end if;
 select count(*) into total from public.team_room_invites where created_by_user_id=p_owner and conversation_id=room.id and team_name=p_team and league_name=p_league and flight=p_flight;
 select coalesce(jsonb_agg(x.row order by x.active desc,x.created desc,x.id desc),'[]'::jsonb) into rows from (
 select id,created_at created,(revoked_at is null and expires_at>clock_timestamp()) active,jsonb_build_object('id',id,'token',invite_token,'expiresAt',expires_at,'revokedAt',revoked_at,'acceptedCount',accepted_count,'active',revoked_at is null and expires_at>clock_timestamp()) row
 from public.team_room_invites where created_by_user_id=p_owner and conversation_id=room.id and team_name=p_team and league_name=p_league and flight=p_flight
 order by (revoked_at is null and expires_at>clock_timestamp()) desc,created_at desc,id desc limit 20) x;
 return jsonb_build_object('ok',true,'status',200,'nativeCaptainInvites',1,'action','list','scope',jsonb_build_object('teamName',p_team,'leagueName',p_league,'flight',p_flight),'invites',rows,'more',total>20);
exception when others then
 raise warning 'native_captain_invites failed [%]',sqlstate;
 return jsonb_build_object('ok',false,'status',503);
end;
$$;
revoke all on function public.native_captain_invites(uuid,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.native_captain_invites(uuid,text,text,text,text,uuid) to service_role;
notify pgrst,'reload schema';
