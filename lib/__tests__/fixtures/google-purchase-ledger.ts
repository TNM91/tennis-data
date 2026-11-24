import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222'
const sqlFile=new URL('../../../supabase/migrations/20261123000100_google_pro_purchase_fulfillment.sql',import.meta.url)
export async function googleLedgerFixture(){
 const db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table public.profiles(id uuid primary key,role text default 'member',coach_subscription_active boolean default false,coach_subscription_status text default 'inactive',coach_access_expires_at timestamptz,captain_subscription_active boolean default false,captain_subscription_status text default 'inactive',captain_access_expires_at timestamptz,stripe_subscription_id text);create table public.account_deletion_requests(account_id uuid,automatic_consent boolean);grant usage on schema public,auth to anon,authenticated,service_role;insert into auth.users values('${a}'),('${b}');insert into profiles(id) values('${a}'),('${b}');
 create function public.account_erasure_catalog_ready() returns boolean language sql stable security definer set search_path='' as $$with legacy_checks as (select current_setting('fixture.legacy_ready',true) is distinct from 'false' ready) select ready from legacy_checks;$$;revoke all on function public.account_erasure_catalog_ready() from public,anon,authenticated;grant execute on function public.account_erasure_catalog_ready() to service_role;`)
 await db.exec('create function public.is_admin() returns boolean language sql stable as $$select false$$')
 await db.exec(await readFile(new URL('../../../supabase/migrations/20261028000300_apple_purchase_records.sql',import.meta.url),'utf8'))
 await db.exec(await readFile(new URL('../../../supabase/migrations/20261114001100_apple_pro_membership.sql',import.meta.url),'utf8'))
 await db.exec(await readFile(sqlFile,'utf8'))
 async function rpc<T=Record<string,unknown>>(name:string,args:unknown[]=[]){const placeholders=args.map((_,i)=>'$'+(i+1)).join(',');return (await db.query<{r:T}>('select public.'+name+'('+placeholders+') r',args)).rows[0].r}
 await db.exec('set role service_role')
 return {db,rpc,async enable(owner=a){await db.exec('reset role');await rpc('google_purchase_account',[owner,true]);await db.query('update tenaceiq_google.accounts set test_enabled=true where owner_id=$1',[owner]);await db.exec('set role service_role');return rpc<{accountId:string}>('google_purchase_account',[owner])}}
}
