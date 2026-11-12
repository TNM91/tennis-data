begin;
set local lock_timeout = '5s';
set local statement_timeout = '20s';

do $guard$
begin
  if not public.account_erasure_catalog_ready() then
    raise exception 'Review the account deletion catalog before adding private court ratings';
  end if;
end $guard$;

alter table public.native_personal_matches
  add column court_feedback jsonb
    constraint native_personal_matches_court_feedback_check check (
      case
        when court_feedback is null then true
        when court_venue_key is null or jsonb_typeof(court_feedback) <> 'object' then false
        else court_feedback ?& array['surface', 'lighting', 'court_time']
          and court_feedback - array['surface', 'lighting', 'court_time'] = '{}'::jsonb
          and court_feedback->'surface' in ('null', '1', '2', '3', '4', '5')
          and court_feedback->'lighting' in ('null', '1', '2', '3', '4', '5')
          and court_feedback->'court_time' in ('null', '1', '2', '3', '4', '5')
          and court_feedback <> '{"surface":null,"lighting":null,"court_time":null}'::jsonb
      end
    );

comment on column public.native_personal_matches.court_feedback is
  'Private ratings of an owner-recorded visit. Null dimensions are unrated.';
grant insert (court_feedback), update (court_feedback) on public.native_personal_matches to authenticated;

create function public.clear_native_match_court_feedback()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.court_feedback := null;
  return new;
end;
$$;
revoke all on function public.clear_native_match_court_feedback() from public, anon, authenticated;

create trigger native_personal_match_venue_change
  before update of court_venue_key on public.native_personal_matches
  for each row when (old.court_venue_key is distinct from new.court_venue_key)
  execute function public.clear_native_match_court_feedback();

do $catalog$
declare
  source text := pg_catalog.pg_get_functiondef('public.account_erasure_catalog_ready()'::regprocedure);
  previous_columns constant text := 'a1a1cf0e7c31d37b037b494d4f57efa7';
  next_columns constant text := '44a05a79459948ebd912b57bdd1e292d';
begin
  if length(source) - length(replace(source, previous_columns, '')) <> length(previous_columns) then
    raise exception 'The reviewed account deletion catalog marker changed';
  end if;
  execute replace(source, previous_columns, next_columns);
  if not public.account_erasure_catalog_ready() then
    raise exception 'Account deletion catalog did not validate with private court ratings';
  end if;
end $catalog$;

notify pgrst, 'reload schema';
commit;
