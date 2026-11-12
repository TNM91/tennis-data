begin;
set local lock_timeout = '5s';
set local statement_timeout = '20s';

do $guard$
begin
  if not public.account_erasure_catalog_ready() then
    raise exception 'Review the account deletion catalog before adding scorecard practice';
  end if;
end $guard$;

alter table public.player_calendar_items
  add column practice_focus jsonb constraint player_calendar_practice_focus_check check (
    practice_focus is null or (
      jsonb_typeof(practice_focus) = 'object'
      and practice_focus - array['cardId', 'target'] = '{}'::jsonb
      and practice_focus->>'cardId' in ('serve-target-ladder', 'return-depth-lane', 'crosscourt-consistency', 'doubles-return-first-move')
      and jsonb_typeof(practice_focus->'target') = 'string'
      and char_length(practice_focus->>'target') between 1 and 160
      and btrim(practice_focus->>'target') <> ''
      and practice_focus->>'target' !~ '[[:cntrl:]]'
    ) is true
  );

comment on column public.player_calendar_items.practice_focus is
  'Private Level Up drill and target. Shared calendar feeds omit this field.';

do $catalog$
declare
  source text := pg_catalog.pg_get_functiondef('public.account_erasure_catalog_ready()'::regprocedure);
  previous_columns constant text := '56c190b438a618acdca3552e72133545';
  next_columns constant text := '96c414bb51f7737278af351b88d18e90';
begin
  if length(source) - length(replace(source, previous_columns, '')) <> length(previous_columns) then
    raise exception 'The reviewed account deletion catalog marker changed';
  end if;
  execute replace(source, previous_columns, next_columns);
  if not public.account_erasure_catalog_ready() then
    raise exception 'Account deletion catalog did not validate with scorecard practice';
  end if;
end $catalog$;

notify pgrst, 'reload schema';
commit;
