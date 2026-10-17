begin;
-- Match the existing column-level public metadata grant; RLS still controls visibility.
grant select (event_id, is_event, event_theme, registration_email, event_details)
  on public.tiq_tournaments to anon, authenticated;
notify pgrst, 'reload schema';
commit;