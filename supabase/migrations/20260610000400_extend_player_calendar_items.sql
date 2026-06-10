alter table public.player_calendar_items
  add column if not exists recurrence_rule text not null default '',
  add column if not exists availability_status text not null default '';

alter table public.player_calendar_items
  drop constraint if exists player_calendar_items_kind_check;

alter table public.player_calendar_items
  add constraint player_calendar_items_kind_check
  check (kind in ('practice', 'match', 'lesson', 'reminder', 'availability'));

alter table public.player_calendar_items
  drop constraint if exists player_calendar_items_availability_status_check;

alter table public.player_calendar_items
  add constraint player_calendar_items_availability_status_check
  check (availability_status in ('', 'available', 'unavailable'));
