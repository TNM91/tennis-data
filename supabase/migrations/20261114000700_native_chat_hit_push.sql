begin;
set local lock_timeout = '5s';

-- Separate device registration keeps this opt-in independent of the integrated
-- build's team and coach notifications.
create table private.native_hit_push_devices (
  installation_id uuid primary key,
  secret_hash text not null check(secret_hash ~ '^[a-f0-9]{64}$'),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  device_token text not null unique check(device_token ~ '^[a-f0-9]+$' and length(device_token) between 64 and 256),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '30 days'
);
create index native_hit_push_devices_profile on private.native_hit_push_devices(profile_id);
create index native_chat_hit_reminders_due_at on private.native_chat_hit_reminders(due_at);

create table private.native_hit_push_delivery (
  reminder_id uuid not null references private.native_chat_hit_reminders(id) on delete cascade,
  installation_id uuid not null references private.native_hit_push_devices(installation_id) on delete cascade,
  attempt_id uuid not null,
  attempts smallint not null,
  retry_at timestamptz not null,
  complete boolean not null default false,
  primary key(reminder_id,installation_id)
);
create index native_hit_push_delivery_installation on private.native_hit_push_delivery(installation_id);
alter table private.native_hit_push_devices enable row level security;
alter table private.native_hit_push_delivery enable row level security;
revoke all on private.native_hit_push_devices,private.native_hit_push_delivery from public,anon,authenticated,service_role;

create function public.bind_native_hit_push(
  p_installation uuid,p_secret_hash text,p_profile uuid,p_token text,p_enabled boolean
) returns boolean language plpgsql security definer set search_path='' as $$
declare current_device private.native_hit_push_devices;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_profile::text,1));
  select * into current_device from private.native_hit_push_devices where installation_id=p_installation for update;
  if found and current_device.secret_hash<>p_secret_hash then return false; end if;
  if not p_enabled then
    update private.native_hit_push_devices set enabled=false,updated_at=now()
      where installation_id=p_installation and secret_hash=p_secret_hash and profile_id=p_profile;
    return true;
  end if;
  if not private.native_player_chat_account(p_profile) or
      (select count(*) from private.native_hit_push_devices
       where profile_id=p_profile and enabled and expires_at>now() and installation_id<>p_installation)>=3 then return false; end if;
  insert into private.native_hit_push_devices as device(installation_id,secret_hash,profile_id,device_token)
    values(p_installation,p_secret_hash,p_profile,p_token)
    on conflict(installation_id) do update set profile_id=excluded.profile_id,device_token=excluded.device_token,
      enabled=true,updated_at=now(),expires_at=now()+interval '30 days'
      where device.secret_hash=p_secret_hash;
  return found;
exception when unique_violation then return false;
end;
$$;

create function public.claim_native_hit_push(p_hit uuid default null)
returns table(reminder_id uuid,attempt_id uuid,installation_id uuid,profile_id uuid,device_token text,
  updated_at timestamptz,room_id uuid,hit_id uuid,starts_at timestamptz)
language sql volatile security definer set search_path='' as $$
  with due as materialized (
    select reminder.id,device.installation_id
    from private.native_chat_hit_reminders reminder
    join private.native_chat_hits hit on hit.id=reminder.hit_id
    join private.native_hit_push_devices device on device.profile_id=reminder.recipient_profile_id
    join public.internal_conversation_participants participant
      on participant.conversation_id=hit.room_id and participant.profile_id=device.profile_id
    left join public.internal_notification_preferences prefs on prefs.profile_id=device.profile_id
    left join private.native_hit_push_delivery delivery
      on delivery.reminder_id=reminder.id and delivery.installation_id=device.installation_id
    where reminder.due_at between now()-interval '2 hours' and now()
      and (p_hit is null or hit.id=p_hit)
      and hit.status='accepted' and hit.starts_at>now()
      and device.enabled and device.expires_at>now()
      and not participant.muted and coalesce(prefs.schedule_alerts_enabled,true)
      and (delivery.reminder_id is null or (not delivery.complete and delivery.attempts<3 and delivery.retry_at<=now()))
      and private.can_read_native_chat_hit(hit,device.profile_id)
    order by reminder.due_at,reminder.id,device.installation_id
    limit 12
    for update of reminder skip locked
  ), claimed as (
    insert into private.native_hit_push_delivery as delivery(reminder_id,installation_id,attempt_id,attempts,retry_at)
    select due.id,due.installation_id,gen_random_uuid(),1,now()+interval '15 minutes' from due
    on conflict on constraint native_hit_push_delivery_pkey do update
      set attempt_id=excluded.attempt_id,attempts=delivery.attempts+1,retry_at=excluded.retry_at
      where not delivery.complete and delivery.attempts<3 and delivery.retry_at<=now()
    returning delivery.reminder_id,delivery.attempt_id,delivery.installation_id
  )
  select claimed.reminder_id,claimed.attempt_id,device.installation_id,device.profile_id,device.device_token,
    device.updated_at,hit.room_id,hit.id,hit.starts_at
  from claimed
  join private.native_chat_hit_reminders reminder on reminder.id=claimed.reminder_id
  join private.native_chat_hits hit on hit.id=reminder.hit_id
  join private.native_hit_push_devices device on device.installation_id=claimed.installation_id;
$$;

-- Recheck the lease and current privacy settings immediately before dispatch.
create function public.native_hit_push_current(p_reminders uuid[],p_attempts uuid[],p_device_versions timestamptz[])
returns table(attempt_id uuid)
language sql stable security definer set search_path='' as $$
  select delivery.attempt_id
  from unnest(p_reminders,p_attempts,p_device_versions) as ticket(reminder_id,attempt_id,device_version)
  join private.native_hit_push_delivery delivery on delivery.reminder_id=ticket.reminder_id and delivery.attempt_id=ticket.attempt_id
  join private.native_chat_hit_reminders reminder on reminder.id=delivery.reminder_id
  join private.native_chat_hits hit on hit.id=reminder.hit_id
  join private.native_hit_push_devices device on device.installation_id=delivery.installation_id and device.profile_id=reminder.recipient_profile_id
  join public.internal_conversation_participants participant
    on participant.conversation_id=hit.room_id and participant.profile_id=device.profile_id
  left join public.internal_notification_preferences prefs on prefs.profile_id=device.profile_id
  where not delivery.complete and hit.status='accepted' and hit.starts_at>now()
    and device.enabled and device.expires_at>now() and device.updated_at=ticket.device_version and not participant.muted
    and coalesce(prefs.schedule_alerts_enabled,true) and private.can_read_native_chat_hit(hit,device.profile_id);
$$;

create function public.finish_native_hit_push(p_reminder uuid,p_installation uuid,p_attempt uuid,p_expired_at timestamptz)
returns void language sql security definer set search_path='' as $$
  with finished as (
    update private.native_hit_push_delivery set complete=true
    where reminder_id=p_reminder and installation_id=p_installation and attempt_id=p_attempt
    returning installation_id
  )
  update private.native_hit_push_devices device set enabled=false,updated_at=now()
  from finished where device.installation_id=finished.installation_id and device.updated_at=p_expired_at;
$$;

revoke all on function public.bind_native_hit_push(uuid,text,uuid,text,boolean),
  public.claim_native_hit_push(uuid),public.native_hit_push_current(uuid[],uuid[],timestamptz[]),
  public.finish_native_hit_push(uuid,uuid,uuid,timestamptz)
  from public,anon,authenticated,service_role;
grant execute on function public.bind_native_hit_push(uuid,text,uuid,text,boolean),
  public.claim_native_hit_push(uuid),public.native_hit_push_current(uuid[],uuid[],timestamptz[]),
  public.finish_native_hit_push(uuid,uuid,uuid,timestamptz) to service_role;

notify pgrst,'reload schema';
commit;
