create table if not exists public.tiq_individual_league_suggestions (
  id text primary key,
  league_id text not null references public.tiq_leagues(id) on delete cascade,
  individual_competition_format text not null default 'standard',
  suggestion_type text not null,
  pair_key text not null,
  title text not null,
  body text not null default '',
  player_a_name text not null,
  player_a_id text not null default '',
  player_b_name text not null,
  player_b_id text not null default '',
  status text not null default 'open',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  updated_by_user_id uuid not null references auth.users(id) on delete cascade,
  constraint tiq_individual_suggestions_format_check
    check (individual_competition_format in ('standard', 'ladder', 'round_robin', 'challenge')),
  constraint tiq_individual_suggestions_status_check
    check (status in ('open', 'completed', 'dismissed'))
);

create index if not exists tiq_individual_suggestions_league_idx
  on public.tiq_individual_league_suggestions (league_id, status, updated_at desc);

create unique index if not exists tiq_individual_suggestions_open_pair_idx
  on public.tiq_individual_league_suggestions (league_id, suggestion_type, pair_key)
  where status = 'open';

alter table public.tiq_individual_league_suggestions enable row level security;

create policy "Authenticated users can read TIQ individual suggestions"
  on public.tiq_individual_league_suggestions
  for select
  to authenticated
  using (true);

create policy "Authenticated users can create TIQ individual suggestions"
  on public.tiq_individual_league_suggestions
  for insert
  to authenticated
  with check (auth.uid() = created_by_user_id and auth.uid() = updated_by_user_id);

create policy "Suggestion owners can update TIQ individual suggestions"
  on public.tiq_individual_league_suggestions
  for update
  to authenticated
  using (auth.uid() = created_by_user_id or auth.uid() = updated_by_user_id)
  with check (auth.uid() = updated_by_user_id);
