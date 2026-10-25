-- Existing server role only; atomic RSVP + schedule response, no notifications or new table grants.
create or replace function public.native_reply_practice(p_owner uuid,p_team text,p_league text,p_flight text,p_event uuid,p_event_revision text,p_person uuid,p_revision text,p_response text,p_note text)
returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public set lock_timeout='3s'
as $$
declare
 room public.internal_conversations%rowtype; practice public.internal_schedule_events%rowtype; person public.captain_practice_invitees%rowtype; invitation public.captain_practice_invites%rowtype; scope_id text; total integer; stamp timestamptz;
begin
 if p_owner is null or p_event is null or p_person is null or p_team is null or p_league is null or p_flight is null or btrim(p_team)='' or btrim(p_league)='' or length(p_team)>160 or length(p_league)>160 or length(p_flight)>120 or p_response is null or p_response not in ('in','out','maybe') or p_note is null or length(p_note)>300 or p_note<>btrim(p_note) or p_revision is null or p_event_revision is null or length(p_revision)>80 or length(p_event_revision)>80 then return jsonb_build_object('ok',false,'status',400); end if;
 scope_id:=concat_ws('__',btrim(regexp_replace(lower(p_team),'[^a-z0-9]+',' ','g')),btrim(regexp_replace(lower(p_league),'[^a-z0-9]+',' ','g')),btrim(regexp_replace(lower(p_flight),'[^a-z0-9]+',' ','g')));
 select * into room from public.internal_conversations where related_entity_type='team_room' and related_entity_id=scope_id for share;
 if room.id is null or room.status='closed' then return jsonb_build_object('ok',false,'status',403); end if;
 perform id from public.team_profile_links where profile_user_id=p_owner and normalized_team_name=btrim(regexp_replace(lower(p_team),'[^a-z0-9]+',' ','g')) and league_name=p_league and flight=p_flight and status='accepted' and archived_at is null for share;
 get diagnostics total=row_count;
 if total<>1 or exists(select 1 from public.team_room_member_removals where conversation_id=room.id and profile_id=p_owner) or not exists(select 1 from public.internal_conversation_participants where conversation_id=room.id and profile_id=p_owner) then return jsonb_build_object('ok',false,'status',403); end if;
 -- Lock the parent before the child so cancellation/editing cannot cross a native RSVP commit.
 select * into practice from public.internal_schedule_events where id=p_event for update;
 if practice.id is null or practice.event_type<>'captain_practice' or practice.metadata->>'teamName' is distinct from p_team or practice.metadata->>'leagueName' is distinct from p_league or practice.metadata->>'flight' is distinct from p_flight then return jsonb_build_object('ok',false,'status',404); end if;
 if practice.status not in ('proposed','confirmed') or practice.updated_at is distinct from p_event_revision::timestamptz then return jsonb_build_object('ok',false,'status',409); end if;
 select * into invitation from public.captain_practice_invites where event_id=p_event;
 if invitation.id is null or invitation.created_by_user_id is distinct from practice.created_by_user_id then return jsonb_build_object('ok',false,'status',409); end if;
 select count(*) into total from public.captain_practice_invitees where event_id=p_event and profile_id=p_owner;
 if total<>1 then return jsonb_build_object('ok',false,'status',409); end if;
 select * into person from public.captain_practice_invitees where id=p_person and event_id=p_event and invite_id=invitation.id and profile_id=p_owner for update;
 if person.id is null then return jsonb_build_object('ok',false,'status',403); end if;
 -- An identical current state is a read-only replay, preserving queue time and confirmations.
 if person.response_status=p_response and person.note=p_note and (p_response='in' or person.captain_confirmed_at is null and person.captain_confirmed_by_user_id is null) and exists(select 1 from public.internal_schedule_event_responses where event_id=p_event and profile_id=p_owner and response_status=p_response and note=p_note) then return jsonb_build_object('ok',true,'status',200,'nativePracticeReply',1,'eventId',p_event); end if;
 if person.updated_at is distinct from p_revision::timestamptz then return jsonb_build_object('ok',false,'status',409); end if;
 stamp:=clock_timestamp();
 update public.captain_practice_invitees set response_status=p_response,note=p_note,responded_at=stamp,updated_at=stamp,captain_confirmed_at=case when p_response='in' then captain_confirmed_at else null end,captain_confirmed_by_user_id=case when p_response='in' then captain_confirmed_by_user_id else null end where id=person.id;
 insert into public.internal_schedule_event_responses(event_id,profile_id,response_status,note,updated_at) values(p_event,p_owner,p_response,p_note,stamp) on conflict(event_id,profile_id) do update set response_status=excluded.response_status,note=excluded.note,updated_at=excluded.updated_at;
 return jsonb_build_object('ok',true,'status',200,'nativePracticeReply',1,'eventId',p_event);
exception when invalid_datetime_format or datetime_field_overflow then return jsonb_build_object('ok',false,'status',400);
when others then raise warning 'native_reply_practice failed [%]',sqlstate;return jsonb_build_object('ok',false,'status',503);
end;
$$;
revoke all on function public.native_reply_practice(uuid,text,text,text,uuid,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.native_reply_practice(uuid,text,text,text,uuid,text,uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
