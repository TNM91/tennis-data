begin;
-- Supabase's inherited default privileges must not exceed the approved scopes.
revoke all on public.tiq_tournament_arrivals from anon, authenticated;
grant select on public.tiq_tournament_arrivals to anon, authenticated;
grant insert, update on public.tiq_tournament_arrivals to authenticated;
notify pgrst, 'reload schema';
commit;
