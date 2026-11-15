begin;
set local lock_timeout = '5s';

create table private.native_tournament_schedule_notices (
  notification_id uuid primary key references public.internal_notifications(id) on delete cascade,
  division_id text not null references public.tiq_tournaments(id) on delete cascade,
  match_key text not null check (match_key ~ '^r[1-9][0-9]?-m[1-9][0-9]?$'),
  entry_id uuid not null references public.tiq_tournament_entries(id) on delete cascade,
  slot jsonb,
  rescheduled boolean not null,
  unique (division_id, match_key, entry_id)
);
alter table private.native_tournament_schedule_notices enable row level security;
revoke all on private.native_tournament_schedule_notices from public, anon, authenticated, service_role;

create function private.native_tournament_schedule_href(p_parent text,p_division text,p_match text,p_entry uuid)
returns text language sql immutable set search_path = '' as $$
  select '/compete?event=' || p_parent || '&division=' || p_division || '&match=' || p_match
    || '&entry=' || p_entry || '#tournament-schedule';
$$;
revoke all on function private.native_tournament_schedule_href(text,text,text,uuid) from public, anon, authenticated, service_role;

-- The application supplies only sides resolved from the exact version it validated.
-- The existing write takes the event lock and compares that revision before applying the slot.
create function public.native_tournament_save_slot(
  p_owner uuid, p_event uuid, p_expected text, p_division text, p_match text, p_slot jsonb,
  p_sides text[], p_rescheduled boolean
) returns jsonb language plpgsql security definer set search_path = ''
set lock_timeout = '3s' set statement_timeout = '8s' as $$
declare
  saved jsonb;
  division public.tiq_tournaments;
begin
  if p_sides is null or cardinality(p_sides) > 2 or p_rescheduled is null then
    return jsonb_build_object('code', 'invalid');
  end if;
  saved := public.native_tournament_draw_plan(p_owner,p_event,'slot',p_expected,p_division,p_match,p_slot);
  if saved ? 'code' or saved->>'revision' = p_expected then return saved; end if;

  -- A private rehearsal may use the same editor, but it never generates account alerts.
  select * into division from public.tiq_tournaments
    where id = p_division and event_id = saved->>'id' and is_public and not is_event;
  if not found then return saved; end if;

  -- At most one current alert per match and entrant. This also handles moving back to a former slot.
  delete from public.internal_notifications n using private.native_tournament_schedule_notices notice
    where notice.notification_id = n.id and notice.division_id = p_division and notice.match_key = p_match;

  with recipients as (
    select distinct on (e.submitted_by_user_id) e.id, e.submitted_by_user_id as recipient
    from public.tiq_tournament_entries e
    join public.profiles profile on profile.id = e.submitted_by_user_id
    join public.profiles organizer on organizer.id = p_owner
    where e.tournament_id = p_division and e.status = 'approved' and e.native_registration->>'version' = '1'
      and e.player_name = any(p_sides) and e.player_name = any(division.entrants)
      and e.submitted_by_user_id <> p_owner
      and not exists (select 1 from public.account_deletion_requests request
        where request.account_id = e.submitted_by_user_id and request.automatic_consent)
      and not exists (select 1 from public.team_chat_blocks block
        where (block.owner_user_id = e.submitted_by_user_id and block.blocked_user_id = p_owner)
           or (block.owner_user_id = p_owner and block.blocked_user_id = e.submitted_by_user_id))
    order by e.submitted_by_user_id, e.id
  ), sent as (
    insert into public.internal_notifications (recipient_profile_id, actor_user_id, notification_type, title, body, href)
    select recipient, p_owner, 'schedule', 'Tournament schedule update', 'Open TenAceIQ to check your match.',
      private.native_tournament_schedule_href(division.event_id,p_division,p_match,id)
    from recipients
    returning id, recipient_profile_id
  )
  insert into private.native_tournament_schedule_notices (notification_id,division_id,match_key,entry_id,slot,rescheduled)
    select sent.id,p_division,p_match,recipients.id,p_slot,p_rescheduled
    from sent join recipients on recipients.recipient = sent.recipient_profile_id;
  return saved;
end;
$$;
revoke all on function public.native_tournament_save_slot(uuid,uuid,text,text,text,jsonb,text[],boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.native_tournament_save_slot(uuid,uuid,text,text,text,jsonb,text[],boolean)
  to service_role;

create function private.native_tournament_schedule_updates()
returns table (id uuid, recipient_profile_id uuid, notification_type text, title text, body text,
  href text, conversation_id uuid, schedule_event_id uuid, read_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id,n.recipient_profile_id,'schedule',
    case when notice.slot is null then 'Tournament court time cleared'
         when notice.rescheduled then 'Tournament match rescheduled' else 'Tournament match scheduled' end,
    parent.name || ' · ' || division.name || ' · ' || case when notice.slot is null then 'New time to be confirmed'
      else to_char((notice.slot->>'date')::date,'Dy, Mon FMDD')
        || ' · ' || to_char((notice.slot->>'time')::time,'FMHH12:MI AM')
        || ' (' || coalesce(nullif(parent.event_details->>'timeZone',''),'Time zone to be confirmed')
        || ') · ' || (notice.slot->>'court') end,
    private.native_tournament_schedule_href(parent.id,division.id,notice.match_key,entry.id),
    null::uuid,null::uuid,n.read_at,n.created_at
  from public.internal_notifications n
  join private.native_tournament_schedule_notices notice on notice.notification_id = n.id
  join public.tiq_tournaments division on division.id = notice.division_id and division.is_public and not division.is_event
  join public.tiq_tournaments parent on parent.id = division.event_id and parent.is_public and parent.is_event
    and parent.created_by_user_id = n.actor_user_id and division.created_by_user_id = n.actor_user_id
  join public.tiq_tournament_entries entry on entry.id = notice.entry_id and entry.tournament_id = division.id
    and entry.submitted_by_user_id = n.recipient_profile_id and entry.status = 'approved'
    and entry.native_registration->>'version' = '1' and entry.player_name = any(division.entrants)
  where n.recipient_profile_id = (select auth.uid()) and n.notification_type = 'schedule'
    and division.status = 'scheduled' and not (division.results ? notice.match_key)
    and division.schedule->notice.match_key is not distinct from notice.slot
    and not exists (select 1 from public.account_deletion_requests request
      where request.account_id = n.recipient_profile_id and request.automatic_consent)
    and not exists (select 1 from public.team_chat_blocks block
      where (block.owner_user_id = n.recipient_profile_id and block.blocked_user_id = n.actor_user_id)
         or (block.owner_user_id = n.actor_user_id and block.blocked_user_id = n.recipient_profile_id));
$$;
revoke all on function private.native_tournament_schedule_updates() from public, anon, authenticated, service_role;
grant execute on function private.native_tournament_schedule_updates() to authenticated;

do $inbox$
declare definition text := rtrim(pg_get_viewdef('public.native_first_party_updates'::regclass), ';' || chr(10) || ' ');
begin
  execute 'create or replace view public.native_first_party_updates with (security_invoker=true) as '
    || definition || ' union all select * from private.native_tournament_schedule_updates()';
end;
$inbox$;

notify pgrst, 'reload schema';
commit;
