begin;
set local lock_timeout = '5s';
set local statement_timeout = '20s';

do $guard$
begin
  if not public.account_erasure_catalog_ready() then
    raise exception 'Review the account deletion catalog before adding hitting plans';
  end if;
end $guard$;

alter table public.player_calendar_items
  add column hitting_plan jsonb constraint player_calendar_hitting_plan_check check (
    hitting_plan is null or (
      jsonb_typeof(hitting_plan) = 'object'
      and hitting_plan - array['clubId', 'confirmedFor'] = '{}'::jsonb
      and jsonb_typeof(hitting_plan->'clubId') = 'string'
      and hitting_plan->>'clubId' ~ '^[a-z][a-z0-9-]{0,79}$'
      and (not hitting_plan ? 'confirmedFor' or (
        jsonb_typeof(hitting_plan->'confirmedFor') = 'string'
        and hitting_plan->>'confirmedFor' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$'
      ))
    ) is true
  );

alter table public.native_personal_matches
  add column hitting_calendar_id text constraint native_match_hitting_calendar_check check (
    hitting_calendar_id is null or (
      calendar_match_id is null
      and hitting_calendar_id ~* '^player-calendar-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
  );

create unique index native_match_hitting_calendar_unique
  on public.native_personal_matches (owner_user_id, hitting_calendar_id) where hitting_calendar_id is not null;

comment on column public.player_calendar_items.hitting_plan is
  'Private club plan. Confirmation applies only to the saved Central date and time.';
comment on column public.native_personal_matches.hitting_calendar_id is
  'Private calendar association. Deleting a plan leaves its recorded scorecard in My Lab.';
grant insert (hitting_calendar_id) on public.native_personal_matches to authenticated;

do $catalog$
declare
  source text := pg_catalog.pg_get_functiondef('public.account_erasure_catalog_ready()'::regprocedure);
  previous_columns constant text := '44a05a79459948ebd912b57bdd1e292d';
  next_columns constant text := '56c190b438a618acdca3552e72133545';
begin
  if length(source) - length(replace(source, previous_columns, '')) <> length(previous_columns) then
    raise exception 'The reviewed account deletion catalog marker changed';
  end if;
  execute replace(source, previous_columns, next_columns);
  if not public.account_erasure_catalog_ready() then
    raise exception 'Account deletion catalog did not validate with hitting plans';
  end if;
end $catalog$;

notify pgrst, 'reload schema';
commit;
