alter table public.tiq_tournament_entries
  add column if not exists eligibility_status text not null default 'needs_confirmation',
  add column if not exists eligibility_review_note text not null default '',
  add column if not exists eligibility_reviewed_at timestamptz,
  add column if not exists eligibility_reviewed_by uuid references auth.users(id) on delete set null;

alter table public.tiq_tournament_entries
  drop constraint if exists tiq_tournament_entries_eligibility_status_check;

alter table public.tiq_tournament_entries
  add constraint tiq_tournament_entries_eligibility_status_check
  check (eligibility_status in ('verified', 'needs_confirmation', 'ineligible'));

alter table public.tiq_player_league_entries
  add column if not exists eligibility_status text not null default 'needs_confirmation',
  add column if not exists eligibility_review_note text not null default '',
  add column if not exists eligibility_reviewed_at timestamptz,
  add column if not exists eligibility_reviewed_by uuid references auth.users(id) on delete set null;

alter table public.tiq_player_league_entries
  drop constraint if exists tiq_player_league_entries_eligibility_status_check;

alter table public.tiq_player_league_entries
  add constraint tiq_player_league_entries_eligibility_status_check
  check (eligibility_status in ('verified', 'needs_confirmation', 'ineligible'));

comment on column public.tiq_tournament_entries.eligibility_review_note is
'Organizer-facing audit note describing the rating, age, and division evidence reviewed before approval.';

comment on column public.tiq_player_league_entries.eligibility_review_note is
'League Office audit note describing the rating, age, and division evidence reviewed before approval.';
