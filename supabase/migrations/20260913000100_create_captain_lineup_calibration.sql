create table if not exists public.lineup_prediction_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scenario_id uuid,
  scenario_name text not null default 'Saved lineup',
  league_name text,
  flight text,
  match_date date,
  team_name text,
  opponent_team text,
  projected_team_win_pct numeric,
  projected_score_for integer,
  projected_score_against integer,
  favored_lines integer not null default 0,
  underdog_lines integer not null default 0,
  swing_line_label text,
  strongest_line_label text,
  weakest_line_label text,
  confidence_score numeric,
  confidence_tier text,
  slots_json jsonb not null default '[]'::jsonb,
  opponent_slots_json jsonb not null default '[]'::jsonb,
  line_projections_json jsonb not null default '[]'::jsonb,
  notes text,
  source text not null default 'lineup-builder',
  created_at timestamptz not null default now()
);

alter table public.lineup_prediction_snapshots
  add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete cascade;

create index if not exists lineup_prediction_snapshots_owner_match_idx
  on public.lineup_prediction_snapshots (user_id, match_date desc, created_at desc);

create index if not exists lineup_prediction_snapshots_match_scope_idx
  on public.lineup_prediction_snapshots (user_id, team_name, opponent_team, match_date, created_at desc);

alter table public.lineup_prediction_snapshots enable row level security;

drop policy if exists lineup_prediction_snapshots_owner_select on public.lineup_prediction_snapshots;
create policy lineup_prediction_snapshots_owner_select
  on public.lineup_prediction_snapshots for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists lineup_prediction_snapshots_owner_insert on public.lineup_prediction_snapshots;
create policy lineup_prediction_snapshots_owner_insert
  on public.lineup_prediction_snapshots for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists lineup_prediction_snapshots_owner_update on public.lineup_prediction_snapshots;
create policy lineup_prediction_snapshots_owner_update
  on public.lineup_prediction_snapshots for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists lineup_prediction_snapshots_owner_delete on public.lineup_prediction_snapshots;
create policy lineup_prediction_snapshots_owner_delete
  on public.lineup_prediction_snapshots for delete to authenticated
  using (user_id = (select auth.uid()));

create table if not exists public.captain_lineup_calibrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_id uuid not null references public.lineup_prediction_snapshots(id) on delete cascade,
  external_match_id text not null,
  team_name text not null,
  opponent_team text not null,
  league_name text,
  flight text,
  match_date date not null,
  projected_team_win_pct numeric,
  projected_score_for integer,
  projected_score_against integer,
  actual_score_for integer not null,
  actual_score_against integer not null,
  actual_outcome text not null,
  team_prediction_correct boolean,
  exact_score_correct boolean,
  court_prediction_accuracy numeric,
  brier_score numeric,
  lineup_adherence numeric not null,
  opponent_placement_accuracy numeric not null,
  calibration_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint captain_lineup_calibrations_owner_match_unique unique (user_id, external_match_id),
  constraint captain_lineup_calibrations_outcome_check check (actual_outcome in ('won', 'lost', 'split'))
);

create index if not exists captain_lineup_calibrations_owner_date_idx
  on public.captain_lineup_calibrations (user_id, match_date desc, updated_at desc);

alter table public.captain_lineup_calibrations enable row level security;

drop policy if exists captain_lineup_calibrations_owner_select on public.captain_lineup_calibrations;
create policy captain_lineup_calibrations_owner_select
  on public.captain_lineup_calibrations for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists captain_lineup_calibrations_owner_insert on public.captain_lineup_calibrations;
create policy captain_lineup_calibrations_owner_insert
  on public.captain_lineup_calibrations for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists captain_lineup_calibrations_owner_update on public.captain_lineup_calibrations;
create policy captain_lineup_calibrations_owner_update
  on public.captain_lineup_calibrations for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

comment on table public.lineup_prediction_snapshots is
  'Private pre-match Captain lineup projections used to measure decision quality after verified results.';

comment on table public.captain_lineup_calibrations is
  'Private post-match reconciliation between a Captain prediction snapshot, the lineup that played, and the verified scorecard.';
