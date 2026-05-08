alter table public.data_assist_drafts
  add column if not exists ocr_job_id uuid null,
  add column if not exists ocr_provider text not null default 'disabled',
  add column if not exists ocr_processed_at timestamptz null;

create table if not exists public.data_assist_ocr_jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.data_assist_batches(id) on delete cascade,
  draft_id uuid not null references public.data_assist_drafts(id) on delete cascade,
  requested_by_user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'mock_review',
  status text not null default 'completed'
    check (status in ('queued', 'blocked', 'completed', 'failed')),
  screenshot_count integer not null default 0 check (screenshot_count >= 0),
  confidence_score numeric(5, 2) not null default 0 check (confidence_score >= 0 and confidence_score <= 1),
  warnings jsonb not null default '[]'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  error_message text not null default '',
  created_at timestamptz not null default now(),
  processed_at timestamptz null
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'data_assist_drafts_ocr_job_id_fkey'
  ) then
    alter table public.data_assist_drafts
      add constraint data_assist_drafts_ocr_job_id_fkey
      foreign key (ocr_job_id) references public.data_assist_ocr_jobs(id) on delete set null;
  end if;
end $$;

create index if not exists data_assist_ocr_jobs_batch_idx
  on public.data_assist_ocr_jobs (batch_id, created_at desc);

create index if not exists data_assist_ocr_jobs_status_idx
  on public.data_assist_ocr_jobs (status, provider, created_at desc);

alter table public.data_assist_ocr_jobs enable row level security;

drop policy if exists "Users and admins can read Data Assist OCR jobs" on public.data_assist_ocr_jobs;
create policy "Users and admins can read Data Assist OCR jobs"
  on public.data_assist_ocr_jobs for select to authenticated
  using (
    exists (
      select 1 from public.data_assist_batches
      where data_assist_batches.id = data_assist_ocr_jobs.batch_id
        and data_assist_batches.submitted_by_user_id = auth.uid()
    )
    or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

drop policy if exists "Admins can create Data Assist OCR jobs" on public.data_assist_ocr_jobs;
create policy "Admins can create Data Assist OCR jobs"
  on public.data_assist_ocr_jobs for insert to authenticated
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists "Admins can update Data Assist OCR jobs" on public.data_assist_ocr_jobs;
create policy "Admins can update Data Assist OCR jobs"
  on public.data_assist_ocr_jobs for update to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
