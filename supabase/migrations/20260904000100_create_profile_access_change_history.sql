-- Keep a durable, admin-only record of every manual change to product access.
-- The RPC below changes the profile and writes the history row in one transaction.
create table if not exists public.profile_access_change_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  changed_by_user_id uuid null references auth.users(id) on delete set null,
  change_type text not null check (change_type in ('grant', 'extend', 'revoke', 'manual_update')),
  offer_key text null,
  reason text not null check (char_length(reason) between 3 and 500),
  previous_access jsonb not null default '{}'::jsonb,
  next_access jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists profile_access_change_events_profile_created_at_idx
  on public.profile_access_change_events (profile_id, created_at desc);

create index if not exists profile_access_change_events_created_at_idx
  on public.profile_access_change_events (created_at desc);

alter table public.profile_access_change_events enable row level security;

drop policy if exists "Admins can read profile access history" on public.profile_access_change_events;
create policy "Admins can read profile access history"
  on public.profile_access_change_events for select to authenticated
  using (public.is_admin());

create or replace function public.apply_profile_access_change(
  p_profile_id uuid,
  p_player_plus_subscription_active boolean,
  p_player_plus_subscription_status text,
  p_player_plus_access_expires_at timestamptz,
  p_coach_subscription_active boolean,
  p_coach_subscription_status text,
  p_coach_access_expires_at timestamptz,
  p_captain_subscription_active boolean,
  p_captain_subscription_status text,
  p_captain_access_expires_at timestamptz,
  p_tiq_team_league_entry_enabled boolean,
  p_tiq_individual_league_creator_enabled boolean,
  p_league_access_expires_at timestamptz,
  p_reason text,
  p_change_type text,
  p_offer_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reason text;
  v_previous jsonb;
  v_next jsonb;
  v_event_id uuid;
  v_created_at timestamptz := timezone('utc', now());
begin
  if not public.is_admin() then
    raise exception 'Admin access is required.' using errcode = '42501';
  end if;

  v_reason := btrim(regexp_replace(coalesce(p_reason, ''), '\s+', ' ', 'g'));
  if char_length(v_reason) < 3 then
    raise exception 'Add a reason with at least 3 characters.' using errcode = '22023';
  end if;

  if p_change_type not in ('grant', 'extend', 'revoke', 'manual_update') then
    raise exception 'Invalid access change type.' using errcode = '22023';
  end if;

  if p_offer_key is not null and char_length(p_offer_key) > 80 then
    raise exception 'Invalid access offer.' using errcode = '22023';
  end if;

  if p_player_plus_subscription_status not in ('inactive', 'trial', 'active', 'past_due', 'canceled')
    or p_coach_subscription_status not in ('inactive', 'trial', 'active', 'past_due', 'canceled')
    or p_captain_subscription_status not in ('inactive', 'trial', 'active', 'past_due', 'canceled') then
    raise exception 'Invalid access status.' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'player_plus_subscription_active', player_plus_subscription_active,
    'player_plus_subscription_status', player_plus_subscription_status,
    'player_plus_access_expires_at', player_plus_access_expires_at,
    'coach_subscription_active', coach_subscription_active,
    'coach_subscription_status', coach_subscription_status,
    'coach_access_expires_at', coach_access_expires_at,
    'captain_subscription_active', captain_subscription_active,
    'captain_subscription_status', captain_subscription_status,
    'captain_access_expires_at', captain_access_expires_at,
    'tiq_team_league_entry_enabled', tiq_team_league_entry_enabled,
    'tiq_individual_league_creator_enabled', tiq_individual_league_creator_enabled,
    'league_access_expires_at', league_access_expires_at
  ) into v_previous
  from public.profiles
  where id = p_profile_id
  for update;

  if v_previous is null then
    raise exception 'Profile was not found.' using errcode = 'P0002';
  end if;

  update public.profiles
  set
    player_plus_subscription_active = p_player_plus_subscription_active,
    player_plus_subscription_status = p_player_plus_subscription_status,
    player_plus_access_expires_at = p_player_plus_access_expires_at,
    coach_subscription_active = p_coach_subscription_active,
    coach_subscription_status = p_coach_subscription_status,
    coach_access_expires_at = p_coach_access_expires_at,
    captain_subscription_active = p_captain_subscription_active,
    captain_subscription_status = p_captain_subscription_status,
    captain_access_expires_at = p_captain_access_expires_at,
    tiq_team_league_entry_enabled = p_tiq_team_league_entry_enabled,
    tiq_individual_league_creator_enabled = p_tiq_individual_league_creator_enabled,
    league_access_expires_at = p_league_access_expires_at
  where id = p_profile_id;

  v_next := jsonb_build_object(
    'player_plus_subscription_active', p_player_plus_subscription_active,
    'player_plus_subscription_status', p_player_plus_subscription_status,
    'player_plus_access_expires_at', p_player_plus_access_expires_at,
    'coach_subscription_active', p_coach_subscription_active,
    'coach_subscription_status', p_coach_subscription_status,
    'coach_access_expires_at', p_coach_access_expires_at,
    'captain_subscription_active', p_captain_subscription_active,
    'captain_subscription_status', p_captain_subscription_status,
    'captain_access_expires_at', p_captain_access_expires_at,
    'tiq_team_league_entry_enabled', p_tiq_team_league_entry_enabled,
    'tiq_individual_league_creator_enabled', p_tiq_individual_league_creator_enabled,
    'league_access_expires_at', p_league_access_expires_at
  );

  insert into public.profile_access_change_events (
    profile_id,
    changed_by_user_id,
    change_type,
    offer_key,
    reason,
    previous_access,
    next_access,
    created_at
  ) values (
    p_profile_id,
    auth.uid(),
    p_change_type,
    nullif(btrim(p_offer_key), ''),
    v_reason,
    v_previous,
    v_next,
    v_created_at
  ) returning id into v_event_id;

  return jsonb_build_object(
    'event_id', v_event_id,
    'created_at', v_created_at,
    'previous_access', v_previous,
    'next_access', v_next
  );
end;
$$;

revoke all on function public.apply_profile_access_change(
  uuid, boolean, text, timestamptz, boolean, text, timestamptz,
  boolean, text, timestamptz, boolean, boolean, timestamptz, text, text, text
) from public;

grant execute on function public.apply_profile_access_change(
  uuid, boolean, text, timestamptz, boolean, text, timestamptz,
  boolean, text, timestamptz, boolean, boolean, timestamptz, text, text, text
) to authenticated;

comment on table public.profile_access_change_events is
  'Permanent administrator audit history for manually granted, extended, revoked, and adjusted product access.';
