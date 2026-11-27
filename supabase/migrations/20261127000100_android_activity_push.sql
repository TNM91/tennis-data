begin;
set local lock_timeout = '5s';

-- Reuse the same private opt-in, eligibility and account-deletion cascade.
-- Prefixing the token preserves existing RPC signatures and routes each device
-- to its provider without changing or reinterpreting any existing APNs token.
alter table private.native_hit_push_devices
  drop constraint native_hit_push_devices_device_token_check;
alter table private.native_hit_push_devices add constraint native_hit_push_devices_device_token_check
  check((device_token ~ '^[a-f0-9]+$' and length(device_token) between 64 and 256) or
    (device_token ~ '^fcm:[A-Za-z0-9:_-]+$' and length(device_token) between 24 and 2052));

create function public.bind_native_android_activity_push(
  p_installation uuid,p_secret_hash text,p_profile uuid,p_token text,p_enabled boolean,p_coach_activity boolean
) returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_enabled and (p_token is null or p_token !~ '^[A-Za-z0-9:_-]+$' or length(p_token) not between 20 and 2048) then return false; end if;
  return public.bind_native_hit_push(p_installation,p_secret_hash,p_profile,
    case when p_enabled then 'fcm:'||p_token else '' end,p_enabled,p_coach_activity);
end;
$$;
revoke all on function public.bind_native_android_activity_push(uuid,text,uuid,text,boolean,boolean)
  from public,anon,authenticated,service_role;
grant execute on function public.bind_native_android_activity_push(uuid,text,uuid,text,boolean,boolean) to service_role;

notify pgrst,'reload schema';
commit;
