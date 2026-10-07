-- Read only metadata already granted to organizers; private contacts stay protected.
begin;
create or replace function public.validate_tournament_event_division()
returns trigger language plpgsql set search_path = '' as $$
declare parent record;
begin
  if tg_op = 'UPDATE' and old.is_event and not new.is_event and exists (
    select 1 from public.tiq_tournaments where event_id = old.id
  ) then raise exception 'Remove divisions before changing the event structure.'; end if;
  if new.event_id is not null then
    select id, is_event, created_by_user_id, starts_on, location_label, event_theme, registration_email, event_details, is_public
      into parent from public.tiq_tournaments where id = new.event_id;
    if parent.id is null or not parent.is_event or parent.id = new.id
      or parent.created_by_user_id is distinct from new.created_by_user_id then
      raise exception 'A division must belong to an event with the same organizer.';
    end if;
    new.starts_on := parent.starts_on;
    new.location_label := parent.location_label;
    new.event_theme := parent.event_theme;
    new.registration_email := parent.registration_email;
    new.event_details := parent.event_details;
    new.is_public := parent.is_public;
  end if;
  return new;
end $$;

commit;
