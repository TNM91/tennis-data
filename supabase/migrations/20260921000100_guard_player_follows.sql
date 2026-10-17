-- Follow changes pass through /api/follows, which checks current Player access.
-- Keep SELECT grants and existing rows so former members can still see follows.
do $$
begin
  if to_regclass('public.user_follows') is not null then
    revoke insert, update, delete on table public.user_follows from public, anon, authenticated;
    grant insert, update, delete on table public.user_follows to service_role;
  end if;
end $$;
