begin;
-- Private server-only moderation records. Existing verified admin APIs provide review access.
create table if not exists public.team_chat_blocks (
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_user_id, blocked_user_id),
  check (owner_user_id <> blocked_user_id)
);
create index if not exists team_chat_blocks_target_idx on public.team_chat_blocks (blocked_user_id, owner_user_id);
create table if not exists public.team_chat_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null references public.internal_messages(id) on delete cascade,
  conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('harassment', 'spam', 'inappropriate', 'other')),
  message_body text not null check (length(message_body) <= 2400),
  status text not null default 'open' check (status in ('open', 'resolved')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_user_id, message_id),
  check (reporter_user_id <> reported_user_id)
);
create index if not exists team_chat_reports_queue_idx on public.team_chat_reports (status, created_at, id);
alter table public.team_chat_blocks enable row level security;
alter table public.team_chat_reports enable row level security;
revoke all on public.team_chat_blocks, public.team_chat_reports from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.team_chat_blocks to service_role;
grant select, insert, update on public.team_chat_reports to service_role;

commit;
