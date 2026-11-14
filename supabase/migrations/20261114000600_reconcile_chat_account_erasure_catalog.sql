begin;
set local lock_timeout = '5s';
set local statement_timeout = '20s';

do $catalog$
declare
  source text := pg_catalog.pg_get_functiondef('public.account_erasure_catalog_ready()'::regprocedure);
  previous_columns constant text := '96c414bb51f7737278af351b88d18e90';
  next_columns constant text := 'cef9b621099b594e054e28e311c887d9';
  unaffected_columns text;
begin
  -- The optional display name is on a member preference row that cascades from
  -- profiles. The release-scope flag belongs to the shared room, whose creator
  -- is already cleared. Neither column adds a user reference or delete trigger.
  select md5(string_agg(table_name||'|'||column_name||'|'||data_type||'|'||is_nullable,
      E'\n' order by table_name collate "C",column_name collate "C"))
    into unaffected_columns
    from information_schema.columns
    where table_schema='public' and table_name not in ('account_deletion_requests','native_email_auth_limits')
      and (table_name,column_name) not in (('team_chat_rooms','first_party'),
        ('team_room_member_preferences','chat_display_name'));

  if unaffected_columns is distinct from previous_columns
      or length(source) - length(replace(source, previous_columns, '')) <> length(previous_columns) then
    raise exception 'Review unexpected account deletion catalog changes';
  end if;
  execute replace(source, previous_columns, next_columns);
  if not public.account_erasure_catalog_ready() then
    raise exception 'Account deletion catalog did not validate with the reviewed chat columns';
  end if;
end $catalog$;

notify pgrst,'reload schema';
commit;
