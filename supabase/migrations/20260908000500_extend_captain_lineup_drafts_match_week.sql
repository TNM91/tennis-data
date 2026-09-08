alter table public.captain_lineup_drafts
  add column if not exists match_location text not null default '',
  add column if not exists match_directions text not null default '',
  add column if not exists arrival_time text not null default '',
  add column if not exists captain_notes text not null default '',
  add column if not exists match_week_updated_at timestamptz;

comment on column public.captain_lineup_drafts.match_week_updated_at is
  'Newest court or match-detail edit shared by Captain Builder and Match Week.';
