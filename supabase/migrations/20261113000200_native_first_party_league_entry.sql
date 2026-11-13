begin;
set local lock_timeout = '5s';

create function public.native_first_party_league_entry(
  p_actor uuid, p_league text, p_format text, p_version timestamptz, p_entry jsonb
) returns boolean
language plpgsql security definer set search_path = '' as $body$
declare
  team public.tiq_team_league_entries;
  player public.tiq_player_league_entries;
  actor_role text;
begin
  if p_format is null or p_format not in ('team','individual')
    or jsonb_typeof(p_entry) is distinct from 'object' then
    return false;
  end if;
  select role into actor_role from public.profiles where id = p_actor for share;
  if not found or exists (
    select 1 from public.account_deletion_requests where account_id = p_actor and status <> 'completed'
  ) then
    return false;
  end if;
  if p_format = 'team' and actor_role is distinct from 'admin' and not exists (
    select 1 from public.profiles where id = p_actor and tiq_team_league_entry_enabled
      and (league_access_expires_at is null or league_access_expires_at > clock_timestamp())
  ) then
    return false;
  end if;
  -- Keep the reviewed season open and unchanged until the pending entry is saved.
  perform 1 from public.tiq_leagues
    where id = p_league and is_public and season_status = 'active'
      and league_format = p_format and updated_at = p_version for share;
  if not found then return false; end if;

  if p_format = 'team' then
    team := jsonb_populate_record(null::public.tiq_team_league_entries,p_entry);
    insert into public.tiq_team_league_entries (id,league_id,created_by_user_id,updated_by_user_id,entry_status,team_name)
    values (team.id,p_league,p_actor,p_actor,'pending',team.team_name);
  else
    player := jsonb_populate_record(null::public.tiq_player_league_entries,p_entry);
    insert into public.tiq_player_league_entries (
      id,league_id,created_by_user_id,updated_by_user_id,entry_status,player_name,
      eligibility_status,eligibility_review_note,eligibility_rating,eligibility_rating_source,
      eligibility_mixed_pair_role,eligibility_mixed_pair_role_source,eligibility_age_division,
      eligibility_age_division_source,eligibility_submitted_at
    ) values (
      player.id,p_league,p_actor,p_actor,'pending',player.player_name,
      player.eligibility_status,player.eligibility_review_note,player.eligibility_rating,
      case when player.eligibility_rating is null then 'unknown' else 'self' end,
      player.eligibility_mixed_pair_role,
      case when player.eligibility_mixed_pair_role = 'unknown' then 'unknown' else 'self' end,
      player.eligibility_age_division,
      case when player.eligibility_age_division is null then 'unknown' else 'self' end,
      clock_timestamp()
    );
  end if;
  return true;
end
$body$;

revoke all on function public.native_first_party_league_entry(uuid,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.native_first_party_league_entry(uuid,text,text,timestamptz,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
