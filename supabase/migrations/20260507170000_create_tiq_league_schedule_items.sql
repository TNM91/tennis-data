create extension if not exists pgcrypto;

create table if not exists public.tiq_league_schedule_items (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.tiq_leagues(id) on delete cascade,
  league_format text not null check (league_format in ('team', 'individual')),
  participant_a_name text not null,
  participant_a_id text,
  participant_b_name text not null,
  participant_b_id text,
  scheduled_date date not null,
  scheduled_time time,
  facility text not null default '',
  status text not null default 'proposed',
  notes text not null default '',
  proposed_by_user_id uuid references auth.users(id) on delete set null,
  confirmed_by_user_id uuid references auth.users(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tiq_league_schedule_items_status_check
    check (status in ('proposed', 'confirmed', 'coordinator_set', 'completed', 'cancelled')),
  constraint tiq_league_schedule_items_distinct_participants_check
    check (lower(participant_a_name) <> lower(participant_b_name))
);

create index if not exists tiq_league_schedule_items_league_idx
  on public.tiq_league_schedule_items (league_id, scheduled_date, scheduled_time);

create index if not exists tiq_league_schedule_items_status_idx
  on public.tiq_league_schedule_items (status);

create or replace function public.set_tiq_league_schedule_item_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_tiq_league_schedule_item_updated_at on public.tiq_league_schedule_items;
create trigger set_tiq_league_schedule_item_updated_at
before update on public.tiq_league_schedule_items
for each row
execute function public.set_tiq_league_schedule_item_updated_at();

alter table public.tiq_league_schedule_items enable row level security;

drop policy if exists "TIQ league schedule items are readable" on public.tiq_league_schedule_items;
drop policy if exists "Authenticated users can propose TIQ league schedule items" on public.tiq_league_schedule_items;
drop policy if exists "Participants can update TIQ league schedule proposals" on public.tiq_league_schedule_items;
drop policy if exists "League creators can manage TIQ league schedule items" on public.tiq_league_schedule_items;

create policy "TIQ league schedule items are readable"
on public.tiq_league_schedule_items
for select
using (
  exists (
    select 1
    from public.tiq_leagues
    where tiq_leagues.id = tiq_league_schedule_items.league_id
      and (
        tiq_leagues.is_public = true
        or tiq_leagues.created_by_user_id = auth.uid()
        or tiq_league_schedule_items.created_by_user_id = auth.uid()
        or tiq_league_schedule_items.proposed_by_user_id = auth.uid()
      )
  )
);

create policy "Authenticated users can propose TIQ league schedule items"
on public.tiq_league_schedule_items
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
  and proposed_by_user_id = auth.uid()
  and status in ('proposed', 'confirmed', 'coordinator_set')
  and exists (
    select 1
    from public.tiq_leagues
    where tiq_leagues.id = tiq_league_schedule_items.league_id
      and (
        tiq_leagues.is_public = true
        or tiq_leagues.created_by_user_id = auth.uid()
      )
  )
);

create policy "Participants can update TIQ league schedule proposals"
on public.tiq_league_schedule_items
for update
to authenticated
using (
  proposed_by_user_id = auth.uid()
  or created_by_user_id = auth.uid()
)
with check (
  updated_by_user_id = auth.uid()
  and status in ('confirmed', 'cancelled')
);

create policy "League creators can manage TIQ league schedule items"
on public.tiq_league_schedule_items
for update
to authenticated
using (
  exists (
    select 1
    from public.tiq_leagues
    where tiq_leagues.id = tiq_league_schedule_items.league_id
      and tiq_leagues.created_by_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tiq_leagues
    where tiq_leagues.id = tiq_league_schedule_items.league_id
      and tiq_leagues.created_by_user_id = auth.uid()
  )
);
