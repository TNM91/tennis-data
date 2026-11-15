begin;
set local lock_timeout = '5s';

create or replace function public.native_tournament_checkout(
  p_owner uuid, p_event uuid, p_environment text, p_action text, p_token uuid default null,
  p_expected uuid default null, p_cancel_key uuid default null
)
returns jsonb language plpgsql security definer set search_path = ''
set lock_timeout = '3s' set statement_timeout = '5s' as $$
declare
  setup private.native_tournament_setups;
  purchase private.native_tournament_purchases;
begin
  if p_owner is null or p_event is null or p_environment is null or p_environment not in ('Sandbox','Production')
    or p_action is null or p_action not in ('status','prepare','cancel')
    or (p_action <> 'status' and (p_token is null or p_cancel_key is null)) then
    return jsonb_build_object('code','invalid');
  end if;
  perform 1 from auth.users where id = p_owner for key share;
  if not found or exists (
    select 1 from public.account_deletion_requests request where request.account_id = p_owner and request.automatic_consent
  ) then return jsonb_build_object('code','forbidden'); end if;
  if exists (
    select 1 from private.native_tournament_rehearsals where owner_id = p_owner and event_id = p_event
  ) then return jsonb_build_object('code','missing'); end if;
  select * into setup from private.native_tournament_setups where owner_id = p_owner and id = p_event for update;
  if not found then return jsonb_build_object('code','missing'); end if;

  if p_action = 'cancel' then
    update private.native_tournament_purchases set status = 'cancelled'
      where token = p_token and cancel_key = p_cancel_key and owner_id = p_owner
        and event_id = p_event and environment = p_environment and status = 'pending';
    if not found and setup.settings_revision is not null then
      -- Cancellation may arrive before preparation. Keep the token cancelled so a
      -- delayed prepare cannot create a pending checkout without a StoreKit sheet.
      insert into private.native_tournament_purchases (token, cancel_key, owner_id, event_id, environment, settings_revision, status)
        values (p_token, p_cancel_key, p_owner, p_event, p_environment, setup.settings_revision, 'cancelled')
        on conflict (token) do nothing;
    end if;
  end if;

  select * into purchase from private.native_tournament_purchases
    where owner_id = p_owner and event_id = p_event and environment = p_environment and status <> 'cancelled' for update;
  if found then return private.native_tournament_checkout_json(purchase); end if;
  if setup.settings_revision is null
    or (setup.settings->>'registrationClosesOn')::date < (clock_timestamp() at time zone (setup.settings->>'timeZone'))::date then
    return jsonb_build_object('state','setup');
  end if;
  if p_action <> 'prepare' then return jsonb_build_object('state','ready'); end if;
  if setup.settings_revision is distinct from p_expected then return jsonb_build_object('code','stale'); end if;

  insert into private.native_tournament_purchases (token, cancel_key, owner_id, event_id, environment, settings_revision)
    values (p_token, p_cancel_key, p_owner, p_event, p_environment, setup.settings_revision)
    on conflict (token) do nothing returning * into purchase;
  if found then return private.native_tournament_checkout_json(purchase)||jsonb_build_object('start',true); end if;
  if exists (
    select 1 from private.native_tournament_purchases
    where token = p_token and cancel_key = p_cancel_key and owner_id = p_owner
      and event_id = p_event and environment = p_environment and status = 'cancelled'
  ) then return jsonb_build_object('state','ready'); end if;
  return jsonb_build_object('code','conflict');
end;
$$;

notify pgrst, 'reload schema';
commit;
