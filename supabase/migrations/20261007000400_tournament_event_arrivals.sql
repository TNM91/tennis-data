begin;
-- Attendance is separate from draws, scores, and private contact information.
create table public.tiq_tournament_arrivals (
  tournament_id text not null references public.tiq_tournaments(id) on delete cascade,
  entrant_name text not null check (length(btrim(entrant_name)) between 1 and 200),
  checked_in boolean not null default false,
  primary key (tournament_id, entrant_name)
);
alter table public.tiq_tournament_arrivals enable row level security;
revoke all on public.tiq_tournament_arrivals from anon, authenticated;
grant select on public.tiq_tournament_arrivals to anon, authenticated;
grant insert, update on public.tiq_tournament_arrivals to authenticated;
create policy "Visible event attendance" on public.tiq_tournament_arrivals
for select to anon, authenticated using (exists (
  select 1 from public.tiq_tournaments t where t.id = tournament_id
    and t.event_id is not null and entrant_name = any(t.entrants)
));
create policy "Event managers confirm attendance" on public.tiq_tournament_arrivals
for insert to authenticated with check (
  public.can_manage_tiq_tournament(tournament_id) and exists (
    select 1 from public.tiq_tournaments t where t.id = tournament_id
      and t.event_id is not null and entrant_name = any(t.entrants)
  )
);
create policy "Event managers update attendance" on public.tiq_tournament_arrivals
for update to authenticated using (public.can_manage_tiq_tournament(tournament_id))
with check (public.can_manage_tiq_tournament(tournament_id) and exists (
  select 1 from public.tiq_tournaments t where t.id = tournament_id
    and t.event_id is not null and entrant_name = any(t.entrants)
));
notify pgrst, 'reload schema';
commit;
