create table if not exists public.data_assist_batches (
  id uuid primary key default gen_random_uuid(),
  submitted_by_user_id uuid not null references public.profiles(id) on delete cascade,
  source_system text not null default 'tennislink'
    check (source_system = 'tennislink'),
  requested_import_type text not null
    check (requested_import_type in ('scorecard', 'schedule', 'team_summary')),
  detected_layout text not null default 'pending'
    check (detected_layout in ('pending', 'tennislink_scorecard', 'tennislink_schedule', 'tennislink_team_summary', 'unsupported')),
  status text not null default 'uploaded'
    check (status in ('uploaded', 'layout_detected', 'needs_review', 'ready_to_import', 'rejected', 'verified', 'imported')),
  screenshot_count integer not null default 0 check (screenshot_count >= 0),
  confidence_score numeric not null default 0 check (confidence_score >= 0 and confidence_score <= 1),
  rejection_reason text not null default '',
  contribution_value text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.data_assist_screenshots (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.data_assist_batches(id) on delete cascade,
  submitted_by_user_id uuid not null references public.profiles(id) on delete cascade,
  upload_order integer not null check (upload_order >= 1),
  file_name text not null default '',
  mime_type text not null default '',
  file_size_bytes integer not null default 0 check (file_size_bytes >= 0),
  image_width integer null check (image_width is null or image_width >= 0),
  image_height integer null check (image_height is null or image_height >= 0),
  client_fingerprint text not null default '',
  detection_status text not null default 'pending'
    check (detection_status in ('pending', 'supported', 'needs_review', 'rejected')),
  detected_layout text not null default 'pending',
  confidence_score numeric not null default 0 check (confidence_score >= 0 and confidence_score <= 1),
  visual_signals jsonb not null default '[]'::jsonb,
  rejection_reason text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.data_assist_drafts (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.data_assist_batches(id) on delete cascade,
  submitted_by_user_id uuid not null references public.profiles(id) on delete cascade,
  draft_type text not null
    check (draft_type in ('scorecard', 'schedule', 'team_summary')),
  status text not null default 'needs_review'
    check (status in ('needs_review', 'blocked', 'ready_for_verification', 'verified', 'imported')),
  confidence_score numeric not null default 0 check (confidence_score >= 0 and confidence_score <= 1),
  validation_summary jsonb not null default '{}'::jsonb,
  parsed_payload jsonb not null default '{}'::jsonb,
  impact_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.data_assist_contributor_stats (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  verified_import_count integer not null default 0 check (verified_import_count >= 0),
  contribution_accuracy_score numeric not null default 0 check (contribution_accuracy_score >= 0 and contribution_accuracy_score <= 1),
  captain_verified_imports integer not null default 0 check (captain_verified_imports >= 0),
  admin_verified_imports integer not null default 0 check (admin_verified_imports >= 0),
  badges jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists data_assist_batches_user_idx
  on public.data_assist_batches (submitted_by_user_id, created_at desc);

create index if not exists data_assist_batches_status_idx
  on public.data_assist_batches (status, requested_import_type, created_at desc);

create index if not exists data_assist_screenshots_batch_order_idx
  on public.data_assist_screenshots (batch_id, upload_order);

create index if not exists data_assist_drafts_batch_idx
  on public.data_assist_drafts (batch_id, status);

create or replace function public.set_data_assist_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists data_assist_batches_set_updated_at on public.data_assist_batches;
create trigger data_assist_batches_set_updated_at
before update on public.data_assist_batches
for each row
execute function public.set_data_assist_updated_at();

drop trigger if exists data_assist_drafts_set_updated_at on public.data_assist_drafts;
create trigger data_assist_drafts_set_updated_at
before update on public.data_assist_drafts
for each row
execute function public.set_data_assist_updated_at();

drop trigger if exists data_assist_contributor_stats_set_updated_at on public.data_assist_contributor_stats;
create trigger data_assist_contributor_stats_set_updated_at
before update on public.data_assist_contributor_stats
for each row
execute function public.set_data_assist_updated_at();

alter table public.data_assist_batches enable row level security;
alter table public.data_assist_screenshots enable row level security;
alter table public.data_assist_drafts enable row level security;
alter table public.data_assist_contributor_stats enable row level security;

drop policy if exists "Users can create their Data Assist batches" on public.data_assist_batches;
create policy "Users can create their Data Assist batches"
  on public.data_assist_batches for insert to authenticated
  with check (submitted_by_user_id = auth.uid());

drop policy if exists "Users and admins can read Data Assist batches" on public.data_assist_batches;
create policy "Users and admins can read Data Assist batches"
  on public.data_assist_batches for select to authenticated
  using (
    submitted_by_user_id = auth.uid()
    or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

drop policy if exists "Admins can update Data Assist batches" on public.data_assist_batches;
create policy "Admins can update Data Assist batches"
  on public.data_assist_batches for update to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists "Users can create their Data Assist screenshots" on public.data_assist_screenshots;
create policy "Users can create their Data Assist screenshots"
  on public.data_assist_screenshots for insert to authenticated
  with check (
    submitted_by_user_id = auth.uid()
    and exists (
      select 1 from public.data_assist_batches
      where data_assist_batches.id = data_assist_screenshots.batch_id
        and data_assist_batches.submitted_by_user_id = auth.uid()
    )
  );

drop policy if exists "Users and admins can read Data Assist screenshots" on public.data_assist_screenshots;
create policy "Users and admins can read Data Assist screenshots"
  on public.data_assist_screenshots for select to authenticated
  using (
    submitted_by_user_id = auth.uid()
    or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

drop policy if exists "Users can create their Data Assist drafts" on public.data_assist_drafts;
create policy "Users can create their Data Assist drafts"
  on public.data_assist_drafts for insert to authenticated
  with check (
    submitted_by_user_id = auth.uid()
    and exists (
      select 1 from public.data_assist_batches
      where data_assist_batches.id = data_assist_drafts.batch_id
        and data_assist_batches.submitted_by_user_id = auth.uid()
    )
  );

drop policy if exists "Users and admins can read Data Assist drafts" on public.data_assist_drafts;
create policy "Users and admins can read Data Assist drafts"
  on public.data_assist_drafts for select to authenticated
  using (
    submitted_by_user_id = auth.uid()
    or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

drop policy if exists "Users and admins can read contributor stats" on public.data_assist_contributor_stats;
create policy "Users and admins can read contributor stats"
  on public.data_assist_contributor_stats for select to authenticated
  using (
    profile_id = auth.uid()
    or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

drop policy if exists "Admins can update contributor stats" on public.data_assist_contributor_stats;
create policy "Admins can update contributor stats"
  on public.data_assist_contributor_stats for all to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
