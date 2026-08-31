-- The mobile shortcut dock has eight visual slots: up to seven user pins
-- followed by its fixed Edit control. Keep the persisted preference valid
-- across devices without forcing a member to fill every slot.
begin;

create or replace function public.text_array_has_unique_values(values text[])
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select cardinality(values) = (
    select count(distinct value)
    from unnest(values) as entry(value)
  )
$$;

alter table public.portal_shortcut_preferences
  drop constraint if exists portal_shortcut_preferences_four_unique_shortcuts;

alter table public.portal_shortcut_preferences
  add constraint portal_shortcut_preferences_up_to_seven_unique_shortcuts
  check (
    cardinality(shortcut_ids) between 1 and 7
    and public.text_array_has_unique_values(shortcut_ids)
  );

comment on table public.portal_shortcut_preferences is
  'The one to seven portal hubs or tennis actions a signed-in user pins across devices.';

commit;
