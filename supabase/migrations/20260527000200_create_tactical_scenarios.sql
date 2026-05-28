create table if not exists public.tactical_scenarios (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  focus text not null default '',
  category text not null default 'practice',
  scenario_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tactical_scenarios enable row level security;

drop policy if exists "Users can read own tactical scenarios" on public.tactical_scenarios;
drop policy if exists "Users can insert own tactical scenarios" on public.tactical_scenarios;
drop policy if exists "Users can update own tactical scenarios" on public.tactical_scenarios;
drop policy if exists "Users can delete own tactical scenarios" on public.tactical_scenarios;

create policy "Users can read own tactical scenarios"
  on public.tactical_scenarios
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own tactical scenarios"
  on public.tactical_scenarios
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tactical scenarios"
  on public.tactical_scenarios
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own tactical scenarios"
  on public.tactical_scenarios
  for delete
  using (auth.uid() = user_id);

create index if not exists tactical_scenarios_user_updated_idx
  on public.tactical_scenarios (user_id, updated_at desc);
