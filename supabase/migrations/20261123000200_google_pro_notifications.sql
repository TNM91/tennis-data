begin;
set local lock_timeout='5s';
set local statement_timeout='20s';

-- Preserve the exactly audited purchase namespace; notification receipts have
-- their own private catalog and cascade with the associated account.
do $$ begin
 if exists(select 1 from pg_namespace where nspname='tenaceiq_google_notifications') then raise exception 'Review the existing Google notification namespace'; end if;
 if not public.google_purchase_catalog_ready() or not public.account_erasure_catalog_ready() then raise exception 'Existing purchase/deletion checks must pass'; end if;
end $$;
create schema tenaceiq_google_notifications;
revoke all on schema tenaceiq_google_notifications from public,anon,authenticated,service_role;
create table tenaceiq_google_notifications.receipts(
 message_hash text primary key check(message_hash~'^[0-9a-f]{64}$'),
 fingerprint text not null check(fingerprint~'^[0-9a-f]{64}$'),
 token_hash text not null check(token_hash~'^[0-9a-f]{64}$'),
 owner_id uuid not null references auth.users(id) on delete cascade,
 account_id text not null,
 operation_id uuid not null unique default gen_random_uuid(),
 lease uuid not null default gen_random_uuid(),
 lease_until timestamptz not null default clock_timestamp()+interval '90 seconds',
 completed boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),
 constraint notification_account_owner_fkey foreign key(owner_id,account_id) references tenaceiq_google.accounts(owner_id,account_id) on delete cascade
);
create index google_notification_cleanup on tenaceiq_google_notifications.receipts(created_at) where completed;
alter table tenaceiq_google_notifications.receipts enable row level security;
revoke all on tenaceiq_google_notifications.receipts from public,anon,authenticated,service_role;

create function public.google_notification_lookup(p_message_hash text,p_fingerprint text,p_token_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r tenaceiq_google_notifications.receipts;p tenaceiq_google.purchases;a tenaceiq_google.accounts;
begin
 if not public.google_notification_catalog_ready() then return jsonb_build_object('ok',false,'status',503); end if;
 if p_message_hash is null or p_message_hash!~'^[0-9a-f]{64}$' or p_fingerprint is null or p_fingerprint!~'^[0-9a-f]{64}$' or p_token_hash is null or p_token_hash!~'^[0-9a-f]{64}$' then return jsonb_build_object('ok',false,'status',400); end if;
 select * into r from tenaceiq_google_notifications.receipts where message_hash=p_message_hash;
 if found then
  if r.fingerprint<>p_fingerprint or r.token_hash<>p_token_hash then return jsonb_build_object('ok',false,'status',409); end if;
  if r.completed then return jsonb_build_object('ok',true,'state','done'); end if;
  if not tenaceiq_google.owner_ready(r.owner_id) then return jsonb_build_object('ok',true,'state','ignored'); end if;
 end if;
 select * into p from tenaceiq_google.purchases where token_hash=p_token_hash;
 if not found then return jsonb_build_object('ok',true,'state','lookup','accountId',null); end if;
 select * into a from tenaceiq_google.accounts where owner_id=p.owner_id and account_id=p.account_id;
 if not found or not a.test_enabled or p.environment<>'Test' or not tenaceiq_google.owner_ready(p.owner_id) then return jsonb_build_object('ok',true,'state','ignored'); end if;
 return jsonb_build_object('ok',true,'state','lookup','accountId',a.account_id);
end $$;

create function public.google_notification_claim(p_message_hash text,p_fingerprint text,p_token_hash text,p_account_id text) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='3s' set statement_timeout='5s' as $$
declare a tenaceiq_google.accounts;r tenaceiq_google_notifications.receipts;
begin
 if not public.google_notification_catalog_ready() then return jsonb_build_object('ok',false,'status',503); end if;
 if p_message_hash is null or p_message_hash!~'^[0-9a-f]{64}$' or p_fingerprint is null or p_fingerprint!~'^[0-9a-f]{64}$' or p_token_hash is null or p_token_hash!~'^[0-9a-f]{64}$' or p_account_id is null or p_account_id!~'^[0-9a-f]{64}$' then return jsonb_build_object('ok',false,'status',400); end if;
 perform pg_advisory_xact_lock(hashtextextended('google-notification:'||p_message_hash,0));
 select * into a from tenaceiq_google.accounts where account_id=p_account_id;
 if not found or not a.test_enabled then return jsonb_build_object('ok',true,'state','ignored'); end if;
 perform 1 from auth.users where id=a.owner_id for key share;
 if not found or not tenaceiq_google.owner_ready(a.owner_id) then return jsonb_build_object('ok',true,'state','ignored'); end if;
 if exists(select 1 from tenaceiq_google.purchases where token_hash=p_token_hash and (owner_id<>a.owner_id or account_id<>a.account_id or environment<>'Test')) then return jsonb_build_object('ok',false,'status',409); end if;
 select * into r from tenaceiq_google_notifications.receipts where message_hash=p_message_hash for update;
 if found then
  if r.fingerprint<>p_fingerprint or r.token_hash<>p_token_hash or r.owner_id<>a.owner_id or r.account_id<>a.account_id then return jsonb_build_object('ok',false,'status',409); end if;
  if r.completed then return jsonb_build_object('ok',true,'state','done'); end if;
  if r.lease_until>clock_timestamp() then return jsonb_build_object('ok',false,'status',409); end if;
 end if;
 insert into tenaceiq_google_notifications.receipts(message_hash,fingerprint,token_hash,owner_id,account_id)
 values(p_message_hash,p_fingerprint,p_token_hash,a.owner_id,a.account_id)
 on conflict(message_hash) do update set lease=gen_random_uuid(),lease_until=clock_timestamp()+interval '90 seconds' returning * into r;
 delete from tenaceiq_google_notifications.receipts where message_hash in(select message_hash from tenaceiq_google_notifications.receipts where completed and created_at<clock_timestamp()-interval '30 days' limit 25);
 return jsonb_build_object('ok',true,'state','ready','ownerId',r.owner_id,'accountId',r.account_id,'operationId',r.operation_id,'lease',r.lease);
end $$;

create function public.google_notification_complete(p_message_hash text,p_fingerprint text,p_token_hash text,p_lease uuid) returns boolean
language sql security definer set search_path='' as $$
 with updated as (
 update tenaceiq_google_notifications.receipts r set completed=true,lease_until=clock_timestamp()
 where r.message_hash=p_message_hash and r.fingerprint=p_fingerprint and r.token_hash=p_token_hash and r.lease=p_lease and r.lease_until>clock_timestamp()
 and tenaceiq_google.owner_ready(r.owner_id)
 and exists(select 1 from tenaceiq_google.operations o join tenaceiq_google.purchases p on p.token_hash=o.token_hash
   join tenaceiq_google.accounts a on a.owner_id=p.owner_id and a.account_id=p.account_id
   where o.operation_id=r.operation_id and o.owner_id=r.owner_id and o.token_hash=r.token_hash and o.saved
   and p.owner_id=r.owner_id and p.account_id=r.account_id and p.environment='Test' and p.settled and a.test_enabled)
 returning 1) select exists(select 1 from updated);
$$;
create function public.google_notification_release(p_message_hash text,p_lease uuid) returns void
language sql security definer set search_path='' as $$
 update tenaceiq_google_notifications.receipts set lease_until=clock_timestamp() where message_hash=p_message_hash and lease=p_lease;
$$;

create function public.google_notification_catalog_ready() returns boolean
language sql stable security definer set search_path='' as $$
 with expected(c,d,n) as (values
 ('message_hash','text','NO'),('fingerprint','text','NO'),('token_hash','text','NO'),('owner_id','uuid','NO'),('account_id','text','NO'),('operation_id','uuid','NO'),('lease','uuid','NO'),('lease_until','timestamp with time zone','NO'),('completed','boolean','NO'),('created_at','timestamp with time zone','NO')),
 actual as(select table_name t,column_name c,data_type d,is_nullable n from information_schema.columns where table_schema='tenaceiq_google_notifications')
 select public.google_purchase_catalog_ready()
 and not exists(select 1 from expected e full join actual a using(c) where a.t is distinct from 'receipts' or e.d is distinct from a.d or e.n is distinct from a.n)
 and (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='tenaceiq_google_notifications' and c.relkind='r' and c.relrowsecurity and c.relpersistence='p')=1
 and not exists(select 1 from (values('anon'),('authenticated'),('service_role')) roles(role) where has_schema_privilege(roles.role,'tenaceiq_google_notifications','USAGE,CREATE') or has_table_privilege(roles.role,'tenaceiq_google_notifications.receipts','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
 and exists(select 1 from pg_constraint where conrelid='tenaceiq_google_notifications.receipts'::regclass and contype='f' and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE')
 and exists(select 1 from pg_constraint where conrelid='tenaceiq_google_notifications.receipts'::regclass and conname='notification_account_owner_fkey' and pg_get_constraintdef(oid)='FOREIGN KEY (owner_id, account_id) REFERENCES tenaceiq_google.accounts(owner_id, account_id) ON DELETE CASCADE')
 and not exists(select 1 from pg_trigger where tgrelid='tenaceiq_google_notifications.receipts'::regclass and not tgisinternal)
 and (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('google_notification_lookup','google_notification_claim','google_notification_complete','google_notification_release','google_notification_catalog_ready'))=5
 and not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('google_notification_lookup','google_notification_claim','google_notification_complete','google_notification_release','google_notification_catalog_ready') and (not p.prosecdef or not coalesce(p.proconfig@>array['search_path=""'],false) or not has_function_privilege('service_role',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE')));
$$;
revoke all on function public.google_notification_lookup(text,text,text),public.google_notification_claim(text,text,text,text),public.google_notification_complete(text,text,text,uuid),public.google_notification_release(text,uuid),public.google_notification_catalog_ready() from public,anon,authenticated;
grant execute on function public.google_notification_lookup(text,text,text),public.google_notification_claim(text,text,text,text),public.google_notification_complete(text,text,text,uuid),public.google_notification_release(text,uuid),public.google_notification_catalog_ready() to service_role;

do $guard$
declare source text;definition text;wrapped text;
begin
 if not public.google_notification_catalog_ready() then raise exception 'Google notification catalog did not validate'; end if;
 select p.prosrc into source from pg_proc p join pg_language l on l.oid=p.prolang
 where p.oid='public.account_erasure_catalog_ready()'::regprocedure and p.prosecdef and l.lanname='sql' and p.prorettype='boolean'::regtype;
 if source is null or not public.account_erasure_catalog_ready() then raise exception 'Review the existing deletion audit'; end if;
 definition:=pg_get_functiondef('public.account_erasure_catalog_ready()'::regprocedure);
 if source='' or (length(definition)-length(replace(definition,source,'')))<>length(source) then raise exception 'Deletion audit source is ambiguous'; end if;
 wrapped:='select public.google_notification_catalog_ready() and ('||regexp_replace(source,';\s*$','')||E'\n)';
 execute replace(definition,source,wrapped);
 if not public.account_erasure_catalog_ready() then raise exception 'Combined deletion audit did not validate'; end if;
end $guard$;
notify pgrst,'reload schema';
commit;
