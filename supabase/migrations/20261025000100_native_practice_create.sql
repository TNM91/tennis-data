-- Atomic native practice creation. Only the existing server role can call this routine.
-- No SECURITY DEFINER, new table grants, automatic notifications or external sends.
create or replace function public.native_create_practice(p_owner uuid,p_team text,p_league text,p_flight text,p_action text,p_id uuid default null,p_fields jsonb default null,p_capacity integer default null,p_roster jsonb default null)
returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public set lock_timeout='3s'
as $$
declare
 room public.internal_conversations%rowtype;
 link public.team_profile_links%rowtype;
 practice public.internal_schedule_events%rowtype;
 invitation public.captain_practice_invites%rowtype;
 roster jsonb; profile_map jsonb; item jsonb; member uuid; members uuid[]; conversation uuid; scope_id text; normalized text; name_key text; notes text; receipt jsonb;
begin
 if p_owner is null or p_action is null or p_action not in ('preview','create','lookup') or p_team is null or p_league is null or p_flight is null or btrim(p_team)='' or btrim(p_league)='' or length(p_team)>160 or length(p_league)>160 or length(p_flight)>120 then return jsonb_build_object('ok',false,'status',400); end if;
 normalized:=btrim(regexp_replace(lower(p_team),'[^a-z0-9]+',' ','g'));
 scope_id:=concat_ws('__',normalized,btrim(regexp_replace(lower(p_league),'[^a-z0-9]+',' ','g')),btrim(regexp_replace(lower(p_flight),'[^a-z0-9]+',' ','g')));
 select * into room from public.internal_conversations where related_entity_type='team_room' and related_entity_id=scope_id for update;
 if room.id is null or room.status='closed' then return jsonb_build_object('ok',false,'status',403); end if;
 select * into link from public.team_profile_links where profile_user_id=p_owner and normalized_team_name=normalized and league_name=p_league and flight=p_flight and status='accepted' and archived_at is null and (case when cardinality(team_roles)>0 then team_roles else array[team_role] end) && array['captain','co_captain']::text[] for share;
 if link.id is null or exists(select 1 from public.team_room_member_removals where conversation_id=room.id and profile_id=p_owner) or not exists(select 1 from public.internal_conversation_participants where conversation_id=room.id and profile_id=p_owner) then return jsonb_build_object('ok',false,'status',403); end if;
 if p_action<>'preview' then
  if p_id is null or jsonb_typeof(p_fields) is distinct from 'object' or not (p_fields ?& array['date','time','endTime','facility','focus','recurrence']) or jsonb_typeof(p_roster) is distinct from 'array' or jsonb_array_length(p_roster)<1 or jsonb_array_length(p_roster)>200 or p_capacity is not null and (p_capacity<1 or p_capacity>100) then return jsonb_build_object('ok',false,'status',400); end if;
  if exists(select 1 from jsonb_each(p_fields) f where f.key in ('date','time','endTime','facility','focus','recurrence') and jsonb_typeof(f.value)<>'string') or p_fields->>'date' !~ '^\d{4}-\d{2}-\d{2}$' or to_char((p_fields->>'date')::date,'YYYY-MM-DD')<>p_fields->>'date' or p_fields->>'time' !~ '^$|^([01][0-9]|2[0-3]):[0-5][0-9]$' or p_fields->>'endTime' !~ '^$|^([01][0-9]|2[0-3]):[0-5][0-9]$' or (p_fields->>'endTime'<>'' and (p_fields->>'time'='' or p_fields->>'endTime'<=p_fields->>'time')) or length(p_fields->>'facility')>300 or length(p_fields->>'focus')>3000 or p_fields->>'recurrence' not in ('','weekly','biweekly') then return jsonb_build_object('ok',false,'status',400); end if;
  receipt:=jsonb_build_object('requestId',p_id,'fields',p_fields,'capacity',p_capacity,'roster',p_roster);
  select * into practice from public.internal_schedule_events where id=p_id for update;
  if practice.id is not null then
   if practice.created_by_user_id<>p_owner or practice.event_type<>'captain_practice' or practice.metadata->>'teamName' is distinct from p_team or practice.metadata->>'leagueName' is distinct from p_league or practice.metadata->>'flight' is distinct from p_flight or practice.metadata->'nativePracticeCreate' is distinct from receipt or practice.status not in ('proposed','confirmed') or practice.scheduled_date::text<>p_fields->>'date' or practice.scheduled_time<>p_fields->>'time' or practice.facility<>p_fields->>'facility' or practice.recurrence_rule<>p_fields->>'recurrence' or practice.metadata->>'practiceEndTime' is distinct from p_fields->>'endTime' or practice.metadata->>'practiceNotes' is distinct from p_fields->>'focus' then return jsonb_build_object('ok',false,'status',409); end if;
   select * into invitation from public.captain_practice_invites where event_id=practice.id and created_by_user_id=p_owner;
   if invitation.id is null or invitation.capacity is distinct from p_capacity then return jsonb_build_object('ok',false,'status',409); end if;
   return jsonb_build_object('ok',true,'status',200,'nativePracticeCreate',1,'eventId',practice.id,'publicToken',invitation.public_token,'rosterCount',jsonb_array_length(p_roster));
  end if;
  if p_action='lookup' then return jsonb_build_object('ok',false,'status',404); end if;
 end if;
 -- Exact roster scope, bounded before aggregation; duplicate normalized names need captain review.
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id::text,'playerId',coalesce(r.player_id::text,''),'name',r.player_name) order by r.id),'[]'::jsonb) into roster from (select id,player_id,player_name from public.team_roster_members where normalized_team_name=public.normalize_team_membership_text(p_team) and league_name=p_league and flight=p_flight order by id limit 201) r;
 if jsonb_array_length(roster)<1 or jsonb_array_length(roster)>200 or exists(select 1 from jsonb_array_elements(roster) r where btrim(coalesce(r->>'name',''))='' or btrim(regexp_replace(lower(btrim(r->>'name')),'[^a-z0-9]+',' ','g'))='' or length(r->>'name')>300) or exists(select 1 from jsonb_array_elements(roster) r group by left(btrim(regexp_replace(lower(btrim(r->>'name')),'[^a-z0-9]+',' ','g')),160) having count(*)>1) then return jsonb_build_object('ok',false,'status',409,'message','Review the team roster before creating practice.'); end if;
 if p_action='preview' then return jsonb_build_object('ok',true,'status',200,'nativePracticeCreate',1,'roster',roster); end if;
 if p_roster<>roster then return jsonb_build_object('ok',false,'status',409); end if;
 -- Resolve linked profiles once for the bounded roster, never by player name.
 select coalesce(jsonb_object_agg(player_key,profile_id),'{}'::jsonb) into profile_map from (select d.linked_player_id::text player_key,case when count(*)=1 then min(d.id::text) else null end profile_id from public.internal_message_directory d where d.linked_player_id::text in (select r->>'playerId' from jsonb_array_elements(roster) r where r->>'playerId'<>'') group by d.linked_player_id) linked where profile_id is not null;
 conversation:=gen_random_uuid();members:=array[p_owner];
 insert into public.internal_conversations(id,conversation_type,subject,status,created_by_user_id,related_entity_type,related_entity_id,metadata) values(conversation,'league',p_team||' practice','open',p_owner,'captain_practice',p_id::text,jsonb_build_object('teamName',p_team,'leagueName',p_league,'flight',p_flight,'scheduleDate',p_fields->>'date','scheduleTime',p_fields->>'time','scheduleEndTime',p_fields->>'endTime','facility',p_fields->>'facility','recurrenceRule',p_fields->>'recurrence','capacity',coalesce(p_capacity::text,'')));
 insert into public.internal_schedule_events(id,conversation_id,event_type,title,scheduled_date,scheduled_time,facility,recurrence_rule,status,source_entity_type,source_entity_id,created_by_user_id,metadata) values(p_id,conversation,'captain_practice',p_team||' practice',(p_fields->>'date')::date,p_fields->>'time',p_fields->>'facility',p_fields->>'recurrence','proposed','captain_practice',p_id::text,p_owner,jsonb_build_object('teamName',p_team,'leagueName',p_league,'flight',p_flight,'practiceNotes',p_fields->>'focus','practiceEndTime',p_fields->>'endTime','scheduleEndTime',p_fields->>'endTime','capacity',coalesce(p_capacity::text,''),'nativePracticeCreate',receipt));
 insert into public.captain_practice_invites(event_id,capacity,created_by_user_id) values(p_id,p_capacity,p_owner) returning * into invitation;
 for item in select * from jsonb_array_elements(roster) loop
  member:=nullif(profile_map->>(item->>'playerId'),'')::uuid;
  if member is not null and not member=any(members) then members:=array_append(members,member); end if;
  name_key:=left(btrim(regexp_replace(lower(btrim(item->>'name')),'[^a-z0-9]+',' ','g')),160);
  if name_key='' then raise exception 'Practice player name cannot be normalized'; end if;
  insert into public.captain_practice_invitees(invite_id,event_id,player_id,profile_id,player_name,normalized_name,response_status,responded_at) values(invitation.id,p_id,item->>'playerId',member,item->>'name',name_key,case when member=p_owner then 'in' else 'unanswered' end,case when member=p_owner then clock_timestamp() else null end);
 end loop;
 insert into public.internal_conversation_participants(conversation_id,profile_id,participant_role) select conversation,m,'member' from unnest(members) m;
 insert into public.internal_schedule_event_responses(event_id,profile_id,response_status) select p_id,m,case when m=p_owner then 'in' else 'unanswered' end from unnest(members) m;
 notes:=concat_ws(E'\n','Practice: '||p_team,'League: '||p_league,case when p_flight<>'' then 'Flight: '||p_flight end,'Date: '||(p_fields->>'date'),case when p_fields->>'time'<>'' then 'Time: '||(p_fields->>'time')||case when p_fields->>'endTime'<>'' then '–'||(p_fields->>'endTime') else '' end end,case when p_fields->>'facility'<>'' then 'Site: '||(p_fields->>'facility') end,case when p_fields->>'recurrence'<>'' then 'Repeats: '||(p_fields->>'recurrence') end,case when p_fields->>'focus'<>'' then 'Notes: '||(p_fields->>'focus') end,case when p_capacity is not null then 'Spots: '||p_capacity::text end,'Please mark In, Out, or Maybe so the captain knows who can make it.');
 insert into public.internal_messages(conversation_id,sender_user_id,body,message_kind) values(conversation,p_owner,notes,'message');
 update public.internal_schedule_events set metadata=metadata||jsonb_build_object('publicToken',invitation.public_token::text) where id=p_id;
 return jsonb_build_object('ok',true,'status',200,'nativePracticeCreate',1,'eventId',p_id,'publicToken',invitation.public_token,'rosterCount',jsonb_array_length(roster));
exception when invalid_datetime_format or datetime_field_overflow then return jsonb_build_object('ok',false,'status',400);
when others then raise warning 'native_create_practice failed [%]',sqlstate;return jsonb_build_object('ok',false,'status',503);
end;
$$;
revoke all on function public.native_create_practice(uuid,text,text,text,text,uuid,jsonb,integer,jsonb) from public,anon,authenticated;
grant execute on function public.native_create_practice(uuid,text,text,text,text,uuid,jsonb,integer,jsonb) to service_role;
notify pgrst,'reload schema';
