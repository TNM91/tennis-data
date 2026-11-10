-- The first-party inbox projects current TenAceIQ relationships. Raw notice copy is never returned.
begin;
set local lock_timeout = '5s';

create or replace view public.native_first_party_updates
with (security_invoker = true) as
with own_notices as not materialized (
  select n.id, n.recipient_profile_id, n.actor_user_id, n.notification_type,
    n.href, n.conversation_id, n.read_at, n.created_at
  from public.internal_notifications n
  where n.recipient_profile_id = (select auth.uid())
    and n.actor_user_id <> n.recipient_profile_id
    and n.schedule_event_id is null
), thread_notices as not materialized (
  select n.*, c.conversation_type, c.status, c.related_entity_id, c.related_entity_type,
    c.created_by_user_id, c.assigned_admin_user_id
  from own_notices n
  join public.internal_conversations c on c.id = n.conversation_id
  where n.href = '/messages?thread=' || c.id::text
    and exists (
      select 1 from public.internal_conversation_participants member
      where member.conversation_id = c.id and member.profile_id = n.recipient_profile_id
    )
    and exists (
      select 1 from public.internal_messages m
      where m.conversation_id = c.id and m.sender_user_id = n.actor_user_id
        and m.message_kind = 'message' and m.deleted_at is null and m.created_at <= n.created_at
    )
)
select n.id, n.recipient_profile_id, 'message'::text as notification_type,
  'Coach conversation'::text as title, 'Open Coach messages to catch up.'::text as body,
  '/messages?coach=' || l.id as href, n.conversation_id, null::uuid as schedule_event_id, n.read_at, n.created_at
from thread_notices n
join public.coach_player_links l on l.id = n.related_entity_id
cross join lateral (select encode(sha256(convert_to('tenaceiq:coach-direct:v1:' || l.id, 'UTF8')), 'hex') as digest) h
where n.notification_type = 'message' and n.conversation_type = 'direct' and n.related_entity_type = 'coach_student'
  and n.status <> 'closed' and l.status in ('active', 'needs_assignment', 'review_notes')
  and l.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  -- Use the same conversation ID as coachConversationId in the native Coach messages API.
  and n.conversation_id::text = substr(h.digest, 1, 8) || '-' || substr(h.digest, 9, 4) || '-5' || substr(h.digest, 14, 3)
    || '-a' || substr(h.digest, 18, 3) || '-' || substr(h.digest, 21, 12)
  and ((l.coach_user_id = n.recipient_profile_id and l.player_user_id = n.actor_user_id)
    or (l.player_user_id = n.recipient_profile_id and l.coach_user_id = n.actor_user_id))
  and exists (
    select 1 from public.internal_conversation_participants member
    where member.conversation_id = n.conversation_id and member.profile_id = n.actor_user_id
  )
union all
select n.id, n.recipient_profile_id, 'message', 'Your coach updated your weekly plan',
  'Review the guidance and plan your next rep.', '/level-up/my-quest?coachUpdate=' || p.id || '#level-up-coach-update',
  null::uuid, null::uuid, n.read_at, n.created_at
from own_notices n
join public.level_up_weekly_plans p on p.id = substring(n.href from '^/level-up/my-quest[?]coachUpdate=([a-zA-Z0-9_-]{1,240})#level-up-coach-update$')
join public.coach_player_links l on l.id = p.student_link_id
where n.notification_type = 'message' and n.conversation_id is null and p.shared_with_coach
  and p.player_user_id = n.recipient_profile_id and p.coach_user_id = n.actor_user_id
  and l.player_user_id = p.player_user_id and l.coach_user_id = p.coach_user_id
  and l.status in ('active', 'needs_assignment', 'review_notes')
  and p.plan_json #>> '{coachResponse,coachUserId}' = n.actor_user_id::text
  and p.plan_json #>> '{coachResponse,action}' in ('acknowledged', 'answered', 'adjusted', 'replaced')
union all
select n.id, n.recipient_profile_id, 'support', 'TenAceIQ support update',
  'There’s an update on your support request.', '', null::uuid, null::uuid, n.read_at, n.created_at
from thread_notices n
where n.notification_type in ('message', 'support') and n.conversation_type = 'support'
  and n.created_by_user_id = n.recipient_profile_id and n.related_entity_type in ('account', 'billing', 'general')
  and (n.assigned_admin_user_id = n.actor_user_id or exists (
    select 1 from public.internal_conversation_participants support
    where support.conversation_id = n.conversation_id and support.profile_id = n.actor_user_id
      and support.participant_role in ('admin', 'support')
  ));

revoke all on public.native_first_party_updates from public, anon, authenticated;
grant select on public.native_first_party_updates to authenticated;

-- One transaction checks the whole batch and confirms the read state, including retries.
create or replace function public.native_first_party_mark_updates_read(p_ids uuid[])
returns table (id uuid, recipient_profile_id uuid, read_at timestamptz)
language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare
  owner_id uuid := auth.uid();
  requested integer := cardinality(p_ids);
begin
  if owner_id is null or p_ids is null or requested not between 1 and 100
    or requested <> (select count(distinct item) from unnest(p_ids) as ids(item)) then
    raise exception 'Invalid update IDs' using errcode = '22023';
  end if;

  if requested <> (select count(*) from public.native_first_party_updates visible where visible.id = any(p_ids)) then
    raise exception 'Updates changed. Refresh before trying again.' using errcode = 'P0001';
  end if;

  update public.internal_notifications n
  set read_at = now()
  where n.recipient_profile_id = owner_id and n.read_at is null and n.id = any(p_ids)
    and exists (select 1 from public.native_first_party_updates visible where visible.id = n.id);

  return query
    select visible.id, visible.recipient_profile_id, visible.read_at
    from public.native_first_party_updates visible
    where visible.id = any(p_ids) and visible.read_at is not null;
  if (select count(*) from public.native_first_party_updates visible where visible.id = any(p_ids) and visible.read_at is not null) <> requested then
    raise exception 'Updates changed. Refresh before trying again.' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.native_first_party_mark_updates_read(uuid[]) from public, anon, authenticated;
grant execute on function public.native_first_party_mark_updates_read(uuid[]) to authenticated;
notify pgrst, 'reload schema';
commit;
