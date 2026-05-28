create table if not exists public.tiq_tournaments (
  id text primary key,
  name text not null,
  format text not null default 'single_elimination'
    check (format in ('single_elimination', 'round_robin', 'compass_draw')),
  entrant_type text not null default 'players'
    check (entrant_type in ('players', 'teams')),
  status text not null default 'draft'
    check (status in ('draft', 'open', 'scheduled', 'completed')),
  starts_on text not null default '',
  location_label text not null default '',
  director_notes text not null default '',
  entrants text[] not null default '{}',
  results jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tiq_tournaments_entrants_check check (cardinality(entrants) >= 2)
);

create index if not exists tiq_tournaments_created_by_idx
  on public.tiq_tournaments (created_by_user_id, updated_at desc);

create index if not exists tiq_tournaments_public_idx
  on public.tiq_tournaments (is_public, updated_at desc);

create or replace function public.set_tiq_tournaments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_tiq_tournaments_updated_at on public.tiq_tournaments;

create trigger set_tiq_tournaments_updated_at
before update on public.tiq_tournaments
for each row
execute function public.set_tiq_tournaments_updated_at();

alter table public.tiq_tournaments enable row level security;

drop policy if exists "Public TIQ tournaments are readable" on public.tiq_tournaments;
create policy "Public TIQ tournaments are readable"
on public.tiq_tournaments
for select
using (
  is_public = true
  or auth.uid() = created_by_user_id
);

drop policy if exists "Authenticated users can create TIQ tournaments" on public.tiq_tournaments;
create policy "Authenticated users can create TIQ tournaments"
on public.tiq_tournaments
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
);

drop policy if exists "Creators can update TIQ tournaments" on public.tiq_tournaments;
create policy "Creators can update TIQ tournaments"
on public.tiq_tournaments
for update
to authenticated
using (auth.uid() = created_by_user_id)
with check (
  auth.uid() = created_by_user_id
  and updated_by_user_id = auth.uid()
);

drop policy if exists "Creators can delete TIQ tournaments" on public.tiq_tournaments;
create policy "Creators can delete TIQ tournaments"
on public.tiq_tournaments
for delete
to authenticated
using (auth.uid() = created_by_user_id);
