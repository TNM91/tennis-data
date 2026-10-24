begin;
create table if not exists public.native_push_devices (
 installation_id uuid primary key,
 secret_hash text not null check(secret_hash ~ '^[a-f0-9]{64}$'),
 profile_id uuid not null references public.profiles(id) on delete cascade,
 device_token text not null unique check(device_token ~ '^[a-f0-9]+$' and length(device_token) between 64 and 256),
 enabled boolean not null default true,
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '30 days'
);
create index if not exists native_push_devices_recipient on public.native_push_devices(profile_id) where enabled;
alter table public.native_push_devices enable row level security;
revoke all on public.native_push_devices from public,anon,authenticated,service_role;
grant select,update on public.native_push_devices to service_role;
-- Only the service can call this atomic compare-and-bind. A device secret is
-- required even when changing accounts; knowing an installation ID is insufficient.
create or replace function public.bind_native_push_device(p_installation uuid,p_secret_hash text,p_profile uuid,p_token text,p_enabled boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare current_row public.native_push_devices;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_profile::text,0));
 select * into current_row from public.native_push_devices where installation_id=p_installation for update;
 if found and current_row.secret_hash<>p_secret_hash then return false; end if;
 if not p_enabled then
  update public.native_push_devices set enabled=false,updated_at=now() where installation_id=p_installation and profile_id=p_profile and secret_hash=p_secret_hash;
  return true;
 end if;
 if (select count(*) from public.native_push_devices where profile_id=p_profile and enabled and expires_at>now() and installation_id<>p_installation)>=3 then return false; end if;
 insert into public.native_push_devices(installation_id,secret_hash,profile_id,device_token,enabled,updated_at,expires_at)
 values(p_installation,p_secret_hash,p_profile,p_token,true,now(),now()+interval '30 days')
 on conflict(installation_id) do update set profile_id=excluded.profile_id,device_token=excluded.device_token,enabled=true,updated_at=now(),expires_at=excluded.expires_at
 where native_push_devices.secret_hash=p_secret_hash;
 return found;
exception when unique_violation then return false;
end;
$$;
revoke all on function public.bind_native_push_device(uuid,text,uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.bind_native_push_device(uuid,text,uuid,text,boolean) to service_role;
commit;
