create table if not exists public.tiq_individual_league_results (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.tiq_leagues(id) on delete cascade,
  player_a_name text not null,
  player_a_id text,
  player_b_name text not null,
  player_b_id text,
  winner_player_name text not null,
  winner_player_id text,
  score text not null default '',
  result_date timestamptz not null default timezone('utc', now()),
  notes text not null default '',
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists tiq_individual_league_results_league_idx
  on public.tiq_individual_league_results (league_id, result_date desc);

create or replace function public.set_tiq_individual_result_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_tiq_individual_result_updated_at on public.tiq_individual_league_results;
create trigger set_tiq_individual_result_updated_at
before update on public.tiq_individual_league_results
for each row
execute function public.set_tiq_individual_result_updated_at();

alter table public.tiq_individual_league_results enable row level security;

drop policy if exists "Public TIQ individual results are readable" on public.tiq_individual_league_results;
create policy "Public TIQ individual results are readable"
on public.tiq_individual_league_results
for select
using (
  exists (
    select 1
    from public.tiq_leagues
    where tiq_leagues.id = tiq_individual_league_results.league_id
      and (
        tiq_leagues.is_public = true
        or tiq_leagues.created_by_user_id = auth.uid()
      )
  )
);

drop policy if exists "Authenticated users can insert TIQ individual results" on public.tiq_individual_league_results;
create policy "Authenticated users can insert TIQ individual results"
on public.tiq_individual_league_results
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
);

drop policy if exists "Result creators can update TIQ individual results" on public.tiq_individual_league_results;
create policy "Result creators can update TIQ individual results"
on public.tiq_individual_league_results
for update
to authenticated
using (created_by_user_id = auth.uid())
with check (
  created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
);
