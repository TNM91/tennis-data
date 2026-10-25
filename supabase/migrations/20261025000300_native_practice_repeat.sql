-- Explicit exact-scope repeat preparation. No new table grants, messages or notifications.
create or replace function public.native_repeat_practice(p_owner uuid,p_team text,p_league text,p_flight text,p_action text,p_source uuid,p_id uuid default null,p_revision text default null,p_snapshot text default null,p_date text default null)
returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public set lock_timeout='3s'
as $$
declare
 room public.internal_conversations%rowtype; source public.internal_schedule_events%rowtype; child public.internal_schedule_events%rowtype; invitation public.captain_practice_invites%rowtype; new_invite public.captain_practice_invites%rowtype;
 total integer; scope_id text; identities jsonb; roster jsonb; responses jsonb; fingerprint text; receipt jsonb; next_date date; days integer; today date := (now() at time zone 'America/Chicago')::date;
begin
 if p_owner is null or p_source is null or p_action is null or p_action not in ('preview','create','lookup') or p_team is null or p_league is null or p_flight is null or btrim(p_team)='' or btrim(p_league)='' or length(p_team)>160 or length(p_league)>160 or length(p_flight)>120 then return jsonb_build_object('ok',false,'status',400); end if;
 if p_action<>'preview' and (p_id is null or p_id=p_source or p_revision is null or length(p_revision)>80 or p_snapshot is null or p_snapshot !~ '^[a-f0-9]{32}$' or p_date is null or p_date !~ '^\d{4}-\d{2}-\d{2}$') then return jsonb_build_object('ok',false,'status',400); end if;
 scope_id:=concat_ws('__',btrim(regexp_replace(lower(p_team),'[^a-z0-9]+',' ','g')),btrim(regexp_replace(lower(p_league),'[^a-z0-9]+',' ','g')),btrim(regexp_replace(lower(p_flight),'[^a-z0-9]+',' ','g')));
 select * into room from public.internal_conversations where related_entity_type='team_room' and related_entity_id=scope_id for update;
 if room.id is null or room.status='closed' then return jsonb_build_object('ok',false,'status',403); end if;
 perform id from public.team_profile_links where profile_user_id=p_owner and normalized_team_name=btrim(regexp_replace(lower(p_team),'[^a-z0-9]+',' ','g')) and league_name=p_league and flight=p_flight and status='accepted' and archived_at is null order by id limit 2 for share;
 get diagnostics total=row_count;
 if total<>1 or not exists(select 1 from public.team_profile_links where profile_user_id=p_owner and normalized_team_name=btrim(regexp_replace(lower(p_team),'[^a-z0-9]+',' ','g')) and league_name=p_league and flight=p_flight and status='accepted' and archived_at is null and (case when cardinality(team_roles)>0 then team_roles else array[team_role] end) && array['captain','co_captain']::text[]) or exists(select 1 from public.team_room_member_removals where conversation_id=room.id and profile_id=p_owner) or not exists(select 1 from public.internal_conversation_participants where conversation_id=room.id and profile_id=p_owner) then return jsonb_build_object('ok',false,'status',403); end if;
 -- This is also the lock used by the website repeat worker: only one child per source.
 select * into source from public.internal_schedule_events where id=p_source for update;
 if source.id is null or source.created_by_user_id is distinct from p_owner or source.event_type<>'captain_practice' or source.metadata->>'teamName' is distinct from p_team or source.metadata->>'leagueName' is distinct from p_league or source.metadata->>'flight' is distinct from p_flight then return jsonb_build_object('ok',false,'status',404); end if;
 receipt:=jsonb_build_object('requestId',p_id,'sourceId',p_source,'sourceRevision',p_revision,'snapshot',p_snapshot,'nextDate',p_date);
 if p_action<>'preview' then
  select * into child from public.internal_schedule_events where id=p_id for update;
  if child.id is not null then
   if child.created_by_user_id is distinct from p_owner or child.event_type<>'captain_practice' or child.metadata->>'teamName' is distinct from p_team or child.metadata->>'leagueName' is distinct from p_league or child.metadata->>'flight' is distinct from p_flight or child.metadata->'nativePracticeRepeat' is distinct from receipt or child.metadata->>'previousPracticeId' is distinct from p_source::text or source.metadata->>'nextPracticeId' is distinct from p_id::text or not exists(select 1 from public.captain_practice_invites where event_id=p_id and created_by_user_id=p_owner) then return jsonb_build_object('ok',false,'status',409); end if;
   return jsonb_build_object('ok',true,'status',200,'nativePracticeRepeat',1,'eventId',p_id,'sourceId',p_source,'requestId',p_id);
  end if;
  if p_action='lookup' then return jsonb_build_object('ok',false,'status',404); end if;
 end if;
 if source.metadata ? 'nextPracticeId' then
  if p_action<>'preview' then return jsonb_build_object('ok',false,'status',409); end if;
  return jsonb_build_object('ok',true,'status',200,'nativePracticeRepeat',1,'existingEventId',source.metadata->>'nextPracticeId');
 end if;
 if source.status not in ('proposed','confirmed','completed') or source.recurrence_rule not in ('weekly','biweekly') or source.recurrence_rule is null then return jsonb_build_object('ok',false,'status',409); end if;
 if source.scheduled_date is null then return jsonb_build_object('ok',false,'status',409); end if;
 if source.scheduled_date>=today then
  if p_action<>'preview' then return jsonb_build_object('ok',false,'status',409); end if;
  return jsonb_build_object('ok',true,'status',200,'nativePracticeRepeat',1,'notDue',true,'sourceDate',source.scheduled_date);
 end if;
 days:=case when source.recurrence_rule='weekly' then 7 else 14 end;
 next_date:=source.scheduled_date+(((today-source.scheduled_date+days-1)/days)*days);
 select * into invitation from public.captain_practice_invites where event_id=p_source for share;
 if invitation.id is null or invitation.created_by_user_id is distinct from p_owner then return jsonb_build_object('ok',false,'status',409); end if;
 -- Lock roster identities, not just a response count. Replies are deliberately excluded from the snapshot.
 perform id from public.captain_practice_invitees where invite_id=invitation.id and event_id=p_source order by id limit 251 for share;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'playerId',r.player_id,'profileId',r.profile_id,'name',r.player_name,'normalizedName',r.normalized_name) order by r.id),'[]'::jsonb) into identities from (select id,player_id,profile_id,player_name,normalized_name from public.captain_practice_invitees where invite_id=invitation.id and event_id=p_source order by id limit 251) r;
 if jsonb_array_length(identities)<1 or jsonb_array_length(identities)>250 or exists(select 1 from jsonb_array_elements(identities) r where btrim(coalesce(r->>'name',''))='' or length(r->>'name')>300) then return jsonb_build_object('ok',false,'status',409); end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r->>'id','name',r->>'name') order by r->>'id'),'[]'::jsonb) into roster from jsonb_array_elements(identities) r;
 select coalesce(jsonb_agg(r.profile_id order by r.profile_id),'[]'::jsonb) into responses from (select profile_id from public.internal_schedule_event_responses where event_id=p_source order by profile_id limit 252) r;
 if jsonb_array_length(responses)>251 then return jsonb_build_object('ok',false,'status',409); end if;
 fingerprint:=md5(jsonb_build_object('source',to_jsonb(source),'invitation',to_jsonb(invitation)-'public_token','identities',identities,'responseProfiles',responses,'nextDate',next_date)::text);
 if p_action='preview' then return jsonb_build_object('ok',true,'status',200,'nativePracticeRepeat',1,'preview',jsonb_build_object('sourceId',p_source,'sourceRevision',source.updated_at,'snapshot',fingerprint,'nextDate',next_date,'title',source.title,'time',coalesce(source.scheduled_time,''),'endTime',coalesce(source.metadata->>'practiceEndTime',''),'facility',coalesce(source.facility,''),'focus',coalesce(source.metadata->>'practiceNotes',''),'recurrence',source.recurrence_rule,'capacity',invitation.capacity,'roster',roster)); end if;
 if source.updated_at is distinct from p_revision::timestamptz or fingerprint<>p_snapshot or next_date::text<>p_date then return jsonb_build_object('ok',false,'status',409); end if;
 insert into public.internal_schedule_events(id,conversation_id,event_type,title,scheduled_date,scheduled_time,facility,recurrence_rule,status,source_entity_type,source_entity_id,created_by_user_id,metadata) values(p_id,source.conversation_id,'captain_practice',source.title,next_date,source.scheduled_time,source.facility,source.recurrence_rule,'proposed',source.source_entity_type,source.source_entity_id||'-'||next_date::text,p_owner,(source.metadata-array['nextPracticeId','nativePracticeCreate','nativePracticeEdit','nativePracticeCancel','nativePracticeRepeat'])||jsonb_build_object('scheduleDate',next_date::text,'previousPracticeId',p_source::text,'nativePracticeRepeat',receipt));
 insert into public.captain_practice_invites(event_id,capacity,created_by_user_id) values(p_id,invitation.capacity,p_owner) returning * into new_invite;
 -- Omit phone, responses, notes and captain confirmations; no new membership or conversation.
 insert into public.captain_practice_invitees(invite_id,event_id,player_id,profile_id,player_name,normalized_name) select new_invite.id,p_id,r->>'playerId',nullif(r->>'profileId','')::uuid,r->>'name',r->>'normalizedName' from jsonb_array_elements(identities) r;
 insert into public.internal_schedule_event_responses(event_id,profile_id) select p_id,(r#>>'{}')::uuid from jsonb_array_elements(responses) r;
 update public.internal_schedule_events set metadata=metadata||jsonb_build_object('publicToken',new_invite.public_token::text) where id=p_id;
 update public.internal_schedule_events set metadata=metadata||jsonb_build_object('nextPracticeId',p_id::text),updated_at=clock_timestamp() where id=p_source;
 return jsonb_build_object('ok',true,'status',200,'nativePracticeRepeat',1,'eventId',p_id,'sourceId',p_source,'requestId',p_id);
exception when invalid_datetime_format or datetime_field_overflow then return jsonb_build_object('ok',false,'status',400);
when others then raise warning 'native_repeat_practice failed [%]',sqlstate;return jsonb_build_object('ok',false,'status',503);
end;
$$;
revoke all on function public.native_repeat_practice(uuid,text,text,text,text,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.native_repeat_practice(uuid,text,text,text,text,uuid,uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
