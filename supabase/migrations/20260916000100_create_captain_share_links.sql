create table if not exists public.captain_share_links (
  token text primary key,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('lineup', 'final-result', 'availability', 'practice', 'live-scorecard')),
  target_href text not null,
  team_name text not null default '',
  opponent text not null default '',
  match_date date,
  detail text not null default '',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint captain_share_links_token_check check (token ~ '^[A-Za-z0-9_-]{12,32}$'),
  constraint captain_share_links_target_check check (target_href ~ '^/[^/]')
);

create index if not exists captain_share_links_owner_created_idx
  on public.captain_share_links (created_by_user_id, created_at desc);

create index if not exists captain_share_links_expiry_idx
  on public.captain_share_links (expires_at);

alter table public.captain_share_links enable row level security;

drop policy if exists captain_share_links_owner_select on public.captain_share_links;
create policy captain_share_links_owner_select
  on public.captain_share_links for select to authenticated
  using (created_by_user_id = (select auth.uid()));

drop policy if exists captain_share_links_owner_insert on public.captain_share_links;
create policy captain_share_links_owner_insert
  on public.captain_share_links for insert to authenticated
  with check (created_by_user_id = (select auth.uid()));

drop policy if exists captain_share_links_owner_delete on public.captain_share_links;
create policy captain_share_links_owner_delete
  on public.captain_share_links for delete to authenticated
  using (created_by_user_id = (select auth.uid()));

comment on table public.captain_share_links is
  'Short, expiring public handoffs for Captain share previews without exposing the full destination query string.';
