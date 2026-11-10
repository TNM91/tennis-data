-- Keep invite management tied to the reviewed room for the entire operation.
create or replace function public.native_first_party_captain_invites(
  p_owner uuid, p_team text, p_league text, p_flight text, p_action text, p_id uuid, p_room_id uuid
)
returns jsonb language plpgsql security invoker
set search_path = pg_catalog, public set lock_timeout = '3s'
as $$
begin
  if p_owner is null or p_team is null or p_league is null or p_flight is null or p_room_id is null then
    return jsonb_build_object('ok', false, 'status', 400);
  end if;

  perform 1 from public.internal_conversations
    where id = p_room_id and status = 'open' and related_entity_type = 'team_room'
      and related_entity_id = concat_ws('__',
        btrim(regexp_replace(lower(p_team), '[^a-z0-9]+', ' ', 'g')),
        btrim(regexp_replace(lower(p_league), '[^a-z0-9]+', ' ', 'g')),
        btrim(regexp_replace(lower(p_flight), '[^a-z0-9]+', ' ', 'g')))
    for update;
  if not found then
    return jsonb_build_object('ok', false, 'status', 403);
  end if;

  perform 1 from public.team_profile_links
    where profile_user_id = p_owner and team_name = p_team and league_name = p_league and flight = p_flight
      and status = 'accepted' and archived_at is null and source_type in ('manual_invite', 'tiq_entry')
      and coalesce(team_roles, array[team_role]) && array['captain', 'co_captain']::text[]
    for share;
  if not found then
    return jsonb_build_object('ok', false, 'status', 403);
  end if;

  return public.native_captain_invites(p_owner, p_team, p_league, p_flight, p_action, p_id);
end;
$$;

revoke all on function public.native_first_party_captain_invites(uuid,text,text,text,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.native_first_party_captain_invites(uuid,text,text,text,text,uuid,uuid) to service_role;
notify pgrst, 'reload schema';
