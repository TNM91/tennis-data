create table if not exists public.coach_player_links (
  id text primary key,
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  player_user_id uuid references auth.users(id) on delete set null,
  player_id text,
  player_name text not null,
  identity_slug text not null default 'relentless-competitor-4-0',
  level_label text not null default '',
  status text not null default 'active',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_player_links_status_check check (status in ('active', 'needs_assignment', 'review_notes', 'paused'))
);

create table if not exists public.coach_assignments (
  id text primary key,
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  student_link_id text not null references public.coach_player_links(id) on delete cascade,
  title text not null,
  focus text not null default '',
  due_date date,
  status text not null default 'draft',
  assignment_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_assignments_status_check check (status in ('draft', 'assigned', 'completed', 'archived'))
);

alter table public.coach_player_links enable row level security;
alter table public.coach_assignments enable row level security;

drop policy if exists "Coaches and linked players can read coach links" on public.coach_player_links;
drop policy if exists "Coaches can insert coach links" on public.coach_player_links;
drop policy if exists "Coaches can update own coach links" on public.coach_player_links;
drop policy if exists "Coaches can delete own coach links" on public.coach_player_links;

create policy "Coaches and linked players can read coach links"
  on public.coach_player_links
  for select
  using (auth.uid() = coach_user_id or auth.uid() = player_user_id);

create policy "Coaches can insert coach links"
  on public.coach_player_links
  for insert
  with check (auth.uid() = coach_user_id);

create policy "Coaches can update own coach links"
  on public.coach_player_links
  for update
  using (auth.uid() = coach_user_id)
  with check (auth.uid() = coach_user_id);

create policy "Coaches can delete own coach links"
  on public.coach_player_links
  for delete
  using (auth.uid() = coach_user_id);

drop policy if exists "Coaches and linked players can read assignments" on public.coach_assignments;
drop policy if exists "Coaches can insert assignments" on public.coach_assignments;
drop policy if exists "Coaches can update own assignments" on public.coach_assignments;
drop policy if exists "Coaches can delete own assignments" on public.coach_assignments;

create policy "Coaches and linked players can read assignments"
  on public.coach_assignments
  for select
  using (
    auth.uid() = coach_user_id
    or exists (
      select 1
      from public.coach_player_links link
      where link.id = coach_assignments.student_link_id
        and link.player_user_id = auth.uid()
    )
  );

create policy "Coaches can insert assignments"
  on public.coach_assignments
  for insert
  with check (auth.uid() = coach_user_id);

create policy "Coaches can update own assignments"
  on public.coach_assignments
  for update
  using (auth.uid() = coach_user_id)
  with check (auth.uid() = coach_user_id);

create policy "Coaches can delete own assignments"
  on public.coach_assignments
  for delete
  using (auth.uid() = coach_user_id);

create index if not exists coach_player_links_coach_updated_idx
  on public.coach_player_links (coach_user_id, updated_at desc);

create index if not exists coach_player_links_player_idx
  on public.coach_player_links (player_user_id);

create index if not exists coach_assignments_coach_updated_idx
  on public.coach_assignments (coach_user_id, updated_at desc);

create index if not exists coach_assignments_student_updated_idx
  on public.coach_assignments (student_link_id, updated_at desc);
