begin;
insert into public.tiq_tournaments(id,name,is_event,status,created_by_user_id)
values('__court_plan_verify_event__','Court plan verification',true,'draft','accc3471-8912-491c-b8d9-4a84dcc7c42e');
insert into public.tiq_tournaments(id,name,event_id,status,entrants,created_by_user_id,updated_at)
values('__court_plan_verify_division__','Division verification','__court_plan_verify_event__','draft',array['Team A','Team B'],'accc3471-8912-491c-b8d9-4a84dcc7c42e',now()-interval '1 minute');
select set_config('request.jwt.claim.sub','accc3471-8912-491c-b8d9-4a84dcc7c42e',true);
set local role authenticated;
do $$
declare initial_version timestamptz; changed integer;
begin
  select updated_at into initial_version from public.tiq_tournaments where id='__court_plan_verify_division__';
  update public.tiq_tournaments set schedule='{"r1-m1":{"date":"2026-10-17","time":"17:30","court":"1","updatedAt":"2026-10-07T22:00:00Z"}}'::jsonb,
    status='scheduled',updated_by_user_id=auth.uid(),updated_at=clock_timestamp()
  where id='__court_plan_verify_division__' and event_id='__court_plan_verify_event__' and updated_at=initial_version;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Organizer could not update the division schedule.'; end if;
  update public.tiq_tournaments set schedule='{}'::jsonb
  where id='__court_plan_verify_division__' and updated_at=initial_version;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Stale schedule update was accepted.'; end if;
  if (select schedule->'r1-m1'->>'court' from public.tiq_tournaments where id='__court_plan_verify_division__') <> '1' then
    raise exception 'Schedule was not preserved.';
  end if;
end $$;
reset role;
rollback;