begin;
do $$ begin
 if exists(select 1 from pg_catalog.pg_namespace n where n.nspname='tenaceiq_private' and (exists(select 1 from pg_catalog.pg_class c where c.relnamespace=n.oid) or exists(select 1 from pg_catalog.pg_proc p where p.pronamespace=n.oid))) then raise exception 'Private purchase namespace is not empty; review before migration'; end if;
end $$;
-- Purchase data is outside the exposed public schema. No existing profile grant is written.
create schema if not exists tenaceiq_private;
revoke all on schema tenaceiq_private from public,anon,authenticated;
grant usage on schema tenaceiq_private to service_role;
create table tenaceiq_private.apple_purchase_accounts(
 owner_id uuid primary key references auth.users(id) on delete cascade,
 account_token uuid not null unique default gen_random_uuid(),
 sandbox_enabled boolean not null default false,
 created_at timestamptz not null default clock_timestamp()
);
create table tenaceiq_private.apple_memberships(
 environment text not null check(environment in ('Production','Sandbox')),
 original_transaction_id text not null check(original_transaction_id~'^[0-9]{1,32}$'),
 owner_id uuid not null references auth.users(id) on delete cascade,
 account_token uuid not null references tenaceiq_private.apple_purchase_accounts(account_token) on delete cascade,
 transaction_id text not null check(transaction_id~'^[0-9]{1,32}$'),
 product_id text not null check(product_id in ('com.tenaceiq.app.player.monthly','com.tenaceiq.app.captain.monthly')),
 expires_at timestamptz not null,
 signed_at timestamptz not null,
 status integer not null check(status between 1 and 5),
 revoked boolean not null,
 upgraded boolean not null,
 checked_at timestamptz not null default clock_timestamp(),
 primary key(environment,original_transaction_id)
);
create index apple_memberships_owner on tenaceiq_private.apple_memberships(owner_id,expires_at);
create table tenaceiq_private.apple_purchase_operations(
 operation_id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('client','notification')),
 fingerprint text not null check(fingerprint~'^[0-9a-f]{64}$'),
 lease uuid not null default gen_random_uuid(),
 lease_until timestamptz not null default clock_timestamp()+interval '60 seconds',
 receipt jsonb,
 created_at timestamptz not null default clock_timestamp()
);
create index apple_purchase_operations_owner on tenaceiq_private.apple_purchase_operations(owner_id,created_at);
alter table tenaceiq_private.apple_purchase_accounts enable row level security;
alter table tenaceiq_private.apple_memberships enable row level security;
alter table tenaceiq_private.apple_purchase_operations enable row level security;
revoke all on all tables in schema tenaceiq_private from public,anon,authenticated;
grant select,insert,update,delete on tenaceiq_private.apple_purchase_accounts,tenaceiq_private.apple_memberships,tenaceiq_private.apple_purchase_operations to service_role;

create function public.apple_purchase_account(p_owner uuid,p_create boolean default false,p_token uuid default null) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='5s' as $$
declare a tenaceiq_private.apple_purchase_accounts%rowtype;
begin
 if p_owner is null and p_token is not null then select * into a from tenaceiq_private.apple_purchase_accounts where account_token=p_token;
 else
  if not exists(select 1 from public.profiles where id=p_owner) or exists(select 1 from public.account_deletion_requests where account_id=p_owner and automatic_consent) then return null; end if;
  if p_create then insert into tenaceiq_private.apple_purchase_accounts(owner_id) values(p_owner) on conflict do nothing; end if;
  select * into a from tenaceiq_private.apple_purchase_accounts where owner_id=p_owner;
 end if;
 if a.owner_id is null or exists(select 1 from public.account_deletion_requests where account_id=a.owner_id and automatic_consent) then return null; end if;
 return jsonb_build_object('ownerId',a.owner_id,'accountToken',a.account_token,'sandboxEnabled',a.sandbox_enabled);
end;$$;
revoke all on function public.apple_purchase_account(uuid,boolean,uuid) from public,anon,authenticated;
grant execute on function public.apple_purchase_account(uuid,boolean,uuid) to service_role;

create function public.apple_purchase_claim(p_owner uuid,p_operation uuid,p_fingerprint text,p_kind text default 'client') returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='5s' set lock_timeout='3s' as $$
declare op tenaceiq_private.apple_purchase_operations%rowtype;
begin
 if p_kind not in ('client','notification') or p_owner is null or p_operation is null or p_fingerprint is null or p_fingerprint!~'^[0-9a-f]{64}$' or public.apple_purchase_account(p_owner) is null then return jsonb_build_object('ok',false,'status',403); end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('apple:'||p_owner::text,0));
 select * into op from tenaceiq_private.apple_purchase_operations where operation_id=p_operation for update;
 if found then
  if op.owner_id<>p_owner or op.fingerprint<>p_fingerprint or op.kind<>p_kind then return jsonb_build_object('ok',false,'status',409); end if;
  if op.receipt is not null then return jsonb_build_object('ok',true,'receipt',op.receipt); end if;
  if op.lease_until>clock_timestamp() then return jsonb_build_object('ok',false,'status',409); end if;
  update tenaceiq_private.apple_purchase_operations set lease=gen_random_uuid(),lease_until=clock_timestamp()+interval '60 seconds' where operation_id=p_operation returning * into op;
 else
  if p_kind='client' and (select count(*) from tenaceiq_private.apple_purchase_operations where owner_id=p_owner and kind='client' and created_at>clock_timestamp()-interval '15 minutes')>=12 then return jsonb_build_object('ok',false,'status',429); end if;
  insert into tenaceiq_private.apple_purchase_operations(operation_id,owner_id,fingerprint,kind) values(p_operation,p_owner,p_fingerprint,p_kind) returning * into op;
 end if;
 delete from tenaceiq_private.apple_purchase_operations where operation_id in(select operation_id from tenaceiq_private.apple_purchase_operations where created_at<clock_timestamp()-interval '30 days' limit 25);
 return jsonb_build_object('ok',true,'lease',op.lease);
end;$$;
revoke all on function public.apple_purchase_claim(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.apple_purchase_claim(uuid,uuid,text,text) to service_role;

create function public.apple_purchase_commit(p_owner uuid,p_operation uuid,p_lease uuid,p_membership jsonb,p_acknowledged text) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='5s' set lock_timeout='3s' as $$
declare op tenaceiq_private.apple_purchase_operations%rowtype; a tenaceiq_private.apple_purchase_accounts%rowtype; old tenaceiq_private.apple_memberships%rowtype; m tenaceiq_private.apple_memberships%rowtype; v_receipt jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('apple:'||p_owner::text,0));
 select * into op from tenaceiq_private.apple_purchase_operations where operation_id=p_operation and owner_id=p_owner for update;
 if not found or op.lease<>p_lease then return jsonb_build_object('ok',false,'status',409); end if;
 if op.receipt is not null then return jsonb_build_object('ok',true,'receipt',op.receipt); end if;
 if op.lease_until<=clock_timestamp() then return jsonb_build_object('ok',false,'status',409); end if;
 select * into a from tenaceiq_private.apple_purchase_accounts where owner_id=p_owner;
 if a.owner_id is null or public.apple_purchase_account(p_owner) is null or a.account_token::text<>p_membership->>'appAccountToken' or p_membership->>'environment'='Sandbox' and not a.sandbox_enabled then return jsonb_build_object('ok',false,'status',403); end if;
 if p_acknowledged is null or p_acknowledged!~'^[0-9]{1,32}$' or jsonb_typeof(p_membership->'expiresAt')<>'number' or jsonb_typeof(p_membership->'signedAt')<>'number' or jsonb_typeof(p_membership->'revoked')<>'boolean' or jsonb_typeof(p_membership->'upgraded')<>'boolean' then return jsonb_build_object('ok',false,'status',400); end if;
 m.environment:=p_membership->>'environment';m.original_transaction_id:=p_membership->>'originalTransactionId';m.transaction_id:=p_membership->>'transactionId';m.owner_id:=p_owner;m.account_token:=a.account_token;m.product_id:=p_membership->>'productId';m.status:=(p_membership->>'status')::integer;m.expires_at:=to_timestamp((p_membership->>'expiresAt')::double precision/1000);m.signed_at:=to_timestamp((p_membership->>'signedAt')::double precision/1000);m.revoked:=(p_membership->>'revoked')::boolean;m.upgraded:=(p_membership->>'upgraded')::boolean;
 if m.signed_at>clock_timestamp()+interval '5 minutes' or m.signed_at<'2000-01-01' or m.expires_at<'2000-01-01' then return jsonb_build_object('ok',false,'status',400); end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('apple-origin:'||m.environment||':'||m.original_transaction_id,0));
 select * into old from tenaceiq_private.apple_memberships where environment=m.environment and original_transaction_id=m.original_transaction_id for update;
 if found and (old.owner_id<>p_owner or old.account_token<>a.account_token) then return jsonb_build_object('ok',false,'status',409); end if;
 -- Equal signed payloads may carry a newly observed expired/revoked status. Never resurrect a restrictive equal-date observation.
 if old.owner_id is null or m.signed_at>old.signed_at or m.signed_at=old.signed_at and (m.status<>1 or m.revoked or m.upgraded) then
  insert into tenaceiq_private.apple_memberships values(m.environment,m.original_transaction_id,m.owner_id,m.account_token,m.transaction_id,m.product_id,m.expires_at,m.signed_at,m.status,m.revoked,m.upgraded,clock_timestamp())
  on conflict(environment,original_transaction_id) do update set transaction_id=excluded.transaction_id,product_id=excluded.product_id,expires_at=excluded.expires_at,signed_at=excluded.signed_at,status=excluded.status,revoked=excluded.revoked,upgraded=excluded.upgraded,checked_at=excluded.checked_at;
 end if;
 v_receipt:=jsonb_build_object('transactionId',p_acknowledged,'accountToken',a.account_token,'environment',m.environment);
 update tenaceiq_private.apple_purchase_operations set receipt=v_receipt,lease_until=clock_timestamp() where operation_id=p_operation;
 return jsonb_build_object('ok',true,'receipt',v_receipt);
end;$$;
revoke all on function public.apple_purchase_commit(uuid,uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.apple_purchase_commit(uuid,uuid,uuid,jsonb,text) to service_role;

create function public.apple_purchase_access(p_owner uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('ownerId',p_owner,'playerExpiresAt',max(m.expires_at),'captainExpiresAt',max(m.expires_at) filter(where m.product_id='com.tenaceiq.app.captain.monthly'))
 from tenaceiq_private.apple_memberships m join tenaceiq_private.apple_purchase_accounts a on a.owner_id=m.owner_id and a.account_token=m.account_token
 where m.owner_id=p_owner and m.status=1 and not m.revoked and not m.upgraded and m.expires_at>now()
 and (m.environment='Production' or a.sandbox_enabled)
 and not exists(select 1 from public.account_deletion_requests where account_id=p_owner and automatic_consent);
$$;
revoke all on function public.apple_purchase_access(uuid) from public,anon,authenticated;
grant execute on function public.apple_purchase_access(uuid) to service_role;
create function public.my_apple_purchase_access() returns jsonb
language sql stable security definer set search_path='' as $$select public.apple_purchase_access((select auth.uid()));$$;
revoke all on function public.my_apple_purchase_access() from public,anon;
grant execute on function public.my_apple_purchase_access() to authenticated;

-- Activation and erasure both require this exact, private account-owned catalog.
create function public.apple_purchase_catalog_ready() returns boolean
language sql stable security definer set search_path='' as $$
 select (select md5(string_agg(table_name||'|'||column_name||'|'||data_type||'|'||is_nullable,E'\n' order by table_name collate "C",column_name collate "C")) from information_schema.columns where table_schema='tenaceiq_private')='839169e363c7fbf4832d868573f10c75'
 and not has_schema_privilege('anon','tenaceiq_private','USAGE') and not has_schema_privilege('authenticated','tenaceiq_private','USAGE')
 and (select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='tenaceiq_private' and c.relkind='r' and c.relrowsecurity)=3
 and not exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='tenaceiq_private' and c.relkind='r' and
  (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')))
 and (select count(*) from pg_catalog.pg_constraint f join pg_catalog.pg_class c on c.oid=f.conrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='tenaceiq_private' and f.contype='f' and f.confrelid='auth.users'::regclass and f.confdeltype='c' and pg_catalog.pg_get_constraintdef(f.oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE')=3
 and (select count(*) from pg_catalog.pg_constraint f join pg_catalog.pg_class c on c.oid=f.conrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='tenaceiq_private' and f.contype='f')=4
 and (select count(*) from pg_catalog.pg_constraint f join pg_catalog.pg_class c on c.oid=f.conrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='tenaceiq_private' and f.contype='p')=3
 and (select count(*) from pg_catalog.pg_constraint f join pg_catalog.pg_class c on c.oid=f.conrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='tenaceiq_private' and f.contype='f' and f.confrelid='tenaceiq_private.apple_purchase_accounts'::regclass and f.confdeltype='c' and pg_catalog.pg_get_constraintdef(f.oid)='FOREIGN KEY (account_token) REFERENCES tenaceiq_private.apple_purchase_accounts(account_token) ON DELETE CASCADE')=1
 and not exists(select 1 from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='tenaceiq_private' and not t.tgisinternal)
 and not exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('apple_purchase_account','apple_purchase_claim','apple_purchase_commit','apple_purchase_access') and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE')))
 and has_function_privilege('authenticated','public.my_apple_purchase_access()','EXECUTE')
 and not has_function_privilege('anon','public.my_apple_purchase_access()','EXECUTE');
$$;
revoke all on function public.apple_purchase_catalog_ready() from public,anon,authenticated;
grant execute on function public.apple_purchase_catalog_ready() to service_role;

notify pgrst,'reload schema';
commit;
