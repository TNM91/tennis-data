alter table public.profiles
  add column if not exists linked_player_id uuid,
  add column if not exists linked_player_name text,
  add column if not exists tiq_public_id text,
  add column if not exists tiq_admin_id text,
  add column if not exists message_display_name text not null default '',
  add column if not exists message_search_enabled boolean not null default true;

update public.profiles
set tiq_public_id = 'TIQ-' || upper(substr(replace(id::text, '-', ''), 1, 10))
where tiq_public_id is null or btrim(tiq_public_id) = '';

update public.profiles
set tiq_admin_id = 'TIQ-ADMIN-' || upper(substr(replace(id::text, '-', ''), 1, 8))
where role = 'admin'
  and (tiq_admin_id is null or btrim(tiq_admin_id) = '');

update public.profiles
set message_display_name = coalesce(nullif(btrim(linked_player_name), ''), tiq_public_id, 'TenAceIQ user')
where btrim(message_display_name) = '';

create unique index if not exists profiles_tiq_public_id_key
  on public.profiles (tiq_public_id)
  where tiq_public_id is not null;

create unique index if not exists profiles_tiq_admin_id_key
  on public.profiles (tiq_admin_id)
  where tiq_admin_id is not null;

create or replace view public.internal_message_directory as
select
  id,
  coalesce(role, 'member') as role,
  coalesce(
    nullif(btrim(message_display_name), ''),
    nullif(btrim(linked_player_name), ''),
    tiq_public_id,
    'TenAceIQ user'
  ) as display_name,
  linked_player_id,
  tiq_public_id,
  tiq_admin_id
from public.profiles
where tiq_public_id is not null
  and message_search_enabled = true;

grant select on public.internal_message_directory to authenticated;

create table if not exists public.internal_conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_type text not null default 'direct'
    check (conversation_type in ('direct', 'support', 'league', 'system')),
  subject text not null default '',
  status text not null default 'open'
    check (status in ('open', 'waiting_on_user', 'waiting_on_admin', 'closed')),
  created_by_user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_admin_user_id uuid null references public.profiles(id) on delete set null,
  related_entity_type text not null default '',
  related_entity_id text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.internal_conversation_participants (
  conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  participant_role text not null default 'member'
    check (participant_role in ('member', 'admin', 'support', 'coordinator', 'system')),
  last_read_at timestamptz null,
  muted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (conversation_id, profile_id)
);

create table if not exists public.internal_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  message_kind text not null default 'message'
    check (message_kind in ('message', 'support_note', 'system')),
  created_at timestamptz not null default timezone('utc', now()),
  edited_at timestamptz null,
  deleted_at timestamptz null,
  check (btrim(body) <> '')
);

create index if not exists internal_conversations_created_by_idx
  on public.internal_conversations (created_by_user_id, updated_at desc);

create index if not exists internal_conversations_type_status_idx
  on public.internal_conversations (conversation_type, status, updated_at desc);

create index if not exists internal_conversation_participants_profile_idx
  on public.internal_conversation_participants (profile_id, conversation_id);

create index if not exists internal_messages_conversation_created_idx
  on public.internal_messages (conversation_id, created_at desc);

alter table public.internal_conversations enable row level security;
alter table public.internal_conversation_participants enable row level security;
alter table public.internal_messages enable row level security;

drop policy if exists "Users can create internal conversations" on public.internal_conversations;
create policy "Users can create internal conversations"
  on public.internal_conversations for insert to authenticated
  with check (created_by_user_id = auth.uid());

drop policy if exists "Participants and admins can read internal conversations" on public.internal_conversations;
create policy "Participants and admins can read internal conversations"
  on public.internal_conversations for select to authenticated
  using (
    created_by_user_id = auth.uid()
    or assigned_admin_user_id = auth.uid()
    or exists (
      select 1 from public.internal_conversation_participants
      where internal_conversation_participants.conversation_id = internal_conversations.id
        and internal_conversation_participants.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Owners and admins can update internal conversations" on public.internal_conversations;
create policy "Owners and admins can update internal conversations"
  on public.internal_conversations for update to authenticated
  using (
    created_by_user_id = auth.uid()
    or assigned_admin_user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  )
  with check (
    created_by_user_id = auth.uid()
    or assigned_admin_user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Conversation creators can add participants" on public.internal_conversation_participants;
create policy "Conversation creators can add participants"
  on public.internal_conversation_participants for insert to authenticated
  with check (
    profile_id = auth.uid()
    or exists (
      select 1 from public.internal_conversations
      where internal_conversations.id = internal_conversation_participants.conversation_id
        and internal_conversations.created_by_user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Participants and admins can read participants" on public.internal_conversation_participants;
create policy "Participants and admins can read participants"
  on public.internal_conversation_participants for select to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.internal_conversations
      where internal_conversations.id = internal_conversation_participants.conversation_id
        and internal_conversations.created_by_user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Participants can update their read state" on public.internal_conversation_participants;
create policy "Participants can update their read state"
  on public.internal_conversation_participants for update to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  )
  with check (
    profile_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Participants can create internal messages" on public.internal_messages;
create policy "Participants can create internal messages"
  on public.internal_messages for insert to authenticated
  with check (
    sender_user_id = auth.uid()
    and (
      exists (
        select 1 from public.internal_conversation_participants
        where internal_conversation_participants.conversation_id = internal_messages.conversation_id
          and internal_conversation_participants.profile_id = auth.uid()
      )
      or exists (
        select 1 from public.internal_conversations
        where internal_conversations.id = internal_messages.conversation_id
          and internal_conversations.created_by_user_id = auth.uid()
      )
      or exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
      )
    )
  );

drop policy if exists "Participants and admins can read internal messages" on public.internal_messages;
create policy "Participants and admins can read internal messages"
  on public.internal_messages for select to authenticated
  using (
    sender_user_id = auth.uid()
    or exists (
      select 1 from public.internal_conversation_participants
      where internal_conversation_participants.conversation_id = internal_messages.conversation_id
        and internal_conversation_participants.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.internal_conversations
      where internal_conversations.id = internal_messages.conversation_id
        and internal_conversations.created_by_user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
