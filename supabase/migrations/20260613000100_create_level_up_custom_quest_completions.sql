create table if not exists public.level_up_custom_quest_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  custom_quest_id uuid not null references public.level_up_custom_quests(id) on delete cascade,
  level_up_session_id text,
  identity_slug text not null default '',
  card_id text,
  completed_on date not null default ((now() at time zone 'utc')::date),
  completed_at timestamptz not null default now(),
  xp integer not null default 0,
  proof_rating integer,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint level_up_custom_quest_completions_unique_day unique (custom_quest_id, completed_on),
  constraint level_up_custom_quest_completions_xp_check check (xp between 0 and 100),
  constraint level_up_custom_quest_completions_rating_check check (proof_rating is null or proof_rating between 0 and 5)
);

alter table public.level_up_custom_quest_completions enable row level security;

drop policy if exists "Users can select own Level Up custom quest completions" on public.level_up_custom_quest_completions;
drop policy if exists "Users can insert own Level Up custom quest completions" on public.level_up_custom_quest_completions;
drop policy if exists "Users can update own Level Up custom quest completions" on public.level_up_custom_quest_completions;
drop policy if exists "Users can delete own Level Up custom quest completions" on public.level_up_custom_quest_completions;

create policy "Users can select own Level Up custom quest completions"
  on public.level_up_custom_quest_completions for select
  using (auth.uid() = user_id);

create policy "Users can insert own Level Up custom quest completions"
  on public.level_up_custom_quest_completions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.level_up_custom_quests quest
      where quest.id = custom_quest_id
        and quest.user_id = auth.uid()
    )
  );

create policy "Users can update own Level Up custom quest completions"
  on public.level_up_custom_quest_completions for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.level_up_custom_quests quest
      where quest.id = custom_quest_id
        and quest.user_id = auth.uid()
    )
  );

create policy "Users can delete own Level Up custom quest completions"
  on public.level_up_custom_quest_completions for delete
  using (auth.uid() = user_id);

create index if not exists level_up_custom_quest_completions_user_completed_idx
  on public.level_up_custom_quest_completions (user_id, completed_on desc);

create index if not exists level_up_custom_quest_completions_quest_completed_idx
  on public.level_up_custom_quest_completions (custom_quest_id, completed_on desc);

create index if not exists level_up_custom_quest_completions_user_quest_idx
  on public.level_up_custom_quest_completions (user_id, custom_quest_id);
