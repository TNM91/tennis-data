begin;
set local lock_timeout = '5s';

do $$ begin
  if not public.account_erasure_catalog_ready() then raise exception 'Review the existing account deletion catalog'; end if;
end $$;

create table public.native_team_result_players (
  room_id uuid not null,
  fixture_id uuid not null,
  result_revision uuid not null,
  court_number smallint not null check (court_number between 1 and 30),
  seat smallint not null check (seat between 1 and 2),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (room_id, fixture_id, court_number, seat),
  unique (room_id, fixture_id, profile_id),
  foreign key (room_id, fixture_id) references public.native_team_fixture_history(room_id, fixture_id) on delete cascade
);
create index native_team_result_players_profile_idx on public.native_team_result_players (profile_id);
alter table public.native_team_result_players enable row level security;
revoke all on public.native_team_result_players from public, anon, authenticated;
grant select, insert, update, delete on public.native_team_result_players to service_role;

create function public.read_native_team_result_players(p_room uuid, p_fixtures uuid[])
returns jsonb language sql stable security invoker set search_path = pg_catalog, public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'fixture_id', p.fixture_id, 'result_revision', p.result_revision, 'court_number', p.court_number,
    'profile_id', p.profile_id, 'name', coalesce(nullif(left(btrim(regexp_replace(m.message_display_name,
      '[[:cntrl:]]', '', 'g')), 50), ''), 'Teammate ' || upper(right(p.profile_id::text, 4)))
  ) order by p.fixture_id, p.court_number, p.seat), '[]'::jsonb)
  from public.native_team_result_players p join public.profiles m on m.id = p.profile_id
  where p.room_id = p_room and cardinality(p_fixtures) between 1 and 20 and p.fixture_id = any(p_fixtures);
$$;
revoke all on function public.read_native_team_result_players(uuid,uuid[]) from public, anon, authenticated;
grant execute on function public.read_native_team_result_players(uuid,uuid[]) to service_role;

create function public.save_native_team_result_with_players(
  p_owner uuid, p_room uuid, p_team text, p_league text, p_flight text, p_fixture uuid,
  p_expected uuid, p_revision uuid, p_won integer, p_lost integer, p_allow_current boolean,
  p_court_scores jsonb, p_court_players jsonb
) returns integer language plpgsql security invoker
set search_path = pg_catalog, public set lock_timeout = '3s'
as $$
declare
  previous public.native_team_fixture_history%rowtype;
  result integer;
  court jsonb;
  court_index integer;
  requested_ids uuid[];
  requested_count integer;
  recorded jsonb;
begin
  p_court_players := nullif(p_court_players, 'null'::jsonb);
  p_court_scores := nullif(p_court_scores, 'null'::jsonb);
  if p_court_players is not null then
    if jsonb_typeof(p_court_players) <> 'array' or jsonb_typeof(p_court_scores) is distinct from 'array' then return 400; end if;
    if jsonb_array_length(p_court_players) <> jsonb_array_length(p_court_scores) or jsonb_array_length(p_court_players) > 30 then return 400; end if;
    for court_index in 0..jsonb_array_length(p_court_players)-1 loop
      court := p_court_players->court_index;
      if jsonb_typeof(court) is distinct from 'array' then return 400; end if;
      if jsonb_array_length(court) > 2 or (jsonb_array_length(court) > 0 and p_court_scores->>court_index in ('W-DEFAULT','L-DEFAULT'))
        or exists(select 1 from jsonb_array_elements_text(court) as p(id)
          where id is null or id !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') then return 400; end if;
    end loop;
    select coalesce(array_agg(distinct p.id::uuid), '{}'), count(*) into requested_ids, requested_count
    from jsonb_array_elements(p_court_players) as c(players) cross join lateral jsonb_array_elements_text(c.players) as p(id);
    if cardinality(requested_ids) <> requested_count then return 400; end if;
  end if;

  -- Use the same room lock as schedule edits and the score writer for one result revision.
  perform 1 from public.internal_conversations where id = p_room for update;
  select * into previous from public.native_team_fixture_history where room_id = p_room and fixture_id = p_fixture;
  result := public.save_native_team_result(p_owner,p_room,p_team,p_league,p_flight,p_fixture,p_expected,p_revision,
    p_won,p_lost,p_allow_current,p_court_scores);
  if result <> 200 then return result; end if;

  if previous.result_revision = p_revision then
    if p_court_players is null then return 200; end if;
    select coalesce(jsonb_agg(coalesce((select jsonb_agg(p.profile_id order by p.seat)
      from public.native_team_result_players p where p.room_id = p_room and p.fixture_id = p_fixture
        and p.court_number = c.number), '[]'::jsonb) order by c.number), '[]'::jsonb) into recorded
      from generate_series(1,jsonb_array_length(p_court_players)) as c(number);
    if recorded = p_court_players then return 200; end if;
    return 409;
  end if;

  if p_court_players is null then
    if p_court_scores is not null and jsonb_array_length(p_court_scores) <> jsonb_array_length(previous.court_scores) then
      delete from public.native_team_result_players where room_id = p_room and fixture_id = p_fixture;
    else
      delete from public.native_team_result_players where room_id = p_room and fixture_id = p_fixture
        and p_court_scores->>(court_number-1) in ('W-DEFAULT','L-DEFAULT');
      update public.native_team_result_players set result_revision = p_revision where room_id = p_room and fixture_id = p_fixture;
    end if;
    return 200;
  end if;

  perform 1 from public.profiles where id = any(requested_ids) order by id for key share;
  if exists(select 1 from jsonb_array_elements(p_court_players) with ordinality as c(players,number)
    cross join lateral jsonb_array_elements_text(c.players) with ordinality as p(id,seat)
    where not exists(select 1 from public.profiles where id = p.id::uuid)
    or (not exists(select 1 from public.native_team_result_players old where old.room_id = p_room
        and old.fixture_id = p_fixture and old.court_number = c.number and old.profile_id = p.id::uuid)
      and (not exists(select 1 from public.internal_conversation_participants where conversation_id = p_room and profile_id = p.id::uuid)
        or not exists(select 1 from public.team_profile_links where profile_user_id = p.id::uuid and team_name = p_team
          and league_name = p_league and flight = p_flight and status = 'accepted' and archived_at is null
          and source_type in ('manual_invite','tiq_entry'))
        or exists(select 1 from public.team_room_member_removals where conversation_id = p_room and profile_id = p.id::uuid))))
    then raise exception using errcode = 'P0261', message = 'Team result player changed'; end if;

  delete from public.native_team_result_players where room_id = p_room and fixture_id = p_fixture;
  insert into public.native_team_result_players(room_id,fixture_id,result_revision,court_number,seat,profile_id)
    select p_room,p_fixture,p_revision,c.number,p.seat,p.id::uuid
    from jsonb_array_elements(p_court_players) with ordinality as c(players,number)
    cross join lateral jsonb_array_elements_text(c.players) with ordinality as p(id,seat);
  return 200;
exception when sqlstate 'P0261' then
  return 409;
end;
$$;
revoke all on function public.save_native_team_result_with_players(uuid,uuid,text,text,text,uuid,uuid,uuid,integer,integer,boolean,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.save_native_team_result_with_players(uuid,uuid,text,text,text,uuid,uuid,uuid,integer,integer,boolean,jsonb,jsonb) to service_role;

do $catalog$
declare
  source text := pg_catalog.pg_get_functiondef('public.account_erasure_catalog_ready()'::regprocedure);
  previous_columns constant text := '7d20fc83acb244389c96c56b6c2d685f';
  next_columns constant text := '806febd4e4da78213a78fc4f6196b433';
  foreign_keys_marker constant text := $marker$jsonb_to_recordset('[$marker$;
  player_key constant text := '{"t":"native_team_result_players","c":"profile_id","p":"profiles","d":"c","n":false},';
begin
  if length(source) - length(replace(source, previous_columns, '')) <> length(previous_columns)
     or length(source) - length(replace(source, foreign_keys_marker, '')) <> length(foreign_keys_marker) then
    raise exception 'The reviewed account deletion catalog markers changed';
  end if;
  execute replace(replace(source, previous_columns, next_columns), foreign_keys_marker, foreign_keys_marker || player_key);
  if not public.account_erasure_catalog_ready() then raise exception 'Account deletion catalog did not validate with result players'; end if;
end $catalog$;

notify pgrst,'reload schema';
commit;
