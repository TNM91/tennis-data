create table if not exists public.upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null check (plan_id in ('player_plus', 'captain', 'league')),
  plan_name text not null,
  requester_name text not null default '',
  requester_email text not null,
  requester_user_id uuid null,
  organization text not null default '',
  goal text not null,
  next_href text not null default '',
  status text not null default 'pending' check (status in ('pending', 'contacted', 'converted', 'closed')),
  source text not null default 'upgrade_page',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists upgrade_requests_status_created_at_idx
  on public.upgrade_requests (status, created_at desc);

create index if not exists upgrade_requests_plan_created_at_idx
  on public.upgrade_requests (plan_id, created_at desc);

create index if not exists upgrade_requests_requester_user_id_idx
  on public.upgrade_requests (requester_user_id)
  where requester_user_id is not null;

alter table public.upgrade_requests enable row level security;

drop policy if exists "Anyone can create upgrade requests" on public.upgrade_requests;
create policy "Anyone can create upgrade requests"
  on public.upgrade_requests for insert to anon, authenticated
  with check (
    requester_email <> ''
    and goal <> ''
    and source = 'upgrade_page'
    and (
      requester_user_id is null
      or requester_user_id = auth.uid()
    )
  );

drop policy if exists "Admins can read upgrade requests" on public.upgrade_requests;
create policy "Admins can read upgrade requests"
  on public.upgrade_requests for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can update upgrade requests" on public.upgrade_requests;
create policy "Admins can update upgrade requests"
  on public.upgrade_requests for update to authenticated
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

drop policy if exists "Admins can delete upgrade requests" on public.upgrade_requests;
create policy "Admins can delete upgrade requests"
  on public.upgrade_requests for delete to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
