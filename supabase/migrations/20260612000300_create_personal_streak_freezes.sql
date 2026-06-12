create table if not exists public.personal_streak_freezes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  freeze_date date not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, freeze_date)
);

alter table public.personal_streak_freezes enable row level security;

drop policy if exists "Users can select own personal streak freezes" on public.personal_streak_freezes;
drop policy if exists "Users can insert own personal streak freezes" on public.personal_streak_freezes;
drop policy if exists "Users can update own personal streak freezes" on public.personal_streak_freezes;
drop policy if exists "Users can delete own personal streak freezes" on public.personal_streak_freezes;

create policy "Users can select own personal streak freezes"
  on public.personal_streak_freezes for select
  using (auth.uid() = user_id);

create policy "Users can insert own personal streak freezes"
  on public.personal_streak_freezes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own personal streak freezes"
  on public.personal_streak_freezes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own personal streak freezes"
  on public.personal_streak_freezes for delete
  using (auth.uid() = user_id);

create index if not exists personal_streak_freezes_user_date_idx
  on public.personal_streak_freezes (user_id, freeze_date desc);
