alter table public.profiles
  add column if not exists player_plus_subscription_active boolean not null default false,
  add column if not exists player_plus_subscription_status text not null default 'inactive';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_player_plus_subscription_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_player_plus_subscription_status_check
      check (player_plus_subscription_status in ('inactive', 'trial', 'active', 'past_due', 'canceled'));
  end if;
end $$;

update public.profiles
set
  player_plus_subscription_active = true,
  player_plus_subscription_status = 'active'
where role in ('captain', 'admin');

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'captain_subscription_active'
  ) then
    execute '
      update public.profiles
      set
        player_plus_subscription_active = true,
        player_plus_subscription_status = ''active''
      where captain_subscription_active = true
    ';
  end if;
end $$;
