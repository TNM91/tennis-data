create table if not exists public.player_calendar_items (
  id text primary key,
  player_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  scheduled_date date not null,
  scheduled_time text not null default '',
  kind text not null default 'reminder',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_calendar_items_kind_check check (kind in ('practice', 'match', 'lesson', 'reminder')),
  constraint player_calendar_items_time_check check (scheduled_time = '' or scheduled_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

alter table public.player_calendar_items enable row level security;

drop policy if exists "Players can read own calendar items" on public.player_calendar_items;
drop policy if exists "Players can insert own calendar items" on public.player_calendar_items;
drop policy if exists "Players can update own calendar items" on public.player_calendar_items;
drop policy if exists "Players can delete own calendar items" on public.player_calendar_items;

create policy "Players can read own calendar items"
  on public.player_calendar_items
  for select
  using (auth.uid() = player_user_id);

create policy "Players can insert own calendar items"
  on public.player_calendar_items
  for insert
  with check (auth.uid() = player_user_id);

create policy "Players can update own calendar items"
  on public.player_calendar_items
  for update
  using (auth.uid() = player_user_id)
  with check (auth.uid() = player_user_id);

create policy "Players can delete own calendar items"
  on public.player_calendar_items
  for delete
  using (auth.uid() = player_user_id);

create index if not exists player_calendar_items_user_date_idx
  on public.player_calendar_items (player_user_id, scheduled_date, scheduled_time);
