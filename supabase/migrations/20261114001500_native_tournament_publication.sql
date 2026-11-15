begin;
set local lock_timeout = '5s';

-- The prefix is reserved for tournaments created by a verified publication.
do $$ begin
  if exists (select 1 from public.tiq_tournaments where id like 'tiq-native-%' or event_id like 'tiq-native-%') then
    raise exception 'Native tournament IDs are already in use';
  end if;
end $$;

create policy "Native tournament IDs are reserved" on public.tiq_tournaments
as restrictive for insert to anon, authenticated
with check (id not like 'tiq-native-%' and coalesce(event_id, '') not like 'tiq-native-%');
create policy "Native tournaments use scoped updates" on public.tiq_tournaments
as restrictive for update to anon, authenticated
using (id not like 'tiq-native-%' and coalesce(event_id, '') not like 'tiq-native-%')
with check (id not like 'tiq-native-%' and coalesce(event_id, '') not like 'tiq-native-%');
create policy "Native tournaments use scoped deletion" on public.tiq_tournaments
as restrictive for delete to anon, authenticated
using (id not like 'tiq-native-%' and coalesce(event_id, '') not like 'tiq-native-%');

-- A newly opened native division can collect and approve entries before it has a playable draw.
alter table public.tiq_tournaments drop constraint tiq_tournaments_entrants_check;
alter table public.tiq_tournaments add constraint tiq_tournaments_entrants_check check (
  (is_event and cardinality(entrants) = 0)
  or (not is_event and (
    status = 'draft' or cardinality(entrants) >= 2
    or (id like 'tiq-native-division-%' and coalesce(event_id, '') like 'tiq-native-event-%'
        and status = 'open' and schedule = '{}'::jsonb and results = '{}'::jsonb)
  ))
);

create table private.native_tournament_purchases (
  token uuid primary key,
  cancel_key uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null,
  environment text not null check (environment in ('Sandbox', 'Production')),
  settings_revision uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  status text not null default 'pending' check (status in ('pending', 'cancelled', 'paid', 'refunded')),
  transaction_id text check (transaction_id ~ '^[0-9]{1,32}$'),
  signed_at timestamptz,
  public_id text,
  unique (environment, transaction_id),
  foreign key (owner_id, event_id) references private.native_tournament_setups(owner_id, id) on delete cascade
);
create unique index native_tournament_one_checkout
  on private.native_tournament_purchases (owner_id, event_id, environment) where status <> 'cancelled';
alter table private.native_tournament_purchases enable row level security;
revoke all on private.native_tournament_purchases from public, anon, authenticated, service_role;

create function private.native_tournament_checkout_json(purchase private.native_tournament_purchases)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('state', purchase.status, 'token', purchase.token, 'publicId', purchase.public_id);
$$;
revoke all on function private.native_tournament_checkout_json(private.native_tournament_purchases)
  from public, anon, authenticated, service_role;

create function public.native_tournament_checkout(
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
    or p_action is null or p_action not in ('status','prepare','cancel') then
    return jsonb_build_object('code','invalid');
  end if;
  perform 1 from auth.users where id = p_owner for key share;
  if not found or exists (
    select 1 from public.account_deletion_requests request where request.account_id = p_owner and request.automatic_consent
  ) then return jsonb_build_object('code','forbidden'); end if;
  select * into setup from private.native_tournament_setups where owner_id = p_owner and id = p_event for update;
  if not found then return jsonb_build_object('code','missing'); end if;
  select * into purchase from private.native_tournament_purchases
  where owner_id = p_owner and event_id = p_event and environment = p_environment and status <> 'cancelled' for update;
  if found then
    if p_action = 'cancel' and purchase.token = p_token and purchase.cancel_key = p_cancel_key and purchase.status = 'pending' then
      update private.native_tournament_purchases set status = 'cancelled' where token = p_token;
      return jsonb_build_object('state','ready');
    end if;
    return private.native_tournament_checkout_json(purchase);
  end if;
  if setup.settings_revision is null
    or (setup.settings->>'registrationClosesOn')::date < (clock_timestamp() at time zone (setup.settings->>'timeZone'))::date then
    return jsonb_build_object('state','setup');
  end if;
  if p_action <> 'prepare' then return jsonb_build_object('state','ready'); end if;
  if p_token is null or p_cancel_key is null then return jsonb_build_object('code','invalid'); end if;
  if setup.settings_revision is distinct from p_expected then return jsonb_build_object('code','stale'); end if;
  insert into private.native_tournament_purchases (token, cancel_key, owner_id, event_id, environment, settings_revision)
  values (p_token, p_cancel_key, p_owner, p_event, p_environment, setup.settings_revision) returning * into purchase;
  return private.native_tournament_checkout_json(purchase)||jsonb_build_object('start',true);
end;
$$;

create function public.complete_native_tournament_purchase(
  p_actor uuid, p_token uuid, p_environment text, p_transaction text, p_signed_at timestamptz, p_revoked boolean,
  p_event uuid default null
)
returns jsonb language plpgsql security definer set search_path = ''
set lock_timeout = '3s' set statement_timeout = '8s' as $$
declare
  setup private.native_tournament_setups;
  purchase private.native_tournament_purchases;
  details jsonb;
  event_key text;
begin
  if p_token is null or p_environment is null or p_environment not in ('Sandbox','Production')
    or p_transaction is null or p_transaction !~ '^[0-9]{1,32}$' or p_signed_at is null or p_revoked is null then
    return jsonb_build_object('code','invalid');
  end if;
  select * into purchase from private.native_tournament_purchases where token = p_token and environment = p_environment;
  if not found or (p_actor is not null and p_actor <> purchase.owner_id)
    or (p_event is not null and p_event <> purchase.event_id) then return jsonb_build_object('code','missing'); end if;
  perform 1 from auth.users where id = purchase.owner_id for key share;
  if not found or exists (
    select 1 from public.account_deletion_requests request where request.account_id = purchase.owner_id and request.automatic_consent
  ) then return jsonb_build_object('code','forbidden'); end if;
  select * into setup from private.native_tournament_setups where owner_id = purchase.owner_id and id = purchase.event_id for update;
  if not found then return jsonb_build_object('code','missing'); end if;
  select * into purchase from private.native_tournament_purchases where token = p_token for update;
  if purchase.status = 'cancelled' or (purchase.transaction_id is not null and purchase.transaction_id <> p_transaction) then
    return jsonb_build_object('code','conflict');
  end if;
  if purchase.signed_at is not null and (p_signed_at < purchase.signed_at
    or (p_signed_at = purchase.signed_at and purchase.status = 'refunded' and not p_revoked)) then
    return private.native_tournament_checkout_json(purchase);
  end if;
  if purchase.status = 'pending' and setup.settings_revision is distinct from purchase.settings_revision then
    return jsonb_build_object('code','conflict');
  end if;

  event_key := purchase.public_id;
  -- A sandbox receipt verifies checkout without placing a test event in the public directory.
  if not p_revoked and event_key is null and p_environment = 'Production' then
    event_key := 'tiq-native-event-' || gen_random_uuid()::text;
    details := jsonb_build_object('venueName',setup.draft->>'venue',
      'timeZone',setup.settings->>'timeZone','registrationClosesOn',setup.settings->>'registrationClosesOn');
    insert into public.tiq_tournaments (id,name,format,entrant_type,status,starts_on,location_label,is_public,
      is_event,created_by_user_id,updated_by_user_id,event_details)
    values (event_key,setup.draft->>'name','single_elimination','players','open',setup.draft->>'date',
      setup.draft->>'venue',true,true,purchase.owner_id,purchase.owner_id,details);
    insert into public.tiq_tournaments (id,event_id,name,format,entrant_type,status,starts_on,location_label,is_public,
      is_event,created_by_user_id,updated_by_user_id,event_details)
    select 'tiq-native-division-' || gen_random_uuid()::text,event_key,division->>'name',division->>'format',
      case when division->>'discipline' = 'doubles' then 'teams' else 'players' end,
      'open',setup.draft->>'date',setup.draft->>'venue',true,false,purchase.owner_id,purchase.owner_id,details
    from jsonb_array_elements(setup.settings->'divisions') division;
  end if;
  if event_key is not null then
    update public.tiq_tournaments set is_public = not p_revoked where id = event_key and is_public = p_revoked;
  end if;
  update private.native_tournament_purchases set
    status = case when p_revoked then 'refunded' else 'paid' end,
    transaction_id = p_transaction,signed_at = p_signed_at,public_id = event_key
  where token = p_token returning * into purchase;
  return private.native_tournament_checkout_json(purchase);
end;
$$;

-- Snapshot settings stay fixed from Apple confirmation through verified publication.
create function private.lock_tournament_settings_during_checkout()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.settings_revision is distinct from new.settings_revision and exists (
    select 1 from private.native_tournament_purchases payment where payment.owner_id = old.owner_id
      and payment.event_id = old.id and (payment.status = 'pending'
        or payment.environment = 'Production' and payment.status in ('paid','refunded'))
  ) then raise exception 'Tournament settings are locked during publication' using errcode = '23514'; end if;
  return new;
end;
$$;
revoke all on function private.lock_tournament_settings_during_checkout() from public, anon, authenticated, service_role;
create trigger lock_tournament_settings_during_checkout before update of settings_revision on private.native_tournament_setups
for each row execute function private.lock_tournament_settings_during_checkout();

revoke all on function public.native_tournament_checkout(uuid,uuid,text,text,uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.complete_native_tournament_purchase(uuid,uuid,text,text,timestamptz,boolean,uuid) from public,anon,authenticated,service_role;
grant execute on function public.native_tournament_checkout(uuid,uuid,text,text,uuid,uuid,uuid) to service_role;
grant execute on function public.complete_native_tournament_purchase(uuid,uuid,text,text,timestamptz,boolean,uuid) to service_role;

notify pgrst, 'reload schema';
commit;
