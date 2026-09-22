create table if not exists public.captain_lineup_reviews (
  id uuid primary key default gen_random_uuid(),
  review_token uuid not null default gen_random_uuid() unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid,
  team_name text not null,
  league_name text not null default '',
  flight text not null default '',
  match_date date,
  opponent_team text not null default '',
  match_time text not null default '',
  facility text not null default '',
  slots_json jsonb not null default '[]'::jsonb,
  roster_json jsonb not null default '[]'::jsonb,
  proposed_slots_json jsonb,
  reviewer_name text not null default '',
  reviewer_note text not null default '',
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '14 days'),
  submitted_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint captain_lineup_reviews_status_check
    check (status in ('pending', 'submitted', 'accepted'))
);

create index if not exists captain_lineup_reviews_owner_idx
  on public.captain_lineup_reviews (created_by, updated_at desc);

create index if not exists captain_lineup_reviews_expiry_idx
  on public.captain_lineup_reviews (expires_at);

alter table public.captain_lineup_reviews enable row level security;

drop policy if exists captain_lineup_reviews_owner_select on public.captain_lineup_reviews;
create policy captain_lineup_reviews_owner_select
  on public.captain_lineup_reviews
  for select
  to authenticated
  using (created_by = (select auth.uid()));

drop policy if exists captain_lineup_reviews_owner_insert on public.captain_lineup_reviews;
create policy captain_lineup_reviews_owner_insert
  on public.captain_lineup_reviews
  for insert
  to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists captain_lineup_reviews_owner_update on public.captain_lineup_reviews;
create policy captain_lineup_reviews_owner_update
  on public.captain_lineup_reviews
  for update
  to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
