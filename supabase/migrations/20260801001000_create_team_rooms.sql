alter table public.internal_conversations
  drop constraint if exists internal_conversations_conversation_type_check;
alter table public.internal_conversations
  add constraint internal_conversations_conversation_type_check
  check (conversation_type in ('direct', 'support', 'league', 'team', 'system'));
alter table public.internal_messages
  drop constraint if exists internal_messages_message_kind_check;
alter table public.internal_messages
  add constraint internal_messages_message_kind_check
  check (message_kind in ('message', 'announcement', 'support_note', 'system'));
create unique index if not exists internal_conversations_team_room_scope_idx
  on public.internal_conversations (related_entity_type, related_entity_id)
  where related_entity_type = 'team_room';
create table if not exists public.team_room_invites (
  id uuid primary key default gen_random_uuid(),
  invite_token uuid not null default gen_random_uuid() unique,
  conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
  created_by_user_id uuid not null references public.profiles(id) on delete cascade,
  team_name text not null,
  normalized_team_name text not null,
  league_name text not null default '',
  flight text not null default '',
  expires_at timestamptz not null default (timezone('utc', now()) + interval '30 days'),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  revoked_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists team_room_invites_conversation_idx
  on public.team_room_invites (conversation_id, created_at desc);
create index if not exists team_room_invites_token_active_idx
  on public.team_room_invites (invite_token, expires_at)
  where revoked_at is null;
alter table public.team_room_invites enable row level security;
-- Team Room membership is private. Team links can still be read by their owner,
-- but mutations must go through the verified team-connection or invite APIs.
drop policy if exists "Members can create own team profile links" on public.team_profile_links;
drop policy if exists "Members can update own team profile links" on public.team_profile_links;
comment on table public.team_room_invites is
  'Secure, expiring links that let a signed-in player join a linked team and its shared Team Room.';
