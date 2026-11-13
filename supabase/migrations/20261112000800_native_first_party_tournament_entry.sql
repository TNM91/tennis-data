-- Reuse the existing receipt, manager, deadline and retry rules under reviewed event metadata.
begin;
set local lock_timeout = '5s';

create or replace function public.native_tournament_entry_context(p_parent text,p_division text) returns jsonb
language plpgsql security definer set search_path='' as $body$
declare first_party boolean := current_setting('role', true) = 'service_role'
 and current_setting('tenaceiq.scoped_tournament_entry', true) = '1';
 t public.tiq_tournaments; root public.tiq_tournaments; zone text; cutoff date; today date; closed boolean; locked boolean; manager boolean; one_name text; linked text; value jsonb;
begin
 select * into t from public.tiq_tournaments where id=p_division and is_public and not is_event and status<>'draft' and entrant_type in ('players','teams');
 if not found or coalesce(t.event_id,'')<>p_parent then return null; end if;
 if p_parent<>'' then
  select * into root from public.tiq_tournaments where id=p_parent and is_public and is_event and event_id is null and status<>'draft';
  if not found then return null; end if;
 else root:=t; end if;
 if not coalesce(first_party,false) then
 select p.linked_player_id::text,btrim(regexp_replace(coalesce(pl.name,''),'[[:space:]]+',' ','g')) into linked,one_name
 from public.profiles p left join public.players pl on pl.id::text=p.linked_player_id::text where p.id=auth.uid();
 if linked is not null and coalesce(one_name,'')='' then return null; end if;
 end if;
 zone:=coalesce(nullif(root.event_details->>'timeZone',''),'UTC');
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then zone:='UTC'; end if;
 today:=(clock_timestamp() at time zone zone)::date;
 begin
  if coalesce(root.event_details->>'registrationClosesOn','')~'^\d{4}-\d{2}-\d{2}$' then cutoff:=(root.event_details->>'registrationClosesOn')::date; end if;
 exception when datetime_field_overflow or invalid_datetime_format then cutoff:=null; end;
 if cutoff is null then begin
  if root.starts_on~'^\d{4}-\d{2}-\d{2}$' then cutoff:=root.starts_on::date; end if;
 exception when datetime_field_overflow or invalid_datetime_format then cutoff:=null; end; end if;
 closed:=t.status='completed' or root.status='completed' or (cutoff is not null and cutoff<today);
 locked:=t.results<>'{}'::jsonb or t.schedule<>'{}'::jsonb or t.status='completed' or root.status='completed';
 manager:=coalesce(public.can_manage_tiq_tournament(t.id) and public.can_manage_tiq_tournament(root.id),false);
 value:=jsonb_build_object('owner',auth.uid(),'parent',p_parent,'division',t.id,'name',t.name,'eventName',root.name,'paired',t.entrant_type='teams','playerName',coalesce(one_name,''),'playerLocked',linked is not null,'canManage',manager,
 'mode',case when not coalesce(first_party,false) and root.registration_email<>'' then 'director' when t.format not in ('single_elimination','round_robin','group_playoffs') then 'unsupported' when closed or locked then 'closed' else 'native' end,
 'director',case when first_party then '' else left(root.registration_email,254) end,'locked',locked,'canApprove',not locked and t.format in ('single_elimination','round_robin','group_playoffs'),
 'date',root.starts_on,'deadline',coalesce(cutoff::text,''),'zone',zone);
 return value||jsonb_build_object('revision',md5((value||jsonb_build_object('tournamentVersion',t.updated_at,'rootVersion',root.updated_at,'field',t.entrants,'draw',md5(t.results::text),'schedule',md5(t.schedule::text),'eventDetails',root.event_details,'rootPublic',root.is_public,'divisionPublic',t.is_public))::text));
end $body$;
revoke all on function public.native_tournament_entry_context(text,text) from public,anon,authenticated;

create function public.native_first_party_tournament_registration(
  p_actor uuid, p_action text, p_parent text, p_division text, p_publication jsonb, p_data jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $body$
declare
  target text;
  row_data public.tiq_tournaments;
  actual jsonb;
  answer jsonb;
  previous_sub text := current_setting('request.jwt.claim.sub', true);
  previous_scope text := current_setting('tenaceiq.scoped_tournament_entry', true);
begin
  if p_actor is null or p_parent is null or p_division is null or p_division = p_parent or
    p_action is null or p_action not in ('review','queue','submit','decide') or
    jsonb_typeof(p_publication) is distinct from 'object' then
    return jsonb_build_object('ok',false,'status',400,'message','Choose a tournament division.');
  end if;

  if p_action in ('submit','decide') then
    perform 1 from public.profiles where id = p_actor for share;
  end if;
  -- Lock in the same parent-first order as the entry and organizer desk writes.
  foreach target in array (case when p_parent = '' then array[p_division] else array[p_parent,p_division] end) loop
    if p_action in ('submit','decide') then
      select * into row_data from public.tiq_tournaments where id = target for update;
    else
      select * into row_data from public.tiq_tournaments where id = target for share;
    end if;
    if not found then
      return jsonb_build_object('ok',false,'status',404,'message','This tournament entry is unavailable.');
    end if;
    actual := jsonb_build_object(
      'id',row_data.id,'event_id',row_data.event_id,'is_event',row_data.is_event,'name',row_data.name,
      'format',row_data.format,'entrant_type',row_data.entrant_type,'status',row_data.status,
      'starts_on',row_data.starts_on,'location_label',row_data.location_label,'event_details',row_data.event_details,
      'is_public',row_data.is_public,'registration_email',row_data.registration_email);
    if actual is distinct from p_publication->target then
      return jsonb_build_object('ok',false,'status',404,'message','This tournament entry is unavailable.');
    end if;
  end loop;

  -- The API verifies the caller JWT before the service-only function receives the account ID.
  perform set_config('request.jwt.claim.sub',p_actor::text,true);
  perform set_config('tenaceiq.scoped_tournament_entry','1',true);
  answer := public.native_tournament_registration(p_action,p_parent,p_division,p_data);
  perform set_config('tenaceiq.scoped_tournament_entry',coalesce(previous_scope,''),true);
  perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
  return answer;
end
$body$;

revoke all on function public.native_first_party_tournament_registration(uuid,text,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.native_first_party_tournament_registration(uuid,text,text,text,jsonb,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
