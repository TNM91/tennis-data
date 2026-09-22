create table if not exists public.captain_lineup_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope_key text not null,
  competition_layer text not null default '',
  team_name text not null,
  league_name text not null default '',
  flight text not null default '',
  match_date date,
  opponent_team text not null default '',
  selected_match_id text not null default '',
  match_format text not null default 'auto',
  scenario_id uuid,
  scenario_name text not null default '',
  notes text not null default '',
  slots_json jsonb not null default '[]'::jsonb,
  opponent_slots_json jsonb not null default '[]'::jsonb,
  manual_roster_entries jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint captain_lineup_drafts_owner_scope_unique unique (user_id, scope_key)
);

create index if not exists captain_lineup_drafts_owner_updated_idx
  on public.captain_lineup_drafts (user_id, updated_at desc);

alter table public.captain_lineup_drafts enable row level security;

drop policy if exists captain_lineup_drafts_owner_select on public.captain_lineup_drafts;
create policy captain_lineup_drafts_owner_select
  on public.captain_lineup_drafts for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists captain_lineup_drafts_owner_insert on public.captain_lineup_drafts;
create policy captain_lineup_drafts_owner_insert
  on public.captain_lineup_drafts for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists captain_lineup_drafts_owner_update on public.captain_lineup_drafts;
create policy captain_lineup_drafts_owner_update
  on public.captain_lineup_drafts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists captain_lineup_drafts_owner_delete on public.captain_lineup_drafts;
create policy captain_lineup_drafts_owner_delete
  on public.captain_lineup_drafts for delete to authenticated
  using (user_id = (select auth.uid()));

comment on table public.captain_lineup_drafts is
  'Private, per-match Captain working lineups that autosave across devices and deployments without replacing explicitly saved versions.';
