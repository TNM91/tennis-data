create schema if not exists private;
revoke all on schema private from public;

create or replace function public.normalize_team_membership_text(input_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(
    regexp_replace(
      regexp_replace(btrim(coalesce(input_value, '')), '[[:space:]]*/[[:space:]]*', '/', 'g'),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

create or replace function private.is_profile_team_member(
  target_profile_id uuid,
  target_team_name text,
  target_league_name text default '',
  target_flight text default ''
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = target_profile_id
      and (
        (
          public.normalize_team_membership_text(profile.linked_team_name)
            = public.normalize_team_membership_text(target_team_name)
          and (
            public.normalize_team_membership_text(profile.linked_league_name) = ''
            or public.normalize_team_membership_text(target_league_name) = ''
            or public.normalize_team_membership_text(profile.linked_league_name)
              = public.normalize_team_membership_text(target_league_name)
          )
          and (
            public.normalize_team_membership_text(profile.linked_flight) = ''
            or public.normalize_team_membership_text(target_flight) = ''
            or public.normalize_team_membership_text(profile.linked_flight)
              = public.normalize_team_membership_text(target_flight)
          )
        )
        or exists (
          select 1
          from public.team_roster_members roster
          where roster.player_id = profile.linked_player_id
            and roster.normalized_team_name = public.normalize_team_membership_text(target_team_name)
            and (
              public.normalize_team_membership_text(target_league_name) = ''
              or public.normalize_team_membership_text(roster.league_name)
                = public.normalize_team_membership_text(target_league_name)
            )
            and (
              public.normalize_team_membership_text(target_flight) = ''
              or public.normalize_team_membership_text(roster.flight)
                = public.normalize_team_membership_text(target_flight)
            )
        )
      )
  );
$$;

create or replace function private.can_access_team_conversation(
  target_conversation_id uuid,
  target_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.internal_conversations conversation
    where conversation.id = target_conversation_id
      and (
        conversation.related_entity_type <> 'team'
        or private.is_profile_team_member(
          target_profile_id,
          conversation.metadata ->> 'teamName',
          conversation.metadata ->> 'leagueName',
          conversation.metadata ->> 'flight'
        )
      )
  );
$$;

create or replace function private.open_team_conversation(
  target_team_name text,
  target_league_name text default '',
  target_flight text default '',
  target_entity_id text default '',
  target_subject text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  conversation_id uuid;
  clean_team_name text := btrim(coalesce(target_team_name, ''));
  clean_league_name text := btrim(coalesce(target_league_name, ''));
  clean_flight text := btrim(coalesce(target_flight, ''));
begin
  if caller_id is null then
    raise exception 'Sign in to open team chat.' using errcode = '42501';
  end if;

  if clean_team_name = '' then
    raise exception 'Choose a team before opening team chat.' using errcode = '22023';
  end if;

  if not public.is_admin()
    and not private.is_profile_team_member(caller_id, clean_team_name, clean_league_name, clean_flight) then
    raise exception 'Your account is not linked to this team.' using errcode = '42501';
  end if;

  select conversation.id
  into conversation_id
  from public.internal_conversations conversation
  where conversation.conversation_type = 'league'
    and conversation.related_entity_type = 'team'
    and conversation.status = 'open'
    and public.normalize_team_membership_text(conversation.metadata ->> 'teamName')
      = public.normalize_team_membership_text(clean_team_name)
    and public.normalize_team_membership_text(conversation.metadata ->> 'leagueName')
      = public.normalize_team_membership_text(clean_league_name)
    and public.normalize_team_membership_text(conversation.metadata ->> 'flight')
      = public.normalize_team_membership_text(clean_flight)
  order by conversation.updated_at desc
  limit 1;

  if conversation_id is null then
    insert into public.internal_conversations (
      conversation_type,
      subject,
      status,
      created_by_user_id,
      related_entity_type,
      related_entity_id,
      metadata
    )
    values (
      'league',
      coalesce(nullif(btrim(target_subject), ''), clean_team_name || ' team chat'),
      'open',
      caller_id,
      'team',
      coalesce(nullif(btrim(target_entity_id), ''), public.normalize_team_membership_text(clean_team_name)),
      jsonb_build_object(
        'entityType', 'team',
        'entityId', coalesce(nullif(btrim(target_entity_id), ''), public.normalize_team_membership_text(clean_team_name)),
        'roomType', 'team',
        'teamName', clean_team_name,
        'leagueName', clean_league_name,
        'flight', clean_flight
      )
    )
    returning id into conversation_id;
  end if;

  insert into public.internal_conversation_participants (
    conversation_id,
    profile_id,
    participant_role
  )
  select
    conversation_id,
    profile.id,
    case when profile.role = 'admin' then 'admin' else 'member' end
  from public.profiles profile
  where private.is_profile_team_member(profile.id, clean_team_name, clean_league_name, clean_flight)
  union
  select
    conversation_id,
    caller_id,
    case when public.is_admin() then 'admin' else 'member' end
  on conflict (conversation_id, profile_id) do nothing;

  return conversation_id;
end;
$$;

create or replace function public.open_team_conversation(
  target_team_name text,
  target_league_name text default '',
  target_flight text default '',
  target_entity_id text default '',
  target_subject text default ''
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.open_team_conversation(
    target_team_name,
    target_league_name,
    target_flight,
    target_entity_id,
    target_subject
  );
$$;

create or replace function private.touch_internal_conversation_from_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.internal_conversations
  set updated_at = timezone('utc', now())
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists internal_messages_touch_conversation on public.internal_messages;
create trigger internal_messages_touch_conversation
after insert on public.internal_messages
for each row
execute function private.touch_internal_conversation_from_message();

revoke all on function public.normalize_team_membership_text(text) from public;
revoke all on function private.is_profile_team_member(uuid, text, text, text) from public;
revoke all on function private.can_access_team_conversation(uuid, uuid) from public;
revoke all on function private.open_team_conversation(text, text, text, text, text) from public;
revoke all on function public.open_team_conversation(text, text, text, text, text) from public;
revoke all on function private.touch_internal_conversation_from_message() from public;

grant execute on function public.normalize_team_membership_text(text) to authenticated, service_role;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_profile_team_member(uuid, text, text, text) to authenticated, service_role;
grant execute on function private.can_access_team_conversation(uuid, uuid) to authenticated, service_role;
grant execute on function private.open_team_conversation(text, text, text, text, text) to authenticated, service_role;
grant execute on function public.open_team_conversation(text, text, text, text, text) to authenticated, service_role;

drop policy if exists "Users can create internal conversations" on public.internal_conversations;
create policy "Users can create internal conversations"
  on public.internal_conversations for insert to authenticated
  with check (
    created_by_user_id = (select auth.uid())
    and (
      related_entity_type <> 'team'
      or private.is_profile_team_member(
        (select auth.uid()),
        metadata ->> 'teamName',
        metadata ->> 'leagueName',
        metadata ->> 'flight'
      )
      or public.is_admin()
    )
  );

drop policy if exists "Participants and admins can read internal conversations" on public.internal_conversations;
create policy "Participants and admins can read internal conversations"
  on public.internal_conversations for select to authenticated
  using (
    public.is_admin()
    or (
      (
        created_by_user_id = (select auth.uid())
        or assigned_admin_user_id = (select auth.uid())
        or public.is_internal_conversation_participant(id)
      )
      and private.can_access_team_conversation(id, (select auth.uid()))
    )
  );

drop policy if exists "Owners and admins can update internal conversations" on public.internal_conversations;
create policy "Owners and admins can update internal conversations"
  on public.internal_conversations for update to authenticated
  using (
    public.is_admin()
    or (
      (created_by_user_id = (select auth.uid()) or assigned_admin_user_id = (select auth.uid()))
      and private.can_access_team_conversation(id, (select auth.uid()))
    )
  )
  with check (
    public.is_admin()
    or (
      (created_by_user_id = (select auth.uid()) or assigned_admin_user_id = (select auth.uid()))
      and private.can_access_team_conversation(id, (select auth.uid()))
    )
  );

drop policy if exists "Conversation creators can add participants" on public.internal_conversation_participants;
create policy "Conversation creators can add participants"
  on public.internal_conversation_participants for insert to authenticated
  with check (
    public.is_admin()
    or (
      (profile_id = (select auth.uid()) or public.is_internal_conversation_creator(conversation_id))
      and private.can_access_team_conversation(conversation_id, (select auth.uid()))
      and private.can_access_team_conversation(conversation_id, profile_id)
    )
  );

drop policy if exists "Participants and admins can read participants" on public.internal_conversation_participants;
create policy "Participants and admins can read participants"
  on public.internal_conversation_participants for select to authenticated
  using (
    public.is_admin()
    or (
      (
        profile_id = (select auth.uid())
        or public.is_internal_conversation_creator(conversation_id)
        or public.is_internal_conversation_participant(conversation_id)
      )
      and private.can_access_team_conversation(conversation_id, (select auth.uid()))
    )
  );

drop policy if exists "Participants can update their read state" on public.internal_conversation_participants;
create policy "Participants can update their read state"
  on public.internal_conversation_participants for update to authenticated
  using (
    public.is_admin()
    or (
      profile_id = (select auth.uid())
      and private.can_access_team_conversation(conversation_id, (select auth.uid()))
    )
  )
  with check (
    public.is_admin()
    or (
      profile_id = (select auth.uid())
      and private.can_access_team_conversation(conversation_id, (select auth.uid()))
    )
  );

drop policy if exists "Participants can create internal messages" on public.internal_messages;
create policy "Participants can create internal messages"
  on public.internal_messages for insert to authenticated
  with check (
    sender_user_id = (select auth.uid())
    and (
      public.is_admin()
      or (
        (
          public.is_internal_conversation_participant(conversation_id)
          or public.is_internal_conversation_creator(conversation_id)
        )
        and private.can_access_team_conversation(conversation_id, (select auth.uid()))
      )
    )
  );

drop policy if exists "Participants and admins can read internal messages" on public.internal_messages;
create policy "Participants and admins can read internal messages"
  on public.internal_messages for select to authenticated
  using (
    public.is_admin()
    or (
      (
        sender_user_id = (select auth.uid())
        or public.is_internal_conversation_participant(conversation_id)
        or public.is_internal_conversation_creator(conversation_id)
      )
      and private.can_access_team_conversation(conversation_id, (select auth.uid()))
    )
  );
