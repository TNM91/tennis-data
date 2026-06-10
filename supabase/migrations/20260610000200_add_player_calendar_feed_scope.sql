alter table public.calendar_feed_tokens
  drop constraint if exists calendar_feed_tokens_scope_type_check;

alter table public.calendar_feed_tokens
  add constraint calendar_feed_tokens_scope_type_check
  check (scope_type in ('coach_student', 'player_calendar'));
