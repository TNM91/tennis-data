create table if not exists public.import_queue (
  id uuid primary key default gen_random_uuid(),
  page_type text not null check (page_type in ('scorecard', 'season_schedule', 'team_summary')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processed', 'rejected')),
  reason text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists import_queue_status_created_at_idx
  on public.import_queue (status, created_at desc);

create index if not exists import_queue_page_type_created_at_idx
  on public.import_queue (page_type, created_at desc);

alter table public.import_queue enable row level security;

drop policy if exists "Admins can read import queue" on public.import_queue;
create policy "Admins can read import queue"
  on public.import_queue for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can update import queue" on public.import_queue;
create policy "Admins can update import queue"
  on public.import_queue for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
