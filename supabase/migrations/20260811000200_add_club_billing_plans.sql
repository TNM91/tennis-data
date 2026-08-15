create table if not exists public.club_billing_accounts (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null check (plan_id in ('club_starter', 'club_unlimited')),
  status text not null default 'inactive' check (status in ('inactive', 'trial', 'active', 'past_due', 'canceled')),
  stripe_customer_id text null,
  stripe_subscription_id text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create unique index if not exists club_billing_accounts_customer_idx
  on public.club_billing_accounts (stripe_customer_id)
  where stripe_customer_id is not null;
create unique index if not exists club_billing_accounts_subscription_idx
  on public.club_billing_accounts (stripe_subscription_id)
  where stripe_subscription_id is not null;
create unique index if not exists clubs_owner_user_id_unique
  on public.clubs (owner_user_id);
drop trigger if exists set_club_billing_accounts_updated_at on public.club_billing_accounts;
create trigger set_club_billing_accounts_updated_at before update on public.club_billing_accounts
for each row execute function public.set_club_updated_at();
alter table public.club_billing_accounts enable row level security;
drop policy if exists "Club owners can read billing" on public.club_billing_accounts;
create policy "Club owners can read billing"
  on public.club_billing_accounts for select to authenticated
  using (owner_user_id = auth.uid());
drop policy if exists "Admins can read club billing" on public.club_billing_accounts;
create policy "Admins can read club billing"
  on public.club_billing_accounts for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
create or replace function public.can_create_club_workspace(requested_owner_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    requested_owner_user_id = auth.uid()
    and exists (
      select 1
      from public.club_billing_accounts billing
      where billing.owner_user_id = requested_owner_user_id
        and billing.status in ('active', 'trial')
    )
    and not exists (
      select 1
      from public.clubs club
      where club.owner_user_id = requested_owner_user_id
    );
$$;
revoke all on function public.can_create_club_workspace(uuid) from public;
grant execute on function public.can_create_club_workspace(uuid) to authenticated;
drop policy if exists "Members can create clubs" on public.clubs;
create policy "Active Club subscribers can create one club" on public.clubs
for insert to authenticated
with check (public.can_create_club_workspace(owner_user_id));
alter table public.upgrade_requests
  drop constraint if exists upgrade_requests_plan_id_check;
alter table public.upgrade_requests
  add constraint upgrade_requests_plan_id_check
  check (plan_id in ('player_plus', 'coach', 'captain', 'league', 'full_court', 'club_starter', 'club_unlimited'));
alter table public.stripe_billing_events
  drop constraint if exists stripe_billing_events_plan_id_check;
alter table public.stripe_billing_events
  add constraint stripe_billing_events_plan_id_check
  check (plan_id is null or plan_id in ('player_plus', 'coach', 'captain', 'league', 'full_court', 'club_starter', 'club_unlimited'));
alter table public.product_usage_events
  drop constraint if exists product_usage_events_plan_id_check;
alter table public.product_usage_events
  add constraint product_usage_events_plan_id_check
  check (plan_id is null or plan_id in ('player_plus', 'coach', 'captain', 'league', 'full_court', 'club_starter', 'club_unlimited'));
create or replace function public.enforce_club_membership_billing_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  club_owner uuid;
  billing_plan text;
  billing_status text;
  staff_count integer;
  player_count integer;
  incoming_is_staff boolean;
  incoming_is_player boolean;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select club.owner_user_id
    into club_owner
  from public.clubs club
  where club.id = new.club_id;

  select billing.plan_id, billing.status
    into billing_plan, billing_status
  from public.club_billing_accounts billing
  where billing.owner_user_id = club_owner;

  if billing_status is null or billing_status not in ('active', 'trial') then
    raise exception 'Club billing is not active.' using errcode = 'P0001';
  end if;

  if billing_plan = 'club_unlimited' then
    return new;
  end if;

  incoming_is_staff := new.roles && array['owner', 'admin', 'coach', 'captain', 'coordinator']::text[];
  incoming_is_player := 'player' = any(new.roles);

  select
    count(*) filter (where membership.roles && array['owner', 'admin', 'coach', 'captain', 'coordinator']::text[]),
    count(*) filter (where 'player' = any(membership.roles))
    into staff_count, player_count
  from public.club_memberships membership
  where membership.club_id = new.club_id
    and membership.status = 'active'
    and membership.id is distinct from new.id;

  if incoming_is_staff and staff_count >= 5 then
    raise exception 'Club Starter supports up to 5 active staff.' using errcode = 'P0001';
  end if;

  if incoming_is_player and player_count >= 100 then
    raise exception 'Club Starter supports up to 100 connected players.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;
drop trigger if exists enforce_club_membership_billing_limits on public.club_memberships;
create trigger enforce_club_membership_billing_limits
before insert or update of roles, status on public.club_memberships
for each row execute function public.enforce_club_membership_billing_limits();
comment on table public.club_billing_accounts is
  'Account-level Club Starter or Club Unlimited subscription state. One active account enables one branded club workspace.';
