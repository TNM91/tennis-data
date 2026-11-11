begin;
set local lock_timeout = '5s';

create table public.native_team_next_fixtures (
  room_id uuid primary key references public.internal_conversations(id) on delete cascade,
  revision uuid not null,
  fixture jsonb check (fixture is null or jsonb_typeof(fixture) = 'object'),
  lineup jsonb check (lineup is null or jsonb_typeof(lineup) = 'object')
);

alter table public.native_team_next_fixtures enable row level security;
revoke all on public.native_team_next_fixtures from public, anon, authenticated;
grant select, insert, update on public.native_team_next_fixtures to service_role;

create table public.native_team_fixture_replies (
  room_id uuid not null references public.native_team_next_fixtures(room_id) on delete cascade,
  profile_id uuid not null,
  fixture_revision uuid not null,
  operation_id uuid not null,
  choice text not null check (choice in ('in', 'maybe', 'out')),
  primary key (room_id, profile_id),
  foreign key (room_id, profile_id)
    references public.internal_conversation_participants(conversation_id, profile_id) on delete cascade
);

alter table public.native_team_fixture_replies enable row level security;
revoke all on public.native_team_fixture_replies from public, anon, authenticated;
grant select, insert, update, delete on public.native_team_fixture_replies to service_role;

create table public.native_team_fixture_history (
  room_id uuid not null references public.internal_conversations(id) on delete cascade,
  fixture_id uuid not null,
  fixture jsonb not null check (jsonb_typeof(fixture) = 'object'),
  match_date date not null,
  result_revision uuid,
  won smallint,
  lost smallint,
  lineup jsonb check (lineup is null or jsonb_typeof(lineup) = 'object'),
  court_scores jsonb not null default '[]'::jsonb
    check (case when jsonb_typeof(court_scores) = 'array' then jsonb_array_length(court_scores) <= 30 else false end),
  primary key (room_id, fixture_id),
  check ((result_revision is null and won is null and lost is null) or
    (result_revision is not null and won is not null and lost is not null and
     won between 0 and 99 and lost between 0 and 99 and won + lost > 0))
);
create index native_team_fixture_history_recent_idx on public.native_team_fixture_history (room_id, match_date desc, fixture_id);
create index native_team_next_fixture_lineup_profiles_idx on public.native_team_next_fixtures using gin ((lineup->'names'));
create index native_team_fixture_history_lineup_profiles_idx on public.native_team_fixture_history using gin ((lineup->'names'));

alter table public.native_team_fixture_history enable row level security;
revoke all on public.native_team_fixture_history from public, anon, authenticated;
grant select, insert, update on public.native_team_fixture_history to service_role;

create function public.erase_native_team_lineup_profile()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  update public.native_team_next_fixtures set lineup = null where (lineup->'names') ? old.id::text;
  update public.native_team_fixture_history set lineup = null where (lineup->'names') ? old.id::text;
  return old;
end;
$$;
revoke all on function public.erase_native_team_lineup_profile() from public, anon, authenticated;
create trigger native_team_lineup_profile_erasure before delete on public.profiles
for each row execute function public.erase_native_team_lineup_profile();

create function public.read_native_team_results(p_room uuid, p_can_edit boolean)
returns jsonb language sql stable security invoker
set search_path = pg_catalog, public
as $$
  with recent as (
    select fixture_id, fixture, match_date, result_revision, won, lost, court_scores, lineup
    from public.native_team_fixture_history
    where room_id = p_room and (p_can_edit is true or result_revision is not null)
    order by match_date desc, fixture_id
    limit 21
  )
  select jsonb_build_object(
    'record', (select jsonb_build_object(
      'wins', count(*) filter (where won > lost),
      'losses', count(*) filter (where won < lost),
      'ties', count(*) filter (where won = lost)
    ) from public.native_team_fixture_history where room_id = p_room and result_revision is not null),
    'entries', (select coalesce(jsonb_agg(jsonb_build_object(
      'fixtureId', fixture_id, 'match', fixture,
      'score', case when result_revision is not null then jsonb_build_object(
        'revision', result_revision, 'won', won, 'lost', lost
      ) || case when court_scores <> '[]'::jsonb then jsonb_build_object('courtScores', court_scores) else '{}'::jsonb end end,
      'plannedLineup', case when p_can_edit then lineup end
    ) order by match_date desc, fixture_id), '[]'::jsonb) from recent),
    'current', (select jsonb_build_object('fixtureId', revision, 'match', fixture, 'score', null, 'plannedLineup', lineup)
      from public.native_team_next_fixtures where p_can_edit is true and room_id = p_room and fixture is not null)
  );
$$;

revoke all on function public.read_native_team_results(uuid,boolean) from public, anon, authenticated;
grant execute on function public.read_native_team_results(uuid,boolean) to service_role;

create function public.set_native_team_next_fixture(
  p_owner uuid, p_room uuid, p_team text, p_league text, p_flight text,
  p_expected uuid, p_revision uuid, p_fixture jsonb, p_archive boolean
) returns integer language plpgsql security invoker
set search_path = pg_catalog, public set lock_timeout = '3s'
as $$
declare
  saved public.native_team_next_fixtures%rowtype;
begin
  p_fixture := nullif(p_fixture, 'null'::jsonb);
  if p_owner is null or p_room is null or p_team is null or p_league is null or p_flight is null
      or p_revision is null or p_expected = p_revision
      or (p_fixture is not null and jsonb_typeof(p_fixture) <> 'object') then
    return 400;
  end if;

  perform 1 from public.internal_conversations where id = p_room and status = 'open'
    and related_entity_type = 'team_room' and related_entity_id = concat_ws('__',
      btrim(regexp_replace(lower(p_team), '[^a-z0-9]+', ' ', 'g')),
      btrim(regexp_replace(lower(p_league), '[^a-z0-9]+', ' ', 'g')),
      btrim(regexp_replace(lower(p_flight), '[^a-z0-9]+', ' ', 'g'))) for update;
  if not found then return 403; end if;

  perform 1 from public.team_profile_links
    where profile_user_id = p_owner and team_name = p_team and league_name = p_league and flight = p_flight
      and status = 'accepted' and archived_at is null and source_type in ('manual_invite', 'tiq_entry')
      and coalesce(team_roles, array[team_role]) && array['captain', 'co_captain']::text[] for share;
  if not found then return 403; end if;

  perform 1 from public.internal_conversation_participants
    where conversation_id = p_room and profile_id = p_owner for share;
  if not found or exists (select 1 from public.team_room_member_removals
    where conversation_id = p_room and profile_id = p_owner) then return 403; end if;

  select * into saved from public.native_team_next_fixtures where room_id = p_room;
  if saved.revision = p_revision then
    if saved.fixture is not distinct from p_fixture then return 200; end if;
    return 409;
  end if;
  if saved.revision is distinct from p_expected then return 409; end if;
  if exists(select 1 from public.native_team_fixture_history where room_id = p_room and fixture_id = p_revision)
    then return 409; end if;

  if p_archive and saved.fixture is not null then
    insert into public.native_team_fixture_history (room_id, fixture_id, fixture, match_date, lineup)
      values (p_room, saved.revision, saved.fixture, (saved.fixture->>'date')::date, saved.lineup)
      on conflict (room_id, fixture_id) do nothing;
  end if;
  delete from public.native_team_fixture_replies where room_id = p_room;
  -- Keep the revision after removing a match so an older save cannot recreate it.
  insert into public.native_team_next_fixtures (room_id, revision, fixture, lineup)
    values (p_room, p_revision, p_fixture, case when p_archive is not true and
      saved.fixture->>'date' = p_fixture->>'date' and saved.fixture->>'opponent' = p_fixture->>'opponent' then saved.lineup end)
    on conflict (room_id) do update set revision = excluded.revision, fixture = excluded.fixture, lineup = excluded.lineup;
  return 200;
end;
$$;

revoke all on function public.set_native_team_next_fixture(uuid,uuid,text,text,text,uuid,uuid,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.set_native_team_next_fixture(uuid,uuid,text,text,text,uuid,uuid,jsonb,boolean) to service_role;

create function public.save_native_team_result(
  p_owner uuid, p_room uuid, p_team text, p_league text, p_flight text, p_fixture uuid,
  p_expected uuid, p_revision uuid, p_won integer, p_lost integer, p_allow_current boolean, p_court_scores jsonb
) returns integer language plpgsql security invoker
set search_path = pg_catalog, public set lock_timeout = '3s'
as $$
declare
  saved public.native_team_fixture_history%rowtype;
  active_match public.native_team_next_fixtures%rowtype;
begin
  p_court_scores := nullif(p_court_scores, 'null'::jsonb);
  if p_owner is null or p_room is null or p_team is null or p_league is null or p_flight is null
    or p_fixture is null or p_revision is null or p_revision = p_expected
    or p_won is null or p_lost is null or p_won not between 0 and 99 or p_lost not between 0 and 99
    or p_won + p_lost = 0 then return 400; end if;
  if p_court_scores is not null then
    if jsonb_typeof(p_court_scores) <> 'array' then return 400; end if;
    if jsonb_array_length(p_court_scores) not in (0, p_won + p_lost) or jsonb_array_length(p_court_scores) > 30 then return 400; end if;
  end if;

  perform 1 from public.internal_conversations where id = p_room and status = 'open'
    and related_entity_type = 'team_room' and related_entity_id = concat_ws('__',
      btrim(regexp_replace(lower(p_team), '[^a-z0-9]+', ' ', 'g')),
      btrim(regexp_replace(lower(p_league), '[^a-z0-9]+', ' ', 'g')),
      btrim(regexp_replace(lower(p_flight), '[^a-z0-9]+', ' ', 'g'))) for update;
  if not found then return 403; end if;

  perform 1 from public.team_profile_links
    where profile_user_id = p_owner and team_name = p_team and league_name = p_league and flight = p_flight
      and status = 'accepted' and archived_at is null and source_type in ('manual_invite', 'tiq_entry')
      and coalesce(team_roles, array[team_role]) && array['captain', 'co_captain']::text[] for share;
  if not found then return 403; end if;
  perform 1 from public.internal_conversation_participants
    where conversation_id = p_room and profile_id = p_owner for share;
  if not found or exists(select 1 from public.team_room_member_removals where conversation_id = p_room and profile_id = p_owner)
    then return 403; end if;

  select * into saved from public.native_team_fixture_history where room_id = p_room and fixture_id = p_fixture;
  if saved.result_revision = p_revision then
    if saved.won = p_won and saved.lost = p_lost and (p_court_scores is null or saved.court_scores = p_court_scores) then return 200; end if;
    return 409;
  end if;
  if saved.result_revision is distinct from p_expected then return 409; end if;

  if found then
    if p_court_scores is null and saved.court_scores <> '[]'::jsonb and (saved.won <> p_won or saved.lost <> p_lost) then return 409; end if;
    update public.native_team_fixture_history set result_revision = p_revision, won = p_won, lost = p_lost,
      court_scores = coalesce(p_court_scores, saved.court_scores)
      where room_id = p_room and fixture_id = p_fixture;
    return 200;
  end if;
  if p_allow_current is not true then return 409; end if;
  select * into active_match from public.native_team_next_fixtures where room_id = p_room and revision = p_fixture;
  if active_match.fixture is null then return 409; end if;

  insert into public.native_team_fixture_history (room_id, fixture_id, fixture, match_date, result_revision, won, lost, court_scores, lineup)
    values (p_room, p_fixture, active_match.fixture, (active_match.fixture->>'date')::date, p_revision, p_won, p_lost,
      coalesce(p_court_scores, '[]'::jsonb), active_match.lineup);
  update public.native_team_next_fixtures set fixture = null, lineup = null where room_id = p_room and revision = p_fixture;
  delete from public.native_team_fixture_replies where room_id = p_room;
  return 200;
end;
$$;

revoke all on function public.save_native_team_result(uuid,uuid,text,text,text,uuid,uuid,uuid,integer,integer,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.save_native_team_result(uuid,uuid,text,text,text,uuid,uuid,uuid,integer,integer,boolean,jsonb) to service_role;

create function public.reply_to_native_team_fixture(
  p_owner uuid, p_room uuid, p_team text, p_league text, p_flight text,
  p_revision uuid, p_expected uuid, p_operation uuid, p_choice text
) returns integer language plpgsql security invoker
set search_path = pg_catalog, public set lock_timeout = '3s'
as $$
declare
  saved public.native_team_fixture_replies%rowtype;
begin
  if p_owner is null or p_room is null or p_team is null or p_league is null or p_flight is null
    or p_revision is null or p_operation is null or p_expected = p_operation
    or p_choice is null or p_choice not in ('in', 'maybe', 'out') then return 400; end if;

  perform 1 from public.internal_conversations where id = p_room and status = 'open'
    and related_entity_type = 'team_room' and related_entity_id = concat_ws('__',
      btrim(regexp_replace(lower(p_team), '[^a-z0-9]+', ' ', 'g')),
      btrim(regexp_replace(lower(p_league), '[^a-z0-9]+', ' ', 'g')),
      btrim(regexp_replace(lower(p_flight), '[^a-z0-9]+', ' ', 'g'))) for update;
  if not found then return 403; end if;

  perform 1 from public.team_profile_links
    where profile_user_id = p_owner and team_name = p_team and league_name = p_league and flight = p_flight
      and status = 'accepted' and archived_at is null and source_type in ('manual_invite', 'tiq_entry') for share;
  if not found then return 403; end if;

  perform 1 from public.internal_conversation_participants
    where conversation_id = p_room and profile_id = p_owner for share;
  if not found or exists(select 1 from public.team_room_member_removals where conversation_id = p_room and profile_id = p_owner)
    then return 403; end if;

  if not exists(select 1 from public.native_team_next_fixtures where room_id = p_room and revision = p_revision and fixture is not null)
    then return 409; end if;
  select * into saved from public.native_team_fixture_replies where room_id = p_room and profile_id = p_owner;
  if saved.operation_id = p_operation then
    if saved.fixture_revision = p_revision and saved.choice = p_choice then return 200; end if;
    return 409;
  end if;
  if saved.operation_id is distinct from p_expected then return 409; end if;
  insert into public.native_team_fixture_replies (room_id, profile_id, fixture_revision, operation_id, choice)
    values (p_room, p_owner, p_revision, p_operation, p_choice)
    on conflict (room_id, profile_id) do update set fixture_revision = excluded.fixture_revision,
      operation_id = excluded.operation_id, choice = excluded.choice;
  return 200;
end;
$$;

revoke all on function public.reply_to_native_team_fixture(uuid,uuid,text,text,text,uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.reply_to_native_team_fixture(uuid,uuid,text,text,text,uuid,uuid,uuid,text) to service_role;

create function public.save_native_team_lineup(
  p_owner uuid, p_room uuid, p_team text, p_league text, p_flight text,
  p_revision uuid, p_expected uuid, p_version uuid, p_courts jsonb
) returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public set lock_timeout = '3s'
as $$
declare
  saved public.native_team_next_fixtures%rowtype;
  court jsonb;
  player_ids uuid[];
  player_count integer;
  names jsonb;
  plan jsonb;
begin
  if p_owner is null or p_room is null or p_team is null or p_league is null or p_flight is null
    or p_revision is null or p_version is null or p_expected = p_version
    or jsonb_typeof(p_courts) is distinct from 'array' then return '{"status":400}'::jsonb; end if;
  if jsonb_array_length(p_courts) not between 1 and 30 then return '{"status":400}'::jsonb; end if;
  for court in select value from jsonb_array_elements(p_courts) loop
    if jsonb_typeof(court->'players') is distinct from 'array' or coalesce(court->>'format','') not in ('singles','doubles')
      then return '{"status":400}'::jsonb; end if;
    if jsonb_array_length(court->'players') <> (case when court->>'format' = 'singles' then 1 else 2 end)
      or exists(select 1 from jsonb_array_elements_text(court->'players') as p(id)
        where id is null or id !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')
      then return '{"status":400}'::jsonb; end if;
  end loop;
  select array_agg(distinct p.id::uuid), count(*) into player_ids, player_count
    from jsonb_array_elements(p_courts) as c(court) cross join lateral jsonb_array_elements_text(c.court->'players') as p(id);
  if cardinality(player_ids) <> player_count then return '{"status":400}'::jsonb; end if;

  perform 1 from public.internal_conversations where id = p_room and status = 'open'
    and related_entity_type = 'team_room' and related_entity_id = concat_ws('__',
      btrim(regexp_replace(lower(p_team), '[^a-z0-9]+', ' ', 'g')),
      btrim(regexp_replace(lower(p_league), '[^a-z0-9]+', ' ', 'g')),
      btrim(regexp_replace(lower(p_flight), '[^a-z0-9]+', ' ', 'g'))) for update;
  if not found then return '{"status":403}'::jsonb; end if;
  perform 1 from public.team_profile_links where profile_user_id = p_owner and team_name = p_team and league_name = p_league
    and flight = p_flight and status = 'accepted' and archived_at is null and source_type in ('manual_invite', 'tiq_entry')
    and coalesce(team_roles, array[team_role]) && array['captain', 'co_captain']::text[] for share;
  if not found then return '{"status":403}'::jsonb; end if;
  perform 1 from public.internal_conversation_participants where conversation_id = p_room and profile_id = p_owner for share;
  if not found or exists(select 1 from public.team_room_member_removals where conversation_id = p_room and profile_id = p_owner)
    then return '{"status":403}'::jsonb; end if;

  select * into saved from public.native_team_next_fixtures where room_id = p_room and revision = p_revision;
  if saved.fixture is null then return '{"status":409}'::jsonb; end if;
  if saved.lineup->>'version' = p_version::text then
    if saved.lineup->'courts' = p_courts then return jsonb_build_object('status', 200, 'lineup', saved.lineup); end if;
    return '{"status":409}'::jsonb;
  end if;
  if saved.lineup->>'version' is distinct from p_expected::text then return '{"status":409}'::jsonb; end if;

  -- Hold the selected profiles until the snapshot is written so profile deletion can clear it atomically.
  perform 1 from public.profiles where id = any(player_ids) order by id for key share;
  select jsonb_object_agg(ids.id::text, coalesce(nullif(left(btrim(regexp_replace(profiles.message_display_name,
    '[[:cntrl:]]', '', 'g')), 50), ''), 'Teammate ' || upper(right(ids.id::text, 4)))) into names
    from unnest(player_ids) as ids(id) join public.profiles on profiles.id = ids.id
    where exists(select 1 from public.internal_conversation_participants where conversation_id = p_room and profile_id = ids.id)
      and exists(select 1 from public.team_profile_links where profile_user_id = ids.id and team_name = p_team and league_name = p_league
        and flight = p_flight and status = 'accepted' and archived_at is null and source_type in ('manual_invite', 'tiq_entry'))
      and not exists(select 1 from public.team_room_member_removals where conversation_id = p_room and profile_id = ids.id)
      and not exists(select 1 from public.native_team_fixture_replies where room_id = p_room and profile_id = ids.id
        and fixture_revision = p_revision and choice = 'out');
  if names is null or (select count(*) from jsonb_object_keys(names)) <> player_count then return '{"status":409}'::jsonb; end if;
  plan := jsonb_build_object('version', p_version, 'courts', p_courts, 'names', names);
  update public.native_team_next_fixtures set lineup = plan where room_id = p_room and revision = p_revision;
  return jsonb_build_object('status', 200, 'lineup', plan);
end;
$$;

revoke all on function public.save_native_team_lineup(uuid,uuid,text,text,text,uuid,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.save_native_team_lineup(uuid,uuid,text,text,text,uuid,uuid,uuid,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
