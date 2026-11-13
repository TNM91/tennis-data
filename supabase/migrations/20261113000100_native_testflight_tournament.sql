-- Permit the signed-in owner to exercise tournament entry in their private TestFlight fixture.
begin;
set local lock_timeout = '5s';

create function tenaceiq_private.is_testflight_tournament(t public.tiq_tournaments, owner_id uuid)
returns boolean language sql immutable set search_path = '' as $body$
  select owner_id is not null and t.id = 'tiq-testflight-doubles-' || owner_id::text
    and t.created_by_user_id = owner_id and not t.is_public and not t.is_event
    and t.event_id is null and t.format = 'round_robin' and t.entrant_type = 'teams';
$body$;
revoke all on function tenaceiq_private.is_testflight_tournament(public.tiq_tournaments,uuid) from public,anon,authenticated;

-- Reserve demo IDs for operator-created fixtures and keep owners from publishing them.
create policy "TestFlight tournament IDs are reserved" on public.tiq_tournaments
as restrictive for insert to authenticated
with check (id not like 'tiq-testflight-doubles-%');

create policy "TestFlight tournaments are read-only for owners" on public.tiq_tournaments
as restrictive for update to authenticated
using (id not like 'tiq-testflight-doubles-%')
with check (id not like 'tiq-testflight-doubles-%');

create or replace function public.native_tournament_entry_context(p_parent text,p_division text) returns jsonb
language plpgsql security definer set search_path='' as $body$
declare first_party boolean := current_setting('role', true) = 'service_role'
 and current_setting('tenaceiq.scoped_tournament_entry', true) = '1';
 t public.tiq_tournaments; root public.tiq_tournaments; zone text; cutoff date; today date; closed boolean; locked boolean; manager boolean; one_name text; linked text; value jsonb;
begin
 select * into t from public.tiq_tournaments where id=p_division and not is_event and status<>'draft' and entrant_type in ('players','teams')
   and (is_public or (first_party and p_parent = '' and tenaceiq_private.is_testflight_tournament(tiq_tournaments, auth.uid())));
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

create function tenaceiq_private.schedule_testflight_tournament_match()
returns trigger language plpgsql security definer set search_path = '' as $body$
begin
  if current_setting('role', true) = 'service_role'
    and current_setting('tenaceiq.scoped_tournament_entry', true) = '1'
    and tenaceiq_private.is_testflight_tournament(new, auth.uid())
    and old.entrants = array['Demo Avery / Demo Robin', 'Demo Casey / Demo Morgan']
    and cardinality(new.entrants) = 3
    and new.entrants[1:2] = old.entrants
    and new.schedule = '{}'::jsonb and new.results = '{}'::jsonb then
    -- With three pairs, round one court two pairs the second and third entrants.
    new.schedule := jsonb_build_object('r1-m2', jsonb_build_object(
      'date', new.starts_on, 'time', '10:00', 'court', 'Demo Court 2'));
    new.status := 'scheduled';
  end if;
  return new;
end $body$;
revoke all on function tenaceiq_private.schedule_testflight_tournament_match() from public,anon,authenticated;
create trigger schedule_testflight_tournament_match
before update of entrants on public.tiq_tournaments
for each row when (new.id like 'tiq-testflight-doubles-%')
execute function tenaceiq_private.schedule_testflight_tournament_match();

notify pgrst, 'reload schema';
commit;
