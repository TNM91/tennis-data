-- Run only after 20261007000100_tournament_event_divisions.sql is approved/applied.
-- Preserve both division IDs, entry relationships, and draw records.
begin;
do $$
declare first_division public.tiq_tournaments; division_count integer;
begin
  select * into first_division from public.tiq_tournaments
    where id = 'pumpkin-playoffs-2026-mens-4-0-doubles' for update;
  if first_division.id is null then raise exception 'The 4.0 draft is missing.'; end if;
  perform 1 from public.tiq_tournaments where id = 'pumpkin-playoffs-2026-mens-4-5-doubles' for update;
  select count(*) into division_count from public.tiq_tournaments
    where id in ('pumpkin-playoffs-2026-mens-4-0-doubles', 'pumpkin-playoffs-2026-mens-4-5-doubles')
      and status = 'draft' and not is_public and event_id is null and not is_event
      and created_by_user_id = first_division.created_by_user_id;
  if division_count <> 2 then raise exception 'Both divisions must still be private, unattached drafts with the same owner.'; end if;
  if exists (select 1 from public.tiq_tournaments where id = 'pumpkin-playoffs-2026') then
    raise exception 'The event already exists; refusing to overwrite it.';
  end if;
  insert into public.tiq_tournaments (
    id, name, is_event, event_theme, registration_email, event_details, format, entrant_type, status,
    starts_on, location_label, director_notes, entrants, results, schedule, is_public, result_mode,
    created_by_user_id, updated_by_user_id
  ) values (
    'pumpkin-playoffs-2026', 'Pumpkin Playoffs', true, 'pumpkin', 'leskotennis11@gmail.com',
    jsonb_build_object(
      'subtitle', 'Competitive doubles. Great tennis. Good company.', 'startsAt', '17:30',
      'finishLabel', 'Expected finish 9–10 PM', 'timeZone', 'America/Chicago', 'timeZoneLabel', 'Central',
      'registrationClosesOn', '2026-10-14', 'feePerPlayer', 40, 'feePerTeam', 80, 'currency', 'USD',
      'directorName', 'Michael Lesko', 'venueName', 'Woodsmill Tennis Club',
      'venueAddress', '910 Old Woodsmill Road, Chesterfield, MO 63017',
      'formatSummary', '2–3 rounds of group play, followed by a championship playoff for group winners. Final format depends on entries.',
      'hospitalitySummary', 'Prizes in each division. Snacks, drinks, pizza, and a cash bar. No outside alcohol allowed.',
      'sanctioningLabel', 'Not USTA or UTR sanctioned.',
      'sponsors', jsonb_build_array('Forever Tennis & Pickleball', 'Woodsmill Tennis Club')
    ),
    'round_robin', 'teams', 'draft', '2026-10-17', first_division.location_label,
    regexp_replace(first_division.director_notes, '^Division: [^\n]+\n\n', ''),
    '{}', '{}'::jsonb, '{}'::jsonb, false, 'social',
    first_division.created_by_user_id, first_division.updated_by_user_id
  );
  update public.tiq_tournaments set event_id = 'pumpkin-playoffs-2026',
    name = case when id = 'pumpkin-playoffs-2026-mens-4-0-doubles' then 'Men''s 4.0 Doubles' else 'Men''s 4.5 Doubles' end
  where id in ('pumpkin-playoffs-2026-mens-4-0-doubles', 'pumpkin-playoffs-2026-mens-4-5-doubles');
end $$;
commit;
