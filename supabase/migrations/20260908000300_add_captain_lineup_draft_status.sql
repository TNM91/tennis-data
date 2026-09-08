alter table public.captain_lineup_drafts
  add column if not exists status text not null default 'working';

alter table public.captain_lineup_drafts
  drop constraint if exists captain_lineup_drafts_status_check;

alter table public.captain_lineup_drafts
  add constraint captain_lineup_drafts_status_check
  check (status in ('working', 'final'));

alter table public.captain_lineup_drafts
  add column if not exists finalized_at timestamptz;

create index if not exists captain_lineup_drafts_active_summary_idx
  on public.captain_lineup_drafts (user_id, match_date, updated_at desc);

comment on column public.captain_lineup_drafts.status is
  'Working drafts become final only after every selected player is confirmed.';
