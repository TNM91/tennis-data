begin;
set local lock_timeout = '5s';

create table private.native_league_score_reminders (
  notification_id uuid primary key references public.internal_notifications(id) on delete cascade,
  match_id uuid not null references public.tiq_league_schedule_items(id) on delete cascade,
  fixture_digest text not null,
  correction_revision uuid,
  sent_at timestamptz not null,
  room_a uuid,
  room_b uuid
);
create index native_league_score_reminders_match on private.native_league_score_reminders(match_id,sent_at desc);
alter table private.native_league_score_reminders enable row level security;
revoke all on private.native_league_score_reminders from public, anon, authenticated, service_role;

create function private.native_league_attention_coordinator(l public.tiq_leagues, actor uuid)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(l.created_by_user_id = actor and l.league_format = 'team' and l.season_status = 'active'
    and (l.is_public or private.native_testflight_score_league(l,actor))
    and exists (select 1 from public.profiles p where p.id = actor and (
      private.native_testflight_score_league(l,actor) or p.role = 'admin' or (
        (p.tiq_team_league_entry_enabled or p.tiq_individual_league_creator_enabled)
        and (p.league_access_expires_at is null or p.league_access_expires_at > now())
      )))
    and not exists (select 1 from public.account_deletion_requests d where d.account_id = actor and d.status <> 'completed'),false);
$$;

-- The overview, the send, and Updates all use the same unresolved state.
create function private.native_league_attention_matches(l public.tiq_leagues, matches uuid[])
returns table (match_id uuid, fixture jsonb, fixture_digest text, correction_revision uuid,
  submitter uuid, correction_note text, since_at timestamptz)
language sql stable set search_path = '' as $$
  select f.id,
    private.native_league_score_fixture(f) || jsonb_build_object('status',f.status,'facility',btrim(f.facility)),
    current_fixture.digest, c.revision, c.submitted_by, coalesce(c.note,''),
    coalesce(c.updated_at, due.at)
  from public.tiq_league_schedule_items f
  cross join lateral (select private.native_league_fixture_digest(f) as digest) current_fixture
  cross join lateral (select (f.scheduled_date + 1)::timestamp at time zone
    coalesce(nullif(l.schedule_time_zone,''),'America/Chicago') as at) due
  left join private.native_league_scorecards c on c.match_id = f.id and c.fixture_digest = current_fixture.digest
  where f.league_id = l.id and f.id = any(matches) and f.league_format = 'team'
    and f.status in ('confirmed','coordinator_set','completed')
    and (c.state = 'changes_requested' or (c.match_id is null and due.at <= now()))
    and not exists (select 1 from public.tiq_team_league_match_events e
      where e.schedule_item_id = f.id or (e.schedule_item_id is null and e.league_id = l.id and e.match_date = f.scheduled_date
        and ((btrim(e.team_a_name) = btrim(f.participant_a_name) and btrim(e.team_b_name) = btrim(f.participant_b_name))
          or (btrim(e.team_b_name) = btrim(f.participant_a_name) and btrim(e.team_a_name) = btrim(f.participant_b_name)))));
$$;

create function public.native_league_score_attention(p_league text,p_version timestamptz,p_matches uuid[],p_actor uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_agg(jsonb_build_object('fixture',m.fixture,'id',m.match_id,
    'fixtureDigest',m.fixture_digest,'revision',m.correction_revision,'note',m.correction_note,
    'since',m.since_at,'nextReminderAt',recent.next_at) order by m.since_at,m.match_id)
    from private.native_league_attention_matches(l,p_matches) m
    left join lateral (
      select r.sent_at + interval '24 hours' as next_at
      from private.native_league_score_reminders r
      where r.match_id = m.match_id and r.sent_at > now() - interval '24 hours'
      order by r.sent_at desc limit 1
    ) recent on true),'[]'::jsonb)
  from public.tiq_leagues l where l.id = p_league and l.updated_at = p_version
    and cardinality(p_matches) between 0 and 100 and private.native_league_attention_coordinator(l,p_actor);
$$;

create function public.native_league_remind_score(p_actor uuid,p_league text,p_version timestamptz,p_match uuid,
  p_fixture_digest text,p_revision uuid,p_room_a uuid,p_room_b uuid,p_fixture jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l public.tiq_leagues;
  f public.tiq_league_schedule_items;
  item record;
  sent timestamptz;
  next_at timestamptz;
  delivered integer;
begin
  -- Serialize with reschedules and score writes, which lock in the same order.
  select * into l from public.tiq_leagues where id = p_league for update;
  if not found or not private.native_league_attention_coordinator(l,p_actor) then
    return jsonb_build_object('code','forbidden');
  end if;
  if l.updated_at is distinct from p_version then return jsonb_build_object('code','stale'); end if;
  select * into f from public.tiq_league_schedule_items where id = p_match and league_id = p_league for update;
  if not found then return jsonb_build_object('code','stale'); end if;
  select * into item from private.native_league_attention_matches(l,array[p_match]);
  if not found or item.fixture is distinct from p_fixture or item.fixture_digest is distinct from p_fixture_digest
    or item.correction_revision is distinct from p_revision then return jsonb_build_object('code','stale'); end if;

  sent := clock_timestamp();
  select r.sent_at + interval '24 hours' into next_at from private.native_league_score_reminders r
    where r.match_id = p_match order by r.sent_at desc limit 1;
  if next_at > sent then return jsonb_build_object('code','recent','nextReminderAt',next_at); end if;

  with candidates as (
    select item.submitter as profile_id where p_revision is not null
    union
    select r.recipient from private.native_league_schedule_roster(p_league,'team') entry
    join private.native_league_schedule_recipients(p_league,'team',array[entry.id]) r on r.entry_id = entry.id
    where p_revision is null and entry.id::text in (f.participant_a_id,f.participant_b_id)
    union
    select link.profile_user_id from public.team_profile_links link
    where p_revision is null and link.league_name = l.league_name and link.flight = l.flight
      and link.team_name in (f.participant_a_name,f.participant_b_name)
      and link.status = 'accepted' and link.archived_at is null and link.team_roles && array['captain','co_captain']
  ), notices as (
    insert into public.internal_notifications(recipient_profile_id,actor_user_id,notification_type,title,body,href,created_at)
    select p.id,p_actor,'system',
      case when p_revision is null then 'League score reminder' else 'League score correction reminder' end,
      f.participant_a_name || ' vs ' || f.participant_b_name,
      '/explore/leagues/tiq/' || l.id || '?scoreMatch=' || f.id || '#league-scores',sent
    from candidates c join public.profiles p on p.id = c.profile_id
    where (p.id <> p_actor or private.native_testflight_score_league(l,p_actor))
      and private.native_league_score_captain(p.id,l,f,p_room_a,p_room_b)
      and not exists (select 1 from public.team_chat_blocks b where
        (b.owner_user_id = p.id and b.blocked_user_id = p_actor) or (b.owner_user_id = p_actor and b.blocked_user_id = p.id))
    returning id
  )
  insert into private.native_league_score_reminders(notification_id,match_id,fixture_digest,correction_revision,sent_at,room_a,room_b)
    select id,p_match,p_fixture_digest,p_revision,sent,p_room_a,p_room_b from notices;
  get diagnostics delivered = row_count;
  if delivered = 0 then return jsonb_build_object('code','no_captains'); end if;
  return jsonb_build_object('code','sent','count',delivered,'nextReminderAt',sent + interval '24 hours');
end;
$$;

create function private.native_league_score_reminder_updates()
returns table (id uuid,recipient_profile_id uuid,notification_type text,title text,body text,
  href text,conversation_id uuid,schedule_event_id uuid,read_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id,n.recipient_profile_id,'system',
    case when r.correction_revision is null then 'League score reminder' else 'League score correction reminder' end,
    f.participant_a_name || ' vs ' || f.participant_b_name,
    '/explore/leagues/tiq/' || l.id || '?scoreMatch=' || f.id || '#league-scores',
    null::uuid,null::uuid,n.read_at,n.created_at
  from public.internal_notifications n
  join private.native_league_score_reminders r on r.notification_id = n.id
  join public.tiq_league_schedule_items f on f.id = r.match_id
  join public.tiq_leagues l on l.id = f.league_id and l.season_status = 'active'
    and (l.is_public or private.native_testflight_score_league(l,n.recipient_profile_id))
  cross join lateral private.native_league_attention_matches(l,array[f.id]) m
  where n.recipient_profile_id = (select auth.uid()) and n.actor_user_id = l.created_by_user_id
    and m.fixture_digest = r.fixture_digest and m.correction_revision is not distinct from r.correction_revision
    and (r.correction_revision is null or m.submitter = n.recipient_profile_id)
    and not exists (select 1 from public.team_chat_blocks b where
      (b.owner_user_id = n.recipient_profile_id and b.blocked_user_id = n.actor_user_id)
      or (b.owner_user_id = n.actor_user_id and b.blocked_user_id = n.recipient_profile_id))
    and private.native_league_score_captain(n.recipient_profile_id,l,f,r.room_a,r.room_b);
$$;

revoke all on function private.native_league_attention_coordinator(public.tiq_leagues,uuid),
  private.native_league_attention_matches(public.tiq_leagues,uuid[]) from public, anon, authenticated;
revoke all on function public.native_league_score_attention(text,timestamptz,uuid[],uuid),
  public.native_league_remind_score(uuid,text,timestamptz,uuid,text,uuid,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.native_league_score_attention(text,timestamptz,uuid[],uuid),
  public.native_league_remind_score(uuid,text,timestamptz,uuid,text,uuid,uuid,uuid,jsonb) to service_role;
revoke all on function private.native_league_score_reminder_updates() from public, anon, authenticated;
grant execute on function private.native_league_score_reminder_updates() to authenticated;

do $$
declare definition text := rtrim(pg_get_viewdef('public.native_first_party_updates'::regclass), ';' || chr(10) || ' ');
begin
  execute 'create or replace view public.native_first_party_updates with (security_invoker=true) as '
    || definition || ' union all select * from private.native_league_score_reminder_updates()';
end;
$$;

notify pgrst,'reload schema';
commit;
