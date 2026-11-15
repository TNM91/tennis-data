begin;
set local lock_timeout = '5s';

alter table private.native_tournament_rehearsals add column schedule_enabled boolean not null default false;
create or replace view private.active_native_tournament_rehearsals as
  select owner_id, event_id, event_key, winner_id, partner_id, schedule_enabled
  from private.native_tournament_rehearsals
  where expires_at > statement_timestamp() and winner_id is not null and partner_id is not null;

create function private.native_tournament_alert_rehearsal_member(p_parent text, p_owner uuid, p_member uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from private.active_native_tournament_rehearsals rehearsal
    where rehearsal.event_key = p_parent and rehearsal.owner_id = p_owner and rehearsal.schedule_enabled
      and p_member in (rehearsal.winner_id, rehearsal.partner_id)
  );
$$;
revoke all on function private.native_tournament_alert_rehearsal_member(text,uuid,uuid)
  from public, anon, authenticated, service_role;

create function private.native_tournament_rehearsal_draw_row(t public.tiq_tournaments)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id',t.id,'event_id',t.event_id,'is_event',t.is_event,'name',t.name,
    'format',t.format,'entrant_type',t.entrant_type,'status',t.status,'starts_on',t.starts_on,
    'location_label',t.location_label,'event_details',jsonb_build_object('timeZone',t.event_details->>'timeZone'),
    'updated_at',t.updated_at,'is_public',t.is_public,'entrants',t.entrants,'results',t.results,'schedule',t.schedule);
$$;
revoke all on function private.native_tournament_rehearsal_draw_row(public.tiq_tournaments)
  from public, anon, authenticated, service_role;

-- These are the only player projections for a private alert rehearsal. The caller
-- supplies exact keys and reads using their JWT. Directory and registration writes stay unchanged.
create function public.native_tournament_alert_rehearsal(p_parent text, p_division text, p_view text)
returns jsonb language plpgsql stable security definer set search_path = ''
set statement_timeout = '5s' as $$
declare
  actor uuid := auth.uid();
  parent public.tiq_tournaments;
  division public.tiq_tournaments;
  entry public.tiq_tournament_entries;
begin
  if actor is null or p_view is null or p_view not in ('draw','entry') then return null; end if;
  select * into parent from public.tiq_tournaments t where t.id = p_parent and t.is_event
    and t.event_id is null and not t.is_public
    and private.native_tournament_alert_rehearsal_member(t.id,t.created_by_user_id,actor);
  if not found then return null; end if;
  if exists (select 1 from public.account_deletion_requests request
      where request.account_id in (actor,parent.created_by_user_id) and request.automatic_consent)
    or exists (select 1 from public.team_chat_blocks block
      where (block.owner_user_id = actor and block.blocked_user_id = parent.created_by_user_id)
         or (block.owner_user_id = parent.created_by_user_id and block.blocked_user_id = actor)) then return null; end if;
  select * into division from public.tiq_tournaments t where t.id = p_division and t.event_id = parent.id
    and not t.is_event and not t.is_public and t.status = 'scheduled'
    and t.created_by_user_id = parent.created_by_user_id;
  if not found then return null; end if;
  select * into strict entry from public.tiq_tournament_entries e where e.tournament_id = division.id
    and e.submitted_by_user_id = actor and e.status = 'approved'
    and e.native_registration->>'version' = '1' and e.player_name = any(division.entrants);

  if p_view = 'draw' then
    return jsonb_build_object('root',private.native_tournament_rehearsal_draw_row(parent),
      'division',private.native_tournament_rehearsal_draw_row(division));
  end if;
  return jsonb_build_object('ok',true,'context',jsonb_build_object('owner',actor,'parent',parent.id,
    'division',division.id,'name',division.name,'eventName',parent.name,'paired',division.entrant_type = 'teams',
    'playerName',left(coalesce(entry.native_registration->>'one',entry.player_name),90),'playerLocked',true,
    'canManage',false,'mode','closed','director','','locked',true,'canApprove',false,'date',parent.starts_on,
    'deadline','','zone',coalesce(parent.event_details->>'timeZone',''),'revision',md5(division.id || ':' || entry.id)),
    'receipt',public.native_tournament_entry_receipt(entry),'queue','[]'::jsonb,'more',false);
exception when no_data_found or too_many_rows then return null;
end;
$$;
revoke all on function public.native_tournament_alert_rehearsal(text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.native_tournament_alert_rehearsal(text,text,text) to authenticated;

-- Preserve the existing organizer lock, version check, and production write path.
create function pg_temp.patch_alert_rehearsal(source text, marker text, replacement text)
returns text language plpgsql as $$
begin
  source := replace(source,chr(13),'');
  if length(source) - length(replace(source,marker,'')) <> length(marker) then
    raise exception 'Tournament alert rehearsal patch did not find exactly one marker: %', marker;
  end if;
  return replace(source,marker,replacement);
end;
$$;

do $patch$
declare source text;
begin
  source := pg_get_functiondef('public.native_tournament_draw_plan(uuid,uuid,text,text,text,text,jsonb)'::regprocedure);
  source := pg_temp.patch_alert_rehearsal(source,'  action_date text;','  action_date text;' || chr(10) || '  alert_rehearsal boolean := false;');
  source := pg_temp.patch_alert_rehearsal(source,$sql$  -- The completed fixture is read-only in the draw planner.
  if p_action = 'read' then
    select test.event_key into event_key from private.active_native_tournament_rehearsals test
      where test.owner_id = p_owner and test.event_id = p_event;
    if found then$sql$,$sql$  -- A scheduling rehearsal uses the same slot write as a live event.
  if p_action in ('read','slot') then
    select test.event_key into event_key from private.active_native_tournament_rehearsals test
      where test.owner_id = p_owner and test.event_id = p_event and (p_action = 'read' or test.schedule_enabled);
    alert_rehearsal := found;
    if alert_rehearsal and p_action = 'read' then$sql$);
  source := pg_temp.patch_alert_rehearsal(source,$sql$  if p_action = 'read' then
    select public_id into event_key$sql$,$sql$  if not alert_rehearsal then
  if p_action = 'read' then
    select public_id into event_key$sql$);
  source := pg_temp.patch_alert_rehearsal(source,$sql$  if event_key is null then return jsonb_build_object('code','missing'); end if;$sql$,$sql$  end if;
  if event_key is null then return jsonb_build_object('code','missing'); end if;$sql$);
  source := pg_temp.patch_alert_rehearsal(source,$sql$where id = event_key and is_public and is_event
      and event_id is null and created_by_user_id = p_owner for update$sql$,$sql$where id = event_key and is_public = (not alert_rehearsal) and is_event
      and event_id is null and created_by_user_id = p_owner for update$sql$);
  execute pg_temp.patch_alert_rehearsal(source,'and is_public and not is_event and id like',
    'and is_public = (not alert_rehearsal) and not is_event and id like');

  source := pg_get_functiondef('public.native_tournament_save_slot(uuid,uuid,text,text,text,jsonb,text[],boolean)'::regprocedure);
  source := pg_temp.patch_alert_rehearsal(source,$sql$  -- A private rehearsal may use the same editor, but it never generates account alerts.
  select * into division from public.tiq_tournaments
    where id = p_division and event_id = saved->>'id' and is_public and not is_event;$sql$,$sql$  select * into division from public.tiq_tournaments
    where id = p_division and event_id = saved->>'id' and not is_event;$sql$);
  execute pg_temp.patch_alert_rehearsal(source,'      and e.submitted_by_user_id <> p_owner',$sql$      and e.submitted_by_user_id <> p_owner
      and (division.is_public or private.native_tournament_alert_rehearsal_member(
        division.event_id,p_owner,e.submitted_by_user_id))$sql$);

  source := pg_get_functiondef('private.native_tournament_schedule_updates()'::regprocedure);
  source := pg_temp.patch_alert_rehearsal(source,'and division.is_public and not division.is_event','and not division.is_event');
  source := pg_temp.patch_alert_rehearsal(source,'and parent.is_public and parent.is_event',
    'and parent.is_public = division.is_public and parent.is_event');
  execute pg_temp.patch_alert_rehearsal(source,$sql$    and division.status = 'scheduled' and not (division.results ? notice.match_key)$sql$,$sql$    and (parent.is_public or private.native_tournament_alert_rehearsal_member(
      parent.id,n.actor_user_id,n.recipient_profile_id))
    and division.status = 'scheduled' and not (division.results ? notice.match_key)$sql$);
end;
$patch$;
drop function pg_temp.patch_alert_rehearsal(text,text,text);

notify pgrst, 'reload schema';
commit;
