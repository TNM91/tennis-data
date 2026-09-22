create table if not exists public.coach_workspace_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  resume_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.coach_workspace_preferences enable row level security;

drop policy if exists "Coaches can read own workspace preference" on public.coach_workspace_preferences;
create policy "Coaches can read own workspace preference"
  on public.coach_workspace_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Coaches can add own workspace preference" on public.coach_workspace_preferences;
create policy "Coaches can add own workspace preference"
  on public.coach_workspace_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Coaches can update own workspace preference" on public.coach_workspace_preferences;
create policy "Coaches can update own workspace preference"
  on public.coach_workspace_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.coach_workspace_preferences is
  'The selected Coach player, active development work, assignment draft, and conversation for seamless signed-in resume.';
