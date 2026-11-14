begin;
set local lock_timeout = '5s';

create table private.native_player_contacts (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  primary key (owner_id,player_id),
  check (owner_id <> player_id)
);
create index native_player_contacts_target on private.native_player_contacts(player_id);

create table private.native_player_chat_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid references public.internal_conversations(id) on delete cascade,
  token_digest text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  used_by uuid references public.profiles(id) on delete cascade
);
create index native_player_chat_invites_owner on private.native_player_chat_invites(owner_id,expires_at);
create index native_player_chat_invites_room on private.native_player_chat_invites(room_id);
create index native_player_chat_invites_user on private.native_player_chat_invites(used_by);
create unique index native_player_direct_pair on public.internal_conversations(related_entity_id)
  where related_entity_type='player_chat';
create table private.native_player_chat_notices (
  notification_id uuid primary key references public.internal_notifications(id) on delete cascade,
  message_id uuid not null references public.internal_messages(id) on delete cascade
);
create index native_player_chat_notices_message on private.native_player_chat_notices(message_id);

alter table private.native_player_contacts enable row level security;
alter table private.native_player_chat_invites enable row level security;
alter table private.native_player_chat_notices enable row level security;
revoke all on private.native_player_contacts, private.native_player_chat_invites, private.native_player_chat_notices
  from public,anon,authenticated,service_role;

-- Entry through the existing messaging tables must not bypass membership or blocks.
create function private.is_player_chat(p_room uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.internal_conversations c where c.id=p_room
    and c.related_entity_type in ('player_chat','player_group'));
$$;
revoke all on function private.is_player_chat(uuid) from public,anon;
grant execute on function private.is_player_chat(uuid) to authenticated;
create policy "Player chat metadata reads use its server API" on public.internal_conversations
  as restrictive for select to authenticated using (related_entity_type not in ('player_chat','player_group'));
create policy "Player chat creation uses its server API" on public.internal_conversations
  as restrictive for insert to authenticated with check (related_entity_type not in ('player_chat','player_group'));
create policy "Player chat changes use its server API" on public.internal_conversations
  as restrictive for update to authenticated using (related_entity_type not in ('player_chat','player_group'))
  with check (related_entity_type not in ('player_chat','player_group'));
create policy "Player chat deletion uses its server API" on public.internal_conversations
  as restrictive for delete to authenticated using (related_entity_type not in ('player_chat','player_group'));
create policy "Player chat membership reads use its server API" on public.internal_conversation_participants
  as restrictive for select to authenticated using (not private.is_player_chat(conversation_id));
create policy "Player chat membership uses its server API" on public.internal_conversation_participants
  as restrictive for insert to authenticated with check (not private.is_player_chat(conversation_id));
create policy "Player chat membership changes use its server API" on public.internal_conversation_participants
  as restrictive for update to authenticated using (not private.is_player_chat(conversation_id))
  with check (not private.is_player_chat(conversation_id));
create policy "Player chat membership removal uses its server API" on public.internal_conversation_participants
  as restrictive for delete to authenticated using (not private.is_player_chat(conversation_id));
create policy "Player chat message reads use its server API" on public.internal_messages
  as restrictive for select to authenticated using (not private.is_player_chat(conversation_id));
create policy "Player chat sends use its server API" on public.internal_messages
  as restrictive for insert to authenticated with check (not private.is_player_chat(conversation_id));
create policy "Player chat edits use its server API" on public.internal_messages
  as restrictive for update to authenticated using (not private.is_player_chat(conversation_id))
  with check (not private.is_player_chat(conversation_id));
create policy "Player chat message removal uses its server API" on public.internal_messages
  as restrictive for delete to authenticated using (not private.is_player_chat(conversation_id));

create function private.native_player_chat_account(p_id uuid)
returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from public.profiles p join auth.users u on u.id=p.id
    where p.id=p_id and u.email_confirmed_at is not null)
    and not exists(select 1 from public.account_deletion_requests d where d.account_id=p_id and d.status<>'completed');
$$;

create function private.ensure_native_player_chat_profile(p_owner uuid)
returns void language sql volatile set search_path='' as $$
  insert into public.profiles(id,email,role)
    select u.id,u.email,'member' from auth.users u
    where u.id=p_owner and u.email_confirmed_at is not null and nullif(u.email,'') is not null
      and not exists(select 1 from public.profiles p where p.id=u.id)
      and not exists(select 1 from public.account_deletion_requests d where d.account_id=u.id and d.status<>'completed')
    on conflict(id) do nothing;
$$;

create function private.native_player_chat_unblocked(a uuid,b uuid)
returns boolean language sql stable set search_path='' as $$
  select not exists(select 1 from public.team_chat_blocks x
    where (x.owner_user_id=a and x.blocked_user_id=b) or (x.owner_user_id=b and x.blocked_user_id=a));
$$;

create function private.native_player_chat_name(p_id uuid)
returns text language sql stable set search_path='' as $$
  select coalesce((select label.name from public.profiles p join auth.users u on u.id=p.id
    cross join lateral (
      select nullif(left(btrim(regexp_replace(candidate,'[[:cntrl:]]','','g')),100),'') as name
      from unnest(array[
        case when lower(btrim(p.message_display_name)) is distinct from lower(btrim(u.email)) then p.message_display_name end,
        p.linked_player_name,u.raw_user_meta_data->>'first_name',p.tiq_public_id
      ]) with ordinality names(candidate,priority)
      where nullif(btrim(regexp_replace(candidate,'[[:cntrl:]]','','g')),'') is not null order by priority limit 1
    ) label where p.id=p_id),'Tennis player');
$$;

create function private.native_player_chat_visible(c public.internal_conversations,p_owner uuid)
returns boolean language sql stable set search_path='' as $$
  select c.status='open' and c.related_entity_type in ('player_chat','player_group') and
    exists(select 1 from public.internal_conversation_participants p where p.conversation_id=c.id and p.profile_id=p_owner)
    and (c.related_entity_type='player_group' or exists(
      select 1 from public.internal_conversation_participants p where p.conversation_id=c.id and p.profile_id<>p_owner
        and private.native_player_chat_account(p.profile_id) and private.native_player_chat_unblocked(p_owner,p.profile_id)));
$$;

create function private.native_player_chat_title(c public.internal_conversations,p_owner uuid)
returns text language sql stable set search_path='' as $$
  select case when c.related_entity_type='player_group' then c.subject else
    (select private.native_player_chat_name(p.profile_id) from public.internal_conversation_participants p
      where p.conversation_id=c.id and p.profile_id<>p_owner limit 1) end;
$$;

create function private.can_read_native_player_chat_signal(p_room uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.native_player_chat_account((select auth.uid())) and exists(
    select 1 from public.internal_conversations c where c.id=p_room and private.native_player_chat_visible(c,(select auth.uid())));
$$;
revoke all on function private.can_read_native_player_chat_signal(uuid) from public,anon,authenticated,service_role;
grant execute on function private.can_read_native_player_chat_signal(uuid) to authenticated;
create policy "Player chat members read chat signals" on public.team_chat_signals for select to authenticated
  using (private.can_read_native_player_chat_signal(conversation_id));

create function public.native_player_chats_read(p_owner uuid,p_room uuid,p_before_at timestamptz,p_before_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  c public.internal_conversations;
  messages jsonb;
  more boolean;
begin
  if p_room is null and not private.native_player_chat_account(p_owner) then
    if exists(select 1 from auth.users u where u.id=p_owner and u.email_confirmed_at is not null and nullif(u.email,'') is not null)
      and not exists(select 1 from public.account_deletion_requests d where d.account_id=p_owner and d.status<>'completed')
    then return jsonb_build_object('code','ok','contacts','[]'::jsonb,'rooms','[]'::jsonb); end if;
  end if;
  if not private.native_player_chat_account(p_owner) then return jsonb_build_object('code','forbidden'); end if;
  if p_room is null then
    return jsonb_build_object('code','ok','contacts',coalesce((
      select jsonb_agg(jsonb_build_object('id',p.player_id,'name',p.name) order by p.name,p.player_id)
      from (select x.player_id,private.native_player_chat_name(x.player_id) as name from private.native_player_contacts x
        where x.owner_id=p_owner and private.native_player_chat_account(x.player_id)
        and private.native_player_chat_unblocked(p_owner,x.player_id) order by name,x.player_id limit 100) p
    ),'[]'::jsonb),'rooms',coalesce((
      select jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'group',r.is_group,'unread',r.unread) order by r.activity desc,r.id)
      from (select room.id,private.native_player_chat_title(room,p_owner) as title,room.related_entity_type='player_group' as is_group,
        coalesce(latest.created_at,room.created_at) as activity,
        coalesce(latest.sender_user_id<>p_owner and latest.created_at>coalesce(member.last_read_at,'-infinity'::timestamptz),false) as unread
        from public.internal_conversation_participants member join public.internal_conversations room on room.id=member.conversation_id
        left join lateral (select m.created_at,m.sender_user_id from public.internal_messages m
          where m.conversation_id=room.id and m.message_kind='message' and m.deleted_at is null
            and private.native_player_chat_unblocked(p_owner,m.sender_user_id)
          order by m.created_at desc,m.id desc limit 1) latest on true
        where member.profile_id=p_owner and private.native_player_chat_visible(room,p_owner)
        order by activity desc,room.id limit 100) r
    ),'[]'::jsonb));
  end if;

  select * into c from public.internal_conversations where id=p_room;
  if not found or not private.native_player_chat_visible(c,p_owner) then return jsonb_build_object('code','forbidden'); end if;
  if (p_before_at is null) <> (p_before_id is null) then return jsonb_build_object('code','invalid'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'author',m.sender_user_id,'name',private.native_player_chat_name(m.sender_user_id),
    'body',m.body,'createdAt',m.created_at) order by m.created_at,m.id) filter (where m.position<=40),'[]'::jsonb),count(*)>40
  into messages,more from (
    select m.*,row_number() over(order by m.created_at desc,m.id desc) as position
    from public.internal_messages m where m.conversation_id=c.id and m.message_kind='message' and m.deleted_at is null
      and private.native_player_chat_unblocked(p_owner,m.sender_user_id)
      and (p_before_at is null or (m.created_at,m.id)<(p_before_at,p_before_id))
    order by m.created_at desc,m.id desc limit 41
  ) m;
  return jsonb_build_object('code','ok','room',jsonb_build_object('id',c.id,'title',private.native_player_chat_title(c,p_owner),
    'group',c.related_entity_type='player_group','manage',c.related_entity_type='player_group' and coalesce(c.created_by_user_id=p_owner,false),
    'messages',messages,'more',more,'members',coalesce((
      select jsonb_agg(jsonb_build_object('id',p.profile_id,'name',private.native_player_chat_name(p.profile_id)) order by p.profile_id)
      from public.internal_conversation_participants p where p.conversation_id=c.id and p.profile_id<>p_owner
        and private.native_player_chat_account(p.profile_id) and private.native_player_chat_unblocked(p_owner,p.profile_id)
    ),'[]'::jsonb)));
end;
$$;

create function public.native_player_chats_action(p_owner uuid,p_action text,p_room uuid,p_id uuid,p_target uuid,p_members uuid[],p_text text,p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  c public.internal_conversations;
  invitation private.native_player_chat_invites;
  post public.internal_messages;
  pair_key text;
  invite_key text;
  created_message boolean;
begin
  -- A newly confirmed signup may reach its invite before a profile has been created.
  if not private.native_player_chat_account(p_owner) then perform private.ensure_native_player_chat_profile(p_owner); end if;
  if not private.native_player_chat_account(p_owner) then return jsonb_build_object('code','forbidden'); end if;
  if p_action in ('invite','preview','join','revoke') then
    if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('code','invalid'); end if;
    invite_key := encode(sha256(convert_to(p_token,'UTF8')),'hex');
  end if;
  if p_action in ('preview','join') then
    -- Lock the group before its invite, in the same order as invite and revoke.
    select * into invitation from private.native_player_chat_invites where token_digest=invite_key;
    if not found then return jsonb_build_object('code','unavailable'); end if;
    if invitation.room_id is not null then
      select * into c from public.internal_conversations where id=invitation.room_id for update;
    end if;
    select * into invitation from private.native_player_chat_invites where token_digest=invite_key for update;
    if not found or invitation.revoked_at is not null or invitation.expires_at<=now()
      or not private.native_player_chat_account(invitation.owner_id)
      or not private.native_player_chat_unblocked(p_owner,invitation.owner_id)
      or (invitation.room_id is null and (invitation.owner_id=p_owner or
        (invitation.used_by is not null and invitation.used_by<>p_owner)))
      or (invitation.room_id is not null and (c.id is null or c.status<>'open' or c.related_entity_type<>'player_group'
        or c.created_by_user_id is distinct from invitation.owner_id or exists(
          select 1 from public.team_room_member_removals r where r.conversation_id=c.id and r.profile_id=p_owner)))
    then return jsonb_build_object('code','unavailable'); end if;

    if p_action='preview' then
      return jsonb_build_object('code','ok','group',invitation.room_id is not null,
        'title',case when invitation.room_id is null then private.native_player_chat_name(invitation.owner_id) else c.subject end);
    end if;
    if invitation.room_id is null then
      perform pg_advisory_xact_lock(hashtextextended('player_contacts:'||least(p_owner,invitation.owner_id)::text,0));
      perform pg_advisory_xact_lock(hashtextextended('player_contacts:'||greatest(p_owner,invitation.owner_id)::text,0));
      if invitation.used_by is not null then
        if exists(select 1 from private.native_player_contacts x where x.owner_id=p_owner and x.player_id=invitation.owner_id)
          and exists(select 1 from private.native_player_contacts x where x.owner_id=invitation.owner_id and x.player_id=p_owner)
        then return jsonb_build_object('code','ok','contact',invitation.owner_id); end if;
        return jsonb_build_object('code','unavailable');
      end if;
      if exists(select 1 from (values (p_owner),(invitation.owner_id)) a(id)
        where (select count(*) from private.native_player_contacts x where x.owner_id=a.id)>=100
          and not exists(select 1 from private.native_player_contacts x where x.owner_id=a.id
            and x.player_id=case when a.id=p_owner then invitation.owner_id else p_owner end))
      then return jsonb_build_object('code','full'); end if;
      insert into private.native_player_contacts(owner_id,player_id)
        values (p_owner,invitation.owner_id),(invitation.owner_id,p_owner) on conflict do nothing;
      update private.native_player_chat_invites set used_by=p_owner where id=invitation.id;
      return jsonb_build_object('code','ok','contact',invitation.owner_id);
    end if;
    if not private.native_player_chat_visible(c,p_owner) then
      if (select count(*) from public.internal_conversation_participants p where p.conversation_id=c.id)>=32 then
        return jsonb_build_object('code','full');
      end if;
      insert into public.internal_conversation_participants(conversation_id,profile_id,participant_role)
        values(c.id,p_owner,'member') on conflict do nothing;
    end if;
    return jsonb_build_object('code','ok','roomId',c.id);
  end if;

  if p_action='forget' then
    delete from private.native_player_contacts where owner_id=p_owner and player_id=p_target;
    return jsonb_build_object('code','ok');
  end if;
  if p_action='direct' then
    if p_target=p_owner or not private.native_player_chat_account(p_target) or not private.native_player_chat_unblocked(p_owner,p_target)
      or not exists(select 1 from private.native_player_contacts x where x.owner_id=p_owner and x.player_id=p_target)
    then return jsonb_build_object('code','forbidden'); end if;
    pair_key := encode(sha256(convert_to(least(p_owner,p_target)::text||greatest(p_owner,p_target)::text,'UTF8')),'hex');
    perform pg_advisory_xact_lock(hashtextextended('player_chat:'||pair_key,0));
    select * into c from public.internal_conversations where related_entity_type='player_chat' and related_entity_id=pair_key;
    if found then
      if not private.native_player_chat_visible(c,p_owner) then return jsonb_build_object('code','forbidden'); end if;
      return jsonb_build_object('code','ok','roomId',c.id);
    end if;
    insert into public.internal_conversations (conversation_type,subject,status,created_by_user_id,related_entity_type,related_entity_id)
      values ('direct','Player chat','open',p_owner,'player_chat',pair_key) returning * into c;
    insert into public.internal_conversation_participants(conversation_id,profile_id,participant_role)
      values(c.id,p_owner,'member'),(c.id,p_target,'member');
    return jsonb_build_object('code','ok','roomId',c.id);
  end if;

  if p_action='group' then
    if p_id is null or p_text is null or length(btrim(p_text)) not between 1 and 80 or p_text ~ '[[:cntrl:]]'
      or p_members is null or cardinality(p_members)>20 then return jsonb_build_object('code','invalid'); end if;
    perform pg_advisory_xact_lock(hashtextextended('player_groups:'||p_owner::text,0));
    select * into c from public.internal_conversations where id=p_id;
    if found then
      if c.related_entity_type='player_group' and c.created_by_user_id=p_owner and c.subject=p_text and c.status='open'
        and c.metadata->>'createDigest'=encode(sha256(convert_to(to_jsonb(p_members)::text,'UTF8')),'hex')
        then return jsonb_build_object('code','ok','roomId',c.id); end if;
      return jsonb_build_object('code','invalid');
    end if;
    if (select count(*) from public.internal_conversations r where r.created_by_user_id=p_owner
      and r.related_entity_type='player_group' and r.status='open')>=20 then return jsonb_build_object('code','full'); end if;
    if exists(select 1 from unnest(p_members) m(id) where not private.native_player_chat_account(m.id)
      or not private.native_player_chat_unblocked(p_owner,m.id) or not exists(
        select 1 from private.native_player_contacts x where x.owner_id=m.id and x.player_id=p_owner
      ) or not exists(select 1 from private.native_player_contacts x where x.owner_id=p_owner and x.player_id=m.id)
    ) then return jsonb_build_object('code','forbidden'); end if;
    insert into public.internal_conversations(id,conversation_type,subject,status,created_by_user_id,related_entity_type,related_entity_id,metadata)
      values(p_id,'league',p_text,'open',p_owner,'player_group','',
        jsonb_build_object('createDigest',encode(sha256(convert_to(to_jsonb(p_members)::text,'UTF8')),'hex'))) returning * into c;
    insert into public.internal_conversation_participants(conversation_id,profile_id,participant_role)
      select c.id,id,'member' from (select distinct id from unnest(array[p_owner]||p_members) a(id)) roster;
    return jsonb_build_object('code','ok','roomId',c.id);
  end if;

  if p_room is not null then
    select * into c from public.internal_conversations where id=p_room for update;
    if not found or not private.native_player_chat_visible(c,p_owner) then return jsonb_build_object('code','forbidden'); end if;
  elsif p_action not in ('invite','revoke') then
    return jsonb_build_object('code','invalid');
  end if;

  if p_action in ('invite','revoke') then
    if p_room is not null and (c.related_entity_type<>'player_group' or c.created_by_user_id is distinct from p_owner)
      then return jsonb_build_object('code','forbidden'); end if;
    if p_action='revoke' then
      update private.native_player_chat_invites set revoked_at=coalesce(revoked_at,now())
        where token_digest=invite_key and owner_id=p_owner and room_id is not distinct from p_room;
      return jsonb_build_object('code','ok');
    end if;
    perform pg_advisory_xact_lock(hashtextextended('player_invites:'||p_owner::text,0));
    select * into invitation from private.native_player_chat_invites where token_digest=invite_key;
    if found then
      if invitation.owner_id=p_owner and invitation.room_id is not distinct from p_room and invitation.revoked_at is null
        and invitation.expires_at>now() and invitation.used_by is null
      then return jsonb_build_object('code','ok','expiresAt',invitation.expires_at); end if;
      return jsonb_build_object('code','invalid');
    end if;
    if (select count(*) from private.native_player_chat_invites i where i.owner_id=p_owner and i.expires_at>now())>=40
      then return jsonb_build_object('code','full'); end if;
    -- Each group has one active share link. Generating a fresh link replaces it.
    if p_room is not null then
      update private.native_player_chat_invites set revoked_at=now() where room_id=p_room and revoked_at is null and expires_at>now();
    else
      update private.native_player_chat_invites set revoked_at=now() where owner_id=p_owner and room_id is null
        and used_by is null and revoked_at is null and expires_at>now();
    end if;
    insert into private.native_player_chat_invites(owner_id,room_id,token_digest,expires_at)
      values(p_owner,p_room,invite_key,now()+interval '7 days') returning * into invitation;
    return jsonb_build_object('code','ok','expiresAt',invitation.expires_at);
  end if;

  if p_action='revoke_links' and c.related_entity_type='player_group' and c.created_by_user_id=p_owner then
    update private.native_player_chat_invites set revoked_at=coalesce(revoked_at,now())
      where room_id=c.id and revoked_at is null and expires_at>now();
    return jsonb_build_object('code','ok');
  end if;

  if p_action='leave' and c.related_entity_type='player_group' then
    if c.created_by_user_id=p_owner then
      update public.internal_conversations set status='closed' where id=c.id;
      update private.native_player_chat_invites set revoked_at=coalesce(revoked_at,now()) where room_id=c.id and revoked_at is null;
    else
      delete from public.internal_conversation_participants where conversation_id=c.id and profile_id=p_owner;
    end if;
    return jsonb_build_object('code','ok');
  end if;

  if p_action in ('add','remove') and c.related_entity_type='player_group' and c.created_by_user_id=p_owner then
    if p_target is null or p_target=p_owner then return jsonb_build_object('code','invalid'); end if;
    if p_action='remove' then
      if exists(select 1 from public.internal_conversation_participants p where p.conversation_id=c.id and p.profile_id=p_target) then
        delete from public.internal_conversation_participants where conversation_id=c.id and profile_id=p_target;
        insert into public.team_room_member_removals(conversation_id,profile_id,removed_by_user_id)
          values(c.id,p_target,p_owner) on conflict do nothing;
      end if;
      return jsonb_build_object('code','ok');
    end if;
    if not private.native_player_chat_account(p_target) or not private.native_player_chat_unblocked(p_owner,p_target)
      or not exists(select 1 from private.native_player_contacts x where x.owner_id=p_owner and x.player_id=p_target)
      or not exists(select 1 from private.native_player_contacts x where x.owner_id=p_target and x.player_id=p_owner)
    then return jsonb_build_object('code','forbidden'); end if;
    if exists(select 1 from public.internal_conversation_participants p where p.conversation_id=c.id and p.profile_id=p_target)
      then return jsonb_build_object('code','ok'); end if;
    if (select count(*) from public.internal_conversation_participants p where p.conversation_id=c.id)>=32
      then return jsonb_build_object('code','full'); end if;
    delete from public.team_room_member_removals where conversation_id=c.id and profile_id=p_target;
    insert into public.internal_conversation_participants(conversation_id,profile_id,participant_role) values(c.id,p_target,'member');
    return jsonb_build_object('code','ok');
  end if;

  if p_action='read' then
    -- Mark only up through a message the reader actually saw.
    select * into post from public.internal_messages where id=p_id and conversation_id=c.id and message_kind='message'
      and deleted_at is null and private.native_player_chat_unblocked(p_owner,sender_user_id);
    if found then
      update public.internal_conversation_participants set last_read_at=greatest(last_read_at,post.created_at)
        where conversation_id=c.id and profile_id=p_owner;
    end if;
    return jsonb_build_object('code','ok');
  end if;
  if p_action='block' then
    if p_target is null or p_target=p_owner or not exists(select 1 from public.internal_conversation_participants p
      where p.conversation_id=c.id and p.profile_id=p_target) then return jsonb_build_object('code','forbidden'); end if;
    insert into public.team_chat_blocks(owner_user_id,blocked_user_id) values(p_owner,p_target) on conflict do nothing;
    return jsonb_build_object('code','ok');
  end if;
  if p_action='report' then
    select * into post from public.internal_messages where id=p_id and conversation_id=c.id and message_kind='message'
      and deleted_at is null and sender_user_id<>p_owner and private.native_player_chat_unblocked(p_owner,sender_user_id);
    if not found or p_text not in ('harassment','spam','inappropriate','other') then return jsonb_build_object('code','invalid'); end if;
    insert into public.team_chat_reports(reporter_user_id,message_id,conversation_id,reported_user_id,reason,message_body)
      values(p_owner,p_id,c.id,post.sender_user_id,p_text,left(post.body,2400))
      on conflict(reporter_user_id,message_id) do nothing;
    return jsonb_build_object('code','ok');
  end if;
  if p_action='send' then
    if p_id is null or p_text is null or length(btrim(p_text)) not between 1 and 2400 then
      return jsonb_build_object('code','invalid');
    end if;
    insert into public.internal_messages(id,conversation_id,sender_user_id,body,message_kind,created_at)
      values(p_id,c.id,p_owner,p_text,'message',clock_timestamp()) on conflict do nothing;
    created_message := found;
    select * into post from public.internal_messages where id=p_id and conversation_id=c.id and sender_user_id=p_owner;
    if not found or post.body is distinct from p_text or post.deleted_at is not null then return jsonb_build_object('code','invalid'); end if;
    if created_message then
      insert into public.team_chat_signals as signal(conversation_id) values(c.id)
        on conflict(conversation_id) do update set revision=signal.revision+1,changed_at=clock_timestamp();
      with notices as (
        insert into public.internal_notifications(recipient_profile_id,actor_user_id,notification_type,title,body,href,conversation_id)
        select p.profile_id,p_owner,'message','New player chat message','Open Chats to read it.',
          '/chats?room='||c.id,c.id
        from public.internal_conversation_participants p
        where p.conversation_id=c.id and p.profile_id<>p_owner and not p.muted
          and private.native_player_chat_account(p.profile_id) and private.native_player_chat_unblocked(p_owner,p.profile_id)
          and not exists (select 1 from public.internal_notification_preferences pref
            where pref.profile_id=p.profile_id and not pref.message_alerts_enabled)
        returning id
      )
      insert into private.native_player_chat_notices(notification_id,message_id) select id,p_id from notices;
    end if;
    return jsonb_build_object('code','ok','messageId',post.id);
  end if;
  return jsonb_build_object('code','invalid');
end;
$$;

revoke all on function private.native_player_chat_account(uuid),private.native_player_chat_unblocked(uuid,uuid),
  private.ensure_native_player_chat_profile(uuid),
  private.native_player_chat_name(uuid),private.native_player_chat_visible(public.internal_conversations,uuid),
  private.native_player_chat_title(public.internal_conversations,uuid) from public,anon,authenticated;
revoke all on function public.native_player_chats_read(uuid,uuid,timestamptz,uuid),
  public.native_player_chats_action(uuid,text,uuid,uuid,uuid,uuid[],text,text) from public,anon,authenticated;
grant execute on function public.native_player_chats_read(uuid,uuid,timestamptz,uuid),
  public.native_player_chats_action(uuid,text,uuid,uuid,uuid,uuid[],text,text) to service_role;

create function private.native_player_chat_updates()
returns table(id uuid,recipient_profile_id uuid,notification_type text,title text,body text,href text,
  conversation_id uuid,schedule_event_id uuid,read_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select n.id,n.recipient_profile_id,'message',
    case when c.related_entity_type='player_group' then 'New group message' else 'New player chat message' end,
    private.native_player_chat_title(c,n.recipient_profile_id),'/chats?room='||c.id,c.id,null::uuid,n.read_at,n.created_at
  from public.internal_notifications n
  join private.native_player_chat_notices rn on rn.notification_id=n.id
  join public.internal_messages m on m.id=rn.message_id and m.deleted_at is null
  join public.internal_conversations c on c.id=m.conversation_id and c.id=n.conversation_id
  where n.recipient_profile_id=(select auth.uid()) and n.actor_user_id=m.sender_user_id
    and private.native_player_chat_account(n.recipient_profile_id)
    and private.native_player_chat_visible(c,n.recipient_profile_id)
    and private.native_player_chat_unblocked(n.recipient_profile_id,m.sender_user_id);
$$;
revoke all on function private.native_player_chat_updates() from public,anon,authenticated;
grant execute on function private.native_player_chat_updates() to authenticated;
do $$
declare definition text := rtrim(pg_get_viewdef('public.native_first_party_updates'::regclass), ';' || chr(10) || ' ');
begin
  execute 'create or replace view public.native_first_party_updates with (security_invoker=true) as '
    || definition || ' union all select * from private.native_player_chat_updates()';
end;
$$;

notify pgrst,'reload schema';
commit;
