begin;
set local lock_timeout = '5s';

create table public.native_private_teams (
  room_id uuid primary key references public.internal_conversations(id) on delete cascade,
  team_name text not null check (char_length(team_name) between 1 and 100),
  league_label text not null check (char_length(league_label) <= 100),
  flight text not null check (char_length(flight) <= 60)
);

alter table public.native_private_teams enable row level security;
revoke all on public.native_private_teams from public, anon, authenticated;
grant select, insert on public.native_private_teams to service_role;

create function public.create_native_private_team(
  p_owner uuid, p_id uuid, p_team text, p_label text, p_flight text
) returns integer language plpgsql security invoker
set search_path = pg_catalog, public set lock_timeout = '3s'
as $$
declare
  league_key text := 'Private team ' || p_id::text;
  normalized text := btrim(regexp_replace(lower(p_team), '[^a-z0-9]+', ' ', 'g'));
  saved public.native_private_teams%rowtype;
begin
  if p_owner is null or p_id is null or nullif(normalized, '') is null or char_length(p_team) > 100
      or p_label is null or char_length(p_label) > 100 or p_flight is null or char_length(p_flight) > 60
      or (p_team || p_label || p_flight) ~ '[[:cntrl:]]' then return 400; end if;

  perform pg_advisory_xact_lock(hashtextextended('native_private_team:' || p_owner::text, 0));
  select * into saved from public.native_private_teams where room_id = p_id;
  if found then
    if saved.team_name = p_team and saved.league_label = p_label and saved.flight = p_flight
        and exists(select 1 from public.internal_conversations where id = p_id and created_by_user_id = p_owner and status = 'open')
        and exists(select 1 from public.team_profile_links where profile_user_id = p_owner and league_name = league_key
          and team_name = p_team and flight = p_flight and status = 'accepted' and archived_at is null
          and source_type = 'manual_invite' and coalesce(team_roles, array[team_role]) && array['captain']::text[])
        and exists(select 1 from public.internal_conversation_participants where conversation_id = p_id and profile_id = p_owner)
        and not exists(select 1 from public.team_room_member_removals where conversation_id = p_id and profile_id = p_owner) then
      return 200;
    end if;
    return 409;
  end if;

  if exists(select 1 from public.native_private_teams t join public.internal_conversations c on c.id = t.room_id
    where c.created_by_user_id = p_owner and c.status = 'open' and lower(t.team_name) = lower(p_team)
      and lower(t.league_label) = lower(p_label) and lower(t.flight) = lower(p_flight)) then return 409; end if;

  if (select count(*) from public.team_profile_links where profile_user_id = p_owner
      and status = 'accepted' and archived_at is null and source_type in ('manual_invite', 'tiq_entry')) >= 49
      or (select count(*) from public.native_private_teams t join public.internal_conversations c on c.id = t.room_id
        where c.created_by_user_id = p_owner) >= 12 then return 429; end if;

  insert into public.internal_conversations
    (id, conversation_type, subject, status, created_by_user_id, related_entity_type, related_entity_id, metadata)
  values (p_id, 'league', p_team, 'open', p_owner, 'team_room', concat_ws('__', normalized,
    btrim(regexp_replace(lower(league_key), '[^a-z0-9]+', ' ', 'g')),
    btrim(regexp_replace(lower(p_flight), '[^a-z0-9]+', ' ', 'g'))), '{}'::jsonb)
  on conflict do nothing;
  if not found then return 409; end if;
  insert into public.native_private_teams (room_id, team_name, league_label, flight)
    values (p_id, p_team, p_label, p_flight);
  insert into public.team_profile_links
    (profile_user_id, team_name, normalized_team_name, league_name, flight, team_role, team_roles,
     role_accepted_at, source_type, source_record_id, status, accepted_at)
    values (p_owner, p_team, normalized, league_key, p_flight, 'captain', array['captain'],
      jsonb_build_object('captain', now()), 'manual_invite', p_id, 'accepted', now());
  insert into public.internal_conversation_participants (conversation_id, profile_id, participant_role)
    values (p_id, p_owner, 'coordinator');
  return 200;
end;
$$;

revoke all on function public.create_native_private_team(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.create_native_private_team(uuid,uuid,text,text,text) to service_role;
notify pgrst, 'reload schema';
commit;
