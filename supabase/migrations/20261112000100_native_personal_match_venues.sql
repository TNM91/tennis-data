begin;
set local lock_timeout = '5s';
set local statement_timeout = '20s';

do $guard$
begin
  if not public.account_erasure_catalog_ready() then
    raise exception 'Review the account deletion catalog before adding personal match venues';
  end if;
end $guard$;

alter table public.native_personal_matches
  add column court_venue_key text
    constraint native_personal_matches_court_venue_key_check check (
      char_length(court_venue_key) between 1 and 80
      and court_venue_key ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'
      and court_venue_key not like 'private-%'
    );

comment on column public.native_personal_matches.court_venue_key is
  'Private, self-reported Explore catalog key selected by the scorecard owner.';

grant insert (court_venue_key), update (court_venue_key) on public.native_personal_matches to authenticated;

do $catalog$
declare
  source text := pg_catalog.pg_get_functiondef('public.account_erasure_catalog_ready()'::regprocedure);
  previous_columns constant text := '806febd4e4da78213a78fc4f6196b433';
  next_columns constant text := 'a1a1cf0e7c31d37b037b494d4f57efa7';
begin
  if length(source) - length(replace(source, previous_columns, '')) <> length(previous_columns) then
    raise exception 'The reviewed account deletion catalog marker changed';
  end if;
  execute replace(source, previous_columns, next_columns);
  if not public.account_erasure_catalog_ready() then
    raise exception 'Account deletion catalog did not validate with personal match venues';
  end if;
end $catalog$;

notify pgrst, 'reload schema';
commit;
