-- A single server-only request supplies absolute background badge counts.
-- Reuse the installed team-room aggregate; never create rooms or move reads.
create function public.native_chat_badge_counts(p_owners uuid[])
returns table(profile_id uuid, unread integer)
language plpgsql security invoker
set search_path = pg_catalog, public set lock_timeout = '3s'
as $$
declare
 target uuid; scope record; link record; conversation record;
 team_count integer; link_count integer; invalid boolean; total integer;
 room_result jsonb; fingerprint text; expected_id uuid; posts integer; foreign_posts boolean;
 deadline timestamptz := clock_timestamp() + interval '2 seconds';
begin
 if p_owners is null or cardinality(p_owners) not between 1 and 100
  or array_ndims(p_owners) <> 1 or array_position(p_owners,null) is not null
  or (select count(distinct id) from unnest(p_owners) id) <> cardinality(p_owners)
 then raise exception 'Invalid badge recipients' using errcode='22023'; end if;
 for target in select unnest(p_owners) loop
  if clock_timestamp() >= deadline then return; end if;
  -- A failed/incomplete owner is omitted, never reported as zero.
  begin
   if not exists(select 1 from public.profiles p where p.id=target) then continue; end if;
   total := 0;
   select count(*),coalesce(bool_or(team_name is null or btrim(team_name)='' or length(team_name)>160
    or league_name is null or btrim(league_name)='' or length(league_name)>160 or length(coalesce(flight,''))>120),false)
   into team_count,invalid from (
    select team_name,league_name,flight from public.team_profile_links
    where profile_user_id=target and status='accepted' and archived_at is null limit 51
   ) bounded;
   if team_count>50 or invalid then continue; end if;
   for scope in select distinct team_name,league_name,coalesce(flight,'') flight
    from public.team_profile_links where profile_user_id=target and status='accepted' and archived_at is null
   loop
    if clock_timestamp() >= deadline then return; end if;
    room_result := public.native_team_chat_rooms(target,scope.team_name,scope.league_name,scope.flight,'list');
    if room_result->>'ok' is distinct from 'true' then
     if room_result->>'status'='403' then continue; end if;
     raise exception 'Team badge unavailable';
    end if;
    if jsonb_typeof(room_result->'rooms') is distinct from 'array'
     or jsonb_array_length(room_result->'rooms')>12 then raise exception 'Team badge incomplete'; end if;
    total := least(100,total+(room_result->>'generalUnread')::integer
     + coalesce((select sum((r->>'unread')::integer) from jsonb_array_elements(room_result->'rooms') r),0)::integer);
   end loop;
   -- Match the foreground Coach count: current owner-linked connections,
   -- deterministic direct conversation, owned participant and latest 100 posts.
   select count(*),coalesce(bool_or(id is null or length(id)>120 or id !~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$'
    or coach_user_id is null or status not in ('active','needs_assignment','review_notes')),false)
   into link_count,invalid from (
    select id,coach_user_id,status from public.coach_player_links
    where (coach_user_id=target or player_user_id=target) and player_user_id is not null and status<>'paused' limit 101
   ) bounded;
   if link_count>100 or invalid then continue; end if;
   for link in select id,coach_user_id,player_user_id from public.coach_player_links
    where (coach_user_id=target or player_user_id=target) and player_user_id is not null and status<>'paused'
   loop
    if clock_timestamp() >= deadline then return; end if;
    fingerprint := encode(sha256(convert_to('tenaceiq:coach-direct:v1:'||link.id,'UTF8')),'hex');
    expected_id := (substr(fingerprint,1,8)||'-'||substr(fingerprint,9,4)||'-5'||substr(fingerprint,14,3)||'-a'||substr(fingerprint,18,3)||'-'||substr(fingerprint,21,12))::uuid;
    select c.status,p.last_read_at into conversation
     from public.internal_conversations c
     join public.internal_conversation_participants p on p.conversation_id=c.id and p.profile_id=target
     where c.id=expected_id and c.conversation_type='direct' and c.related_entity_type='coach_student'
      and c.related_entity_id=link.id and c.status<>'closed';
    if not found then continue; end if;
    if conversation.status not in ('open','waiting_on_user','waiting_on_admin') then raise exception 'Coach badge unavailable'; end if;
    select count(*) filter(where created_at>coalesce(conversation.last_read_at,'-infinity'::timestamptz)),
     coalesce(bool_or(sender_user_id is distinct from case when link.coach_user_id=target then link.player_user_id else link.coach_user_id end),false)
    into posts,foreign_posts from (
     select sender_user_id,created_at from public.internal_messages
     where conversation_id=expected_id and sender_user_id<>target and deleted_at is null
     order by created_at desc,id desc limit 100
    ) bounded;
    if foreign_posts then raise exception 'Coach badge unavailable'; end if;
    total := least(100,total+posts);
   end loop;
   profile_id := target; unread := total; return next;
  exception when others then
   -- Optional badge lookup must not suppress a valid message alert.
   continue;
  end;
 end loop;
end;
$$;
revoke all on function public.native_chat_badge_counts(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.native_chat_badge_counts(uuid[]) to service_role;
