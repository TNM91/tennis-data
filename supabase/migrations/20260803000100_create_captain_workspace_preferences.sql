create table if not exists public.captain_workspace_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  resume_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.captain_workspace_preferences enable row level security;

drop policy if exists "Captains can read own workspace preference" on public.captain_workspace_preferences;
create policy "Captains can read own workspace preference"
  on public.captain_workspace_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Captains can add own workspace preference" on public.captain_workspace_preferences;
create policy "Captains can add own workspace preference"
  on public.captain_workspace_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Captains can update own workspace preference" on public.captain_workspace_preferences;
create policy "Captains can update own workspace preference"
  on public.captain_workspace_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.captain_workspace_preferences is
  'The last Captain team, match week, tool, and saved lineup context for seamless signed-in resume.';
