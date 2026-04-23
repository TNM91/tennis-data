alter table public.tiq_individual_league_suggestions
  add column if not exists claimed_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists claimed_by_label text not null default '',
  add column if not exists claimed_at timestamptz;

create index if not exists tiq_individual_suggestions_claimed_by_idx
  on public.tiq_individual_league_suggestions (claimed_by_user_id, status, updated_at desc);
