create table if not exists public.player_improve_workspace_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  resume_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.player_improve_workspace_preferences enable row level security;

drop policy if exists "Players can read own Improve workspace preference" on public.player_improve_workspace_preferences;
create policy "Players can read own Improve workspace preference"
  on public.player_improve_workspace_preferences for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Players can add own Improve workspace preference" on public.player_improve_workspace_preferences;
create policy "Players can add own Improve workspace preference"
  on public.player_improve_workspace_preferences for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Players can update own Improve workspace preference" on public.player_improve_workspace_preferences;
create policy "Players can update own Improve workspace preference"
  on public.player_improve_workspace_preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.player_improve_workspace_preferences is
  'The selected Player path, active Level Up or assignment draft, and coach conversation for seamless signed-in Improve resume.';
