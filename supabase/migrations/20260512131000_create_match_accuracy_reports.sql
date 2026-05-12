alter table public.data_assist_contributor_stats
  add column if not exists can_upload_scorecards boolean not null default true,
  add column if not exists upload_suspension_reason text not null default '',
  add column if not exists upload_suspended_by_user_id uuid null references public.profiles(id) on delete set null,
  add column if not exists upload_suspended_at timestamptz null;

create table if not exists public.match_accuracy_reports (
  id uuid primary key default gen_random_uuid(),
  match_id text not null default '',
  external_match_id text not null default '',
  reporter_user_id uuid not null references public.profiles(id) on delete cascade,
  reporter_player_name text not null default '',
  issue_type text not null default 'other'
    check (issue_type in ('wrong_player', 'wrong_score', 'wrong_winner', 'wrong_team', 'duplicate_match', 'missing_match', 'other')),
  description text not null default '',
  match_snapshot jsonb not null default '{}'::jsonb,
  source_batch_id uuid null references public.data_assist_batches(id) on delete set null,
  source_draft_id uuid null references public.data_assist_drafts(id) on delete set null,
  source_uploader_user_id uuid null references public.profiles(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'reviewing', 'resolved', 'rejected')),
  admin_notes text not null default '',
  action_summary text not null default '',
  resolved_by_user_id uuid null references public.profiles(id) on delete set null,
  resolved_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists match_accuracy_reports_status_idx
  on public.match_accuracy_reports (status, created_at desc);

create index if not exists match_accuracy_reports_match_idx
  on public.match_accuracy_reports (match_id, external_match_id);

create index if not exists match_accuracy_reports_source_uploader_idx
  on public.match_accuracy_reports (source_uploader_user_id, created_at desc)
  where source_uploader_user_id is not null;

drop trigger if exists match_accuracy_reports_set_updated_at on public.match_accuracy_reports;
create trigger match_accuracy_reports_set_updated_at
before update on public.match_accuracy_reports
for each row
execute function public.set_data_assist_updated_at();

alter table public.match_accuracy_reports enable row level security;

drop policy if exists "Users can create their own match accuracy reports" on public.match_accuracy_reports;
create policy "Users can create their own match accuracy reports"
  on public.match_accuracy_reports for insert to authenticated
  with check (reporter_user_id = auth.uid());

drop policy if exists "Users can read their own match accuracy reports" on public.match_accuracy_reports;
create policy "Users can read their own match accuracy reports"
  on public.match_accuracy_reports for select to authenticated
  using (reporter_user_id = auth.uid());

drop policy if exists "Admins can read match accuracy reports" on public.match_accuracy_reports;
create policy "Admins can read match accuracy reports"
  on public.match_accuracy_reports for select to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists "Admins can update match accuracy reports" on public.match_accuracy_reports;
create policy "Admins can update match accuracy reports"
  on public.match_accuracy_reports for update to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists "Users can create their Data Assist batches" on public.data_assist_batches;
create policy "Users can create their Data Assist batches"
  on public.data_assist_batches for insert to authenticated
  with check (
    submitted_by_user_id = auth.uid()
    and (
      requested_import_type <> 'scorecard'
      or coalesce(
        (
          select stats.can_upload_scorecards
          from public.data_assist_contributor_stats stats
          where stats.profile_id = auth.uid()
        ),
        true
      )
    )
  );
