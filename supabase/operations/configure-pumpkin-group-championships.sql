begin;
do $$ begin
  perform 1 from public.tiq_tournaments where id in (
    'pumpkin-playoffs-2026','pumpkin-playoffs-2026-mens-4-0-doubles','pumpkin-playoffs-2026-mens-4-5-doubles') for update;
  if (select count(*) from public.tiq_tournaments where id in (
    'pumpkin-playoffs-2026','pumpkin-playoffs-2026-mens-4-0-doubles','pumpkin-playoffs-2026-mens-4-5-doubles'))<>3 then
    raise exception 'Expected Pumpkin Playoffs event and both divisions'; end if;
  if exists(select 1 from public.tiq_tournaments where id in (
    'pumpkin-playoffs-2026','pumpkin-playoffs-2026-mens-4-0-doubles','pumpkin-playoffs-2026-mens-4-5-doubles')
    and (status<>'draft' or is_public or cardinality(entrants)<>0 or results<>'{}'::jsonb or schedule<>'{}'::jsonb)) then
    raise exception 'Pumpkin Playoffs is no longer an empty private draft; review before changing its format'; end if;
  if exists(select 1 from public.tiq_tournament_entries where tournament_id in (
    'pumpkin-playoffs-2026-mens-4-0-doubles','pumpkin-playoffs-2026-mens-4-5-doubles')) then
    raise exception 'Entries already exist; review before changing the format'; end if;
end $$;
update public.tiq_tournaments set format='group_playoffs' where id in (
  'pumpkin-playoffs-2026','pumpkin-playoffs-2026-mens-4-0-doubles','pumpkin-playoffs-2026-mens-4-5-doubles');
commit;
