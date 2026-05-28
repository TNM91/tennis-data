alter table public.profiles
  add column if not exists coach_subscription_active boolean not null default false,
  add column if not exists coach_subscription_status text not null default 'inactive';

alter table public.profiles
  drop constraint if exists profiles_coach_subscription_status_check;

alter table public.profiles
  add constraint profiles_coach_subscription_status_check
  check (coach_subscription_status in ('inactive', 'trial', 'active', 'past_due', 'canceled'));
