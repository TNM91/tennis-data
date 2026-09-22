create table if not exists public.compete_workspace_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  resume_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.compete_workspace_preferences enable row level security;

drop policy if exists "Players can read own Compete workspace preference" on public.compete_workspace_preferences;
create policy "Players can read own Compete workspace preference"
  on public.compete_workspace_preferences for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Players can add own Compete workspace preference" on public.compete_workspace_preferences;
create policy "Players can add own Compete workspace preference"
  on public.compete_workspace_preferences for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Players can update own Compete workspace preference" on public.compete_workspace_preferences;
create policy "Players can update own Compete workspace preference"
  on public.compete_workspace_preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.compete_workspace_preferences is
  'The last signed-in matchup, league, tournament, schedule, or results view for seamless Compete resume.';
