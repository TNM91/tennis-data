begin;
set local lock_timeout = '5s';

-- Protected seasons take requests and decisions through the first-party service.
-- Caller RLS continues to govern all reads.
create policy "Native team entry requests are scoped" on public.tiq_team_league_entries
  as restrictive for insert to anon, authenticated with check (league_id not like 'tiq-native-league-%');
create policy "Native team decisions are scoped" on public.tiq_team_league_entries
  as restrictive for update to anon, authenticated
  using (league_id not like 'tiq-native-league-%') with check (league_id not like 'tiq-native-league-%');
create policy "Native team entry deletion is scoped" on public.tiq_team_league_entries
  as restrictive for delete to anon, authenticated using (league_id not like 'tiq-native-league-%');

create policy "Native player entry requests are scoped" on public.tiq_player_league_entries
  as restrictive for insert to anon, authenticated with check (league_id not like 'tiq-native-league-%');
create policy "Native player decisions are scoped" on public.tiq_player_league_entries
  as restrictive for update to anon, authenticated
  using (league_id not like 'tiq-native-league-%') with check (league_id not like 'tiq-native-league-%');
create policy "Native player entry deletion is scoped" on public.tiq_player_league_entries
  as restrictive for delete to anon, authenticated using (league_id not like 'tiq-native-league-%');

create function private.native_league_registration_open(target text)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.tiq_leagues league
    where id = target
      and id ~ '^tiq-native-league-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
      and is_public and season_status = 'active'
      and ends_on >= (now() at time zone schedule_time_zone)::date
  );
$$;
revoke all on function private.native_league_registration_open(text) from public, anon, authenticated, service_role;

create or replace function public.native_first_party_league_entry(
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
  if p_format = 'team' and not private.native_league_registration_open(p_league) and actor_role is distinct from 'admin' and not exists (
    select 1 from public.profiles where id = p_actor and tiq_team_league_entry_enabled
      and (league_access_expires_at is null or league_access_expires_at > clock_timestamp())
  ) then
    return false;
  end if;
  -- Keep the reviewed season open and unchanged until the pending entry is saved.
  perform 1 from public.tiq_leagues
    where id = p_league and is_public and season_status = 'active'
      and league_format = p_format and updated_at = p_version
      and (id not like 'tiq-native-league-%' or private.native_league_registration_open(id)) for share;
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

create or replace function public.native_first_party_league_decision(
  p_actor uuid, p_league text, p_format text, p_league_version timestamptz,
  p_entry uuid, p_entry_version timestamptz, p_decision text, p_note text, p_eligibility text
) returns jsonb
language plpgsql security definer set search_path = '' as $body$
declare
  team public.tiq_team_league_entries;
  player public.tiq_player_league_entries;
begin
  if p_decision is null or p_decision not in ('active', 'rejected', 'information')
    or p_format is null or p_format not in ('team', 'individual')
    or p_note is null or length(p_note) > 1800
    or (p_decision = 'information' and (p_format <> 'individual' or length(btrim(p_note)) not between 1 and 600))
    or (p_format = 'individual' and (p_eligibility is null or p_eligibility not in ('verified', 'needs_confirmation', 'ineligible')))
  then return null; end if;

  perform 1 from public.profiles
    where id = p_actor and (
      role = 'admin' or exists (
        select 1 from public.tiq_leagues league where league.id = p_league
          and league.created_by_user_id = p_actor and private.native_league_registration_open(league.id)
      ) or (
        (tiq_team_league_entry_enabled or tiq_individual_league_creator_enabled)
        and (league_access_expires_at is null or league_access_expires_at > clock_timestamp())
      )
    ) for share;
  if not found or exists (
    select 1 from public.account_deletion_requests where account_id = p_actor and status <> 'completed'
  ) then return null; end if;

  -- Keep the reviewed league open and under the same organizer until the decision is saved.
  perform 1 from public.tiq_leagues
    where id = p_league and created_by_user_id = p_actor and is_public
      and season_status = 'active' and league_format = p_format and updated_at = p_league_version
      and (id not like 'tiq-native-league-%' or private.native_league_registration_open(id))
    for share;
  if not found then return null; end if;

  if p_format = 'team' then
    update public.tiq_team_league_entries
      set entry_status = p_decision, updated_by_user_id = p_actor
      where id = p_entry and league_id = p_league and entry_status = 'pending' and updated_at = p_entry_version
        and created_by_user_id is not null
        and nullif(team_entity_id, '') is null and source_league_name = '' and source_flight = ''
      returning * into team;
    if not found then return null; end if;
    return jsonb_build_object('id', team.id, 'league_id', team.league_id, 'entry_status', team.entry_status,
      'created_by_user_id', team.created_by_user_id, 'updated_at', team.updated_at, 'team_name', team.team_name);
  end if;

  update public.tiq_player_league_entries
    set entry_status = case when p_decision = 'information' then 'pending' else p_decision end,
      updated_by_user_id = p_actor,
      player_action_required = p_decision = 'information',
      player_request_note = case when p_decision = 'information' then p_note else '' end,
      eligibility_status = case when p_decision = 'information' then 'needs_confirmation' else p_eligibility end,
      eligibility_review_note = p_note,
      eligibility_reviewed_at = case when p_decision = 'information' then eligibility_reviewed_at else clock_timestamp() end,
      eligibility_reviewed_by = case when p_decision = 'information' then eligibility_reviewed_by else p_actor end
    where id = p_entry and league_id = p_league and entry_status = 'pending' and updated_at = p_entry_version
      and created_by_user_id is not null
      and nullif(player_id, '') is null and club_membership_id is null
      and eligibility_rating_source in ('unknown', 'self')
      and eligibility_age_division_source in ('unknown', 'self')
      and eligibility_mixed_pair_role_source in ('unknown', 'self')
      and (p_decision <> 'active' or not player_action_required)
    returning * into player;
  if not found then return null; end if;
  return jsonb_build_object('id', player.id, 'league_id', player.league_id, 'entry_status', player.entry_status,
    'created_by_user_id', player.created_by_user_id, 'updated_at', player.updated_at, 'player_name', player.player_name,
    'eligibility_rating', player.eligibility_rating, 'eligibility_rating_source', player.eligibility_rating_source,
    'eligibility_age_division', player.eligibility_age_division, 'eligibility_age_division_source', player.eligibility_age_division_source,
    'eligibility_mixed_pair_role', player.eligibility_mixed_pair_role,
    'eligibility_mixed_pair_role_source', player.eligibility_mixed_pair_role_source,
    'eligibility_status', player.eligibility_status, 'eligibility_review_note', player.eligibility_review_note,
    'player_action_required', player.player_action_required, 'player_request_note', player.player_request_note);
end
$body$;

notify pgrst, 'reload schema';
commit;
