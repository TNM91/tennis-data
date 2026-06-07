create table if not exists public.profile_sync_review_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.product_usage_events(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'reviewed')),
  review_note text not null default '',
  reviewed_by_user_id uuid null references public.profiles(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists profile_sync_review_events_status_updated_at_idx
  on public.profile_sync_review_events (status, updated_at desc);

alter table public.profile_sync_review_events enable row level security;

drop policy if exists "Admins can read profile sync reviews" on public.profile_sync_review_events;
create policy "Admins can read profile sync reviews"
  on public.profile_sync_review_events for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can create profile sync reviews" on public.profile_sync_review_events;
create policy "Admins can create profile sync reviews"
  on public.profile_sync_review_events for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can update profile sync reviews" on public.profile_sync_review_events;
create policy "Admins can update profile sync reviews"
  on public.profile_sync_review_events for update to authenticated
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
