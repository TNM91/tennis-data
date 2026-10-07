-- An event holds shared details; division rows retain the existing draw/entry model.
begin;
alter table public.tiq_tournaments
  add column if not exists event_id text references public.tiq_tournaments(id) on delete restrict,
  add column if not exists is_event boolean not null default false,
  add column if not exists event_theme text not null default 'classic' check (event_theme in ('classic', 'pumpkin')),
  add column if not exists registration_email text not null default '',
  add column if not exists event_details jsonb not null default '{}'::jsonb check (jsonb_typeof(event_details) = 'object');

create index if not exists tiq_tournaments_event_idx on public.tiq_tournaments(event_id);
alter table public.tiq_tournaments drop constraint if exists tiq_tournaments_entrants_check;
alter table public.tiq_tournaments add constraint tiq_tournaments_entrants_check
  check ((is_event and cardinality(entrants) = 0) or (not is_event and (status = 'draft' or cardinality(entrants) >= 2)));
alter table public.tiq_tournaments add constraint tiq_tournaments_event_nesting_check
  check (not is_event or event_id is null);

create or replace function public.validate_tournament_event_division()
returns trigger language plpgsql set search_path = '' as $$
declare parent public.tiq_tournaments;
begin
  if tg_op = 'UPDATE' and old.is_event and not new.is_event and exists (
    select 1 from public.tiq_tournaments where event_id = old.id
  ) then raise exception 'Remove divisions before changing the event structure.'; end if;
  if new.event_id is not null then
    select * into parent from public.tiq_tournaments where id = new.event_id;
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
create trigger validate_tournament_event_division before insert or update on public.tiq_tournaments
for each row execute function public.validate_tournament_event_division();

create or replace function public.sync_tournament_event_details()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_event then
    update public.tiq_tournaments set starts_on = new.starts_on, location_label = new.location_label,
      event_theme = new.event_theme, registration_email = new.registration_email,
      event_details = new.event_details, is_public = new.is_public
    where event_id = new.id;
  end if;
  return new;
end $$;
create trigger sync_tournament_event_details after update of starts_on, location_label, event_theme, registration_email, event_details, is_public
on public.tiq_tournaments for each row execute function public.sync_tournament_event_details();

-- Divisions count toward their event, not as additional plan slots.
drop policy if exists "Entitled users can create TIQ tournaments" on public.tiq_tournaments;
create policy "Entitled users can create TIQ tournaments"
on public.tiq_tournaments for insert to authenticated with check (
  created_by_user_id = auth.uid() and updated_by_user_id = auth.uid()
  and (
    (club_id is not null and public.can_run_club_competition(club_id))
    or (public.has_current_league_access(auth.uid()) and (
      public.has_current_full_court_access(auth.uid())
      or (event_id is not null and exists (
        select 1 from public.tiq_tournaments parent
        where parent.id = tiq_tournaments.event_id and parent.is_event and parent.created_by_user_id = auth.uid()
      ))
      or not exists (select 1 from public.tiq_tournaments existing where existing.created_by_user_id = auth.uid() and existing.event_id is null)
    ))
  )
);

notify pgrst, 'reload schema';
commit;
