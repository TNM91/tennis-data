begin;
-- Polls are service-only. Every operation rechecks current exact-team and room access.
create table public.team_chat_polls (
 id uuid primary key references public.internal_messages(id) on delete cascade,
 conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
 created_by uuid not null references public.profiles(id),
 question text not null check(length(question) between 1 and 180 and question=btrim(question) and question !~ '[[:cntrl:]]'),
 options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 6),
 closed_at timestamptz,
 created_at timestamptz not null default clock_timestamp()
);
create index team_chat_polls_room_created on public.team_chat_polls(conversation_id,created_at desc);
create table public.team_chat_poll_votes (
 poll_id uuid not null references public.team_chat_polls(id) on delete cascade,
 profile_id uuid not null references public.profiles(id),
 choice integer check(choice between 0 and 5),
 revision integer not null check(revision between 1 and 1000000),
 primary key(poll_id,profile_id)
);
alter table public.team_chat_polls enable row level security;
alter table public.team_chat_poll_votes enable row level security;
revoke all on public.team_chat_polls,public.team_chat_poll_votes from public,anon,authenticated,service_role;
grant select,insert,update on public.team_chat_polls,public.team_chat_poll_votes to service_role;
create or replace function public.native_team_poll(p_owner uuid,p_team text,p_league text,p_flight text,p_room uuid,p_id uuid,p_action text,p_question text default null,p_options jsonb default null,p_choice integer default null,p_expected integer default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public set lock_timeout='3s' set statement_timeout='8s' as $$
declare
 parent public.internal_conversations%rowtype; room public.internal_conversations%rowtype;
 poll public.team_chat_polls%rowtype; ballot public.team_chat_poll_votes%rowtype;
 msg public.internal_messages%rowtype; scope_id text; normalized text; captain boolean;
 labels jsonb; total integer; body_text text; reply jsonb; newly_created boolean:=false;
begin
 if p_owner is null or p_room is null or p_id is null or p_action is null or p_action not in ('get','create','lookup','vote','close') or p_team is null or p_league is null or p_flight is null or btrim(p_team)='' or btrim(p_league)='' or length(p_team)>160 or length(p_league)>160 or length(p_flight)>120 then return jsonb_build_object('ok',false,'status',400); end if;
 if p_action in ('create','lookup') then
  if p_question is null or length(p_question) not between 1 and 180 or p_question<>btrim(p_question) or p_question ~ '[[:cntrl:]]' or p_options is null or jsonb_typeof(p_options)<>'array' then return jsonb_build_object('ok',false,'status',400); end if;
  if jsonb_array_length(p_options) not between 2 and 6 or exists(select 1 from jsonb_array_elements(p_options) e where jsonb_typeof(e)<>'string' or length(e#>>'{}') not between 1 and 80 or e#>>'{}'<>btrim(e#>>'{}') or e#>>'{}' ~ '[[:cntrl:]]') or (select count(distinct lower(regexp_replace(e#>>'{}','[[:space:]]+',' ','g'))) from jsonb_array_elements(p_options) e)<>jsonb_array_length(p_options) then return jsonb_build_object('ok',false,'status',400); end if;
 end if;
 if p_action='vote' and (p_expected is null or p_expected not between 0 and 1000000 or p_choice is not null and p_choice not between 0 and 5) then return jsonb_build_object('ok',false,'status',400); end if;
 normalized:=btrim(regexp_replace(lower(p_team),'[^a-z0-9]+',' ','g'));
 scope_id:=concat_ws('__',normalized,btrim(regexp_replace(lower(p_league),'[^a-z0-9]+',' ','g')),btrim(regexp_replace(lower(p_flight),'[^a-z0-9]+',' ','g')));
 -- Serialize creation limits per team. Every request is explicit; there is no polling job.
 if p_action='create' then
 select * into parent from public.internal_conversations where related_entity_type='team_room' and related_entity_id=scope_id for update;
 else
 select * into parent from public.internal_conversations where related_entity_type='team_room' and related_entity_id=scope_id for share;
 end if;
 if parent.id is null or parent.status<>'open' or parent.metadata->>'teamName' is distinct from p_team or parent.metadata->>'leagueName' is distinct from p_league or coalesce(parent.metadata->>'flight','') is distinct from p_flight or not exists(select 1 from public.internal_conversation_participants where conversation_id=parent.id and profile_id=p_owner) or exists(select 1 from public.team_room_member_removals where conversation_id=parent.id and profile_id=p_owner) then return jsonb_build_object('ok',false,'status',403); end if;
 if not exists(select 1 from public.team_profile_links where profile_user_id=p_owner and normalized_team_name=normalized and team_name=p_team and league_name=p_league and flight=p_flight and status='accepted' and archived_at is null) then return jsonb_build_object('ok',false,'status',403); end if;
 select * into room from public.internal_conversations where id=p_room;
 if room.id is null or room.status<>'open' or (room.id<>parent.id and (room.related_entity_type<>'team_room_chat' or not exists(select 1 from public.team_chat_rooms where conversation_id=room.id and parent_conversation_id=parent.id and team_name=p_team and league_name=p_league and flight=p_flight))) or not exists(select 1 from public.internal_conversation_participants where conversation_id=room.id and profile_id=p_owner) or not private.can_access_team_conversation(room.id,p_owner) then return jsonb_build_object('ok',false,'status',403); end if;
 if (select count(*) from (select 1 from public.internal_conversation_participants where conversation_id=parent.id limit 251) bounded)>250 then return jsonb_build_object('ok',false,'status',409); end if;
 select exists(select 1 from public.team_profile_links where profile_user_id=p_owner and normalized_team_name=normalized and team_name=p_team and league_name=p_league and flight=p_flight and status='accepted' and archived_at is null and (case when cardinality(team_roles)>0 then team_roles else array[team_role] end) && array['captain','co_captain']::text[]) into captain;
 select * into poll from public.team_chat_polls where id=p_id for update;
 if poll.id is not null and poll.conversation_id<>room.id then return jsonb_build_object('ok',false,'status',404); end if;
 if poll.id is null then
  if p_action<>'create' then return jsonb_build_object('ok',false,'status',404); end if;
  if (select count(*) from public.team_chat_polls where conversation_id=room.id and closed_at is null and exists(select 1 from public.internal_messages active where active.id=team_chat_polls.id and active.deleted_at is null))>=5 or (select count(*) from public.team_chat_polls where conversation_id=room.id and created_by=p_owner and created_at>clock_timestamp()-interval '24 hours')>=10 then return jsonb_build_object('ok',false,'status',429); end if;
  select string_agg(ordinality::text||'. '||(value#>>'{}'),E'\n' order by ordinality) into body_text from jsonb_array_elements(p_options) with ordinality;
  body_text:='Poll: '||p_question||E'\n'||body_text||E'\nhttps://www.tenaceiq.com/team-room?poll='||p_id::text;
  insert into public.internal_messages(id,conversation_id,sender_user_id,body,message_kind,metadata) values(p_id,room.id,p_owner,body_text,'message',jsonb_build_object('nativePoll',jsonb_build_object('version',1,'id',p_id)));
  insert into public.team_chat_polls(id,conversation_id,created_by,question,options) values(p_id,room.id,p_owner,p_question,p_options) returning * into poll;
  newly_created:=true;
 elsif p_action in ('create','lookup') and (poll.created_by<>p_owner or poll.question<>p_question or poll.options<>p_options) then return jsonb_build_object('ok',false,'status',409);
 end if;
 select * into msg from public.internal_messages where id=poll.id and conversation_id=room.id;
 if msg.id is null or msg.deleted_at is not null or exists(select 1 from public.team_chat_blocks where owner_user_id=p_owner and blocked_user_id=msg.sender_user_id) then return jsonb_build_object('ok',false,'status',404); end if;
 select * into ballot from public.team_chat_poll_votes where poll_id=p_id and profile_id=p_owner;
 if p_action='close' then
  if poll.created_by<>p_owner and not captain then return jsonb_build_object('ok',false,'status',403); end if;
  if poll.closed_at is null then update public.team_chat_polls set closed_at=clock_timestamp() where id=p_id returning * into poll; end if;
 elsif p_action='vote' then
  if p_choice is not null and p_choice>=jsonb_array_length(poll.options) then return jsonb_build_object('ok',false,'status',400); end if;
  -- Desired-state replay is safe even after closing; a stale different vote cannot overwrite a newer device.
  if ballot.choice is distinct from p_choice then
   if poll.closed_at is not null or coalesce(ballot.revision,0)<>p_expected or coalesce(ballot.revision,0)>=1000000 then return jsonb_build_object('ok',false,'status',409); end if;
   insert into public.team_chat_poll_votes(poll_id,profile_id,choice,revision) values(p_id,p_owner,p_choice,coalesce(ballot.revision,0)+1)
    on conflict(poll_id,profile_id) do update set choice=excluded.choice,revision=excluded.revision returning * into ballot;
  end if;
 end if;
 -- Only totals and the caller's own choice leave the server. Removed/blocked voters are excluded.
 select coalesce(jsonb_agg(jsonb_build_object('label',opt.value#>>'{}','count',(select count(*) from public.team_chat_poll_votes v
 where v.poll_id=p_id and v.choice=opt.ordinality-1
 and exists(select 1 from public.team_profile_links l where l.profile_user_id=v.profile_id and l.team_name=p_team and l.league_name=p_league and l.flight=p_flight and l.status='accepted' and l.archived_at is null)
 and exists(select 1 from public.internal_conversation_participants where conversation_id=parent.id and profile_id=v.profile_id)
 and not exists(select 1 from public.team_room_member_removals where conversation_id=parent.id and profile_id=v.profile_id)
 and not exists(select 1 from public.team_chat_blocks where owner_user_id=p_owner and blocked_user_id=v.profile_id))) order by opt.ordinality),'[]'::jsonb) into labels from jsonb_array_elements(poll.options) with ordinality opt;
 select coalesce(sum((e->>'count')::integer),0)::integer into total from jsonb_array_elements(labels) e;
 reply:=jsonb_build_object('id',poll.id,'roomId',room.id,'question',poll.question,'options',labels,'total',total,'mine',ballot.choice,'revision',coalesce(ballot.revision,0),'closed',poll.closed_at is not null,'canClose',poll.created_by=p_owner or captain);
 return jsonb_build_object('ok',true,'status',200,'teamPoll',1,'created',newly_created,'parentId',parent.id,'owner',p_owner,'scope',jsonb_build_object('teamName',p_team,'leagueName',p_league,'flight',p_flight),'poll',reply);
exception when unique_violation then return jsonb_build_object('ok',false,'status',409);
end;
$$;
revoke all on function public.native_team_poll(uuid,text,text,text,uuid,uuid,text,text,jsonb,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.native_team_poll(uuid,text,text,text,uuid,uuid,text,text,jsonb,integer,integer) to service_role;
commit;
