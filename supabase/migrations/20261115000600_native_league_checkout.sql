begin;
set local lock_timeout = '5s';

-- Only a verified native publication may use this ID space. Other leagues keep their existing rules.
do $$ begin
  if exists (select 1 from public.tiq_leagues where id like 'tiq-native-league-%') then
    raise exception 'Native league IDs are already in use';
  end if;
end $$;
create policy "Native league IDs are reserved" on public.tiq_leagues
  as restrictive for insert to anon, authenticated with check (id not like 'tiq-native-league-%');
create policy "Native leagues require scoped updates" on public.tiq_leagues
  as restrictive for update to anon, authenticated
  using (id not like 'tiq-native-league-%') with check (id not like 'tiq-native-league-%');
create policy "Native leagues require scoped deletion" on public.tiq_leagues
  as restrictive for delete to anon, authenticated using (id not like 'tiq-native-league-%');

alter table public.tiq_leagues drop constraint tiq_leagues_team_vs_individual_check;
alter table public.tiq_leagues add constraint tiq_leagues_team_vs_individual_check check (
  season_status = 'draft'
  or (id like 'tiq-native-league-%' and cardinality(teams) = 0 and cardinality(players) = 0)
  or (league_format = 'team' and cardinality(teams) >= 1)
  or (league_format = 'individual' and cardinality(players) >= 1)
);

create table private.native_league_purchases (
  token uuid primary key,
  cancel_key uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  draft_revision uuid not null,
  draft_snapshot jsonb not null,
  environment text not null check (environment in ('Sandbox','Production')),
  state text not null default 'pending' check (state in ('pending', 'cancelled', 'paid', 'refunded')),
  transaction_id text check (transaction_id ~ '^[0-9]{1,32}$'),
  signed_at timestamptz,
  public_id text unique,
  unique (environment, transaction_id),
  check (environment = 'Production' or public_id is null)
);
create unique index native_league_one_checkout
  on private.native_league_purchases (owner_id, draft_revision, environment) where state <> 'cancelled';
alter table private.native_league_purchases enable row level security;
revoke all on private.native_league_purchases from public, anon, authenticated, service_role;

create function private.keep_native_league_checkout_draft()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from private.native_league_purchases purchase
    where purchase.owner_id = old.owner_id and purchase.draft_revision = old.revision and purchase.state = 'pending'
  ) then
    raise exception 'native_league_checkout_pending';
  end if;
  if exists (
    select 1 from private.native_league_purchases purchase
    where purchase.owner_id = new.owner_id and purchase.draft_revision = new.revision and purchase.state <> 'cancelled'
  ) then
    raise exception 'native_league_checkout_revision_used';
  end if;
  return new;
end;
$$;
revoke all on function private.keep_native_league_checkout_draft() from public, anon, authenticated, service_role;
create trigger keep_native_league_checkout_draft
  before update of revision on private.native_league_drafts
  for each row when (old.revision is distinct from new.revision)
  execute function private.keep_native_league_checkout_draft();

create function public.native_league_checkout(
  p_owner uuid, p_draft uuid, p_environment text, p_action text, p_token uuid default null, p_cancel_key uuid default null
)
returns jsonb language plpgsql security definer set search_path = ''
set lock_timeout = '3s' set statement_timeout = '5s' as $$
declare
  purchase private.native_league_purchases;
  details jsonb;
begin
  if p_owner is null or p_draft is null or p_environment is null or p_environment not in ('Sandbox','Production')
    or p_action is null or p_action not in ('status', 'prepare', 'cancel')
    or (p_action <> 'status' and (p_token is null or p_cancel_key is null)) then
    return jsonb_build_object('code', 'invalid');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('native-league-draft:' || p_owner::text, 0));
  perform 1 from auth.users where id = p_owner for key share;
  if not found or exists (
    select 1 from public.account_deletion_requests where account_id = p_owner and automatic_consent
  ) or (p_environment = 'Sandbox' and (public.apple_purchase_account(p_owner)->>'sandboxEnabled') is distinct from 'true') then
    return jsonb_build_object('code', 'forbidden');
  end if;
  select draft into details from private.native_league_drafts where owner_id = p_owner and revision = p_draft;

  if p_action = 'cancel' then
    update private.native_league_purchases set state = 'cancelled'
    where token = p_token and cancel_key = p_cancel_key and owner_id = p_owner
      and draft_revision = p_draft and environment = p_environment and state = 'pending';
    if not found and details is not null then
      -- Record a cancellation that arrived ahead of a delayed prepare.
      insert into private.native_league_purchases(token, cancel_key, owner_id, draft_revision, draft_snapshot, environment, state)
      values (p_token, p_cancel_key, p_owner, p_draft, details, p_environment, 'cancelled') on conflict (token) do nothing;
    end if;
  end if;

  select * into purchase from private.native_league_purchases
  where owner_id = p_owner and draft_revision = p_draft and environment = p_environment and state <> 'cancelled';
  if found then return jsonb_build_object('state', purchase.state, 'token', purchase.token, 'publicId', purchase.public_id); end if;
  if details is null then return jsonb_build_object('code', 'stale'); end if;
  if (details->>'startsOn')::date + ((details->>'weeks')::int * 7 - 1) <
    (now() at time zone (details->>'timeZone'))::date then return jsonb_build_object('state', 'setup'); end if;
  if p_action <> 'prepare' then return jsonb_build_object('state', 'ready'); end if;
  insert into private.native_league_purchases(token, cancel_key, owner_id, draft_revision, draft_snapshot, environment)
  values (p_token, p_cancel_key, p_owner, p_draft, details, p_environment) on conflict (token) do nothing returning * into purchase;
  if found then return jsonb_build_object('state', 'pending', 'token', purchase.token, 'start', true); end if;
  if exists (
    select 1 from private.native_league_purchases where token = p_token and cancel_key = p_cancel_key
      and owner_id = p_owner and draft_revision = p_draft and environment = p_environment and state = 'cancelled'
  ) then return jsonb_build_object('state', 'ready'); end if;
  return jsonb_build_object('code', 'conflict');
end;
$$;

create function public.complete_native_league_purchase(
  p_actor uuid, p_draft uuid, p_token uuid, p_environment text, p_transaction text, p_signed_at timestamptz, p_revoked boolean
)
returns jsonb language plpgsql security definer set search_path = ''
set lock_timeout = '3s' set statement_timeout = '5s' as $$
declare
  purchase private.native_league_purchases;
  details jsonb;
  league_id text;
  first_day date;
  last_day date;
begin
  if p_token is null or p_transaction is null or p_transaction !~ '^[0-9]{1,32}$'
    or p_signed_at is null or p_revoked is null then return jsonb_build_object('code', 'invalid'); end if;
  select * into purchase from private.native_league_purchases where token = p_token and environment = p_environment;
  if not found or (p_actor is not null and p_actor <> purchase.owner_id)
    or (p_draft is not null and p_draft <> purchase.draft_revision) then return jsonb_build_object('code', 'missing'); end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('native-league-draft:' || purchase.owner_id::text, 0));
  perform 1 from auth.users where id = purchase.owner_id for key share;
  if not found or exists (
    select 1 from public.account_deletion_requests request
    where request.account_id = purchase.owner_id and request.automatic_consent
  ) then return jsonb_build_object('code', 'forbidden'); end if;
  select * into purchase from private.native_league_purchases where token = p_token for update;
  if not found then return jsonb_build_object('code', 'missing'); end if;
  if purchase.state = 'cancelled' or (purchase.transaction_id is not null and purchase.transaction_id <> p_transaction) then
    return jsonb_build_object('code', 'conflict');
  end if;

  if purchase.signed_at is null or p_signed_at > purchase.signed_at
     or (p_signed_at = purchase.signed_at and p_revoked and purchase.state = 'paid') then
    league_id := purchase.public_id;
    if purchase.environment = 'Production' and league_id is null and not p_revoked then
      details := purchase.draft_snapshot;
      league_id := 'tiq-native-league-' || gen_random_uuid()::text;
      first_day := (details->>'startsOn')::date;
      last_day := first_day + ((details->>'weeks')::int * 7 - 1);
      insert into public.tiq_leagues (id, league_name, league_format, season_label, season_status,
        location_label, starts_on, ends_on, schedule_time_zone, max_weeks, is_public, created_by_user_id, updated_by_user_id)
      values (league_id, details->>'name', details->>'format', to_char(first_day, 'FMMonth YYYY'),
        case when last_day < (now() at time zone (details->>'timeZone'))::date then 'completed' else 'active' end,
        details->>'location', first_day, last_day, details->>'timeZone', (details->>'weeks')::int,
        true, purchase.owner_id, purchase.owner_id);
    elsif league_id is not null then
      update public.tiq_leagues set is_public = not p_revoked
        where id = league_id and is_public = p_revoked;
    end if;
    update private.native_league_purchases
    set state = case when p_revoked then 'refunded' else 'paid' end,
      transaction_id = p_transaction, signed_at = p_signed_at, public_id = league_id
    where token = p_token returning * into purchase;
  end if;
  return jsonb_build_object('state', purchase.state, 'token', purchase.token, 'publicId', purchase.public_id);
end;
$$;

revoke all on function public.native_league_checkout(uuid,uuid,text,text,uuid,uuid) from public, anon, authenticated, service_role;
revoke all on function public.complete_native_league_purchase(uuid,uuid,uuid,text,text,timestamptz,boolean) from public, anon, authenticated, service_role;
grant execute on function public.native_league_checkout(uuid,uuid,text,text,uuid,uuid) to service_role;
grant execute on function public.complete_native_league_purchase(uuid,uuid,uuid,text,text,timestamptz,boolean) to service_role;

notify pgrst, 'reload schema';
commit;
