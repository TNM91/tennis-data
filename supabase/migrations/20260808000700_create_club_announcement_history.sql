create table if not exists public.club_announcement_history (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_name text not null default '',
  body text not null,
  destinations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint club_announcement_history_body_check
    check (char_length(btrim(body)) between 1 and 2000),
  constraint club_announcement_history_destinations_check
    check (
      jsonb_typeof(destinations) = 'array'
      and jsonb_array_length(destinations) between 1 and 50
    )
);

create index if not exists club_announcement_history_club_created_idx
  on public.club_announcement_history (club_id, created_at desc);

alter table public.club_announcement_history enable row level security;

create policy "Club staff can read announcement history"
  on public.club_announcement_history for select to authenticated
  using (
    exists (
      select 1
      from public.club_memberships membership
      where membership.club_id = club_announcement_history.club_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.roles && array['owner', 'admin', 'director', 'coach', 'captain', 'coordinator']::text[]
    )
  );

create policy "Club staff can record announcement history"
  on public.club_announcement_history for insert to authenticated
  with check (
    author_user_id = (select auth.uid())
    and exists (
      select 1
      from public.club_memberships membership
      where membership.club_id = club_announcement_history.club_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.roles && array['owner', 'admin', 'director', 'coach', 'captain', 'coordinator']::text[]
    )
  );

comment on table public.club_announcement_history is
  'Immutable Club announcement receipts used to review destinations and reuse prior communication.';
