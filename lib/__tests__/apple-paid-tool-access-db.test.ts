import {expect,it} from 'vitest'
import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333'
const sql=(name:string)=>readFile(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8')
it('grants Apple Player and Captain tools only to the owner while preserving website and admin access',async()=>{
 const db=new PGlite()
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function public.is_admin() returns boolean language sql stable as $$select auth.uid()='${admin}'::uuid$$;create table profiles(id uuid primary key,player_plus_subscription_active boolean default false,player_plus_subscription_status text default 'inactive',player_plus_access_expires_at timestamptz,coach_subscription_active boolean default false,coach_subscription_status text default 'inactive',coach_access_expires_at timestamptz,captain_subscription_active boolean default false,captain_subscription_status text default 'inactive',captain_access_expires_at timestamptz);create table account_deletion_requests(account_id uuid,automatic_consent boolean);create table lineup_scenarios(id uuid primary key default gen_random_uuid(),owner_user_id uuid default auth.uid(),scenario_name text);alter table lineup_scenarios enable row level security;grant usage on schema public,auth to anon,authenticated,service_role;grant select on profiles to authenticated;grant select,insert,update on lineup_scenarios to authenticated;create policy own_read on lineup_scenarios for select to authenticated using(owner_user_id=auth.uid());insert into auth.users values('${a}'),('${b}'),('${admin}');insert into profiles(id) values('${a}'),('${b}'),('${admin}');`)
 await db.exec((await sql('20260815000200_enforce_storage_quotas.sql')).split('create or replace function public.is_storage')[0])
 const oldPolicies=await sql('20261026000100_owner_scoped_lineup_scenarios.sql');await db.exec(oldPolicies.slice(oldPolicies.indexOf('drop policy if exists "owner insert'),oldPolicies.indexOf('create unique index')))
 await db.exec(await sql('20261028000300_apple_purchase_records.sql'))
 await db.exec(await sql('20261028000500_apple_paid_tool_access.sql'))
 const setOwner=async(owner:string)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);await db.exec('set role authenticated')}
 const access=async(owner=a)=>(await db.query<{r:boolean}>('select has_current_player_access($1) r',[owner])).rows[0].r
 await setOwner(a);expect(await access()).toBe(false);await expect(db.exec("insert into lineup_scenarios(scenario_name) values('Denied')")).rejects.toThrow()
 await db.exec('reset role');await db.query('select apple_purchase_account($1,true)',[a]);await db.query("insert into tenaceiq_private.apple_memberships(environment,original_transaction_id,transaction_id,owner_id,account_token,product_id,expires_at,signed_at,status,revoked,upgraded) select 'Production','1001','1002',owner_id,account_token,'com.tenaceiq.app.player.monthly',now()+interval '1 day',now(),1,false,false from tenaceiq_private.apple_purchase_accounts where owner_id=$1",[a])
 await setOwner(a);expect(await access()).toBe(true);await expect(db.exec("insert into lineup_scenarios(scenario_name) values('Not Captain')")).rejects.toThrow()
 await setOwner(b);expect(await access(a)).toBe(false);expect(await access(b)).toBe(false)
 const own=(await db.query<{r:{ownerId:string;playerExpiresAt:null}}>('select my_apple_purchase_access() r')).rows[0].r;expect(own).toMatchObject({ownerId:b,playerExpiresAt:null})
 await db.exec('reset role');await db.exec("update tenaceiq_private.apple_memberships set product_id='com.tenaceiq.app.captain.monthly'")
 await setOwner(a);await db.exec("insert into lineup_scenarios(scenario_name) values('My Apple lineup')");await db.exec("update lineup_scenarios set scenario_name='Updated'");await expect(db.query("insert into lineup_scenarios(owner_user_id,scenario_name) values($1,'Foreign')",[b])).rejects.toThrow()
 await setOwner(b);expect((await db.query('select * from lineup_scenarios')).rows).toHaveLength(0)
 await db.exec('reset role');await db.exec("update tenaceiq_private.apple_memberships set revoked=true")
 await setOwner(a);expect(await access()).toBe(false);expect((await db.query("update lineup_scenarios set scenario_name='Denied' returning id")).rows).toHaveLength(0)
 await db.exec('reset role');await db.query("update profiles set captain_subscription_active=true,captain_subscription_status='active' where id=$1",[a])
 await setOwner(a);expect(await access()).toBe(true);await db.exec("insert into lineup_scenarios(scenario_name) values('Web grant survives refund')")
 await setOwner(admin);expect(await access(b)).toBe(true)
 await db.exec('reset role');await expect(db.exec(await sql('20261028000500_apple_paid_tool_access.sql'))).rejects.toThrow('Player access definition differs');await db.exec('rollback')
 }finally{await db.close()}
},30000)
