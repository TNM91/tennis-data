create table if not exists public.stripe_billing_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  outcome text not null check (outcome in ('handled', 'ignored', 'error')),
  message text not null default '',
  profile_id uuid null,
  stripe_customer_id text null,
  stripe_subscription_id text null,
  plan_id text null check (plan_id is null or plan_id in ('player_plus', 'captain', 'league')),
  resulting_status text null check (
    resulting_status is null
    or resulting_status in ('inactive', 'trial', 'active', 'past_due', 'canceled')
  ),
  event_object jsonb null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists stripe_billing_events_profile_created_at_idx
  on public.stripe_billing_events (profile_id, created_at desc)
  where profile_id is not null;

create index if not exists stripe_billing_events_customer_created_at_idx
  on public.stripe_billing_events (stripe_customer_id, created_at desc)
  where stripe_customer_id is not null;

create index if not exists stripe_billing_events_subscription_created_at_idx
  on public.stripe_billing_events (stripe_subscription_id, created_at desc)
  where stripe_subscription_id is not null;

create index if not exists stripe_billing_events_outcome_created_at_idx
  on public.stripe_billing_events (outcome, created_at desc);

alter table public.stripe_billing_events enable row level security;

drop policy if exists "Admins can read Stripe billing events" on public.stripe_billing_events;
create policy "Admins can read Stripe billing events"
  on public.stripe_billing_events for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
