begin;
set local lock_timeout = '5s';

-- Keep future reminders private until due. The accepted plan and its reminders
-- change in one transaction, with no separate scheduler or delivery retries.
create table private.native_chat_hit_reminders (
  id uuid primary key default gen_random_uuid(),
  hit_id uuid not null references private.native_chat_hits(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  due_at timestamptz not null,
  read_at timestamptz,
  unique (hit_id,recipient_profile_id)
);
create index native_chat_hit_reminders_due on private.native_chat_hit_reminders(recipient_profile_id,due_at);
alter table private.native_chat_hit_reminders enable row level security;
revoke all on private.native_chat_hit_reminders from public,anon,authenticated,service_role;

create function private.sync_native_chat_hit_reminders()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='accepted' then
    insert into private.native_chat_hit_reminders(hit_id,recipient_profile_id,due_at)
    select new.id,player,greatest(now(),new.starts_at-interval '2 hours')
    from unnest(array[new.proposed_by,new.invited_player]) as recipients(player)
    on conflict (hit_id,recipient_profile_id) do nothing;
  elsif tg_op='UPDATE' and old.status='accepted' then
    delete from private.native_chat_hit_reminders where hit_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_native_chat_hit_reminders() from public,anon,authenticated,service_role;
create trigger native_chat_hit_reminders_sync after insert or update of status on private.native_chat_hits
for each row execute function private.sync_native_chat_hit_reminders();

insert into private.native_chat_hit_reminders(hit_id,recipient_profile_id,due_at)
select hit.id,player,greatest(now(),hit.starts_at-interval '2 hours')
from private.native_chat_hits hit
cross join lateral unnest(array[hit.proposed_by,hit.invited_player]) as recipients(player)
where hit.status='accepted' and hit.starts_at>now()
on conflict (hit_id,recipient_profile_id) do nothing;

create function private.native_chat_hit_reminder_updates()
returns table(id uuid,recipient_profile_id uuid,notification_type text,title text,body text,href text,
  conversation_id uuid,schedule_event_id uuid,read_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select reminder.id,reminder.recipient_profile_id,'schedule','Hit coming up',
    'See the confirmed time and get directions to your club.',
    '/chats?room='||hit.room_id||'&hit='||hit.id,
    hit.room_id,hit.id,reminder.read_at,reminder.due_at
  from private.native_chat_hit_reminders reminder
  join private.native_chat_hits hit on hit.id=reminder.hit_id
  join public.internal_conversation_participants participant
    on participant.conversation_id=hit.room_id and participant.profile_id=reminder.recipient_profile_id
  left join public.internal_notification_preferences prefs on prefs.profile_id=reminder.recipient_profile_id
  where reminder.recipient_profile_id=(select auth.uid())
    and reminder.due_at<=now() and hit.starts_at>now() and hit.status='accepted'
    and not participant.muted and coalesce(prefs.schedule_alerts_enabled,true)
    and private.can_read_native_chat_hit(hit,reminder.recipient_profile_id);
$$;
revoke all on function private.native_chat_hit_reminder_updates() from public,anon,authenticated,service_role;
grant execute on function private.native_chat_hit_reminder_updates() to authenticated;

do $view$
declare definition text := rtrim(pg_get_viewdef('public.native_first_party_updates'::regclass), ';' || chr(10) || ' ');
begin
  execute 'create or replace view public.native_first_party_updates with (security_invoker=true) as '
    || definition || ' union all select * from private.native_chat_hit_reminder_updates()';
end $view$;

create function private.mark_native_chat_hit_reminders_read(p_ids uuid[])
returns void language sql security definer set search_path='' as $$
  update private.native_chat_hit_reminders r
  set read_at=now()
  where r.recipient_profile_id=(select auth.uid()) and r.read_at is null and r.id=any(p_ids)
    and r.id in (select visible.id from private.native_chat_hit_reminder_updates() visible);
$$;
revoke all on function private.mark_native_chat_hit_reminders_read(uuid[]) from public,anon,authenticated,service_role;
grant execute on function private.mark_native_chat_hit_reminders_read(uuid[]) to authenticated;

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

  perform private.mark_native_chat_hit_reminders_read(p_ids);

  return query
    select visible.id, visible.recipient_profile_id, visible.read_at
    from public.native_first_party_updates visible
    where visible.id = any(p_ids) and visible.read_at is not null;
  if (select count(*) from public.native_first_party_updates visible where visible.id = any(p_ids) and visible.read_at is not null) <> requested then
    raise exception 'Updates changed. Refresh before trying again.' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.native_first_party_mark_updates_read(uuid[]) from public,anon,authenticated;
grant execute on function public.native_first_party_mark_updates_read(uuid[]) to authenticated;

notify pgrst,'reload schema';
commit;
