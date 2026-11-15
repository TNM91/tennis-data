begin;
set local lock_timeout = '5s';

alter table private.native_tournament_setups
  add column settings jsonb,
  add column settings_revision uuid,
  add constraint native_tournament_setup_settings_valid check (
    (settings is null and settings_revision is null)
    or (settings is not null and settings_revision is not null and
        jsonb_typeof(settings) = 'object' and octet_length(settings::text) <= 12288)
  );

create function private.native_tournament_setup_json(setup private.native_tournament_setups)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('draft', setup.draft, 'revision', setup.id, 'settings', setup.settings,
    'settingsRevision', setup.settings_revision);
$$;
revoke all on function private.native_tournament_setup_json(private.native_tournament_setups)
  from public, anon, authenticated, service_role;

create function public.native_tournament_setup(p_owner uuid, p_event uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select private.native_tournament_setup_json(setup)
  from private.native_tournament_setups setup
  where setup.owner_id = p_owner and setup.id = p_event and not exists (
    select 1 from public.account_deletion_requests request
    where request.account_id = p_owner and request.automatic_consent
  );
$$;

create function public.save_native_tournament_settings(
  p_owner uuid, p_event uuid, p_expected uuid, p_revision uuid, p_settings jsonb
)
returns jsonb language plpgsql security definer set search_path = ''
set lock_timeout = '3s' set statement_timeout = '5s' as $$
declare
  saved private.native_tournament_setups;
begin
  if p_owner is null or p_event is null or p_revision is null or p_revision = p_expected or p_settings is null then
    return jsonb_build_object('code', 'invalid');
  end if;
  perform 1 from auth.users where id = p_owner for key share;
  if not found or exists (
    select 1 from public.account_deletion_requests request
    where request.account_id = p_owner and request.automatic_consent
  ) then
    return jsonb_build_object('code', 'forbidden');
  end if;
  select * into saved from private.native_tournament_setups
  where owner_id = p_owner and id = p_event for update;
  if not found then return jsonb_build_object('code', 'missing'); end if;
  if saved.settings_revision = p_revision and saved.settings = p_settings then
    return private.native_tournament_setup_json(saved);
  end if;
  if saved.settings_revision is distinct from p_expected then
    return jsonb_build_object('code', 'stale');
  end if;
  -- The API validates the structure, date and time zone. Compare with the
  -- actual event date inside the transaction, using normalized YYYY-MM-DD.
  if coalesce(p_settings->>'registrationClosesOn', '') = ''
    or p_settings->>'registrationClosesOn' > saved.draft->>'date' then
    return jsonb_build_object('code', 'deadline');
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_settings->>'timeZone') then
    return jsonb_build_object('code', 'timeZone');
  end if;
  update private.native_tournament_setups set settings = p_settings, settings_revision = p_revision
  where owner_id = p_owner and id = p_event returning * into saved;
  return private.native_tournament_setup_json(saved);
end;
$$;

revoke all on function public.native_tournament_setup(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.save_native_tournament_settings(uuid, uuid, uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.native_tournament_setup(uuid, uuid) to service_role;
grant execute on function public.save_native_tournament_settings(uuid, uuid, uuid, uuid, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
