create table if not exists public.level_up_weekly_plans (
  id text primary key,
  player_user_id uuid not null references auth.users(id) on delete cascade,
  coach_user_id uuid references auth.users(id) on delete set null,
  student_link_id text references public.coach_player_links(id) on delete set null,
  identity_slug text not null,
  week_start date not null,
  shared_with_coach boolean not null default false,
  plan_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint level_up_weekly_plans_player_week_identity_unique unique (player_user_id, week_start, identity_slug)
);
alter table public.level_up_weekly_plans enable row level security;
drop policy if exists "Players can read own Level Up weekly plans" on public.level_up_weekly_plans;
drop policy if exists "Players can insert own Level Up weekly plans" on public.level_up_weekly_plans;
drop policy if exists "Players can update own Level Up weekly plans" on public.level_up_weekly_plans;
drop policy if exists "Coaches can read shared Level Up weekly plans" on public.level_up_weekly_plans;
create policy "Players can read own Level Up weekly plans"
  on public.level_up_weekly_plans
  for select
  using (auth.uid() = player_user_id);
create policy "Players can insert own Level Up weekly plans"
  on public.level_up_weekly_plans
  for insert
  with check (
    auth.uid() = player_user_id
    and (
      (
        not shared_with_coach
        and student_link_id is null
        and coach_user_id is null
      )
      or exists (
        select 1 from public.coach_player_links link
        where link.id = level_up_weekly_plans.student_link_id
          and link.player_user_id = auth.uid()
          and link.coach_user_id = level_up_weekly_plans.coach_user_id
          and link.status in ('active', 'needs_assignment', 'review_notes')
      )
    )
  );
create policy "Players can update own Level Up weekly plans"
  on public.level_up_weekly_plans
  for update
  using (auth.uid() = player_user_id)
  with check (
    auth.uid() = player_user_id
    and (
      (
        not shared_with_coach
        and student_link_id is null
        and coach_user_id is null
      )
      or exists (
        select 1 from public.coach_player_links link
        where link.id = level_up_weekly_plans.student_link_id
          and link.player_user_id = auth.uid()
          and link.coach_user_id = level_up_weekly_plans.coach_user_id
          and link.status in ('active', 'needs_assignment', 'review_notes')
      )
    )
  );
create policy "Coaches can read shared Level Up weekly plans"
  on public.level_up_weekly_plans
  for select
  using (
    shared_with_coach
    and coach_user_id = auth.uid()
    and exists (
      select 1 from public.coach_player_links link
      where link.id = level_up_weekly_plans.student_link_id
        and link.coach_user_id = auth.uid()
        and link.player_user_id = level_up_weekly_plans.player_user_id
        and link.status in ('active', 'needs_assignment', 'review_notes')
    )
  );
create index if not exists level_up_weekly_plans_player_week_idx
  on public.level_up_weekly_plans (player_user_id, week_start desc);
create index if not exists level_up_weekly_plans_coach_week_idx
  on public.level_up_weekly_plans (coach_user_id, week_start desc)
  where shared_with_coach;
create index if not exists level_up_weekly_plans_student_week_idx
  on public.level_up_weekly_plans (student_link_id, week_start desc)
  where shared_with_coach;
