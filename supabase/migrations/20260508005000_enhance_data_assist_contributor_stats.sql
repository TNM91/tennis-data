alter table public.data_assist_contributor_stats
  add column if not exists rejected_import_count integer not null default 0 check (rejected_import_count >= 0),
  add column if not exists pending_review_count integer not null default 0 check (pending_review_count >= 0),
  add column if not exists last_verified_at timestamptz null,
  add column if not exists last_rejected_at timestamptz null;

create index if not exists data_assist_contributor_stats_quality_idx
  on public.data_assist_contributor_stats (verified_import_count desc, contribution_accuracy_score desc);
