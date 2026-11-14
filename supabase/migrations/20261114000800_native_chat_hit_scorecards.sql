begin;
set local lock_timeout = '5s';
set local statement_timeout = '20s';

do $guard$
begin
  if not public.account_erasure_catalog_ready() then
    raise exception 'Review the account deletion catalog before adding hitting scorecards';
  end if;
end $guard$;

alter table public.native_personal_matches add column chat_hit_id uuid,
  add constraint native_personal_match_one_source
    check (chat_hit_id is null or (calendar_match_id is null and hitting_calendar_id is null));
create unique index native_personal_match_chat_hit
  on public.native_personal_matches(owner_user_id,chat_hit_id) where chat_hit_id is not null;

comment on column public.native_personal_matches.chat_hit_id is
  'Links a private scorecard to a confirmed hit. A saved result survives removal of the shared plan.';
grant insert (chat_hit_id) on public.native_personal_matches to authenticated;

create function private.validate_native_chat_hit_scorecard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.owner_user_id is distinct from auth.uid() or not exists (
    select 1 from private.native_chat_hits hit
    where hit.id=new.chat_hit_id and hit.status='accepted' and hit.starts_at<=now()
      and private.can_read_native_chat_hit(hit,new.owner_user_id)
  ) then
    raise exception 'This hitting plan is no longer available for logging' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_native_chat_hit_scorecard() from public,anon,authenticated,service_role;
create trigger native_chat_hit_scorecard_source before insert on public.native_personal_matches
for each row when (new.chat_hit_id is not null)
execute function private.validate_native_chat_hit_scorecard();

do $catalog$
declare
  source text := pg_catalog.pg_get_functiondef('public.account_erasure_catalog_ready()'::regprocedure);
  previous_columns constant text := 'cef9b621099b594e054e28e311c887d9';
  next_columns constant text := '27be2911dfbd84d818aafa9118507388';
begin
  -- The optional plan reference adds no owner dependency. The existing owner
  -- cascade deletes the scorecard, and either player's erasure removes the plan.
  if length(source) - length(replace(source, previous_columns, '')) <> length(previous_columns) then
    raise exception 'The reviewed account deletion catalog marker changed';
  end if;
  execute replace(source, previous_columns, next_columns);
  if not public.account_erasure_catalog_ready() then
    raise exception 'Account deletion catalog did not validate with hitting scorecards';
  end if;
end $catalog$;

notify pgrst,'reload schema';
commit;
