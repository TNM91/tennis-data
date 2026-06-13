create table if not exists public.level_up_custom_quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null,
  cadence text not null,
  xp integer not null default 10,
  linked_card_id text,
  proof text not null default '',
  starter_habit text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint level_up_custom_quests_title_check check (char_length(trim(title)) between 1 and 90),
  constraint level_up_custom_quests_category_check check (
    category in ('tennis-skill', 'fitness', 'nutrition-hydration', 'mindset', 'recovery', 'match-prep')
  ),
  constraint level_up_custom_quests_cadence_check check (
    cadence in ('daily', 'weekly', 'practice-day', 'match-day')
  ),
  constraint level_up_custom_quests_xp_check check (xp between 1 and 100)
);

alter table public.level_up_custom_quests enable row level security;

drop policy if exists "Users can select own Level Up custom quests" on public.level_up_custom_quests;
drop policy if exists "Users can insert own Level Up custom quests" on public.level_up_custom_quests;
drop policy if exists "Users can update own Level Up custom quests" on public.level_up_custom_quests;
drop policy if exists "Users can delete own Level Up custom quests" on public.level_up_custom_quests;

create policy "Users can select own Level Up custom quests"
  on public.level_up_custom_quests for select
  using (auth.uid() = user_id);

create policy "Users can insert own Level Up custom quests"
  on public.level_up_custom_quests for insert
  with check (auth.uid() = user_id);

create policy "Users can update own Level Up custom quests"
  on public.level_up_custom_quests for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own Level Up custom quests"
  on public.level_up_custom_quests for delete
  using (auth.uid() = user_id);

create index if not exists level_up_custom_quests_user_active_idx
  on public.level_up_custom_quests (user_id, active, updated_at desc);

create index if not exists level_up_custom_quests_user_category_idx
  on public.level_up_custom_quests (user_id, category);
