begin;
set local lock_timeout = '5s';

alter table private.native_chat_hits
  add column replaces_hit_id uuid,
  add column confirmed_hit_id uuid;

create function private.chat_hit_waiting(hit private.native_chat_hits) returns boolean
language sql stable set search_path='' as $$
  select hit.status='proposed' and hit.starts_at>now() and (
    hit.confirmed_hit_id is null or exists (
      select 1 from private.native_chat_hits original
      where original.id=hit.confirmed_hit_id and original.room_id=hit.room_id
        and original.status='accepted' and original.starts_at>now()
    )
  );
$$;

create function public.native_chat_hit_state_for_room(p_owner uuid,p_room uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  with current_hit as (
    select hit.* from private.native_chat_hits hit
    where hit.room_id=p_room and hit.starts_at>now()
      and (hit.status<>'proposed' or private.chat_hit_waiting(hit))
      and private.can_read_native_chat_hit(hit,p_owner)
    order by case hit.status when 'proposed' then 0 when 'accepted' then 1 else 2 end,hit.created_at desc,hit.id
    limit 1
  )
  select jsonb_build_object(
    'hit',(select private.chat_hit_json(hit) from current_hit hit),
    'confirmedHit',(
      select private.chat_hit_json(original)
      from current_hit hit
      join private.native_chat_hits original on original.id=hit.confirmed_hit_id and original.room_id=hit.room_id
      where hit.status='proposed' and original.status='accepted'
        and private.can_read_native_chat_hit(original,p_owner)
    )
  );
$$;

-- Older clients continue showing the confirmed slot during a proposed change.
create or replace function public.native_chat_hit_for_room(p_owner uuid,p_room uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(nullif(state->'confirmedHit','null'::jsonb),nullif(state->'hit','null'::jsonb))
  from public.native_chat_hit_state_for_room(p_owner,p_room) state;
$$;

create function private.write_chat_hit(
  p_owner uuid,p_room uuid,p_hit uuid,p_action text,p_club text,p_date date,p_time time,p_starts timestamptz,
  p_response text,p_replaces uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  chat public.internal_conversations;
  hit private.native_chat_hits;
  replaced private.native_chat_hits;
  other_player uuid;
  other_members uuid[];
  confirmed_id uuid;
  next_status text;
  notice_id uuid;
  wall_time timestamp;
begin
  -- Proposals and player-chat membership or block changes share this room lock.
  select * into chat from public.internal_conversations where id=p_room for update;
  if not found or chat.related_entity_type<>'player_chat' or not private.native_player_chat_account(p_owner)
      or not private.native_player_chat_visible(chat,p_owner) then return jsonb_build_object('code','forbidden'); end if;
  select array(select p.profile_id from public.internal_conversation_participants p
    where p.conversation_id=p_room and p.profile_id<>p_owner limit 2) into other_members;
  if cardinality(other_members)<>1 then return jsonb_build_object('code','forbidden'); end if;
  other_player := other_members[1];
  if p_hit is null then return jsonb_build_object('code','invalid'); end if;
  select * into hit from private.native_chat_hits where id=p_hit and room_id=p_room;

  if p_action in ('hit_propose','hit_suggest') then
    if (p_action='hit_suggest')<>(p_replaces is not null) or p_replaces=p_hit
        or p_club is null or p_club !~ '^[a-z][a-z0-9-]{0,79}$' or p_date is null or p_time is null or p_starts is null
        or extract(second from p_time)<>0 then return jsonb_build_object('code','invalid'); end if;
    wall_time := p_starts at time zone 'America/Chicago';
    if wall_time::date<>p_date or wall_time::time<>p_time then return jsonb_build_object('code','invalid'); end if;
    if hit.id is not null then
      if hit.proposed_by=p_owner and hit.invited_player=other_player and hit.replaces_hit_id is not distinct from p_replaces
        and (hit.club_id,hit.play_date,hit.play_time,hit.starts_at)=(p_club,p_date,p_time,p_starts)
        then return jsonb_build_object('code','ok'); end if;
      return jsonb_build_object('code','hit_stale');
    end if;
    if p_starts<=now() or p_starts>now()+interval '365 days' then return jsonb_build_object('code','invalid'); end if;
    if p_replaces is not null then
      select * into replaced from private.native_chat_hits event where event.room_id=p_room and event.starts_at>now()
        and (private.chat_hit_waiting(event) or event.status='accepted')
        order by (event.status='proposed') desc,event.created_at desc,event.id limit 1;
      if replaced.id is distinct from p_replaces or not private.can_read_native_chat_hit(replaced,p_owner) then
        return jsonb_build_object('code','hit_stale');
      end if;
      if (replaced.club_id,replaced.play_date,replaced.play_time)=(p_club,p_date,p_time) then
        return jsonb_build_object('code','hit_unchanged');
      end if;
      confirmed_id := case when replaced.status='accepted' then replaced.id else replaced.confirmed_hit_id end;
      if exists(select 1 from private.native_chat_hits original where original.id=confirmed_id
          and (original.club_id,original.play_date,original.play_time)=(p_club,p_date,p_time)) then
        return jsonb_build_object('code','hit_unchanged');
      end if;
    elsif exists(select 1 from private.native_chat_hits event where event.room_id=p_room and event.starts_at>now()
        and (event.status='accepted' or private.chat_hit_waiting(event))) then
      return jsonb_build_object('code','hit_stale');
    end if;
    insert into private.native_chat_hits(id,room_id,proposed_by,invited_player,club_id,play_date,play_time,starts_at,
        replaces_hit_id,confirmed_hit_id)
      values(p_hit,p_room,p_owner,other_player,p_club,p_date,p_time,p_starts,p_replaces,confirmed_id)
      on conflict (id) do nothing returning * into hit;
    if not found then return jsonb_build_object('code','hit_stale'); end if;
    if replaced.status='proposed' then
      update private.native_chat_hits set status='cancelled' where id=replaced.id;
    end if;
    next_status := hit.status;
  else
    if hit.id is null or not private.can_read_native_chat_hit(hit,p_owner) then return jsonb_build_object('code','hit_stale'); end if;
    if p_action='hit_reply' and p_response in ('accepted','declined') then
      if p_owner<>hit.invited_player then return jsonb_build_object('code','forbidden'); end if;
      next_status := p_response;
      if hit.status<>next_status and not private.chat_hit_waiting(hit) then return jsonb_build_object('code','hit_stale'); end if;
    elsif p_action='hit_cancel' then
      next_status := 'cancelled';
      if hit.status='proposed' and p_owner<>hit.proposed_by then return jsonb_build_object('code','forbidden'); end if;
      if hit.status='declined' then return jsonb_build_object('code','hit_stale'); end if;
    else return jsonb_build_object('code','invalid');
    end if;
    if hit.status=next_status then return jsonb_build_object('code','ok'); end if;
    if hit.starts_at<=now() then return jsonb_build_object('code','hit_stale'); end if;
    if next_status='accepted' and hit.confirmed_hit_id is not null then
      update private.native_chat_hits set status='cancelled'
        where id=hit.confirmed_hit_id and room_id=p_room and status='accepted' and starts_at>now();
      if not found then return jsonb_build_object('code','hit_stale'); end if;
    elsif next_status='cancelled' and hit.status='accepted' then
      update private.native_chat_hits set status='cancelled'
        where confirmed_hit_id=hit.id and room_id=p_room and status='proposed';
    end if;
    update private.native_chat_hits set status=next_status where id=hit.id;
  end if;

  if exists(select 1 from public.internal_conversation_participants p
      left join public.internal_notification_preferences prefs on prefs.profile_id=p.profile_id
      where p.conversation_id=p_room and p.profile_id=other_player and not p.muted and coalesce(prefs.schedule_alerts_enabled,true)) then
    insert into public.internal_notifications(recipient_profile_id,actor_user_id,notification_type,title,body,href,conversation_id)
      values(other_player,p_owner,'schedule',
        case next_status
          when 'proposed' then case when p_replaces is null then 'New hitting plan' else 'New time or club suggested' end
          when 'accepted' then 'Hitting plan accepted'
          when 'declined' then case when hit.confirmed_hit_id is null then 'Hitting plan declined' else 'Proposed change declined' end
          else case when hit.confirmed_hit_id is not null and hit.status='proposed' then 'Proposed change withdrawn' else 'Hitting plan cancelled' end
        end,
        'Open your chat to see the plan.', '/chats?room='||p_room,p_room)
      returning id into notice_id;
    insert into private.native_chat_hit_notices values(notice_id,p_hit,next_status);
  end if;
  insert into public.team_chat_signals as signal(conversation_id) values(p_room)
    on conflict(conversation_id) do update set revision=signal.revision+1,changed_at=clock_timestamp();
  return jsonb_build_object('code','ok');
end;
$$;

create or replace function public.native_write_chat_hit(
  p_owner uuid,p_room uuid,p_hit uuid,p_action text,p_club text,p_date date,p_time time,p_starts timestamptz,p_response text
) returns jsonb language sql security definer set search_path='' as $$
  select private.write_chat_hit(p_owner,p_room,p_hit,p_action,p_club,p_date,p_time,p_starts,p_response,null);
$$;

create function public.native_suggest_chat_hit(
  p_owner uuid,p_room uuid,p_hit uuid,p_replaces uuid,p_club text,p_date date,p_time time,p_starts timestamptz
) returns jsonb language sql security definer set search_path='' as $$
  select private.write_chat_hit(p_owner,p_room,p_hit,'hit_suggest',p_club,p_date,p_time,p_starts,null,p_replaces);
$$;

create or replace function private.native_chat_hit_updates()
returns table(id uuid,recipient_profile_id uuid,notification_type text,title text,body text,href text,
  conversation_id uuid,schedule_event_id uuid,read_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select n.id,n.recipient_profile_id,'schedule',n.title,n.body,n.href,n.conversation_id,null::uuid,n.read_at,n.created_at
  from public.internal_notifications n
  join private.native_chat_hit_notices notice on notice.notification_id=n.id
  join private.native_chat_hits hit on hit.id=notice.hit_id and hit.room_id=n.conversation_id and hit.status=notice.status
  where n.recipient_profile_id=(select auth.uid()) and hit.starts_at>now()
    and (hit.status<>'proposed' or private.chat_hit_waiting(hit))
    and private.can_read_native_chat_hit(hit,n.recipient_profile_id);
$$;

revoke all on function private.chat_hit_waiting(private.native_chat_hits),
  private.write_chat_hit(uuid,uuid,uuid,text,text,date,time,timestamptz,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.native_chat_hit_state_for_room(uuid,uuid),
  public.native_suggest_chat_hit(uuid,uuid,uuid,uuid,text,date,time,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.native_chat_hit_state_for_room(uuid,uuid),
  public.native_suggest_chat_hit(uuid,uuid,uuid,uuid,text,date,time,timestamptz) to service_role;

notify pgrst,'reload schema';
commit;
