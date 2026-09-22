create table if not exists public.player_achievement_showcases (
  player_id uuid primary key references public.players(id) on delete cascade,
  profile_user_id uuid not null references public.profiles(id) on delete cascade,
  featured_keys text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint player_achievement_showcases_featured_keys_limit check (cardinality(featured_keys) <= 3)
);

create index if not exists player_achievement_showcases_profile_user_id_idx
  on public.player_achievement_showcases (profile_user_id);

alter table public.player_achievement_showcases enable row level security;

create policy "Public can read player achievement showcases"
  on public.player_achievement_showcases for select
  using (true);

create policy "Players can create their own achievement showcase"
  on public.player_achievement_showcases for insert
  with check (auth.uid() = profile_user_id);

create policy "Players can update their own achievement showcase"
  on public.player_achievement_showcases for update
  using (auth.uid() = profile_user_id)
  with check (auth.uid() = profile_user_id);

create policy "Players can remove their own achievement showcase"
  on public.player_achievement_showcases for delete
  using (auth.uid() = profile_user_id);
