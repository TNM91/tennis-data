create function public.save_native_team_lineup_with_tactics(
  p_owner uuid, p_room uuid, p_team text, p_league text, p_flight text,
  p_revision uuid, p_expected uuid, p_version uuid, p_courts jsonb,
  p_keep_tactics boolean, p_tactics jsonb
) returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public set lock_timeout = '3s'
as $$
declare
  saved jsonb;
  result jsonb;
  tactics jsonb;
  shared_plan jsonb;
begin
  if p_keep_tactics is null or (p_keep_tactics and p_tactics is not null)
    or (p_tactics is not null and (
      jsonb_typeof(p_tactics) is distinct from 'object'
      or jsonb_typeof(p_tactics->'reference') is distinct from 'object'
      or jsonb_typeof(p_tactics->'board') is distinct from 'object'
      -- Match the board contract's 160,000 characters, allowing UTF-8 and JSONB spacing.
      or octet_length(p_tactics::text) > 500000
    )) then return '{"status":400}'::jsonb; end if;

  -- Use the room lock taken by the existing lineup and fixture writers.
  perform 1 from public.internal_conversations where id = p_room for update;
  select fixture.lineup into saved from public.native_team_next_fixtures as fixture
    where fixture.room_id = p_room and fixture.revision = p_revision;

  result := public.save_native_team_lineup(
    p_owner, p_room, p_team, p_league, p_flight, p_revision, p_expected, p_version, p_courts
  );
  if result->>'status' <> '200' then return result; end if;

  tactics := case when p_keep_tactics then saved->'tactics' else p_tactics end;
  if saved->>'version' = p_version::text then
    if saved->'tactics' is distinct from tactics then return '{"status":409}'::jsonb; end if;
    return result;
  end if;

  shared_plan := result->'lineup';
  if tactics is not null then
    shared_plan := shared_plan || jsonb_build_object('tactics', tactics);
    update public.native_team_next_fixtures set lineup = shared_plan
      where room_id = p_room and revision = p_revision;
  end if;
  return jsonb_build_object('status', 200, 'lineup', shared_plan);
end;
$$;

revoke all on function public.save_native_team_lineup_with_tactics(uuid,uuid,text,text,text,uuid,uuid,uuid,jsonb,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.save_native_team_lineup_with_tactics(uuid,uuid,text,text,text,uuid,uuid,uuid,jsonb,boolean,jsonb) to service_role;
notify pgrst, 'reload schema';
