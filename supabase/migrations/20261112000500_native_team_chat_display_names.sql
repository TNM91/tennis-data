begin;
set local lock_timeout = '5s';
set local statement_timeout = '20s';

alter table public.team_room_member_preferences
  add column chat_display_name text
    constraint team_room_member_preferences_chat_name_check check (
      chat_display_name = btrim(chat_display_name)
      and char_length(chat_display_name) between 1 and 48
      and chat_display_name !~ '[[:cntrl:]@]'
    );

comment on column public.team_room_member_preferences.chat_display_name is
  'An optional name the member explicitly shares in this conversation. Null keeps the chat alias.';

commit;
