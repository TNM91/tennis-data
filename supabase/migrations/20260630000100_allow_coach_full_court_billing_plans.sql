alter table public.upgrade_requests
  drop constraint if exists upgrade_requests_plan_id_check;

alter table public.upgrade_requests
  add constraint upgrade_requests_plan_id_check
  check (plan_id in ('player_plus', 'coach', 'captain', 'league', 'full_court'));

alter table public.stripe_billing_events
  drop constraint if exists stripe_billing_events_plan_id_check;

alter table public.stripe_billing_events
  add constraint stripe_billing_events_plan_id_check
  check (plan_id is null or plan_id in ('player_plus', 'coach', 'captain', 'league', 'full_court'));

alter table public.product_usage_events
  drop constraint if exists product_usage_events_plan_id_check;

alter table public.product_usage_events
  add constraint product_usage_events_plan_id_check
  check (plan_id is null or plan_id in ('player_plus', 'coach', 'captain', 'league', 'full_court'));
