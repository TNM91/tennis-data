begin;
-- Keep the erasure allowlist fail-closed while adding this one audited column.
do $guard$ begin
 if not public.account_erasure_catalog_ready() or not exists (
  select 1 from pg_catalog.pg_proc
  where oid='public.account_erasure_catalog_ready()'::regprocedure and prosecdef
   and md5(regexp_replace(replace(prosrc,'71aa786c4bef4a48b62690ba6787c745','92283363651da61e44479259f3208041'),'\s','','g'))='58c02891394ead4223d498376cacb534'
 ) then raise exception 'Existing account erasure guard differs; review before Coach alert migration'; end if;
end $guard$;
-- Keep existing account-owned RLS. Existing team-alert choices never opt in.
alter table public.internal_notification_preferences
 add column if not exists native_coach_alerts_enabled boolean not null default false;
comment on column public.internal_notification_preferences.native_coach_alerts_enabled is
 'Explicit account opt-in for private Coach/player iPhone alerts; registered devices, message preferences, current linkage, mute and block checks still apply.';
do $catalog$
declare source text; old_marker text := '92283363651da61e44479259f3208041'; new_marker text := '71aa786c4bef4a48b62690ba6787c745';
begin
 source := pg_catalog.pg_get_functiondef('public.account_erasure_catalog_ready()'::regprocedure);
 if (length(source)-length(replace(source,old_marker,'')))/length(old_marker)=1 then
  execute replace(source,old_marker,new_marker);
 elsif (length(source)-length(replace(source,new_marker,'')))/length(new_marker)<>1 then
  raise exception 'Erasure column marker changed';
 end if;
 if not public.account_erasure_catalog_ready() then raise exception 'Updated erasure catalog did not validate'; end if;
end $catalog$;
commit;
