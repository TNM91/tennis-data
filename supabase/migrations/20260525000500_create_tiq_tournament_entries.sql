create table if not exists public.tiq_tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.tiq_tournaments(id) on delete cascade,
  player_name text not null,
  email text not null default '',
  phone text not null default '',
  self_rating numeric not null default 3.5,
  sms_opt_in boolean not null default false,
  consent_note text not null default '',
  status text not null default 'pending',
  linked_player_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tiq_tournament_entries_status_check check (status in ('pending', 'approved', 'declined'))
);

create index if not exists tiq_tournament_entries_tournament_idx on public.tiq_tournament_entries (tournament_id);
create index if not exists tiq_tournament_entries_status_idx on public.tiq_tournament_entries (status);

alter table public.tiq_tournament_entries enable row level security;

drop policy if exists "Public can submit TIQ tournament entries" on public.tiq_tournament_entries;
create policy "Public can submit TIQ tournament entries"
on public.tiq_tournament_entries for insert
with check (
  status = 'pending'
  and exists (
    select 1 from public.tiq_tournaments t
    where t.id = tournament_id
      and t.is_public = true
  )
);

drop policy if exists "Tournament creators can read entries" on public.tiq_tournament_entries;
create policy "Tournament creators can read entries"
on public.tiq_tournament_entries for select
using (
  exists (
    select 1 from public.tiq_tournaments t
    where t.id = tournament_id
      and t.created_by_user_id = auth.uid()
  )
);

drop policy if exists "Tournament creators can update entries" on public.tiq_tournament_entries;
create policy "Tournament creators can update entries"
on public.tiq_tournament_entries for update
using (
  exists (
    select 1 from public.tiq_tournaments t
    where t.id = tournament_id
      and t.created_by_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.tiq_tournaments t
    where t.id = tournament_id
      and t.created_by_user_id = auth.uid()
  )
);
