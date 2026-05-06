create table if not exists public.product_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_name text not null check (
    event_name in (
      'billing_portal_opened',
      'profile_player_linked',
      'mylab_match_plan_action',
      'mylab_goal_template_applied',
      'captain_closeout_action',
      'captain_team_scope_selected'
    )
  ),
  surface text not null check (
    surface in ('profile', 'mylab', 'captain', 'billing', 'upgrade')
  ),
  plan_id text null check (plan_id is null or plan_id in ('player_plus', 'captain', 'league')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists product_usage_events_created_at_idx
  on public.product_usage_events (created_at desc);

create index if not exists product_usage_events_user_created_at_idx
  on public.product_usage_events (user_id, created_at desc);

create index if not exists product_usage_events_name_created_at_idx
  on public.product_usage_events (event_name, created_at desc);

alter table public.product_usage_events enable row level security;

drop policy if exists "Users can create their own product usage events" on public.product_usage_events;
create policy "Users can create their own product usage events"
  on public.product_usage_events for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Admins can read product usage events" on public.product_usage_events;
create policy "Admins can read product usage events"
  on public.product_usage_events for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
