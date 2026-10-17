create table if not exists public.player_reflections (
  id text primary key,
  player_user_id uuid not null references auth.users(id) on delete cascade,
  player_id text,
  outcome smallint not null,
  worked text not null default '',
  next_step text not null default '',
  proof_label text not null default '',
  result_label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_reflections_outcome_check check (outcome between 1 and 3),
  constraint player_reflections_has_read_check check (length(trim(worked)) > 0 or length(trim(next_step)) > 0)
);

alter table public.player_reflections enable row level security;

drop policy if exists "Players can read own reflections" on public.player_reflections;
drop policy if exists "Players can insert own reflections" on public.player_reflections;
drop policy if exists "Players can update own reflections" on public.player_reflections;
drop policy if exists "Players can delete own reflections" on public.player_reflections;

create policy "Players can read own reflections"
  on public.player_reflections for select
  using (auth.uid() = player_user_id);

create policy "Players can insert own reflections"
  on public.player_reflections for insert
  with check (auth.uid() = player_user_id);

create policy "Players can update own reflections"
  on public.player_reflections for update
  using (auth.uid() = player_user_id)
  with check (auth.uid() = player_user_id);

create policy "Players can delete own reflections"
  on public.player_reflections for delete
  using (auth.uid() = player_user_id);

create index if not exists player_reflections_player_created_idx
  on public.player_reflections (player_user_id, created_at desc);
