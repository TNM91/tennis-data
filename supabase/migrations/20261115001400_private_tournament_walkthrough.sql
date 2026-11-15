begin;
set local lock_timeout = '5s';

-- One appointed player can test a full singles event with its owner. A
-- walkthrough uses the same draw and receipts as a live event, while the
-- rehearsal namespace and checkout guard keep it private.
alter table private.native_tournament_rehearsals add column walkthrough_enabled boolean not null default false;
create or replace view private.active_native_tournament_rehearsals as
  select owner_id,event_id,event_key,winner_id,partner_id,schedule_enabled,walkthrough_enabled
  from private.native_tournament_rehearsals
  where expires_at > statement_timestamp() and winner_id is not null
    and (partner_id is not null or walkthrough_enabled);

create function private.native_tournament_walkthrough_actor(target text, actor uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from private.active_native_tournament_rehearsals w
    join auth.users organizer on organizer.id=w.owner_id and organizer.email_confirmed_at is not null
    join auth.users player on player.id=w.winner_id and player.email_confirmed_at is not null
    where w.event_key=target and w.walkthrough_enabled and actor in (w.owner_id,w.winner_id)
      and not exists (select 1 from public.account_deletion_requests d
        where d.account_id in (w.owner_id,w.winner_id) and d.status<>'completed')
      and not exists (select 1 from public.team_chat_blocks b
        where (b.owner_user_id=w.owner_id and b.blocked_user_id=w.winner_id)
          or (b.owner_user_id=w.winner_id and b.blocked_user_id=w.owner_id))
  );
$$;
revoke all on function private.native_tournament_walkthrough_actor(text,uuid) from public,anon,authenticated,service_role;

create function private.native_tournament_walkthrough_publication(t public.tiq_tournaments)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id',t.id,'event_id',t.event_id,'is_event',t.is_event,'name',t.name,
    'format',t.format,'entrant_type',t.entrant_type,'status',t.status,'starts_on',t.starts_on,
    'location_label',t.location_label,'event_details',t.event_details,'is_public',t.is_public,'registration_email',t.registration_email);
$$;
revoke all on function private.native_tournament_walkthrough_publication(public.tiq_tournaments)
  from public,anon,authenticated,service_role;

create function private.native_tournament_walkthrough(p_parent text,p_division text,actor uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('viewer',actor,
    'root',private.native_tournament_rehearsal_draw_row(root),
    'division',private.native_tournament_rehearsal_draw_row(division),
    'publication',jsonb_build_object(root.id,private.native_tournament_walkthrough_publication(root),
      division.id,private.native_tournament_walkthrough_publication(division)))
  from private.active_native_tournament_rehearsals w
  join public.tiq_tournaments root on root.id=w.event_key and root.created_by_user_id=w.owner_id
    and root.is_event and root.event_id is null and not root.is_public and root.status in ('open','scheduled','completed')
  join public.tiq_tournaments division on division.event_id=root.id and division.created_by_user_id=w.owner_id
    and not division.is_event and not division.is_public and division.entrant_type='players'
    and division.status in ('open','scheduled','completed')
  where w.event_key=p_parent and w.walkthrough_enabled and (p_division='' or division.id=p_division)
    and private.native_tournament_walkthrough_actor(p_parent,actor)
    and 1=(select count(*) from public.tiq_tournaments t where t.event_id=root.id);
$$;
revoke all on function private.native_tournament_walkthrough(text,text,uuid)
  from public,anon,authenticated,service_role;

create function pg_temp.patch_tournament_walkthrough(source text, marker text, replacement text)
returns text language plpgsql as $$
begin
  source := replace(source,chr(13),'');
  if length(source)-length(replace(source,marker,'')) <> length(marker) then
    raise exception 'Tournament walkthrough source changed: %',marker;
  end if;
  return replace(source,marker,replacement);
end;
$$;

do $patch$
declare
  source text;
begin
  source := pg_get_functiondef('public.native_tournament_alert_rehearsal(text,text,text)'::regprocedure);
  execute pg_temp.patch_tournament_walkthrough(source,$sql$  if actor is null or p_view is null$sql$,
    $sql$  if p_view='walkthrough' then return private.native_tournament_walkthrough(p_parent,p_division,actor); end if;
  if actor is null or p_view is null$sql$);

  source := pg_get_functiondef('public.native_tournament_desk(uuid,uuid)'::regprocedure);
  execute pg_temp.patch_tournament_walkthrough(source,'or test.partner_id is null)',
    'or (test.partner_id is null and not test.walkthrough_enabled))');

  source := pg_get_functiondef('public.native_tournament_entry_context(text,text)'::regprocedure);
  source := pg_temp.patch_tournament_walkthrough(source,'manager boolean;', 'manager boolean; walkthrough boolean;');
  source := pg_temp.patch_tournament_walkthrough(source,' select * into t from public.tiq_tournaments',
    $sql$ walkthrough:=coalesce(first_party,false) and private.native_tournament_walkthrough(p_parent,p_division,auth.uid()) is not null;
 select * into t from public.tiq_tournaments$sql$);
  source := pg_temp.patch_tournament_walkthrough(source,$sql$and (is_public or (first_party and p_parent = ''$sql$,
    $sql$and (is_public or walkthrough or (first_party and p_parent = ''$sql$);
  source := pg_temp.patch_tournament_walkthrough(source,'where id=p_parent and is_public and is_event',
    'where id=p_parent and (is_public or walkthrough) and is_event');
  execute pg_temp.patch_tournament_walkthrough(source,
    'manager:=coalesce(public.can_manage_tiq_tournament(t.id) and public.can_manage_tiq_tournament(root.id),false);',
    $sql$manager:=case when walkthrough then root.created_by_user_id=auth.uid()
      else coalesce(public.can_manage_tiq_tournament(t.id) and public.can_manage_tiq_tournament(root.id),false) end;$sql$);

  source := pg_get_functiondef('private.guard_native_tournament_entry()'::regprocedure);
  execute pg_temp.patch_tournament_walkthrough(source,$sql$where id = new.tournament_id and is_public and status = 'open' for share$sql$,
    $sql$where id = new.tournament_id and status = 'open' and (is_public or (
      current_setting('role',true)='service_role' and current_setting('tenaceiq.scoped_tournament_entry',true)='1'
      and auth.uid()=new.submitted_by_user_id and exists (
        select 1 from private.active_native_tournament_rehearsals w
        where w.event_key=tiq_tournaments.event_id and w.walkthrough_enabled and w.winner_id=new.submitted_by_user_id
          and private.native_tournament_walkthrough(w.event_key,new.tournament_id,w.winner_id) is not null
      )
    )) for share$sql$);

  source := pg_get_functiondef('public.native_tournament_draw_plan(uuid,uuid,text,text,text,text,jsonb)'::regprocedure);
  source := pg_temp.patch_tournament_walkthrough(source,$sql$if p_action in ('read','slot') then$sql$,
    $sql$if p_action in ('read','slot','publish') then$sql$);
  source := pg_temp.patch_tournament_walkthrough(source,$sql$and (p_action = 'read' or test.schedule_enabled)$sql$,
    $sql$and (p_action = 'read' or (p_action = 'slot' and test.schedule_enabled)
      or (test.walkthrough_enabled and private.native_tournament_walkthrough_actor(test.event_key,p_owner)))$sql$);
  execute pg_temp.patch_tournament_walkthrough(source,'and item.is_public and item.status',
    'and item.is_public = root.is_public and item.status');

  source := pg_get_functiondef('public.native_tournament_save_result(uuid,uuid,text,text,text,jsonb,boolean)'::regprocedure);
  source := pg_temp.patch_tournament_walkthrough(source,'  result jsonb;', '  result jsonb; walkthrough boolean := false;');
  source := pg_temp.patch_tournament_walkthrough(source,'  perform 1 from public.tiq_tournaments where id = event_key',
    $sql$  if event_key is null then
    select w.event_key into event_key from private.active_native_tournament_rehearsals w
    where w.owner_id=p_owner and w.event_id=p_event and w.walkthrough_enabled
      and private.native_tournament_walkthrough(w.event_key,p_division,p_owner) is not null;
    walkthrough:=found;
  end if;
  perform 1 from public.tiq_tournaments where id = event_key$sql$);
  source := pg_temp.patch_tournament_walkthrough(source,'and is_public and is_event',
    'and is_public = (not walkthrough) and is_event');
  source := pg_temp.patch_tournament_walkthrough(source,'and is_public and not is_event',
    'and is_public = (not walkthrough) and not is_event');
  execute pg_temp.patch_tournament_walkthrough(source,'and item.is_public and item.status',
    'and item.is_public = (not walkthrough) and item.status');

  source := pg_get_functiondef('private.native_tournament_alert_rehearsal_member(text,uuid,uuid)'::regprocedure);
  execute pg_temp.patch_tournament_walkthrough(source,
    'and rehearsal.schedule_enabled' || chr(10) || '      and p_member in (rehearsal.winner_id, rehearsal.partner_id)',
    $sql$and ((rehearsal.schedule_enabled and p_member in (rehearsal.winner_id,rehearsal.partner_id))
      or (rehearsal.walkthrough_enabled and p_member=rehearsal.winner_id
        and private.native_tournament_walkthrough_actor(p_parent,p_member)))$sql$);
end
$patch$;
drop function pg_temp.patch_tournament_walkthrough(text,text,text);

notify pgrst,'reload schema';
commit;
