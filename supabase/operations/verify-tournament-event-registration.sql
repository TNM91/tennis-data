begin;
insert into public.tiq_tournaments(id,name,is_event,status,created_by_user_id,is_public)
values('__registration_event__','Registration verification',true,'draft','accc3471-8912-491c-b8d9-4a84dcc7c42e',true);
insert into public.tiq_tournaments(id,name,event_id,status,entrant_type,entrants,created_by_user_id)
values('__registration_division__','Registration division','__registration_event__','draft','teams','{}','accc3471-8912-491c-b8d9-4a84dcc7c42e');
select set_config('request.jwt.claim.sub','accc3471-8912-491c-b8d9-4a84dcc7c42e',true);
set local role authenticated;
do $$
declare r jsonb; body jsonb; stale jsonb; payment_version text;
begin
  body := '{"tournament_id":"__registration_division__","player_one":"Morgan","player_two":"Lee","status":"waitlisted","fee_cents":8000,"paid_cents":4000,"note":"Test only"}'::jsonb;
  r := public.save_tiq_event_registration('__registration_event__',body);
  if (select cardinality(entrants) from public.tiq_tournaments where id='__registration_division__') <> 0 then raise exception 'Waitlisted team entered draw'; end if;
  body := body || jsonb_build_object('id',r->>'id','expected_updated_at',r->>'updated_at','status','confirmed');
  stale := body;
  r := public.save_tiq_event_registration('__registration_event__',body);
  if not (select 'Morgan / Lee'=any(entrants) from public.tiq_tournaments where id='__registration_division__') then raise exception 'Confirmed team missing from draw'; end if;
  begin
    perform public.save_tiq_event_registration('__registration_event__',stale);
    raise exception 'Stale save accepted';
  exception when raise_exception then if sqlerrm<>'Registration changed. Refresh before saving.' then raise; end if; end;
  begin
    perform public.save_tiq_event_registration('__registration_event__',jsonb_build_object('tournament_id','__registration_division__','player_one','Morgan','player_two','Alex','status','pending','fee_cents',8000,'paid_cents',0));
    raise exception 'Duplicate player accepted';
  exception when raise_exception then if sqlerrm<>'This player is already registered in this division.' then raise; end if; end;
  update public.tiq_tournaments set updated_by_user_id=auth.uid(),schedule='{"test":{"court":"1"}}' where id='__registration_division__';
  body := body || jsonb_build_object('expected_updated_at',r->>'updated_at','paid_cents',8000);
  r := public.save_tiq_event_registration('__registration_event__',body);
  if (r->>'paid_cents')::integer<>8000 then raise exception 'Payment update failed on scheduled field'; end if;
  body := body || jsonb_build_object('expected_updated_at',r->>'updated_at','status','withdrawn');
  begin
    perform public.save_tiq_event_registration('__registration_event__',body);
    raise exception 'Scheduled field changed';
  exception when raise_exception then if sqlerrm<>'Court slots are assigned. Clear the division schedule before changing its field.' then raise; end if; end;
  update public.tiq_tournaments set updated_by_user_id=auth.uid(),schedule='{}',results='{"test":{"winner":"Morgan / Lee","score":"6-4"}}' where id='__registration_division__';
  begin
    perform public.save_tiq_event_registration('__registration_event__',body);
    raise exception 'Scored field changed';
  exception when raise_exception then if sqlerrm<>'Clear results before changing the confirmed field.' then raise; end if; end;
  update public.tiq_tournaments set updated_by_user_id=auth.uid(),results='{}' where id='__registration_division__';
  r := public.save_tiq_event_registration('__registration_event__',body);
  if (select cardinality(entrants) from public.tiq_tournaments where id='__registration_division__')<>0 then raise exception 'Withdrawn entrant retained'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.tiq_event_registrations where event_id='__registration_event__') then raise exception 'Unrelated user read payments'; end if;
  begin
    perform public.save_tiq_event_registration('__registration_event__','{}');
    raise exception 'Unrelated user wrote registration';
  exception when raise_exception then if sqlerrm<>'Organizer access required.' then raise; end if; end;
end $$;
reset role;
do $$ begin
  if has_table_privilege('anon','public.tiq_event_registrations','select') or has_function_privilege('anon','public.save_tiq_event_registration(text,jsonb)','execute') then raise exception 'Anonymous access to registrations'; end if;
  if has_table_privilege('authenticated','public.tiq_event_registrations','insert') or has_table_privilege('authenticated','public.tiq_event_registrations','update') then raise exception 'Direct roster writes bypass atomic save'; end if;
end $$;
rollback;
