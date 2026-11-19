begin;
set local lock_timeout = '5s';

-- Old app versions keep registering normally, without receiving destinations
-- they cannot open. The original binding guard and capability update are atomic.
alter table private.native_hit_push_devices add column coach_activity_enabled boolean not null default false;
alter function public.bind_native_hit_push(uuid,text,uuid,text,boolean) set schema private;
revoke all on function private.bind_native_hit_push(uuid,text,uuid,text,boolean) from public,anon,authenticated,service_role;
create function public.bind_native_hit_push(p_installation uuid,p_secret_hash text,p_profile uuid,p_token text,p_enabled boolean,p_coach_activity boolean default false)
returns boolean language plpgsql security definer set search_path='' as $$
declare accepted boolean;
begin
  accepted:=private.bind_native_hit_push(p_installation,p_secret_hash,p_profile,p_token,p_enabled);
  if accepted then
    update private.native_hit_push_devices set coach_activity_enabled=p_enabled and p_coach_activity
    where installation_id=p_installation and profile_id=p_profile and secret_hash=p_secret_hash;
  end if;
  return accepted;
end;
$$;
revoke all on function public.bind_native_hit_push(uuid,text,uuid,text,boolean,boolean) from public,anon,authenticated,service_role;
grant execute on function public.bind_native_hit_push(uuid,text,uuid,text,boolean,boolean) to service_role;

-- The notice and the assignment commit together. No historical work is replayed.
create table private.native_coach_activity_notices (
  notification_id uuid primary key references public.internal_notifications(id) on delete cascade deferrable initially deferred,
  assignment_id text not null references public.coach_assignments(id) on delete cascade,
  student_link_id text not null references public.coach_player_links(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('assignment','checkin','feedback')),
  revision text not null,
  push_claimed_at timestamptz,
  constraint native_coach_activity_once unique (assignment_id,recipient_profile_id,kind,revision)
);
create index native_coach_activity_student on private.native_coach_activity_notices(student_link_id);
create index native_coach_activity_recipient on private.native_coach_activity_notices(recipient_profile_id);
alter table private.native_coach_activity_notices enable row level security;
revoke all on private.native_coach_activity_notices from public,anon,authenticated,service_role;

create function private.record_native_coach_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  link public.coach_player_links;
  kind text;
  revision text;
  actor uuid;
  recipient uuid;
  notice uuid;
begin
  if tg_op = 'UPDATE' and (new.coach_user_id <> old.coach_user_id or new.student_link_id <> old.student_link_id) then return new; end if;
  if new.status = 'assigned' and (tg_op = 'INSERT' or old.status = 'draft') then
    kind := 'assignment'; revision := 'published';
  elsif tg_op = 'UPDATE' and old.status = 'assigned' and new.status = 'completed'
    and jsonb_typeof(new.assignment_json->'playerCheckIn') = 'object'
    and coalesce(nullif(btrim(new.assignment_json #>> '{playerCheckIn,recap}'),''),nullif(btrim(new.assignment_json #>> '{playerCheckIn,evidence}'),'')) is not null then
    kind := 'checkin'; revision := md5(jsonb_build_array(btrim(new.assignment_json #>> '{playerCheckIn,recap}'),btrim(new.assignment_json #>> '{playerCheckIn,evidence}'))::text);
  elsif tg_op = 'UPDATE' and new.status = 'completed'
    and jsonb_typeof(new.assignment_json->'coachReview') = 'object'
    and jsonb_typeof(new.assignment_json->'playerCheckIn') = 'object'
    and coalesce(nullif(btrim(new.assignment_json #>> '{coachReview,note}'),''),nullif(btrim(new.assignment_json #>> '{coachReview,nextFocus}'),'')) is not null
    and (new.assignment_json #>> '{coachReview,note}',new.assignment_json #>> '{coachReview,nextFocus}')
      is distinct from (old.assignment_json #>> '{coachReview,note}',old.assignment_json #>> '{coachReview,nextFocus}') then
    kind := 'feedback'; revision := md5(jsonb_build_array(btrim(new.assignment_json #>> '{playerCheckIn,recap}'),btrim(new.assignment_json #>> '{playerCheckIn,evidence}'),btrim(new.assignment_json #>> '{coachReview,note}'),btrim(new.assignment_json #>> '{coachReview,nextFocus}'))::text);
  else return new;
  end if;
  if revision is null or length(revision) not between 1 and 80
    or new.id !~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$' then return new; end if;
  select * into link from public.coach_player_links where id = new.student_link_id;
  if not found or link.coach_user_id <> new.coach_user_id or link.player_user_id is null
    or link.player_user_id = link.coach_user_id or link.status = 'paused'
    or link.id !~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$' then return new; end if;
  actor := case when kind = 'checkin' then link.player_user_id else link.coach_user_id end;
  recipient := case when kind = 'checkin' then link.coach_user_id else link.player_user_id end;
  -- An authenticated caller cannot manufacture an event attributed to their peer.
  if auth.uid() is not null and auth.uid() <> actor then return new; end if;
  if auth.uid() is null and coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','') <> 'service_role' then return new; end if;
  if not exists(select 1 from public.profiles where id = recipient)
    or exists(select 1 from public.internal_notification_preferences where profile_id = recipient and not message_alerts_enabled)
    or exists(select 1 from public.account_deletion_requests where account_id in (actor,recipient) and status <> 'completed')
    or exists(select 1 from public.team_chat_blocks where (owner_user_id=actor and blocked_user_id=recipient) or (owner_user_id=recipient and blocked_user_id=actor)) then return new; end if;
  insert into private.native_coach_activity_notices(notification_id,assignment_id,student_link_id,recipient_profile_id,kind,revision)
  values(gen_random_uuid(),new.id,link.id,recipient,kind,revision)
  on conflict on constraint native_coach_activity_once do nothing returning notification_id into notice;
  if notice is null then return new; end if;
  insert into public.internal_notifications(id,recipient_profile_id,actor_user_id,notification_type,title,body,href)
  values(notice,recipient,actor,'message',
    case kind when 'assignment' then 'New coach assignment' when 'checkin' then 'Player check-in ready' else 'Coach feedback ready' end,
    case kind when 'assignment' then 'Open your assigned practice.' when 'checkin' then 'Review your player’s completed practice.' else 'Read your coach’s feedback and next focus.' end,
    '/coach?student='||link.id||'&assignment='||new.id||'&activity='||kind||'#coach-workspace');
  return new;
end;
$$;
revoke all on function private.record_native_coach_activity() from public,anon,authenticated,service_role;
create trigger native_coach_activity after insert or update on public.coach_assignments
for each row execute function private.record_native_coach_activity();

-- Recheck the current relationship, work and safety settings on every read.
create function private.native_coach_activity_current(p_notice uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from private.native_coach_activity_notices r
    join public.internal_notifications n on n.id=r.notification_id and n.recipient_profile_id=r.recipient_profile_id
      and n.notification_type='message' and n.conversation_id is null and n.schedule_event_id is null
    join public.coach_assignments a on a.id=r.assignment_id and a.student_link_id=r.student_link_id
    join public.coach_player_links l on l.id=r.student_link_id and l.coach_user_id=a.coach_user_id
      and l.status in ('active','needs_assignment','review_notes') and l.coach_user_id<>l.player_user_id
    where r.notification_id=p_notice
      and ((r.kind='checkin' and n.recipient_profile_id=l.coach_user_id and n.actor_user_id=l.player_user_id
        and a.status='completed' and md5(jsonb_build_array(btrim(a.assignment_json #>> '{playerCheckIn,recap}'),btrim(a.assignment_json #>> '{playerCheckIn,evidence}'))::text)=r.revision
        and coalesce(nullif(btrim(a.assignment_json #>> '{coachReview,note}'),''),nullif(btrim(a.assignment_json #>> '{coachReview,nextFocus}'),'')) is null)
      or (r.kind in ('assignment','feedback') and n.recipient_profile_id=l.player_user_id and n.actor_user_id=l.coach_user_id
        and ((r.kind='assignment' and a.status='assigned') or (r.kind='feedback' and a.status='completed'
          and md5(jsonb_build_array(btrim(a.assignment_json #>> '{playerCheckIn,recap}'),btrim(a.assignment_json #>> '{playerCheckIn,evidence}'),btrim(a.assignment_json #>> '{coachReview,note}'),btrim(a.assignment_json #>> '{coachReview,nextFocus}'))::text)=r.revision))))
      and not exists(select 1 from public.account_deletion_requests where account_id in(n.recipient_profile_id,n.actor_user_id) and status<>'completed')
      and not exists(select 1 from public.team_chat_blocks where (owner_user_id=n.recipient_profile_id and blocked_user_id=n.actor_user_id) or (owner_user_id=n.actor_user_id and blocked_user_id=n.recipient_profile_id))
  );
$$;
revoke all on function private.native_coach_activity_current(uuid) from public,anon,authenticated,service_role;

create function private.native_coach_activity_updates()
returns table(id uuid,recipient_profile_id uuid,notification_type text,title text,body text,href text,conversation_id uuid,schedule_event_id uuid,read_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select n.id,n.recipient_profile_id,'message',
    case r.kind when 'assignment' then 'New coach assignment' when 'checkin' then 'Player check-in ready' else 'Coach feedback ready' end,
    case r.kind when 'assignment' then 'Open your assigned practice.' when 'checkin' then 'Review your player’s completed practice.' else 'Read your coach’s feedback and next focus.' end,
    '/coach?student='||r.student_link_id||'&assignment='||r.assignment_id||'&activity='||r.kind||'#coach-workspace',
    null::uuid,null::uuid,n.read_at,n.created_at
  from public.internal_notifications n join private.native_coach_activity_notices r on r.notification_id=n.id
  where n.recipient_profile_id=(select auth.uid()) and private.native_coach_activity_current(n.id);
$$;
revoke all on function private.native_coach_activity_updates() from public,anon,authenticated,service_role;
grant execute on function private.native_coach_activity_updates() to authenticated;
do $inbox$
declare definition text:=rtrim(pg_get_viewdef('public.native_first_party_updates'::regclass),';'||chr(10)||' ');
begin
  execute 'create or replace view public.native_first_party_updates with(security_invoker=true) as '
    ||definition||' union all select * from private.native_coach_activity_updates()';
end;
$inbox$;

-- Only the server can claim an optional push, once per committed event. Device
-- registration stays in the first-party app's existing opt-in store.
create function public.claim_native_coach_activity_push(p_actor uuid,p_assignment text,p_kind text)
returns table(notification_id uuid) language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  select r.notification_id into target from private.native_coach_activity_notices r
  join public.internal_notifications n on n.id=r.notification_id
  join public.internal_notification_preferences p on p.profile_id=n.recipient_profile_id
    and p.message_alerts_enabled and p.native_coach_alerts_enabled
  where r.assignment_id=p_assignment and r.kind=p_kind and n.actor_user_id=p_actor
    and r.push_claimed_at is null and n.read_at is null and n.created_at>=now()-interval '10 minutes'
    and private.native_coach_activity_current(n.id)
    and exists(select 1 from private.native_hit_push_devices d where d.profile_id=n.recipient_profile_id and d.enabled and d.coach_activity_enabled and d.expires_at>now())
  order by n.created_at desc,r.notification_id limit 1 for update of r skip locked;
  if target is null then return; end if;
  update private.native_coach_activity_notices set push_claimed_at=clock_timestamp() where private.native_coach_activity_notices.notification_id=target;
  return query select target;
end;
$$;
revoke all on function public.claim_native_coach_activity_push(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.claim_native_coach_activity_push(uuid,text,text) to service_role;

create function public.native_coach_activity_push_devices(p_notice uuid)
returns table(installation_id uuid,profile_id uuid,device_token text,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
  select d.installation_id,d.profile_id,d.device_token,d.updated_at from private.native_hit_push_devices d
  join public.internal_notifications n on n.recipient_profile_id=d.profile_id and n.id=p_notice and n.read_at is null
  join private.native_coach_activity_notices r on r.notification_id=n.id and r.push_claimed_at>=now()-interval '2 minutes'
  join public.internal_notification_preferences p on p.profile_id=d.profile_id and p.message_alerts_enabled and p.native_coach_alerts_enabled
  where d.enabled and d.coach_activity_enabled and d.expires_at>now() and private.native_coach_activity_current(n.id)
  order by d.updated_at desc,d.installation_id limit 4;
$$;
revoke all on function public.native_coach_activity_push_devices(uuid) from public,anon,authenticated,service_role;
grant execute on function public.native_coach_activity_push_devices(uuid) to service_role;

create function public.expire_native_coach_activity_device(p_notice uuid,p_installation uuid,p_version timestamptz)
returns void language sql security definer set search_path='' as $$
  update private.native_hit_push_devices d set enabled=false,updated_at=clock_timestamp()
  from public.internal_notifications n join private.native_coach_activity_notices r on r.notification_id=n.id
  where n.id=p_notice and r.push_claimed_at>=now()-interval '2 minutes' and d.profile_id=n.recipient_profile_id
    and d.installation_id=p_installation and d.updated_at=p_version;
$$;
revoke all on function public.expire_native_coach_activity_device(uuid,uuid,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.expire_native_coach_activity_device(uuid,uuid,timestamptz) to service_role;
notify pgrst,'reload schema';
commit;
