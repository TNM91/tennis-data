begin;
set local lock_timeout = '5s';

create table private.native_league_entry_notices (
  notification_id uuid primary key references public.internal_notifications(id) on delete cascade,
  entry_id uuid not null,
  entry_format text not null check (entry_format in ('team', 'individual')),
  entry_version timestamptz not null,
  decision text not null check (decision in ('active', 'rejected', 'information')),
  check (decision <> 'information' or entry_format = 'individual')
);
alter table private.native_league_entry_notices enable row level security;
revoke all on private.native_league_entry_notices from public, anon, authenticated, service_role;

-- Keep the existing ownership, review version and eligibility guards. Write the
-- entrant's alert in the same transaction as the first-party decision.
alter function public.native_first_party_league_decision(
  uuid,text,text,timestamptz,uuid,timestamptz,text,text,text
) set schema private;
revoke all on function private.native_first_party_league_decision(
  uuid,text,text,timestamptz,uuid,timestamptz,text,text,text
) from public, anon, authenticated, service_role;

create function public.native_first_party_league_decision(
  p_actor uuid, p_league text, p_format text, p_league_version timestamptz,
  p_entry uuid, p_entry_version timestamptz, p_decision text, p_note text, p_eligibility text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  receipt jsonb;
  recipient uuid;
  notification uuid;
begin
  receipt := private.native_first_party_league_decision(
    p_actor,p_league,p_format,p_league_version,p_entry,p_entry_version,p_decision,p_note,p_eligibility
  );
  if receipt is null or not private.native_league_registration_open(p_league) then return receipt; end if;
  recipient := (receipt->>'created_by_user_id')::uuid;

  insert into public.internal_notifications(recipient_profile_id,actor_user_id,notification_type,title,body,href)
  select recipient,p_actor,'system',
    case p_decision when 'active' then 'League entry approved'
      when 'information' then 'League entry needs information' else 'League entry declined' end,
    league.league_name,
    '/explore/leagues/tiq/' || league.id || '?entry=' || p_entry || '#league-entry'
  from public.tiq_leagues league
  join public.profiles profile on profile.id = recipient
  where league.id = p_league and recipient <> p_actor
    and not exists (select 1 from public.account_deletion_requests request
      where request.account_id = recipient and request.status <> 'completed')
    and not exists (select 1 from public.team_chat_blocks block
      where (block.owner_user_id = recipient and block.blocked_user_id = p_actor)
         or (block.owner_user_id = p_actor and block.blocked_user_id = recipient))
  returning id into notification;

  if notification is not null then
    insert into private.native_league_entry_notices(notification_id,entry_id,entry_format,entry_version,decision)
    values (notification,p_entry,p_format,(receipt->>'updated_at')::timestamptz,p_decision);
  end if;
  return receipt || jsonb_build_object('notified',notification is not null);
end;
$$;
revoke all on function public.native_first_party_league_decision(
  uuid,text,text,timestamptz,uuid,timestamptz,text,text,text
) from public, anon, authenticated, service_role;
grant execute on function public.native_first_party_league_decision(
  uuid,text,text,timestamptz,uuid,timestamptz,text,text,text
) to service_role;

-- Only the current receipt revision is visible in Updates. The notification
-- never contains an eligibility note, and the receipt requires its own auth.
create function private.native_league_entry_updates()
returns table (id uuid,recipient_profile_id uuid,notification_type text,title text,body text,
  href text,conversation_id uuid,schedule_event_id uuid,read_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id,n.recipient_profile_id,'system',n.title,league.league_name,
    '/explore/leagues/tiq/' || league.id || '?entry=' || notice.entry_id || '#league-entry',
    null::uuid,null::uuid,n.read_at,n.created_at
  from public.internal_notifications n
  join private.native_league_entry_notices notice on notice.notification_id = n.id
  join lateral (
    select e.league_id,e.created_by_user_id,e.updated_at,e.entry_status,false as action_required
    from public.tiq_team_league_entries e where notice.entry_format = 'team' and e.id = notice.entry_id
    union all
    select e.league_id,e.created_by_user_id,e.updated_at,e.entry_status,e.player_action_required
    from public.tiq_player_league_entries e where notice.entry_format = 'individual' and e.id = notice.entry_id
  ) entry on entry.created_by_user_id = n.recipient_profile_id and entry.updated_at = notice.entry_version
  join public.tiq_leagues league on league.id = entry.league_id and league.league_format = notice.entry_format
    and league.is_public and league.created_by_user_id = n.actor_user_id
  where n.recipient_profile_id = (select auth.uid()) and n.notification_type = 'system'
    and (entry.entry_status = notice.decision or
      (notice.decision = 'information' and entry.entry_status = 'pending' and entry.action_required
        and private.native_league_registration_open(league.id)))
    and not exists (select 1 from public.account_deletion_requests request
      where request.account_id in (n.recipient_profile_id,n.actor_user_id) and request.status <> 'completed')
    and not exists (select 1 from public.team_chat_blocks block
      where (block.owner_user_id = n.recipient_profile_id and block.blocked_user_id = n.actor_user_id)
         or (block.owner_user_id = n.actor_user_id and block.blocked_user_id = n.recipient_profile_id));
$$;
revoke all on function private.native_league_entry_updates() from public, anon, authenticated, service_role;
grant execute on function private.native_league_entry_updates() to authenticated;

do $inbox$
declare definition text := rtrim(pg_get_viewdef('public.native_first_party_updates'::regclass), ';' || chr(10) || ' ');
begin
  execute 'create or replace view public.native_first_party_updates with (security_invoker=true) as '
    || definition || ' union all select * from private.native_league_entry_updates()';
end;
$inbox$;

notify pgrst, 'reload schema';
commit;
