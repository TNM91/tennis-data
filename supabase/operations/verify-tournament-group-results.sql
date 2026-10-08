begin;
insert into public.tiq_tournaments(id,name,is_event,status,created_by_user_id)
values('__group_verify_event__','Group verification',true,'draft','accc3471-8912-491c-b8d9-4a84dcc7c42e');
insert into public.tiq_tournaments(id,name,event_id,format,status,entrants,created_by_user_id,updated_at)
values('__group_verify_division__','Group division','__group_verify_event__','group_playoffs','draft',array['A','B','C','D','E','F'],'accc3471-8912-491c-b8d9-4a84dcc7c42e',now()-interval '1 minute');
select set_config('request.jwt.claim.sub','accc3471-8912-491c-b8d9-4a84dcc7c42e',true);
set local role authenticated;
do $$ declare initial_version timestamptz; changed integer; blocked boolean := false;
begin
  select updated_at into initial_version from public.tiq_tournaments where id='__group_verify_division__';
  update public.tiq_tournaments set results='{"g1-r1-m2":{"winner":"C","score":"6-4","sideA":"C","sideB":"E","updatedAt":"2026-10-07T22:00:00Z"}}',
    status='scheduled',updated_by_user_id=auth.uid(),updated_at=clock_timestamp()
  where id='__group_verify_division__' and updated_at=initial_version;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Organizer could not save a group score'; end if;
  update public.tiq_tournaments set results='{}' where id='__group_verify_division__' and updated_at=initial_version;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Stale group score was accepted'; end if;
  begin
    update public.tiq_tournaments set entrants=array['A','B','C','D','E','F','G'] where id='__group_verify_division__';
  exception when raise_exception then blocked := true; end;
  if not blocked then raise exception 'Scored group field changed'; end if;
  blocked := false;
  begin
    update public.tiq_tournaments set format='single_elimination' where id='__group_verify_division__';
  exception when raise_exception then blocked := true; end;
  if not blocked then raise exception 'Scored group format changed'; end if;
  update public.tiq_tournaments set results='{}' where id='__group_verify_division__';
  update public.tiq_tournaments set entrants=array['A','B','C','D','E','F','G'] where id='__group_verify_division__';
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$ declare changed integer; begin
  update public.tiq_tournaments set results='{}' where id='__group_verify_division__';
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Unrelated user changed group results'; end if;
end $$;
reset role;
rollback;
