alter table public.internal_messages
  add column if not exists reply_to_message_id uuid null references public.internal_messages(id) on delete set null;
create index if not exists internal_messages_reply_to_idx
  on public.internal_messages (reply_to_message_id)
  where reply_to_message_id is not null;
create table if not exists public.team_room_message_reactions (
  conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
  message_id uuid not null references public.internal_messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('ack', 'helpful', 'celebrate')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (message_id, profile_id, reaction)
);
create index if not exists team_room_reactions_conversation_idx
  on public.team_room_message_reactions (conversation_id, created_at desc);
alter table public.team_room_message_reactions enable row level security;
drop policy if exists "Team Room members can read reactions" on public.team_room_message_reactions;
create policy "Team Room members can read reactions"
  on public.team_room_message_reactions for select to authenticated
  using (
    exists (
      select 1 from public.internal_conversation_participants
      where internal_conversation_participants.conversation_id = team_room_message_reactions.conversation_id
        and internal_conversation_participants.profile_id = auth.uid()
    )
  );
create table if not exists public.team_room_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists team_room_push_subscriptions_profile_idx
  on public.team_room_push_subscriptions (profile_id, updated_at desc);
alter table public.team_room_push_subscriptions enable row level security;
drop policy if exists "Members manage own Team Room push subscriptions" on public.team_room_push_subscriptions;
create policy "Members manage own Team Room push subscriptions"
  on public.team_room_push_subscriptions for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
create table if not exists public.team_room_member_removals (
  conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  removed_by_user_id uuid not null references public.profiles(id) on delete cascade,
  removed_at timestamptz not null default timezone('utc', now()),
  primary key (conversation_id, profile_id)
);
create index if not exists team_room_member_removals_actor_idx
  on public.team_room_member_removals (removed_by_user_id, removed_at desc);
alter table public.team_room_member_removals enable row level security;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-room-files',
  'team-room-files',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'internal_messages'
  ) then
    alter publication supabase_realtime add table public.internal_messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'team_room_message_responses'
  ) then
    alter publication supabase_realtime add table public.team_room_message_responses;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'team_room_lineup_acknowledgments'
  ) then
    alter publication supabase_realtime add table public.team_room_lineup_acknowledgments;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'team_room_message_reactions'
  ) then
    alter publication supabase_realtime add table public.team_room_message_reactions;
  end if;
end
$$;
comment on table public.team_room_message_reactions is
  'Low-noise acknowledgments attached to Team Room messages.';
comment on table public.team_room_push_subscriptions is
  'Free standards-based Web Push endpoints for installed Team Room apps.';
comment on table public.team_room_member_removals is
  'Captain-controlled Team Room exclusions without unlinking a player profile from the team.';
