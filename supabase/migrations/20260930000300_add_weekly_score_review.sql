alter table public.tiq_league_weekly_set_results
  add column if not exists review_status text not null default 'approved',
  add column if not exists approved_by_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz null,
  add column if not exists review_note text not null default '';

alter table public.tiq_league_weekly_set_results
  drop constraint if exists tiq_league_weekly_set_results_review_status_check;

alter table public.tiq_league_weekly_set_results
  add constraint tiq_league_weekly_set_results_review_status_check
  check (review_status in ('pending', 'confirmed', 'disputed', 'approved'));

update public.tiq_league_weekly_set_results
set review_status = 'approved', approved_at = coalesce(approved_at, submitted_at)
where approved_at is null;

create table if not exists public.tiq_league_weekly_score_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tiq_league_weekly_sessions(id) on delete cascade,
  court_number smallint not null check (court_number between 1 and 24),
  set_number smallint not null check (set_number between 1 and 3),
  side_a_games smallint not null check (side_a_games between 0 and 99),
  side_b_games smallint not null check (side_b_games between 0 and 99),
  submitted_by_name text not null,
  submitted_at timestamptz not null default now(),
  unique (session_id, court_number, set_number, submitted_by_name)
);

create index if not exists tiq_league_weekly_score_submissions_set_idx
  on public.tiq_league_weekly_score_submissions (session_id, court_number, set_number, submitted_at desc);

alter table public.tiq_league_weekly_score_submissions enable row level security;

create policy "League managers read weekly score submissions"
on public.tiq_league_weekly_score_submissions for select to authenticated
using (
  exists (
    select 1 from public.tiq_league_weekly_sessions session
    where session.id = session_id and public.can_manage_tiq_league(session.league_id)
  )
);
