alter table public.profiles
  add column if not exists captain_subscription_active boolean not null default false,
  add column if not exists captain_subscription_status text not null default 'inactive',
  add column if not exists tiq_team_league_entry_enabled boolean not null default false,
  add column if not exists tiq_individual_league_creator_enabled boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_captain_subscription_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_captain_subscription_status_check
      check (captain_subscription_status in ('inactive', 'trial', 'active', 'past_due', 'canceled'));
  end if;
end $$;

update public.profiles
set
  captain_subscription_active = coalesce(captain_subscription_active, false),
  captain_subscription_status = case
    when role in ('captain', 'admin') then 'active'
    else coalesce(captain_subscription_status, 'inactive')
  end,
  tiq_team_league_entry_enabled = case
    when role in ('captain', 'admin') then true
    else coalesce(tiq_team_league_entry_enabled, false)
  end,
  tiq_individual_league_creator_enabled = coalesce(tiq_individual_league_creator_enabled, true);

update public.profiles
set captain_subscription_active = true
where role in ('captain', 'admin');
