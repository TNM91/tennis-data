begin;
set local lock_timeout = '5s';

create table private.native_practice_reminders (
  event_id uuid primary key references public.internal_schedule_events(id) on delete cascade,
  request_id uuid not null,
  href text not null,
  notification_ids uuid[] not null check (cardinality(notification_ids) between 1 and 200)
);
alter table private.native_practice_reminders enable row level security;
revoke all on private.native_practice_reminders from public, anon, authenticated, service_role;
grant select, insert on private.native_practice_reminders to service_role;

-- Recipient eligibility is shared by preview and send. Only the server can query it.
create function private.native_practice_reminder_recipients(
  p_owner uuid, p_room uuid, p_event uuid, p_invite uuid, p_team text, p_flight text
) returns table (id uuid, player_name text, profile_id uuid)
language sql stable security invoker set search_path = ''
as $$
  select person.id, person.player_name, person.profile_id
  from public.captain_practice_invitees person
  join public.internal_conversation_participants member
    on member.conversation_id = p_room and member.profile_id = person.profile_id
  left join public.internal_notification_preferences prefs on prefs.profile_id = person.profile_id
  where person.event_id = p_event and person.invite_id = p_invite
    and person.response_status = 'unanswered' and person.profile_id <> p_owner
    and not member.muted and coalesce(prefs.schedule_alerts_enabled, true)
    and 1 = (
      select count(*) from public.team_profile_links link
      where link.profile_user_id = person.profile_id and link.team_name = p_team
        and link.league_name = 'Private team ' || p_room::text and link.flight = p_flight
        and link.source_type = 'manual_invite' and link.status = 'accepted' and link.archived_at is null
    )
    and not exists (
      select 1 from public.team_room_member_removals removal
      where removal.conversation_id = p_room and removal.profile_id = person.profile_id
    )
    and not exists (
      select 1 from public.team_chat_blocks block
      where (block.owner_user_id = person.profile_id and block.blocked_user_id = p_owner)
         or (block.owner_user_id = p_owner and block.blocked_user_id = person.profile_id)
    )
    and 1 = (
      select count(*) from public.captain_practice_invitees sibling
      where sibling.event_id = p_event and sibling.profile_id = person.profile_id
    )
  order by person.player_name, person.id
  limit 201;
$$;
revoke all on function private.native_practice_reminder_recipients(uuid,uuid,uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function private.native_practice_reminder_recipients(uuid,uuid,uuid,uuid,text,text) to service_role;

-- The practice row serializes sends with native replies and practice edits.
-- Lock the reviewed RSVP rows before rechecking so a concurrent website RSVP
-- cannot commit between recipient selection and notification creation.
create function public.native_private_practice_reminder(
  p_owner uuid, p_room uuid, p_event uuid, p_team text, p_flight text,
  p_request uuid default null, p_revision timestamptz default null,
  p_recipients uuid[] default null, p_href text default null
) returns jsonb language plpgsql security invoker
set search_path = '' set lock_timeout = '3s'
as $$
declare
  league_key text := 'Private team ' || p_room::text;
  practice public.internal_schedule_events%rowtype;
  invitation uuid;
  previous private.native_practice_reminders%rowtype;
  recipients jsonb;
  saved_ids uuid[];
  total integer;
begin
  if p_owner is null or p_room is null or p_event is null or p_team is null or
     length(p_team) not between 1 and 100 or p_flight is null or length(p_flight) > 60 or
     (p_request is not null and (
       p_revision is null or coalesce(cardinality(p_recipients),0) not between 1 and 200 or
       cardinality(p_recipients) <> (select count(distinct id) from unnest(p_recipients) ids(id)) or
       p_href is null or length(p_href) > 1500 or
       p_href not like '/team-room?practiceReminder=' || p_event::text || '&%&request=' || p_request::text
     )) then return jsonb_build_object('status',400); end if;

  perform 1 from public.internal_conversations room
    join public.native_private_teams team on team.room_id = room.id
    where room.id = p_room and room.related_entity_type = 'team_room' and room.status = 'open'
      and team.team_name = p_team and team.flight = p_flight
    for share of room;
  if not found then return jsonb_build_object('status',403); end if;

  perform 1 from public.team_profile_links link
    where link.profile_user_id = p_owner and link.team_name = p_team and link.flight = p_flight
      and link.league_name = league_key and link.source_type = 'manual_invite'
      and link.status = 'accepted' and link.archived_at is null
      and (case when cardinality(link.team_roles)>0 then link.team_roles else array[link.team_role] end)
        && array['captain','co_captain']::text[]
    for share;
  get diagnostics total = row_count;
  if total <> 1 or not exists (
    select 1 from public.internal_conversation_participants member
    where member.conversation_id = p_room and member.profile_id = p_owner
  ) or exists (
    select 1 from public.team_room_member_removals removal
    where removal.conversation_id = p_room and removal.profile_id = p_owner
  ) then return jsonb_build_object('status',403); end if;

  if p_request is not null then
    perform 1 from public.internal_schedule_events where id = p_event and created_by_user_id = p_owner
      for update;
  end if;
  select * into practice from public.internal_schedule_events
    where id = p_event and created_by_user_id = p_owner and event_type = 'captain_practice'
      and metadata->>'teamName' = p_team and metadata->>'leagueName' = league_key
      and metadata->>'flight' = p_flight;
  if not found then return jsonb_build_object('status',404); end if;

  select * into previous from private.native_practice_reminders where event_id = p_event;
  if p_request is not null and previous.request_id = p_request and previous.href = p_href then
    return jsonb_build_object('status',200,'count',cardinality(previous.notification_ids));
  end if;
  if practice.status not in ('proposed','confirmed') or
     practice.scheduled_date < (now() at time zone 'America/Chicago')::date then
    return jsonb_build_object('status',409);
  end if;

  select id into invitation from public.captain_practice_invites
    where event_id = p_event and created_by_user_id = p_owner;
  if invitation is null then return jsonb_build_object('status',404); end if;

  if p_request is null then
    select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.player_name) order by r.player_name,r.id),'[]')
      into recipients from private.native_practice_reminder_recipients(p_owner,p_room,p_event,invitation,p_team,p_flight) r;
    if jsonb_array_length(recipients) > 200 then return jsonb_build_object('status',409); end if;
    return jsonb_build_object('status',200,'updatedAt',practice.updated_at,'date',practice.scheduled_date,
      'recipients',recipients,'alreadySent',previous.event_id is not null);
  end if;

  if previous.event_id is not null or p_revision <> practice.updated_at then return jsonb_build_object('status',409); end if;
  perform 1 from public.captain_practice_invitees person
    where person.event_id = p_event and person.invite_id = invitation and person.id = any(p_recipients)
    order by person.id for update;

  with saved as (insert into public.internal_notifications (
    recipient_profile_id, actor_user_id, notification_type, title, body, href, conversation_id, schedule_event_id
  )
  select r.profile_id, p_owner, 'schedule', 'Practice RSVP reminder',
    'Open practice to mark In, Out, or Maybe.', p_href, p_room, p_event
  from private.native_practice_reminder_recipients(p_owner,p_room,p_event,invitation,p_team,p_flight) r
  where r.id = any(p_recipients)
  returning id)
  select count(*), array_agg(id) into total,saved_ids from saved;

  if total > 0 then
    insert into private.native_practice_reminders(event_id,request_id,href,notification_ids)
      values (p_event,p_request,p_href,saved_ids);
  end if;
  return jsonb_build_object('status',200,'count',total);
end;
$$;
revoke all on function public.native_private_practice_reminder(uuid,uuid,uuid,text,text,uuid,timestamptz,uuid[],text) from public, anon, authenticated;
grant execute on function public.native_private_practice_reminder(uuid,uuid,uuid,text,text,uuid,timestamptz,uuid[],text) to service_role;

-- This helper returns only the current recipient's valid reminder destinations.
-- Keeping it private avoids exposing practice membership or the block table.
create function private.native_practice_reminder_updates()
returns table (
  id uuid, recipient_profile_id uuid, notification_type text, title text, body text, href text,
  conversation_id uuid, schedule_event_id uuid, read_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select n.id, n.recipient_profile_id, 'schedule', 'Practice RSVP reminder',
    'Open practice to mark In, Out, or Maybe.', n.href, n.conversation_id, n.schedule_event_id, n.read_at, n.created_at
  from public.internal_notifications n
  join private.native_practice_reminders receipt on receipt.event_id = n.schedule_event_id
    and n.id = any(receipt.notification_ids) and n.href = receipt.href
  join public.internal_schedule_events e on e.id = n.schedule_event_id and e.created_by_user_id = n.actor_user_id
  join public.native_private_teams t on t.room_id = n.conversation_id
  join public.internal_conversations c on c.id = t.room_id and c.related_entity_type = 'team_room' and c.status = 'open'
  where n.recipient_profile_id = (select auth.uid()) and n.notification_type = 'schedule'
    and n.actor_user_id <> n.recipient_profile_id
    and e.event_type = 'captain_practice' and e.metadata->>'teamName' = t.team_name
    and e.metadata->>'leagueName' = 'Private team ' || t.room_id::text and e.metadata->>'flight' = t.flight
    and exists (
      select 1 from public.captain_practice_invitees person
      join public.captain_practice_invites invite on invite.id = person.invite_id and invite.event_id = e.id
      where person.event_id = e.id and person.profile_id = n.recipient_profile_id
    )
    and exists (
      select 1 from public.internal_conversation_participants member
      join public.team_profile_links link on link.profile_user_id = member.profile_id
      where member.conversation_id = t.room_id and member.profile_id = n.recipient_profile_id
        and link.team_name = t.team_name and link.league_name = 'Private team ' || t.room_id::text
        and link.flight = t.flight and link.status = 'accepted' and link.archived_at is null and link.source_type = 'manual_invite'
    )
    and not exists (
      select 1 from public.team_room_member_removals removal
      where removal.conversation_id = t.room_id and removal.profile_id = n.recipient_profile_id
    )
    and not exists (
      select 1 from public.team_chat_blocks block
      where (block.owner_user_id = n.recipient_profile_id and block.blocked_user_id = n.actor_user_id)
         or (block.owner_user_id = n.actor_user_id and block.blocked_user_id = n.recipient_profile_id)
    );
$$;
revoke all on function private.native_practice_reminder_updates() from public, anon, authenticated;
grant execute on function private.native_practice_reminder_updates() to authenticated;

-- Preserve the existing view OID so marking Updates read uses the same visibility rules.
do $$
declare definition text := rtrim(pg_get_viewdef('public.native_first_party_updates'::regclass), ';' || chr(10) || ' ');
begin
  execute 'create or replace view public.native_first_party_updates with (security_invoker=true) as '
    || definition || ' union all select * from private.native_practice_reminder_updates()';
end;
$$;
notify pgrst, 'reload schema';
commit;
