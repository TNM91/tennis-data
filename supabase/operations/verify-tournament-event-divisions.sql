-- Transactional smoke test. Every fixture is rolled back, including on failure.
begin;
do $$
declare organizer uuid; other_organizer uuid; child public.tiq_tournaments;
begin
  select id into organizer from public.profiles where email = 'nmeinert91@gmail.com';
  select id into other_organizer from public.profiles where id <> organizer limit 1;
  if organizer is null or other_organizer is null then raise exception 'Verification needs two existing organizer IDs.'; end if;
  insert into public.tiq_tournaments(id, name, is_event, status, starts_on, location_label, event_theme, created_by_user_id)
    values ('__event_division_smoke__', 'Event smoke test', true, 'draft', '2026-10-17', 'Woodsmill', 'pumpkin', organizer);
  insert into public.tiq_tournaments(id, name, event_id, status, starts_on, is_public, entrants, results, created_by_user_id)
    values ('__division_smoke__', '4.0 Doubles', '__event_division_smoke__', 'draft', '2020-01-01', true,
      array['Team A', 'Team B'], '{"r1-m1":{"winner":"Team A","score":"6-4"}}'::jsonb, organizer);
  select * into child from public.tiq_tournaments where id = '__division_smoke__';
  if child.starts_on <> '2026-10-17' or child.is_public or child.event_theme <> 'pumpkin' then
    raise exception 'Division did not inherit shared details.';
  end if;
  update public.tiq_tournaments set starts_on = '2026-10-18', location_label = 'Court center',
    registration_email = 'leskotennis11@gmail.com', is_public = true where id = '__event_division_smoke__';
  select * into child from public.tiq_tournaments where id = '__division_smoke__';
  if child.starts_on <> '2026-10-18' or child.location_label <> 'Court center' or not child.is_public
    or child.registration_email <> 'leskotennis11@gmail.com' or child.results->'r1-m1'->>'winner' <> 'Team A'
    or cardinality(child.entrants) <> 2 then raise exception 'Shared update damaged division data.'; end if;
  begin
    insert into public.tiq_tournaments(id, name, event_id, status, created_by_user_id)
      values ('__wrong_owner_smoke__', 'Wrong owner', '__event_division_smoke__', 'draft', other_organizer);
    raise exception using errcode = 'XX000', message = 'Cross-owner division was accepted.';
  exception when raise_exception then null;
  end;
  begin
    delete from public.tiq_tournaments where id = '__event_division_smoke__';
    raise exception using errcode = 'XX000', message = 'Event deletion did not protect its divisions.';
  exception when foreign_key_violation then null;
  end;
end $$;
set local role anon;
do $$
begin
  if (select count(*) from public.tiq_tournaments where id in ('__event_division_smoke__', '__division_smoke__')) <> 2 then
    raise exception 'Public event and division are not readable.';
  end if;
end $$;
reset role;
update public.tiq_tournaments set is_public = false where id = '__event_division_smoke__';
set local role anon;
do $$
begin
  if exists (select 1 from public.tiq_tournaments where id in ('__event_division_smoke__', '__division_smoke__')) then
    raise exception 'Private event or division was exposed.';
  end if;
end $$;
reset role;
rollback;
