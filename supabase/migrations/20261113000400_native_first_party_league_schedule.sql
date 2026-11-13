begin;
set local lock_timeout = '5s';

-- Keep the shared schedule table authoritative. Only the service may attest
-- that a row was saved through the first-party scheduler.
create table private.native_league_match_operations (
  request_id uuid primary key,
  match_id uuid not null references public.tiq_league_schedule_items(id) on delete cascade,
  request_digest text not null,
  match_version timestamptz not null,
  match_digest text not null,
  venue_id text not null,
  court text not null,
  duration_minutes integer not null check (duration_minutes between 30 and 360),
  original_fixture jsonb,
  rescheduled boolean not null,
  notified_count integer not null default 0,
  unreachable_sides integer not null default 0
);
create index native_league_match_operations_current on private.native_league_match_operations(match_id, match_version);
create table private.native_league_match_notices (
  notification_id uuid primary key references public.internal_notifications(id) on delete cascade,
  request_id uuid not null references private.native_league_match_operations(request_id) on delete cascade,
  entry_ids uuid[] not null check (cardinality(entry_ids) between 1 and 2)
);
create index native_league_match_notices_request on private.native_league_match_notices(request_id);
alter table private.native_league_match_operations enable row level security;
alter table private.native_league_match_notices enable row level security;
revoke all on private.native_league_match_operations, private.native_league_match_notices from public, anon, authenticated, service_role;

create function private.native_league_fixture_digest(f public.tiq_league_schedule_items)
returns text language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(jsonb_build_array(f.id, f.league_id, f.league_format, f.participant_a_id,
    f.participant_b_id, f.participant_a_name, f.participant_b_name, f.scheduled_date, f.scheduled_time,
    f.facility, f.status, f.updated_by_user_id, extract(epoch from f.updated_at))::text, 'UTF8')), 'hex');
$$;
revoke all on function private.native_league_fixture_digest(public.tiq_league_schedule_items) from public, anon, authenticated;

create function private.native_league_schedule_roster(p_league text, p_format text)
returns table (id uuid, name text, submitter uuid) language sql stable set search_path = '' as $$
  select e.id, btrim(e.team_name), e.created_by_user_id from public.tiq_team_league_entries e
    where p_format = 'team' and e.league_id = p_league and e.entry_status = 'active'
      and nullif(e.team_entity_id, '') is null and e.source_league_name = '' and e.source_flight = ''
      and length(btrim(e.team_name)) between 1 and 160 and e.team_name !~ '[[:cntrl:]]'
  union all
  select e.id, btrim(e.player_name), e.created_by_user_id from public.tiq_player_league_entries e
    where p_format = 'individual' and e.league_id = p_league and e.entry_status = 'active'
      and nullif(e.player_id, '') is null and e.club_membership_id is null
      and e.eligibility_rating_source in ('unknown','self') and e.eligibility_age_division_source in ('unknown','self')
      and e.eligibility_mixed_pair_role_source in ('unknown','self') and not e.player_action_required
      and length(btrim(e.player_name)) between 1 and 160 and e.player_name !~ '[[:cntrl:]]';
$$;
revoke all on function private.native_league_schedule_roster(text,text) from public, anon, authenticated;

-- A verified TIQ entry captain/co-captain or the approved team entrant when a
-- captain hasn't linked the team yet. A link from another season cannot match.
create function private.native_league_schedule_recipients(p_league text, p_format text, p_entries uuid[])
returns table (entry_id uuid, recipient uuid) language sql stable set search_path = '' as $$
  with selected as (
    select r.* from private.native_league_schedule_roster(p_league,p_format) r where r.id = any(p_entries)
  ), captains as (
    select s.id, l.profile_user_id from selected s join public.team_profile_links l on l.source_record_id = s.id
    join public.tiq_leagues league on league.id = p_league and league.league_name = l.league_name and league.flight = l.flight
    where p_format = 'team' and l.source_type = 'tiq_entry' and l.team_name = s.name
      and l.status = 'accepted' and l.archived_at is null and l.team_roles && array['captain','co_captain']
  ), targets as (
    select id, profile_user_id from captains
    union
    select s.id, s.submitter from selected s where not exists (select 1 from captains c where c.id = s.id)
  )
  select t.id, t.profile_user_id from targets t join public.profiles p on p.id = t.profile_user_id
  where not exists (select 1 from public.account_deletion_requests d where d.account_id = p.id and d.status <> 'completed');
$$;
revoke all on function private.native_league_schedule_recipients(text,text,uuid[]) from public, anon, authenticated;

create function private.native_league_schedule_venues(p_league text)
returns table (id text, name text, detail text) language sql stable set search_path = '' as $$
  select v.id::text, v.facility_name, v.street_address || ', ' || v.city || ', ' || v.state_code
  from public.calendar_venue_directory v
  where length(v.facility_name) <= 160 and length(v.street_address || ', ' || v.city || ', ' || v.state_code) <= 240
    and (v.facility_name || v.street_address || v.city) !~ '[[:cntrl:]]'
  union all
  select 'league-venue', btrim(l.default_facility), 'League venue'
  from public.tiq_leagues l where l.id = p_league and length(btrim(l.default_facility)) between 1 and 160
    and l.default_facility !~ '[[:cntrl:]]'
    and not exists (select 1 from public.calendar_venue_directory v where lower(btrim(l.default_facility)) = any(v.name_keys));
$$;
revoke all on function private.native_league_schedule_venues(text) from public, anon, authenticated;

create function private.native_league_scheduled_match(f public.tiq_league_schedule_items, court text, duration integer)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id',f.id,'date',f.scheduled_date,'time',coalesce(to_char(f.scheduled_time,'HH24:MI'),''),
    'facility',f.facility,'court',court,'duration',duration,'a',f.participant_a_name,'b',f.participant_b_name,'status',f.status);
$$;
revoke all on function private.native_league_scheduled_match(public.tiq_league_schedule_items,text,integer) from public, anon, authenticated;

-- Only exact live rows written by the coordinator scheduler are projected here.
-- Site edits and arbitrary schedule inserts cannot inherit the attestation.
create function public.native_first_party_league_matches(p_league text, p_version timestamptz)
returns jsonb language sql stable security definer set search_path = '' as $$
  with roster as materialized (
    select r.* from public.tiq_leagues l
    cross join lateral private.native_league_schedule_roster(l.id,l.league_format) r where l.id = p_league
  )
  select coalesce(jsonb_agg(jsonb_build_object('match',private.native_league_scheduled_match(f,o.court,o.duration_minutes),
    'original',o.original_fixture) order by f.scheduled_date desc,f.id), '[]'::jsonb)
  from public.tiq_leagues l
  join public.tiq_league_schedule_items f on f.league_id = l.id and f.league_format = l.league_format
  join private.native_league_match_operations o on o.match_id = f.id and o.match_version = f.updated_at
    and o.match_digest = private.native_league_fixture_digest(f)
  where l.id = p_league and l.updated_at = p_version and l.is_public and l.season_status = 'active'
    and f.status = 'coordinator_set' and f.updated_by_user_id = l.created_by_user_id
    and 2 = (select count(*) from roster r where (r.id::text = f.participant_a_id and r.name = f.participant_a_name)
      or (r.id::text = f.participant_b_id and r.name = f.participant_b_name))
    and not exists (select 1 from roster r where (lower(r.name) = lower(f.participant_a_name) and r.id::text <> f.participant_a_id)
      or (lower(r.name) = lower(f.participant_b_name) and r.id::text <> f.participant_b_id));
$$;
revoke all on function public.native_first_party_league_matches(text,timestamptz) from public, anon, authenticated;
grant execute on function public.native_first_party_league_matches(text,timestamptz) to service_role;

create function public.native_first_party_league_schedule_review(p_actor uuid, p_league text, p_version timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare l public.tiq_leagues; zone text; local_now timestamp;
begin
  select * into l from public.tiq_leagues where id = p_league and created_by_user_id = p_actor
    and is_public and season_status = 'active' and updated_at = p_version;
  if not found then return null; end if;
  zone := coalesce(nullif(l.schedule_time_zone,''),'America/Chicago');
  local_now := now() at time zone zone;
  return jsonb_build_object(
    'name',l.league_name,'format',l.league_format,'zone',zone,'startsOn',coalesce(l.starts_on::text,''),
    'endsOn',coalesce(l.ends_on::text,''),'defaultTime',
    case when l.default_match_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$' then left(l.default_match_time,5) else '' end,
    'defaultVenueId',coalesce((select v.id::text from public.calendar_venue_directory v
      where lower(btrim(l.default_facility)) = any(v.name_keys) order by v.id limit 1),
      (select id from private.native_league_schedule_venues(l.id) where id = 'league-venue'),''),
    'entries',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name) order by r.name,r.id)
      from private.native_league_schedule_roster(l.id,l.league_format) r),'[]'::jsonb),
    'venues',coalesce((select jsonb_agg(to_jsonb(v) order by v.name) from private.native_league_schedule_venues(l.id) v),'[]'::jsonb),
    'matches',coalesce((select jsonb_agg(private.native_league_scheduled_match(f,coalesce(o.court,''),o.duration_minutes)
        || jsonb_build_object('aId',a.id,'bId',b.id,'version',f.updated_at,'venueId',coalesce(o.venue_id,''))
        order by f.scheduled_date,f.scheduled_time,f.id)
      from public.tiq_league_schedule_items f
      join private.native_league_schedule_roster(l.id,l.league_format) a on a.name = f.participant_a_name
        and (nullif(f.participant_a_id,'') is null or f.participant_a_id = a.id::text)
      join private.native_league_schedule_roster(l.id,l.league_format) b on b.name = f.participant_b_name
        and (nullif(f.participant_b_id,'') is null or f.participant_b_id = b.id::text)
      left join private.native_league_match_operations o on o.match_id = f.id and o.match_version = f.updated_at
        and o.match_digest = private.native_league_fixture_digest(f)
      where f.league_id = l.id and f.league_format = l.league_format and f.status in ('confirmed','coordinator_set')
        and f.scheduled_date + coalesce(f.scheduled_time,time '00:00') > local_now
        and not exists (select 1 from private.native_league_schedule_roster(l.id,l.league_format) r
          where (lower(r.name) = lower(a.name) and r.id <> a.id) or (lower(r.name) = lower(b.name) and r.id <> b.id))
        and not exists (select 1 from public.tiq_individual_league_results r where r.schedule_item_id = f.id)
        and not exists (select 1 from public.tiq_team_league_match_events r where r.schedule_item_id = f.id)
        and not exists (select 1 from public.native_captain_court_results r where r.fixture_id = f.id)),'[]'::jsonb));
end;
$$;
revoke all on function public.native_first_party_league_schedule_review(uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.native_first_party_league_schedule_review(uuid,text,timestamptz) to service_role;

create function public.native_first_party_save_league_match(
  p_actor uuid, p_league text, p_league_version timestamptz, p_request uuid, p_match uuid, p_match_version timestamptz,
  p_a uuid, p_b uuid, p_date date, p_time time, p_venue text, p_court text, p_duration integer, p_notify boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l public.tiq_leagues; f public.tiq_league_schedule_items; previous public.tiq_league_schedule_items;
  a record; b record; target record; operation private.native_league_match_operations; notice_id uuid;
  venue_name text; venue_address text; facility_label text; zone text; slot timestamp; finish timestamp; digest text; original jsonb;
  count_notified integer := 0; unreachable integer := 0; notified_entries uuid[] := '{}';
begin
  if p_request is null or p_a is null or p_b is null or p_a = p_b or p_date is null or p_time is null or p_time = time '24:00'
    or p_venue is null or p_court is null or length(p_court) > 20 or p_court ~ '[[:cntrl:]]'
    or p_duration is null or p_duration not between 30 and 360 or p_notify is null
    or (p_match is null) <> (p_match_version is null)
  then return jsonb_build_object('code','invalid'); end if;
  perform 1 from public.profiles where id = p_actor and (role = 'admin' or (
    (tiq_team_league_entry_enabled or tiq_individual_league_creator_enabled)
    and (league_access_expires_at is null or league_access_expires_at > clock_timestamp()))) for share;
  if not found or exists (select 1 from public.account_deletion_requests d where d.account_id = p_actor and d.status <> 'completed')
  then return jsonb_build_object('code','forbidden'); end if;
  select * into l from public.tiq_leagues where id = p_league and created_by_user_id = p_actor
    and is_public and season_status = 'active' and updated_at = p_league_version for update;
  if not found then return jsonb_build_object('code','stale'); end if;

  digest := encode(sha256(convert_to(jsonb_build_array(p_actor,p_league,p_match,extract(epoch from p_match_version),
    p_a,p_b,p_date,p_time,p_venue,p_court,p_duration,p_notify)::text,'UTF8')),'hex');
  select * into operation from private.native_league_match_operations where request_id = p_request;
  if found then
    select * into f from public.tiq_league_schedule_items where id = operation.match_id and league_id = p_league;
    if not found or operation.request_digest <> digest or operation.match_digest <> private.native_league_fixture_digest(f)
    then return jsonb_build_object('code','stale'); end if;
    return jsonb_build_object('code','saved','match',private.native_league_scheduled_match(f,operation.court,operation.duration_minutes),
      'notified',operation.notified_count,'unreachable',operation.unreachable_sides);
  end if;

  -- Lock the approved entries while their names and contacts are used.
  if l.league_format = 'team' then
    perform 1 from public.tiq_team_league_entries where id in (p_a,p_b) and league_id = p_league order by id for share;
  else
    perform 1 from public.tiq_player_league_entries where id in (p_a,p_b) and league_id = p_league order by id for share;
  end if;
  select r.* into a from private.native_league_schedule_roster(p_league,l.league_format) r where r.id = p_a;
  select r.* into b from private.native_league_schedule_roster(p_league,l.league_format) r where r.id = p_b;
  if a.id is null or b.id is null or lower(a.name) = lower(b.name)
    or exists (select 1 from private.native_league_schedule_roster(p_league,l.league_format) r
      where (lower(r.name) = lower(a.name) and r.id <> a.id) or (lower(r.name) = lower(b.name) and r.id <> b.id))
  then return jsonb_build_object('code','roster'); end if;
  zone := coalesce(nullif(l.schedule_time_zone,''),'America/Chicago');
  slot := p_date + p_time;
  finish := slot + make_interval(mins => p_duration);
  if (slot at time zone zone) <= clock_timestamp() or ((slot at time zone zone) at time zone zone) <> slot
    or p_date < l.starts_on or p_date > l.ends_on then return jsonb_build_object('code','date'); end if;
  select v.name,v.detail into venue_name,venue_address from private.native_league_schedule_venues(p_league) v where v.id = p_venue;
  if not found then return jsonb_build_object('code','venue'); end if;
  facility_label := venue_name || case when p_court = '' then '' else ' · Court ' || p_court end;
  if p_venue <> 'league-venue' and length(facility_label || ' — ' || venue_address) <= 240
  then facility_label := facility_label || ' — ' || venue_address; end if;

  if p_match is not null then
    select * into previous from public.tiq_league_schedule_items f0 where f0.id = p_match and f0.league_id = p_league for update;
    if not found or previous.updated_at <> p_match_version or previous.league_format <> l.league_format
      or previous.status not in ('confirmed','coordinator_set')
      or previous.scheduled_date + coalesce(previous.scheduled_time,time '00:00') <= clock_timestamp() at time zone zone
      or previous.participant_a_name <> a.name or previous.participant_b_name <> b.name
      or coalesce(nullif(previous.participant_a_id,''),p_a::text) <> p_a::text
      or coalesce(nullif(previous.participant_b_id,''),p_b::text) <> p_b::text
      or exists (select 1 from public.tiq_individual_league_results r where r.schedule_item_id = p_match)
      or exists (select 1 from public.tiq_team_league_match_events r where r.schedule_item_id = p_match)
      or exists (select 1 from public.native_captain_court_results r where r.fixture_id = p_match)
    then return jsonb_build_object('code','stale'); end if;
    select o.original_fixture into original from private.native_league_match_operations o
      where o.match_id = p_match and o.match_version = previous.updated_at and o.match_digest = private.native_league_fixture_digest(previous);
    if not found then
      original := jsonb_build_object('id',previous.id,'date',previous.scheduled_date,'time',coalesce(previous.scheduled_time::text,''),
        'facility',btrim(previous.facility),'a',btrim(previous.participant_a_name),'b',btrim(previous.participant_b_name),'status',previous.status);
    end if;
    if previous.scheduled_date = p_date and previous.scheduled_time = p_time and previous.facility = facility_label
      and coalesce((select o.duration_minutes from private.native_league_match_operations o
        where o.match_id = p_match and o.match_version = previous.updated_at and o.match_digest = private.native_league_fixture_digest(previous)),
        case when l.league_format = 'team' then 120 else 90 end) = p_duration
    then return jsonb_build_object('code','unchanged'); end if;
  elsif (select count(*) from public.tiq_league_schedule_items f0 where f0.league_id = p_league and f0.status <> 'cancelled') >= l.max_match_events
  then return jsonb_build_object('code','capacity'); end if;

  -- Within this league, check the entire booking window, including adjacent
  -- dates. Unlabelled courts at the same venue conservatively share a slot.
  if exists (
    select 1 from public.tiq_league_schedule_items f0
    left join private.native_league_match_operations o on o.match_id = f0.id and o.match_version = f0.updated_at
      and o.match_digest = private.native_league_fixture_digest(f0)
    where f0.league_id = p_league and f0.id is distinct from p_match
      and f0.status in ('confirmed','coordinator_set') and f0.scheduled_date between p_date - 1 and p_date + 1
      and f0.scheduled_date + f0.scheduled_time < finish
      and f0.scheduled_date + f0.scheduled_time + make_interval(mins => coalesce(o.duration_minutes,
        case when l.league_format = 'team' then 120 else 90 end)) > slot
      and (f0.participant_a_id in (p_a::text,p_b::text) or f0.participant_b_id in (p_a::text,p_b::text)
        or lower(btrim(f0.participant_a_name)) in (lower(a.name),lower(b.name))
        or lower(btrim(f0.participant_b_name)) in (lower(a.name),lower(b.name))
        or ((o.venue_id = p_venue or lower(btrim(split_part(split_part(f0.facility,' — ',1),' · Court ',1))) = lower(venue_name))
          and (p_court = '' or coalesce(o.court,'') = '' or lower(o.court) = lower(p_court))))
  ) then return jsonb_build_object('code','overlap'); end if;

  if p_match is null then
    insert into public.tiq_league_schedule_items (league_id,league_format,participant_a_id,participant_a_name,
      participant_b_id,participant_b_name,scheduled_date,scheduled_time,facility,status,proposed_by_user_id,
      confirmed_by_user_id,created_by_user_id,updated_by_user_id)
    values (p_league,l.league_format,p_a::text,a.name,p_b::text,b.name,p_date,p_time,facility_label,
      'coordinator_set',p_actor,p_actor,p_actor,p_actor) returning * into f;
  else
    update public.tiq_league_schedule_items set participant_a_id = p_a::text, participant_b_id = p_b::text,
      scheduled_date = p_date, scheduled_time = p_time, facility = facility_label, status = 'coordinator_set',
      confirmed_by_user_id = p_actor, updated_by_user_id = p_actor, updated_at = clock_timestamp()
    where id = p_match returning * into f;
  end if;
  insert into private.native_league_match_operations (request_id,match_id,request_digest,match_version,match_digest,
    venue_id,court,duration_minutes,original_fixture,rescheduled)
  values (p_request,f.id,digest,f.updated_at,private.native_league_fixture_digest(f),p_venue,p_court,p_duration,original,p_match is not null);

  if p_notify then
    for target in select recipient, array_agg(entry_id order by entry_id) as entries
      from private.native_league_schedule_recipients(p_league,l.league_format,array[p_a,p_b])
      where recipient <> p_actor and not exists (
        select 1 from public.internal_notification_preferences pref where pref.profile_id = recipient and not pref.schedule_alerts_enabled
      ) and not exists (
        select 1 from public.team_chat_blocks block
        where (block.owner_user_id = recipient and block.blocked_user_id = p_actor)
           or (block.owner_user_id = p_actor and block.blocked_user_id = recipient)
      ) group by recipient order by recipient
    loop
      notified_entries := notified_entries || target.entries;
      insert into public.internal_notifications (recipient_profile_id,actor_user_id,notification_type,title,body,href)
      values (target.recipient,p_actor,'schedule',case when p_match is null then 'League match scheduled' else 'League match rescheduled' end,
        a.name || ' vs ' || b.name || ' · ' || to_char(p_date,'Dy, Mon FMDD') || ' · ' || to_char(p_time,'FMHH12:MI AM')
          || ' (' || zone || ') · ' || facility_label,
        '/explore/leagues/tiq/' || p_league || '?scheduledMatch=' || f.id || '#league-schedule')
      returning id into notice_id;
      insert into private.native_league_match_notices values (notice_id,p_request,target.entries);
      count_notified := count_notified + 1;
    end loop;
    select count(*) into unreachable from unnest(array[p_a,p_b]) e(id)
      where e.id <> all(notified_entries) and not exists (
        select 1 from private.native_league_schedule_recipients(p_league,l.league_format,array[e.id]) r where r.recipient = p_actor);
    update private.native_league_match_operations set notified_count = count_notified, unreachable_sides = unreachable where request_id = p_request;
  end if;
  return jsonb_build_object('code','saved','match',private.native_league_scheduled_match(f,p_court,p_duration),
    'notified',count_notified,'unreachable',unreachable);
end;
$$;
revoke all on function public.native_first_party_save_league_match(uuid,text,timestamptz,uuid,uuid,timestamptz,uuid,uuid,date,time,text,text,integer,boolean) from public, anon, authenticated;
grant execute on function public.native_first_party_save_league_match(uuid,text,timestamptz,uuid,uuid,timestamptz,uuid,uuid,date,time,text,text,integer,boolean) to service_role;

create function private.native_league_match_updates()
returns table (id uuid, recipient_profile_id uuid, notification_type text, title text, body text,
  href text, conversation_id uuid, schedule_event_id uuid, read_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id,n.recipient_profile_id,'schedule',
    case when o.rescheduled then 'League match rescheduled' else 'League match scheduled' end,
    f.participant_a_name || ' vs ' || f.participant_b_name || ' · ' || to_char(f.scheduled_date,'Dy, Mon FMDD')
      || ' · ' || to_char(f.scheduled_time,'FMHH12:MI AM') || ' (' || coalesce(nullif(l.schedule_time_zone,''),'America/Chicago')
      || ') · ' || f.facility,
    '/explore/leagues/tiq/' || l.id || '?scheduledMatch=' || f.id || '#league-schedule',null::uuid,null::uuid,n.read_at,n.created_at
  from public.internal_notifications n
  join private.native_league_match_notices receipt on receipt.notification_id = n.id
  join private.native_league_match_operations o on o.request_id = receipt.request_id
  join public.tiq_league_schedule_items f on f.id = o.match_id
  join public.tiq_leagues l on l.id = f.league_id and l.created_by_user_id = n.actor_user_id
  where n.recipient_profile_id = (select auth.uid()) and n.notification_type = 'schedule'
    and l.is_public and l.season_status = 'active'
    and f.status = 'coordinator_set' and f.updated_at = o.match_version and private.native_league_fixture_digest(f) = o.match_digest
    and not exists (
      select 1 from public.team_chat_blocks block
      where (block.owner_user_id = n.recipient_profile_id and block.blocked_user_id = n.actor_user_id)
         or (block.owner_user_id = n.actor_user_id and block.blocked_user_id = n.recipient_profile_id)
    )
    and exists (select 1 from private.native_league_schedule_recipients(l.id,l.league_format,receipt.entry_ids) r
      where r.recipient = n.recipient_profile_id);
$$;
revoke all on function private.native_league_match_updates() from public, anon, authenticated;
grant execute on function private.native_league_match_updates() to authenticated;

do $$
declare definition text := rtrim(pg_get_viewdef('public.native_first_party_updates'::regclass), ';' || chr(10) || ' ');
begin
  execute 'create or replace view public.native_first_party_updates with (security_invoker=true) as '
    || definition || ' union all select * from private.native_league_match_updates()';
end;
$$;
notify pgrst, 'reload schema';
commit;
