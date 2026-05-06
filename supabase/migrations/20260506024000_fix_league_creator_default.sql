alter table public.profiles
  alter column tiq_individual_league_creator_enabled set default false;

update public.profiles as profile
set
  tiq_individual_league_creator_enabled = false,
  updated_at = now()
where profile.role = 'member'
  and profile.tiq_individual_league_creator_enabled = true
  and coalesce(profile.tiq_team_league_entry_enabled, false) = false
  and coalesce(profile.captain_subscription_active, false) = false
  and coalesce(profile.player_plus_subscription_active, false) = false
  and not exists (
    select 1
    from public.upgrade_requests as request
    where request.requester_user_id = profile.id
      and request.plan_id = 'league'
      and request.status = 'converted'
  );
