create table if not exists public.level_up_sessions (
  id text primary key,
  player_user_id uuid not null references auth.users(id) on delete cascade,
  coach_user_id uuid references auth.users(id) on delete set null,
  student_link_id text references public.coach_player_links(id) on delete set null,
  assignment_id text references public.coach_assignments(id) on delete set null,
  identity_slug text not null default 'relentless-competitor-4-0',
  focus_id text not null,
  focus_title text not null,
  work_type text not null,
  training_context text not null,
  drill_title text not null,
  rating integer not null,
  feeling text not null,
  access_mode text not null,
  note text not null default '',
  elapsed_seconds integer not null default 0,
  shared_with_coach boolean not null default false,
  session_json jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint level_up_sessions_rating_check check (rating between 0 and 5),
  constraint level_up_sessions_work_type_check check (work_type in ('court', 'physical', 'mental')),
  constraint level_up_sessions_training_context_check check (training_context in ('alone', 'partner', 'singles', 'doubles', 'coach')),
  constraint level_up_sessions_feeling_check check (feeling in ('ready', 'tight', 'tired', 'nervous')),
  constraint level_up_sessions_access_mode_check check (access_mode in ('coach_invited', 'player_plus', 'free_preview'))
);

alter table public.level_up_sessions enable row level security;

drop policy if exists "Players can read own Level Up sessions" on public.level_up_sessions;
drop policy if exists "Players can insert own Level Up sessions" on public.level_up_sessions;
drop policy if exists "Players can update own Level Up sessions" on public.level_up_sessions;
drop policy if exists "Coaches can read shared Level Up sessions" on public.level_up_sessions;

create policy "Players can read own Level Up sessions"
  on public.level_up_sessions
  for select
  using (auth.uid() = player_user_id);

create policy "Players can insert own Level Up sessions"
  on public.level_up_sessions
  for insert
  with check (
    auth.uid() = player_user_id
    and (
      student_link_id is null
      or exists (
        select 1
        from public.coach_player_links link
        where link.id = level_up_sessions.student_link_id
          and link.player_user_id = auth.uid()
      )
    )
  );

create policy "Players can update own Level Up sessions"
  on public.level_up_sessions
  for update
  using (auth.uid() = player_user_id)
  with check (auth.uid() = player_user_id);

create policy "Coaches can read shared Level Up sessions"
  on public.level_up_sessions
  for select
  using (
    shared_with_coach
    and (
      coach_user_id = auth.uid()
      or exists (
        select 1
        from public.coach_player_links link
        where link.id = level_up_sessions.student_link_id
          and link.coach_user_id = auth.uid()
      )
    )
  );

create index if not exists level_up_sessions_player_completed_idx
  on public.level_up_sessions (player_user_id, completed_at desc);

create index if not exists level_up_sessions_coach_completed_idx
  on public.level_up_sessions (coach_user_id, completed_at desc);

create index if not exists level_up_sessions_student_completed_idx
  on public.level_up_sessions (student_link_id, completed_at desc);

create index if not exists level_up_sessions_assignment_idx
  on public.level_up_sessions (assignment_id);
