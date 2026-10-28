begin;
-- Account requests are private operational records. No existing user/data permissions change.
create table public.account_deletion_requests (
 id uuid primary key default gen_random_uuid(),
 account_id uuid unique,
 verified_email text,
 status text not null default 'requested' check(status in ('requested','reviewing','erased','completed')),
 requested_at timestamptz not null default clock_timestamp(),
 due_at timestamptz not null default clock_timestamp()+interval '7 days',
 reviewed_by uuid references public.profiles(id) on delete set null,
 completed_at timestamptz,
 check ((status='completed' and account_id is null and verified_email is null and completed_at is not null)
 or (status<>'completed' and account_id is not null and verified_email is not null and length(verified_email) between 3 and 320 and completed_at is null))
);
create index account_deletion_requests_pending on public.account_deletion_requests(due_at,id) where status<>'completed';
create table public.native_email_auth_limits (
 scope text not null check(scope in ('email-minute','email-hour','ip-quarter')),
 key_hash text not null check(key_hash ~ '^[0-9a-f]{64}$'),
 window_started_at timestamptz not null,
 hits integer not null check(hits between 1 and 5),
 primary key(scope,key_hash)
);
create index native_email_auth_limits_expiry on public.native_email_auth_limits(window_started_at);
alter table public.account_deletion_requests enable row level security;
alter table public.native_email_auth_limits enable row level security;
revoke all on public.account_deletion_requests,public.native_email_auth_limits from public,anon,authenticated,service_role;
grant select,insert,update on public.account_deletion_requests to service_role;
grant select,insert,update,delete on public.native_email_auth_limits to service_role;

create function public.native_account_lifecycle_config() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('version',1,'deletionReviewDays',7,'fulfillment','administrator_review','queueReady',(select count(*)=0 from (select id from public.account_deletion_requests limit 0) checked));
$$;
revoke all on function public.native_account_lifecycle_config() from public,anon,authenticated,service_role;
grant execute on function public.native_account_lifecycle_config() to service_role;

-- Three small counters, serialized per hash. Only hashes are retained; no email, IP, code or token.
create function public.consume_native_email_auth(p_email_hash text,p_ip_hash text) returns boolean
language plpgsql security invoker set search_path=pg_catalog,public set statement_timeout='5s' set lock_timeout='3s' as $$
declare item record; old public.native_email_auth_limits%rowtype; moment timestamptz:=clock_timestamp();
begin
 if p_email_hash is null or p_ip_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' or p_ip_hash !~ '^[0-9a-f]{64}$' then return false; end if;
 for item in select * from (values ('email-minute',p_email_hash,60,1),('email-hour',p_email_hash,3600,5),('ip-quarter',p_ip_hash,900,5)) v(scope,key_hash,seconds,allowed) order by scope,key_hash loop
  perform pg_advisory_xact_lock(hashtextextended('native-email:'||item.scope||':'||item.key_hash,0));
 end loop;
 for item in select * from (values ('email-minute',p_email_hash,60,1),('email-hour',p_email_hash,3600,5),('ip-quarter',p_ip_hash,900,5)) v(scope,key_hash,seconds,allowed) loop
  select * into old from public.native_email_auth_limits l where l.scope=item.scope and l.key_hash=item.key_hash;
  if found and old.window_started_at>moment-make_interval(secs=>item.seconds) and old.hits>=item.allowed then return false; end if;
 end loop;
 for item in select * from (values ('email-minute',p_email_hash,60,1),('email-hour',p_email_hash,3600,5),('ip-quarter',p_ip_hash,900,5)) v(scope,key_hash,seconds,allowed) loop
  insert into public.native_email_auth_limits as l(scope,key_hash,window_started_at,hits) values(item.scope,item.key_hash,moment,1)
  on conflict(scope,key_hash) do update set hits=case when l.window_started_at<=moment-make_interval(secs=>item.seconds) then 1 else l.hits+1 end,
   window_started_at=case when l.window_started_at<=moment-make_interval(secs=>item.seconds) then moment else l.window_started_at end;
 end loop;
 -- Recheck the target expiry after any row-lock wait; a concurrent renewal must survive cleanup.
 delete from public.native_email_auth_limits where window_started_at<moment-interval '2 days' and (scope,key_hash) in (select l.scope,l.key_hash from public.native_email_auth_limits l where window_started_at<moment-interval '2 days' order by window_started_at limit 100);
 return true;
end;$$;
revoke all on function public.consume_native_email_auth(text,text) from public,anon,authenticated,service_role;
grant execute on function public.consume_native_email_auth(text,text) to service_role;

-- Service caller derives owner/email from a freshly verified Auth user, never request JSON.
create function public.native_account_deletion_request(p_owner uuid,p_email text,p_create boolean default false) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public set statement_timeout='5s' set lock_timeout='3s' as $$
declare item public.account_deletion_requests%rowtype;
begin
 if p_owner is null or p_email is null or length(p_email) not between 3 and 320 then return jsonb_build_object('ok',false); end if;
 if p_create then
  insert into public.account_deletion_requests(account_id,verified_email) values(p_owner,p_email) on conflict(account_id) do nothing;
 end if;
 select * into item from public.account_deletion_requests where account_id=p_owner;
 return jsonb_build_object('ok',true,'reviewDays',7,'request',case when item.id is null then null else jsonb_build_object('id',item.id,'status',item.status,'requestedAt',item.requested_at,'dueAt',item.due_at) end);
end;$$;
revoke all on function public.native_account_deletion_request(uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.native_account_deletion_request(uuid,text,boolean) to service_role;

-- This migration does not erase users or change ownership/cascades. Completion follows reviewed erasure.
create function public.admin_account_deletion_request(p_actor uuid,p_action text,p_id uuid default null) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public set statement_timeout='5s' set lock_timeout='3s' as $$
declare item public.account_deletion_requests%rowtype; rows jsonb;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role='admin') then return jsonb_build_object('ok',false,'status',403); end if;
 if p_action='list' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from (select id,account_id,verified_email,status,requested_at,due_at from public.account_deletion_requests where status<>'completed' order by due_at,id limit 25) x;
  return jsonb_build_object('ok',true,'rows',rows,'limit',25);
 end if;
 select * into item from public.account_deletion_requests where id=p_id for update;
 if item.id is null then return jsonb_build_object('ok',false,'status',404); end if;
 if p_action='review' and item.status='requested' then
  update public.account_deletion_requests set status='reviewing',reviewed_by=p_actor where id=p_id returning * into item;
 elsif p_action='confirm_erased' and item.status='reviewing' then
  -- The API first verifies Auth no longer contains this exact user; no erasure is done by this function.
  -- Refuse a completion badge while known non-cascading account records or files remain.
  if exists(select 1 from public.profiles where id=item.account_id)
    or exists(select 1 from public.product_usage_events where user_id=item.account_id)
    or exists(select 1 from public.upgrade_requests where requester_user_id=item.account_id)
    or exists(select 1 from storage.objects where owner_id=item.account_id::text
      or bucket_id in ('profile-photos','data-assist-screenshots','personal-quest-photos') and split_part(name,'/',1)=item.account_id::text
      or bucket_id='team-room-files' and split_part(name,'/',2)=item.account_id::text) then return jsonb_build_object('ok',false,'status',409); end if;
  update public.account_deletion_requests set status='erased',reviewed_by=p_actor where id=p_id returning * into item;
 elsif p_action='complete' and item.status='erased' then
  -- Only after the provider accepts the idempotent completion email may the delivery address be removed.
  update public.account_deletion_requests set status='completed',account_id=null,verified_email=null,completed_at=clock_timestamp(),reviewed_by=p_actor where id=p_id returning * into item;
 elsif p_action not in ('get','review','confirm_erased','complete') then return jsonb_build_object('ok',false,'status',400);
 end if;
 return jsonb_build_object('ok',true,'row',to_jsonb(item));
end;$$;
revoke all on function public.admin_account_deletion_request(uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_account_deletion_request(uuid,text,uuid) to service_role;
commit;
