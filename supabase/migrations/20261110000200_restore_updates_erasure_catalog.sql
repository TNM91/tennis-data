begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';

do $catalog$
declare
  prior_hash constant text := '71aa786c4bef4a48b62690ba6787c745';
  updates_hash constant text := '16cffb50117acff9ca9275d67c04808b';
  current_hash text;
  source text;
begin
  -- The new view stores no data. Include its exact columns in the audited schema.
  select md5(string_agg(table_name || '|' || column_name || '|' || data_type || '|' || is_nullable,
      E'\n' order by table_name collate "C", column_name collate "C")) into current_hash
  from information_schema.columns
  where table_schema = 'public' and table_name not in ('account_deletion_requests', 'native_email_auth_limits');

  if current_hash is distinct from updates_hash then
    raise exception 'Account deletion schema differs from the reviewed Updates schema';
  end if;
  if public.account_erasure_catalog_ready() then
    return;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc
    where oid = 'public.account_erasure_catalog_ready()'::regprocedure and prosecdef
      and md5(regexp_replace(prosrc, '\s', '', 'g')) = 'd5ae334069ece2d06146a4b9863d7713'
  ) then
    raise exception 'Account deletion guard differs from the reviewed function';
  end if;

  source := pg_catalog.pg_get_functiondef('public.account_erasure_catalog_ready()'::regprocedure);
  if length(source) - length(replace(source, prior_hash, '')) <> length(prior_hash) then
    raise exception 'Account deletion schema marker changed';
  end if;
  execute replace(source, prior_hash, updates_hash);

  if not public.account_erasure_catalog_ready() then
    raise exception 'Updated account deletion catalog did not validate';
  end if;
end $catalog$;

commit;
