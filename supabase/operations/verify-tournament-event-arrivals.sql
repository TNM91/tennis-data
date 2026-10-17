begin;
insert into public.tiq_tournaments(id,name,is_event,status,created_by_user_id,is_public)
values('__arrival_event__','Arrival verification',true,'draft','accc3471-8912-491c-b8d9-4a84dcc7c42e',false);
insert into public.tiq_tournaments(id,name,event_id,status,entrants,created_by_user_id)
values('__arrival_division__','Arrival division','__arrival_event__','draft',array['Team A','Team B'],'accc3471-8912-491c-b8d9-4a84dcc7c42e');
select set_config('request.jwt.claim.sub','accc3471-8912-491c-b8d9-4a84dcc7c42e',true);
set local role authenticated;
insert into public.tiq_tournament_arrivals values('__arrival_division__','Team A',true);
do $$ begin
  if not (select checked_in from public.tiq_tournament_arrivals where tournament_id='__arrival_division__' and entrant_name='Team A') then
    raise exception 'Manager arrival save failed'; end if;
  begin
    insert into public.tiq_tournament_arrivals values('__arrival_division__','Unknown team',true);
    raise exception 'Unknown entrant was accepted';
  exception when insufficient_privilege then null; end;
end $$;
update public.tiq_tournament_arrivals set checked_in=false where tournament_id='__arrival_division__' and entrant_name='Team A';
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
  if exists(select 1 from public.tiq_tournament_arrivals where tournament_id='__arrival_division__') then
    raise exception 'Private attendance leaked'; end if;
end $$;
reset role;
update public.tiq_tournaments set is_public=true where id='__arrival_event__';
set local role anon;
do $$ begin
  if (select count(*) from public.tiq_tournament_arrivals where tournament_id='__arrival_division__') <> 1 then
    raise exception 'Public attendance unavailable'; end if;
  begin
    update public.tiq_tournament_arrivals set checked_in=true where tournament_id='__arrival_division__';
    raise exception 'Anonymous attendance write allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$ declare changed integer; begin
  update public.tiq_tournament_arrivals set checked_in=true where tournament_id='__arrival_division__';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Unrelated user changed attendance'; end if;
  begin
    insert into public.tiq_tournament_arrivals values('__arrival_division__','Team B',true);
    raise exception 'Unrelated user inserted attendance';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
