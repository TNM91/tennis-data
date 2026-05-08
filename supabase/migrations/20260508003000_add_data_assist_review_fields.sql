alter table public.data_assist_batches
  add column if not exists reviewed_by_user_id uuid null references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz null,
  add column if not exists review_note text not null default '';

alter table public.data_assist_drafts
  add column if not exists reviewed_by_user_id uuid null references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz null,
  add column if not exists review_note text not null default '',
  add column if not exists ocr_status text not null default 'not_started'
    check (ocr_status in ('not_started', 'queued', 'processed', 'failed', 'disabled')),
  add column if not exists external_match_id text not null default '',
  add column if not exists home_team text not null default '',
  add column if not exists away_team text not null default '',
  add column if not exists match_date text not null default '',
  add column if not exists line_count integer not null default 0 check (line_count >= 0),
  add column if not exists parser_warnings jsonb not null default '[]'::jsonb;

create index if not exists data_assist_batches_review_idx
  on public.data_assist_batches (reviewed_at desc, status, requested_import_type);

create index if not exists data_assist_drafts_scorecard_idx
  on public.data_assist_drafts (draft_type, external_match_id)
  where draft_type = 'scorecard';

drop policy if exists "Admins can update Data Assist drafts" on public.data_assist_drafts;
create policy "Admins can update Data Assist drafts"
  on public.data_assist_drafts for update to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
