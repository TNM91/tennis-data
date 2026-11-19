begin;
set local lock_timeout = '5s';

do $erasure$
begin
  if not exists(select 1 from pg_catalog.pg_proc where oid='public.erase_native_team_lineup_profile()'::regprocedure
    and prosecdef and md5(regexp_replace(prosrc,'\s','','g'))='51d2bc6b81052338e92a485f2030017d') then
    raise exception 'Review the existing lineup erasure trigger before changing publication';
  end if;
  perform set_config('tenaceiq.previous_lineup_erasure_hash',md5(pg_catalog.pg_get_functiondef('public.erase_native_team_lineup_profile()'::regprocedure)),true);
end $erasure$;

alter table public.native_team_next_fixtures add column published_lineup jsonb
  check (published_lineup is null or jsonb_typeof(published_lineup) = 'object');
-- Preserve plans that captains explicitly shared using the existing tactics flow.
update public.native_team_next_fixtures set published_lineup = lineup
  where lineup->'tactics' is not null;
create index native_team_published_lineup_profiles_idx on public.native_team_next_fixtures using gin ((published_lineup->'names'));

create table public.native_team_lineup_replies (
  room_id uuid not null references public.native_team_next_fixtures(room_id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  fixture_revision uuid not null,
  lineup_version uuid not null,
  operation_id uuid not null,
  choice text not null check (choice in ('confirmed', 'needs_change')),
  primary key (room_id, profile_id),
  foreign key (room_id, profile_id) references public.internal_conversation_participants(conversation_id, profile_id) on delete cascade
);
alter table public.native_team_lineup_replies enable row level security;
revoke all on public.native_team_lineup_replies from public, anon, authenticated;
grant select, insert, update, delete on public.native_team_lineup_replies to service_role;

create function public.reset_native_lineup_reply_on_availability() returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if tg_op='INSERT' or new.fixture_revision is distinct from old.fixture_revision or new.choice is distinct from old.choice then
    delete from public.native_team_lineup_replies where room_id=new.room_id and profile_id=new.profile_id;
  end if;
  return new;
end;
$$;
revoke all on function public.reset_native_lineup_reply_on_availability() from public, anon, authenticated;
create trigger native_lineup_reply_availability_change after insert or update on public.native_team_fixture_replies
for each row execute function public.reset_native_lineup_reply_on_availability();

create function public.reset_native_lineup_publication() returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if new.fixture is null or new.fixture->>'date' is distinct from old.fixture->>'date'
    or new.fixture->>'opponent' is distinct from old.fixture->>'opponent' then
    new.published_lineup := null;
  end if;
  if new.revision is distinct from old.revision then
    delete from public.native_team_lineup_replies where room_id = old.room_id;
  end if;
  return new;
end;
$$;
revoke all on function public.reset_native_lineup_publication() from public, anon, authenticated;
create trigger native_lineup_publication_fixture_change before update of fixture, revision on public.native_team_next_fixtures
for each row execute function public.reset_native_lineup_publication();

create or replace function public.erase_native_team_lineup_profile()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  update public.native_team_next_fixtures set lineup = null where (lineup->'names') ? old.id::text;
  update public.native_team_next_fixtures set published_lineup = null where (published_lineup->'names') ? old.id::text;
  update public.native_team_fixture_history set lineup = null where (lineup->'names') ? old.id::text;
  return old;
end;
$$;

create function public.save_native_team_match_plan(
  p_owner uuid, p_room uuid, p_team text, p_league text, p_flight text,
  p_revision uuid, p_expected uuid, p_version uuid, p_courts jsonb,
  p_keep_tactics boolean, p_tactics jsonb, p_publish boolean
) returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public set lock_timeout = '3s' as $$
declare
  saved public.native_team_next_fixtures%rowtype;
  result jsonb;
  plan jsonb;
  published jsonb;
begin
  perform 1 from public.internal_conversations where id = p_room for update;
  select * into saved from public.native_team_next_fixtures where room_id = p_room;
  -- An operation identity binds the publication intent as well as courts and tactics.
  if saved.lineup->>'version' = p_version::text and
    (saved.lineup->>'publication_intent')::boolean is distinct from p_publish then return '{"status":409}'::jsonb; end if;
  result := public.save_native_team_lineup_with_tactics(p_owner,p_room,p_team,p_league,p_flight,
    p_revision,p_expected,p_version,p_courts,p_keep_tactics,p_tactics);
  if result->>'status' <> '200' then return result; end if;
  if saved.lineup->>'version' = p_version::text then
    return jsonb_build_object('status',200,'lineup',saved.lineup,'sharedLineup',saved.published_lineup);
  end if;
  plan := result->'lineup' || jsonb_build_object('publication_intent',p_publish);
  -- Older clients retain their existing explicit board-sharing/detaching behavior.
  published := case when p_publish is true then result->'lineup'
    when p_publish is false then saved.published_lineup
    when plan->'tactics' is not null then result->'lineup'
    when p_keep_tactics is false and saved.published_lineup->'tactics' is not null
      and saved.lineup->>'version'=saved.published_lineup->>'version' then null
    else saved.published_lineup end;
  update public.native_team_next_fixtures set lineup = plan, published_lineup = published
    where room_id = p_room and revision = p_revision;
  if published->>'version' is distinct from saved.published_lineup->>'version' then
    delete from public.native_team_lineup_replies where room_id = p_room;
  end if;
  return jsonb_build_object('status',200,'lineup',plan,'sharedLineup',published);
end;
$$;
revoke all on function public.save_native_team_match_plan(uuid,uuid,text,text,text,uuid,uuid,uuid,jsonb,boolean,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.save_native_team_match_plan(uuid,uuid,text,text,text,uuid,uuid,uuid,jsonb,boolean,jsonb,boolean) to service_role;

create function public.reply_to_native_team_lineup(
  p_owner uuid, p_room uuid, p_team text, p_league text, p_flight text,
  p_revision uuid, p_version uuid, p_expected uuid, p_operation uuid, p_choice text
) returns integer language plpgsql security invoker
set search_path = pg_catalog, public set lock_timeout = '3s' as $$
declare
  fixture public.native_team_next_fixtures%rowtype;
  saved public.native_team_lineup_replies%rowtype;
begin
  if p_owner is null or p_room is null or p_team is null or p_league is null or p_flight is null
    or p_revision is null or p_version is null or p_operation is null or p_operation = p_expected
    or p_choice is null or p_choice not in ('confirmed','needs_change') then return 400; end if;
  perform 1 from public.internal_conversations where id = p_room and status = 'open'
    and related_entity_type = 'team_room' and related_entity_id = concat_ws('__',
      btrim(regexp_replace(lower(p_team),'[^a-z0-9]+',' ','g')),
      btrim(regexp_replace(lower(p_league),'[^a-z0-9]+',' ','g')),
      btrim(regexp_replace(lower(p_flight),'[^a-z0-9]+',' ','g'))) for update;
  if not found then return 403; end if;
  perform 1 from public.team_profile_links where profile_user_id = p_owner and team_name = p_team
    and league_name = p_league and flight = p_flight and status = 'accepted' and archived_at is null
    and source_type in ('manual_invite','tiq_entry') for share;
  if not found then return 403; end if;
  perform 1 from public.internal_conversation_participants where conversation_id = p_room and profile_id = p_owner for share;
  if not found or exists(select 1 from public.team_room_member_removals where conversation_id = p_room and profile_id = p_owner) then return 403; end if;
  select * into fixture from public.native_team_next_fixtures where room_id = p_room;
  if fixture.fixture is null or fixture.revision is distinct from p_revision
    or fixture.published_lineup->>'version' is distinct from p_version::text
    or not coalesce((fixture.published_lineup->'names') ? p_owner::text,false) then return 409; end if;
  if p_choice = 'confirmed' and exists(select 1 from public.native_team_fixture_replies where room_id = p_room
    and profile_id = p_owner and fixture_revision = p_revision and choice = 'out') then return 409; end if;
  select * into saved from public.native_team_lineup_replies where room_id = p_room and profile_id = p_owner;
  if saved.operation_id = p_operation then
    if saved.choice = p_choice and saved.fixture_revision = p_revision and saved.lineup_version = p_version then return 200; end if;
    return 409;
  end if;
  if saved.fixture_revision is distinct from p_revision or saved.lineup_version is distinct from p_version then saved.operation_id := null; end if;
  if saved.operation_id is distinct from p_expected then return 409; end if;
  insert into public.native_team_lineup_replies(room_id,profile_id,fixture_revision,lineup_version,operation_id,choice)
    values(p_room,p_owner,p_revision,p_version,p_operation,p_choice)
    on conflict(room_id,profile_id) do update set fixture_revision=excluded.fixture_revision,
      lineup_version=excluded.lineup_version,operation_id=excluded.operation_id,choice=excluded.choice;
  return 200;
end;
$$;
revoke all on function public.reply_to_native_team_lineup(uuid,uuid,text,text,text,uuid,uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.reply_to_native_team_lineup(uuid,uuid,text,text,text,uuid,uuid,uuid,uuid,text) to service_role;

do $catalog$
declare
  source text := pg_catalog.pg_get_functiondef('public.account_erasure_catalog_ready()'::regprocedure);
  previous_columns constant text := '27be2911dfbd84d818aafa9118507388';
  unaffected_columns text;
  next_columns text;
  previous_trigger text := current_setting('tenaceiq.previous_lineup_erasure_hash');
  next_trigger text := md5(pg_catalog.pg_get_functiondef('public.erase_native_team_lineup_profile()'::regprocedure));
  foreign_keys_marker constant text := $marker$jsonb_to_recordset('[$marker$;
  profile_key constant text := '{"t":"native_team_lineup_replies","c":"profile_id","p":"profiles","d":"c","n":false},';
begin
  -- Only the reviewed publication column and reply table may change the public catalog.
  select md5(string_agg(table_name||'|'||column_name||'|'||data_type||'|'||is_nullable,
      E'\n' order by table_name collate "C",column_name collate "C")) into unaffected_columns
    from information_schema.columns where table_schema='public'
      and table_name not in ('account_deletion_requests','native_email_auth_limits','native_team_lineup_replies')
      and (table_name,column_name) <> ('native_team_next_fixtures','published_lineup');
  select md5(string_agg(table_name||'|'||column_name||'|'||data_type||'|'||is_nullable,
      E'\n' order by table_name collate "C",column_name collate "C")) into next_columns
    from information_schema.columns where table_schema='public' and table_name not in ('account_deletion_requests','native_email_auth_limits');
  if unaffected_columns is distinct from previous_columns
    or length(source)-length(replace(source,previous_columns,'')) <> length(previous_columns)
    or length(source)-length(replace(source,foreign_keys_marker,'')) <> length(foreign_keys_marker)
    or position(previous_trigger in source)=0 then
    raise exception 'Review unexpected account deletion catalog changes before enabling lineup publication';
  end if;
  execute replace(replace(replace(source,previous_columns,next_columns),foreign_keys_marker,foreign_keys_marker||profile_key),previous_trigger,next_trigger);
  if not public.account_erasure_catalog_ready() then raise exception 'Account deletion catalog did not validate with lineup publication'; end if;
end $catalog$;
notify pgrst, 'reload schema';
commit;
