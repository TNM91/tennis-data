begin;
set local lock_timeout = '5s';
set local statement_timeout = '20s';

do $catalog$
declare
  catalog_id constant regprocedure := 'public.account_erasure_catalog_ready()'::regprocedure;
  trigger_id constant regprocedure := 'public.erase_native_team_lineup_profile()'::regprocedure;
  previous_columns constant text := 'e6781b04114bd94e72be80d0c98d91bf';
  new_columns constant text := '7d20fc83acb244389c96c56b6c2d685f';
  trigger_marker constant text := $marker$and md5(pg_catalog.pg_get_functiondef(tr.tgfoid))='a713e288cd360feee271a7fde4504834'))$marker$;
  source text := pg_catalog.pg_get_functiondef(catalog_id);
  reviewed_trigger text;
  replacement text;
begin
  if not exists (select 1 from pg_catalog.pg_proc where oid = catalog_id and prosecdef
      and md5(regexp_replace(prosrc, '\s', '', 'g')) = '7dd12082cc4875c0ed4caf9d46aecbea')
    or not exists (select 1 from pg_catalog.pg_proc where oid = trigger_id and prosecdef
      and md5(regexp_replace(prosrc, '\s', '', 'g')) = '51d2bc6b81052338e92a485f2030017d')
    or length(source) - length(replace(source, previous_columns, '')) <> length(previous_columns)
    or length(source) - length(replace(source, trigger_marker, '')) <> length(trigger_marker) then
    raise exception 'Review the account deletion guard before adding the private team schema';
  end if;

  reviewed_trigger := format($predicate$ns.nspname='public' and c.relname='profiles'
    and tr.tgname='native_team_lineup_profile_erasure' and not tr.tgisinternal
    and tr.tgtype=11 and tr.tgenabled='O' and tr.tgfoid='public.erase_native_team_lineup_profile()'::regprocedure
    and md5(pg_catalog.pg_get_functiondef(tr.tgfoid))=%L$predicate$,
    md5(pg_catalog.pg_get_functiondef(trigger_id)));
  replacement := format($guard$and md5(pg_catalog.pg_get_functiondef(tr.tgfoid))='a713e288cd360feee271a7fde4504834'
      or (%1$s)))
    and exists(select 1 from pg_catalog.pg_trigger tr join pg_catalog.pg_class c on c.oid=tr.tgrelid
      join pg_catalog.pg_namespace ns on ns.oid=c.relnamespace where %1$s)$guard$, reviewed_trigger);

  execute replace(replace(source, previous_columns, new_columns), trigger_marker, replacement);
  if not public.account_erasure_catalog_ready() then
    raise exception 'Account deletion catalog did not validate with private teams';
  end if;
end $catalog$;

commit;
