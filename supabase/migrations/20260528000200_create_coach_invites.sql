create table if not exists public.coach_student_invites (
  id text primary key,
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  student_link_id text references public.coach_player_links(id) on delete cascade,
  invite_email text not null default '',
  invite_token text not null unique,
  status text not null default 'pending',
  message text not null default '',
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_student_invites_status_check check (status in ('pending', 'accepted', 'revoked', 'expired'))
);

alter table public.coach_student_invites enable row level security;

drop policy if exists "Coaches can read own coach invites" on public.coach_student_invites;
drop policy if exists "Coaches can insert own coach invites" on public.coach_student_invites;
drop policy if exists "Coaches can update own coach invites" on public.coach_student_invites;
drop policy if exists "Coaches can delete own coach invites" on public.coach_student_invites;
drop policy if exists "Invited players can read accepted coach invites" on public.coach_student_invites;

create policy "Coaches can read own coach invites"
  on public.coach_student_invites
  for select
  using (auth.uid() = coach_user_id);

create policy "Coaches can insert own coach invites"
  on public.coach_student_invites
  for insert
  with check (auth.uid() = coach_user_id);

create policy "Coaches can update own coach invites"
  on public.coach_student_invites
  for update
  using (auth.uid() = coach_user_id)
  with check (auth.uid() = coach_user_id);

create policy "Coaches can delete own coach invites"
  on public.coach_student_invites
  for delete
  using (auth.uid() = coach_user_id);

create policy "Invited players can read accepted coach invites"
  on public.coach_student_invites
  for select
  using (auth.uid() = accepted_by_user_id);

create index if not exists coach_student_invites_coach_updated_idx
  on public.coach_student_invites (coach_user_id, updated_at desc);

create index if not exists coach_student_invites_student_idx
  on public.coach_student_invites (student_link_id);

create index if not exists coach_student_invites_token_idx
  on public.coach_student_invites (invite_token);
