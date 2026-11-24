begin;
set local lock_timeout='5s';
set local statement_timeout='20s';

-- Keep Google's ledger outside Apple's exactly audited private namespace.
do $$ begin
 if exists(select 1 from pg_namespace where nspname='tenaceiq_google') then raise exception 'Review the existing Google purchase namespace'; end if;
 if not public.apple_purchase_catalog_ready() or not public.account_erasure_catalog_ready() then raise exception 'Existing purchase/deletion checks must pass before adding Google'; end if;
 if not exists(select 1 from pg_proc where oid='public.my_apple_purchase_access()'::regprocedure and prosecdef
   and regexp_replace(prosrc,'\s','','g')='selectpublic.apple_purchase_access((selectauth.uid()));') then raise exception 'Review the existing native access entry point'; end if;
end $$;

create schema tenaceiq_google;
revoke all on schema tenaceiq_google from public,anon,authenticated,service_role;

create table tenaceiq_google.accounts(
 owner_id uuid primary key references auth.users(id) on delete cascade,
 account_id text not null unique default (replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','')) check(account_id~'^[0-9a-f]{64}$'),
 test_enabled boolean not null default false,
 production_enabled boolean not null default false,
 rate_window timestamptz not null default clock_timestamp(),
 rate_count integer not null default 0 check(rate_count between 0 and 20),
 created_at timestamptz not null default clock_timestamp(),
 unique(owner_id,account_id)
);
create table tenaceiq_google.purchases(
 token_hash text primary key check(token_hash~'^[0-9a-f]{64}$'),
 owner_id uuid not null references auth.users(id) on delete cascade,
 account_id text not null,
 environment text not null check(environment in ('Test','Production')),
 product_id text not null check(product_id='com.tenaceiq.app.pro.monthly'),
 subscription_state text not null check(subscription_state in ('SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED','SUBSCRIPTION_STATE_EXPIRED','SUBSCRIPTION_STATE_ON_HOLD','SUBSCRIPTION_STATE_PAUSED','SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED')),
 expires_at timestamptz not null,
 active boolean not null,
 acknowledged boolean not null,
 settled boolean not null default false,
 linked_token_hash text check(linked_token_hash~'^[0-9a-f]{64}$' and linked_token_hash<>token_hash),
 purchased_at timestamptz not null,
 checked_at timestamptz not null default clock_timestamp(),
 constraint purchases_account_owner_fkey foreign key(owner_id,account_id) references tenaceiq_google.accounts(owner_id,account_id) on delete cascade
);
create index google_purchases_owner on tenaceiq_google.purchases(owner_id,expires_at);
create index google_purchases_linked on tenaceiq_google.purchases(linked_token_hash) where linked_token_hash is not null;
create table tenaceiq_google.operations(
 operation_id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 fingerprint text not null check(fingerprint~'^[0-9a-f]{64}$'),
 token_hash text not null check(token_hash~'^[0-9a-f]{64}$'),
 lease uuid not null default gen_random_uuid(),
 lease_until timestamptz not null default clock_timestamp()+interval '90 seconds',
 saved boolean not null default false,
 created_at timestamptz not null default clock_timestamp()
);
create index google_operations_token on tenaceiq_google.operations(token_hash,lease_until);
create index google_operations_cleanup on tenaceiq_google.operations(created_at);
alter table tenaceiq_google.accounts enable row level security;
alter table tenaceiq_google.purchases enable row level security;
alter table tenaceiq_google.operations enable row level security;
revoke all on all tables in schema tenaceiq_google from public,anon,authenticated,service_role;

create function tenaceiq_google.owner_ready(p_owner uuid) returns boolean
language sql stable set search_path='' as $$
 select p_owner is not null and exists(select 1 from auth.users where id=p_owner)
 and exists(select 1 from public.profiles where id=p_owner)
 and not exists(select 1 from public.account_deletion_requests where account_id=p_owner and automatic_consent);
$$;
revoke all on function tenaceiq_google.owner_ready(uuid) from public,anon,authenticated,service_role;

create function public.google_purchase_account(p_owner uuid,p_create boolean default false) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='5s' as $$
declare a tenaceiq_google.accounts;
begin
 perform 1 from auth.users where id=p_owner for key share;
 if not found or not tenaceiq_google.owner_ready(p_owner) then return null; end if;
 if p_create then insert into tenaceiq_google.accounts(owner_id) values(p_owner) on conflict do nothing; end if;
 select * into a from tenaceiq_google.accounts where owner_id=p_owner;
 if not found then return null; end if;
 return jsonb_build_object('ownerId',a.owner_id,'accountId',a.account_id,'testEnabled',a.test_enabled,'productionEnabled',a.production_enabled);
end $$;

create function public.google_purchase_access(p_owner uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('ownerId',p_owner,'proExpiresAt',max(p.expires_at) filter(where p.active and p.expires_at>now()),
 'purchaseBlocked',coalesce(bool_or((p.active and p.expires_at>now()) or p.subscription_state in ('SUBSCRIPTION_STATE_ON_HOLD','SUBSCRIPTION_STATE_PAUSED')),false))
 from tenaceiq_google.purchases p join tenaceiq_google.accounts a on a.owner_id=p.owner_id and a.account_id=p.account_id
 where p.owner_id=p_owner
 and ((p.environment='Test' and a.test_enabled) or (p.environment='Production' and a.production_enabled))
 and tenaceiq_google.owner_ready(p_owner)
 and not exists(select 1 from tenaceiq_google.purchases successor where successor.linked_token_hash=p.token_hash);
$$;
create function public.my_google_purchase_access() returns jsonb
language sql stable security definer set search_path='' as $$select public.google_purchase_access((select auth.uid()));$$;

-- One read for both stores. Apple-specific account/product lookup stays Apple-only.
create function public.native_store_purchase_access(p_owner uuid,p_include_apple boolean default true,p_include_google boolean default true) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare apple jsonb:='{}';g timestamptz;
begin
 if p_include_apple then apple:=public.apple_purchase_access(p_owner); end if;
 if p_include_google then g:=(public.google_purchase_access(p_owner)->>'proExpiresAt')::timestamptz; end if;
 return jsonb_build_object('ownerId',p_owner,
  'playerExpiresAt',greatest((apple->>'playerExpiresAt')::timestamptz,g),
  'captainExpiresAt',greatest((apple->>'captainExpiresAt')::timestamptz,g),
  'proExpiresAt',greatest((apple->>'proExpiresAt')::timestamptz,g));
end $$;
create function public.my_native_store_purchase_access(p_include_apple boolean default true,p_include_google boolean default true) returns jsonb
language sql stable security definer set search_path='' as $$select public.native_store_purchase_access((select auth.uid()),p_include_apple,p_include_google);$$;
-- Preserve the legacy self-only RLS entry point used by player/coach/captain tools.
create or replace function public.my_apple_purchase_access() returns jsonb
language sql stable security definer set search_path='' as $$select public.native_store_purchase_access((select auth.uid()));$$;

create function public.google_purchase_prepare(p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='3s' set statement_timeout='5s' as $$
declare a tenaceiq_google.accounts;profile jsonb;apple jsonb;google jsonb;
begin
 if not public.google_purchase_catalog_ready() then return jsonb_build_object('ok',false,'status',503); end if;
 perform pg_advisory_xact_lock(hashtextextended('google-owner:'||p_owner::text,0));
 perform 1 from auth.users where id=p_owner for key share;
 if not found or not tenaceiq_google.owner_ready(p_owner) then return jsonb_build_object('ok',false,'status',403); end if;
 select * into a from tenaceiq_google.accounts where owner_id=p_owner;
 -- The first fulfillment rollout is license testing only; production needs notification/revocation readiness.
 if not found or not a.test_enabled then return jsonb_build_object('ok',false,'status',403); end if;
 select to_jsonb(p) into profile from public.profiles p where id=p_owner for update;
 apple:=public.apple_purchase_access(p_owner);
 google:=public.google_purchase_access(p_owner);
 if profile->>'role'='admin'
 or exists(select 1 from (values ('coach'),('captain')) tier(name)
   where (profile->>(tier.name||'_subscription_active'))::boolean is true
   and profile->>(tier.name||'_subscription_status') in ('active','trial','trialing')
   and ((profile->>(tier.name||'_access_expires_at')) is null or (profile->>(tier.name||'_access_expires_at'))::timestamptz>now()))
 or (profile->>'stripe_subscription_id' is not null and (profile->>'coach_subscription_status' in ('active','trial','trialing','past_due') or profile->>'captain_subscription_status' in ('active','trial','trialing','past_due')))
 or greatest((apple->>'captainExpiresAt')::timestamptz,(apple->>'proExpiresAt')::timestamptz)>now()
 or (google->>'purchaseBlocked')::boolean
 then return jsonb_build_object('ok',false,'status',409,'code','google_existing_access'); end if;
 return jsonb_build_object('ok',true,'productId','com.tenaceiq.app.pro.monthly','targetId',null,'accountId',a.account_id,'profileId',null);
end $$;

create function public.google_purchase_claim(p_owner uuid,p_operation uuid,p_fingerprint text,p_token_hash text) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='3s' set statement_timeout='5s' as $$
declare a tenaceiq_google.accounts;op tenaceiq_google.operations;
begin
 if not public.google_purchase_catalog_ready() then return jsonb_build_object('ok',false,'status',503); end if;
 if p_operation is null or p_fingerprint is null or p_fingerprint!~'^[0-9a-f]{64}$' or p_token_hash is null or p_token_hash!~'^[0-9a-f]{64}$' then return jsonb_build_object('ok',false,'status',400); end if;
 perform pg_advisory_xact_lock(hashtextextended('google-owner:'||p_owner::text,0));
 perform pg_advisory_xact_lock(hashtextextended('google-token:'||p_token_hash,0));
 perform 1 from auth.users where id=p_owner for key share;
 if not found or not tenaceiq_google.owner_ready(p_owner) then return jsonb_build_object('ok',false,'status',403); end if;
 select * into a from tenaceiq_google.accounts where owner_id=p_owner for update;
 if not found or not a.test_enabled then return jsonb_build_object('ok',false,'status',403); end if;
 select * into op from tenaceiq_google.operations where operation_id=p_operation for update;
 if found and (op.owner_id<>p_owner or op.fingerprint<>p_fingerprint or op.token_hash<>p_token_hash) then return jsonb_build_object('ok',false,'status',409); end if;
 if exists(select 1 from tenaceiq_google.purchases where token_hash=p_token_hash and owner_id<>p_owner)
 or exists(select 1 from tenaceiq_google.operations where token_hash=p_token_hash and lease_until>clock_timestamp()) then return jsonb_build_object('ok',false,'status',409); end if;
 if a.rate_window>clock_timestamp()-interval '15 minutes' and a.rate_count>=20 then return jsonb_build_object('ok',false,'status',429); end if;
 update tenaceiq_google.accounts set rate_count=case when rate_window>clock_timestamp()-interval '15 minutes' then rate_count+1 else 1 end,
 rate_window=case when rate_window>clock_timestamp()-interval '15 minutes' then rate_window else clock_timestamp() end where owner_id=p_owner;
 insert into tenaceiq_google.operations(operation_id,owner_id,fingerprint,token_hash) values(p_operation,p_owner,p_fingerprint,p_token_hash)
 on conflict(operation_id) do update set lease=gen_random_uuid(),lease_until=clock_timestamp()+interval '90 seconds',saved=false returning * into op;
 delete from tenaceiq_google.operations where operation_id in(select operation_id from tenaceiq_google.operations where lease_until<clock_timestamp() and created_at<clock_timestamp()-interval '30 days' limit 25);
 return jsonb_build_object('ok',true,'lease',op.lease,'tokenHash',op.token_hash);
end $$;

create function tenaceiq_google.receipt(p tenaceiq_google.purchases) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('productId',p.product_id,'tokenHash',p.token_hash,'accountId',p.account_id,'profileId',null,
 'delivered',true,'settled',p.settled,'acknowledged',p.acknowledged,'active',p.active and p.expires_at>now()
 and tenaceiq_google.owner_ready(p.owner_id)
 and exists(select 1 from tenaceiq_google.accounts a where a.owner_id=p.owner_id and ((p.environment='Test' and a.test_enabled) or (p.environment='Production' and a.production_enabled)))
 and not exists(select 1 from tenaceiq_google.purchases successor where successor.linked_token_hash=p.token_hash));
$$;
revoke all on function tenaceiq_google.receipt(tenaceiq_google.purchases) from public,anon,authenticated,service_role;

create function public.google_purchase_save(p_owner uuid,p_operation uuid,p_lease uuid,p_evidence jsonb) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='3s' set statement_timeout='5s' as $$
declare op tenaceiq_google.operations;a tenaceiq_google.accounts;old tenaceiq_google.purchases;p tenaceiq_google.purchases;linked text;
begin
 if not public.google_purchase_catalog_ready() then return jsonb_build_object('ok',false,'status',503); end if;
 select * into op from tenaceiq_google.operations where operation_id=p_operation and owner_id=p_owner;
 if not found then return jsonb_build_object('ok',false,'status',409); end if;
 perform pg_advisory_xact_lock(hashtextextended('google-owner:'||p_owner::text,0));
 perform pg_advisory_xact_lock(hashtextextended('google-token:'||op.token_hash,0));
 perform 1 from auth.users where id=p_owner for key share;
 if not found or not tenaceiq_google.owner_ready(p_owner) then return jsonb_build_object('ok',false,'status',403); end if;
 select * into op from tenaceiq_google.operations where operation_id=p_operation and owner_id=p_owner for update;
 if not found or op.lease is distinct from p_lease or op.lease_until<=clock_timestamp() then return jsonb_build_object('ok',false,'status',409); end if;
 select * into a from tenaceiq_google.accounts where owner_id=p_owner;
 if not found or not a.test_enabled then return jsonb_build_object('ok',false,'status',403); end if;
 if p_evidence->>'tokenHash' is distinct from op.token_hash or p_evidence->>'productId' is distinct from 'com.tenaceiq.app.pro.monthly'
 or p_evidence->>'kind' is distinct from 'pro' or p_evidence->>'accountId' is distinct from a.account_id
 or coalesce(p_evidence->>'subscriptionState','') not in ('SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED','SUBSCRIPTION_STATE_EXPIRED','SUBSCRIPTION_STATE_ON_HOLD','SUBSCRIPTION_STATE_PAUSED','SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED')
 or p_evidence->>'environment' is distinct from 'Test' or jsonb_typeof(p_evidence->'profileId') is distinct from 'null'
 or jsonb_typeof(p_evidence->'active') is distinct from 'boolean' or jsonb_typeof(p_evidence->'acknowledged') is distinct from 'boolean'
 or jsonb_typeof(p_evidence->'expiresAt') is distinct from 'number' or jsonb_typeof(p_evidence->'purchasedAt') is distinct from 'number'
 or jsonb_typeof(p_evidence->'consumed') is distinct from 'boolean' or (p_evidence->>'consumed')::boolean
 then return jsonb_build_object('ok',false,'status',400); end if;
 linked:=p_evidence->>'linkedTokenHash';
 if linked is not null and (linked!~'^[0-9a-f]{64}$' or linked=op.token_hash) then return jsonb_build_object('ok',false,'status',400); end if;
 select * into old from tenaceiq_google.purchases where token_hash=op.token_hash for update;
 if found and (old.owner_id<>p_owner or old.account_id<>a.account_id) then return jsonb_build_object('ok',false,'status',409); end if;
 if old.linked_token_hash is not null and linked is not null and linked<>old.linked_token_hash then return jsonb_build_object('ok',false,'status',409); end if;
 if linked is not null and not exists(select 1 from tenaceiq_google.purchases where token_hash=linked and owner_id=p_owner and account_id=a.account_id) then return jsonb_build_object('ok',false,'status',409); end if;
 p.token_hash:=op.token_hash;p.owner_id:=p_owner;p.account_id:=a.account_id;p.environment:='Test';p.product_id:='com.tenaceiq.app.pro.monthly';
 p.subscription_state:=p_evidence->>'subscriptionState';
 p.expires_at:=to_timestamp((p_evidence->>'expiresAt')::double precision/1000);p.purchased_at:=to_timestamp((p_evidence->>'purchasedAt')::double precision/1000);
 if p.purchased_at<'2000-01-01' or p.purchased_at>clock_timestamp()+interval '5 minutes' or p.expires_at<p.purchased_at then return jsonb_build_object('ok',false,'status',400); end if;
 p.active:=(p_evidence->>'active')::boolean;p.acknowledged:=coalesce(old.acknowledged,false) or (p_evidence->>'acknowledged')::boolean;p.settled:=coalesce(old.settled,false);
 p.linked_token_hash:=coalesce(linked,old.linked_token_hash);p.checked_at:=clock_timestamp();
 insert into tenaceiq_google.purchases values(p.*) on conflict(token_hash) do update set
 expires_at=excluded.expires_at,subscription_state=excluded.subscription_state,active=excluded.active,acknowledged=excluded.acknowledged,linked_token_hash=excluded.linked_token_hash,checked_at=excluded.checked_at returning * into p;
 update tenaceiq_google.operations set saved=true where operation_id=p_operation;
 return jsonb_build_object('ok',true,'saved',true,'ownerId',p_owner,'lease',p_lease,'receipt',tenaceiq_google.receipt(p));
end $$;

create function public.google_purchase_settle(p_owner uuid,p_operation uuid,p_lease uuid,p_acknowledged boolean) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='3s' set statement_timeout='5s' as $$
declare op tenaceiq_google.operations;p tenaceiq_google.purchases;
begin
 if not public.google_purchase_catalog_ready() then return jsonb_build_object('ok',false,'status',503); end if;
 select * into op from tenaceiq_google.operations where operation_id=p_operation and owner_id=p_owner;
 if not found then return jsonb_build_object('ok',false,'status',409); end if;
 perform pg_advisory_xact_lock(hashtextextended('google-owner:'||p_owner::text,0));
 perform pg_advisory_xact_lock(hashtextextended('google-token:'||op.token_hash,0));
 perform 1 from auth.users where id=p_owner for key share;
 if not found or not tenaceiq_google.owner_ready(p_owner) then return jsonb_build_object('ok',false,'status',403); end if;
 select * into op from tenaceiq_google.operations where operation_id=p_operation and owner_id=p_owner for update;
 if not found or op.lease is distinct from p_lease or op.lease_until<=clock_timestamp() or not op.saved or p_acknowledged is null then return jsonb_build_object('ok',false,'status',409); end if;
 select * into p from tenaceiq_google.purchases where token_hash=op.token_hash and owner_id=p_owner for update;
 if not found or (not p_acknowledged and p.active and p.expires_at>now()) then return jsonb_build_object('ok',false,'status',409); end if;
 update tenaceiq_google.purchases set settled=true,acknowledged=acknowledged or p_acknowledged where token_hash=op.token_hash and owner_id=p_owner returning * into p;
 if not found then return jsonb_build_object('ok',false,'status',409); end if;
 update tenaceiq_google.operations set lease_until=clock_timestamp() where operation_id=p_operation;
 return jsonb_build_object('ok',true,'receipt',tenaceiq_google.receipt(p));
end $$;
create function public.google_purchase_release(p_owner uuid,p_operation uuid,p_lease uuid) returns void
language sql security definer set search_path='' as $$
 update tenaceiq_google.operations set lease_until=clock_timestamp() where operation_id=p_operation and owner_id=p_owner and lease=p_lease;
$$;

-- Structural audit is explicit and independent of Apple's three-table catalog.
create function public.google_purchase_catalog_ready() returns boolean
language sql stable security definer set search_path='' as $$
 with expected(t,c,d,n) as (values
 ('accounts','owner_id','uuid','NO'),('accounts','account_id','text','NO'),('accounts','test_enabled','boolean','NO'),('accounts','production_enabled','boolean','NO'),('accounts','rate_window','timestamp with time zone','NO'),('accounts','rate_count','integer','NO'),('accounts','created_at','timestamp with time zone','NO'),
 ('purchases','token_hash','text','NO'),('purchases','owner_id','uuid','NO'),('purchases','account_id','text','NO'),('purchases','environment','text','NO'),('purchases','product_id','text','NO'),('purchases','subscription_state','text','NO'),('purchases','expires_at','timestamp with time zone','NO'),('purchases','active','boolean','NO'),('purchases','acknowledged','boolean','NO'),('purchases','settled','boolean','NO'),('purchases','linked_token_hash','text','YES'),('purchases','purchased_at','timestamp with time zone','NO'),('purchases','checked_at','timestamp with time zone','NO'),
 ('operations','operation_id','uuid','NO'),('operations','owner_id','uuid','NO'),('operations','fingerprint','text','NO'),('operations','token_hash','text','NO'),('operations','lease','uuid','NO'),('operations','lease_until','timestamp with time zone','NO'),('operations','saved','boolean','NO'),('operations','created_at','timestamp with time zone','NO')),
 actual as (select table_name t,column_name c,data_type d,is_nullable n from information_schema.columns where table_schema='tenaceiq_google')
 select not exists(select 1 from expected e full join actual a using(t,c) where e.d is distinct from a.d or e.n is distinct from a.n)
 and (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='tenaceiq_google' and c.relkind='r' and c.relrowsecurity and c.relpersistence='p')=3
 and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join (values('anon'),('authenticated'),('service_role')) roles(role) where n.nspname='tenaceiq_google' and c.relkind='r' and has_table_privilege(roles.role,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
 and not exists(select 1 from (values('anon'),('authenticated'),('service_role')) roles(role) where has_schema_privilege(roles.role,'tenaceiq_google','USAGE,CREATE'))
 and (select count(*) from pg_constraint f join pg_class c on c.oid=f.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='tenaceiq_google' and f.contype='f' and f.confrelid='auth.users'::regclass and pg_get_constraintdef(f.oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE')=3
 and exists(select 1 from pg_constraint where conrelid='tenaceiq_google.purchases'::regclass and conname='purchases_account_owner_fkey' and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id, account_id) REFERENCES tenaceiq_google.accounts(owner_id, account_id) ON DELETE CASCADE')
 and not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='tenaceiq_google' and not t.tgisinternal)
 and not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('google_purchase_account','google_purchase_access','native_store_purchase_access','google_purchase_prepare','google_purchase_claim','google_purchase_save','google_purchase_settle','google_purchase_release','google_purchase_catalog_ready') and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE')))
 and not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('google_purchase_account','google_purchase_access','native_store_purchase_access','google_purchase_prepare','google_purchase_claim','google_purchase_save','google_purchase_settle','google_purchase_release','google_purchase_catalog_ready','my_google_purchase_access','my_native_store_purchase_access') and (not p.prosecdef or not coalesce(p.proconfig@>array['search_path=""'],false)))
 and has_function_privilege('authenticated','public.my_google_purchase_access()','EXECUTE') and not has_function_privilege('anon','public.my_google_purchase_access()','EXECUTE')
 and has_function_privilege('authenticated','public.my_native_store_purchase_access(boolean,boolean)','EXECUTE') and not has_function_privilege('anon','public.my_native_store_purchase_access(boolean,boolean)','EXECUTE');
$$;

revoke all on function public.google_purchase_account(uuid,boolean),public.google_purchase_access(uuid),public.native_store_purchase_access(uuid,boolean,boolean),public.google_purchase_prepare(uuid),public.google_purchase_claim(uuid,uuid,text,text),public.google_purchase_save(uuid,uuid,uuid,jsonb),public.google_purchase_settle(uuid,uuid,uuid,boolean),public.google_purchase_release(uuid,uuid,uuid),public.google_purchase_catalog_ready() from public,anon,authenticated;
grant execute on function public.google_purchase_account(uuid,boolean),public.google_purchase_access(uuid),public.native_store_purchase_access(uuid,boolean,boolean),public.google_purchase_prepare(uuid),public.google_purchase_claim(uuid,uuid,text,text),public.google_purchase_save(uuid,uuid,uuid,jsonb),public.google_purchase_settle(uuid,uuid,uuid,boolean),public.google_purchase_release(uuid,uuid,uuid),public.google_purchase_catalog_ready() to service_role;
revoke all on function public.my_google_purchase_access(),public.my_native_store_purchase_access(boolean,boolean) from public,anon,service_role;
grant execute on function public.my_google_purchase_access(),public.my_native_store_purchase_access(boolean,boolean) to authenticated;

-- Preserve the exact existing deletion audit and its grants, adding Google's cascade/privacy checks.
do $guard$
declare source text;definition text;wrapped text;
begin
 if not public.google_purchase_catalog_ready() then raise exception 'Google purchase catalog did not validate'; end if;
 select p.prosrc into source from pg_proc p join pg_language l on l.oid=p.prolang
 where p.oid='public.account_erasure_catalog_ready()'::regprocedure and p.prosecdef and l.lanname='sql' and p.prorettype='boolean'::regtype;
 if source is null or not public.account_erasure_catalog_ready() then raise exception 'Review the existing deletion audit'; end if;
 definition:=pg_get_functiondef('public.account_erasure_catalog_ready()'::regprocedure);
 if source='' or (length(definition)-length(replace(definition,source,'')))<>length(source) then raise exception 'Deletion audit source is ambiguous'; end if;
 wrapped:='select public.google_purchase_catalog_ready() and ('||regexp_replace(source,';\s*$','')||E'\n)';
 execute replace(definition,source,wrapped);
 if not public.account_erasure_catalog_ready() then raise exception 'Combined deletion audit did not validate'; end if;
end $guard$;
notify pgrst,'reload schema';
commit;
