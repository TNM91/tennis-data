create table if not exists public.league_coordinator_workspace_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  resume_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.league_coordinator_workspace_preferences enable row level security;

drop policy if exists "Coordinators can read own workspace preference" on public.league_coordinator_workspace_preferences;
create policy "Coordinators can read own workspace preference"
  on public.league_coordinator_workspace_preferences for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Coordinators can add own workspace preference" on public.league_coordinator_workspace_preferences;
create policy "Coordinators can add own workspace preference"
  on public.league_coordinator_workspace_preferences for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Coordinators can update own workspace preference" on public.league_coordinator_workspace_preferences;
create policy "Coordinators can update own workspace preference"
  on public.league_coordinator_workspace_preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.league_coordinator_workspace_preferences is
  'The selected league, active result or tournament draft, and communication thread for seamless signed-in League resume.';
