import {expect,it} from 'vitest'
import {googleLedgerFixture as fixture} from './fixtures/google-purchase-ledger'
import {readFile} from 'node:fs/promises'
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222'

it('keeps the Google ledger private, preserves Apple checks, and extends deletion audits without weakening them',async()=>{
 const {db,rpc}=await fixture()
 try{
  expect(await rpc('google_purchase_catalog_ready')).toBe(true);expect(await rpc('apple_purchase_catalog_ready')).toBe(true);expect(await rpc('account_erasure_catalog_ready')).toBe(true)
  await db.exec(`select set_config('fixture.legacy_ready','false',false)`);expect(await rpc('account_erasure_catalog_ready')).toBe(false);await db.exec(`select set_config('fixture.legacy_ready','true',false)`)
  for(const role of ['anon','authenticated','service_role']){
   await db.exec('reset role;set role '+role)
   await expect(db.query('select * from tenaceiq_google.accounts')).rejects.toThrow()
   await expect(db.query('select * from tenaceiq_google.purchases')).rejects.toThrow()
   if(role!=='service_role'){
    for(const name of ['google_purchase_account','google_purchase_access'])await expect(rpc(name,[a])).rejects.toThrow()
    await expect(rpc('native_store_purchase_access',[b])).rejects.toThrow()
    await expect(rpc('google_purchase_claim',[a,a,'a'.repeat(64),'b'.repeat(64)])).rejects.toThrow()
   }
  }
  await db.exec('reset role;grant usage on schema tenaceiq_google to authenticated;set role service_role')
  expect(await rpc('google_purchase_catalog_ready')).toBe(false);expect(await rpc('account_erasure_catalog_ready')).toBe(false)
 }finally{await db.close()}
},30000)

it('saves verified Pro access before settlement, preserves token ownership and recovers retries without duplicate grants',async()=>{
 const f=await fixture(),{db,rpc}=f
 try{
  const account=await f.enable(),other=await f.enable(b),now=Date.now(),token='a'.repeat(64),fingerprint='b'.repeat(64)
  expect(await rpc('google_purchase_prepare',[a])).toMatchObject({ok:true,accountId:account.accountId})
  let sequence=0;const operation=()=>`10000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`
  const evidence={productId:'com.tenaceiq.app.pro.monthly',kind:'pro',subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',tokenHash:token,accountId:account.accountId,profileId:null,environment:'Test',active:true,acknowledged:false,consumed:false,expiresAt:now+86400000,purchasedAt:now-1000,linkedTokenHash:null}
  const first=operation(),claim=await rpc<{ok:boolean;lease:string}>('google_purchase_claim',[a,first,fingerprint,token])
  expect(claim.ok).toBe(true)
  expect(await rpc('google_purchase_claim',[a,operation(),fingerprint,token])).toMatchObject({ok:false,status:409})
  expect(await rpc('google_purchase_save',[a,first,b,evidence])).toMatchObject({ok:false,status:409})
  expect(await rpc('google_purchase_save',[a,first,claim.lease,evidence])).toMatchObject({ok:true,saved:true,receipt:{delivered:true,settled:false,active:true}})
  expect(await rpc('google_purchase_access',[a])).toMatchObject({ownerId:a,proExpiresAt:expect.any(String)})
  expect(await rpc('google_purchase_prepare',[a])).toMatchObject({ok:false,code:'google_existing_access'})
  expect(await rpc('google_purchase_save',[a,first,null,evidence])).toMatchObject({ok:false,status:409})
  expect(await rpc('google_purchase_settle',[a,first,claim.lease,false])).toMatchObject({ok:false,status:409})
  expect(await rpc('google_purchase_settle',[a,first,claim.lease,true])).toMatchObject({ok:true,receipt:{settled:true,active:true}})
  expect(await rpc('google_purchase_claim',[b,operation(),fingerprint,token])).toMatchObject({ok:false,status:409})
  expect(await rpc('google_purchase_access',[b])).toMatchObject({proExpiresAt:null})
  const second=operation(),next=await rpc<{lease:string}>('google_purchase_claim',[a,second,fingerprint,token])
  expect(await rpc('google_purchase_save',[a,second,next.lease,{...evidence,accountId:other.accountId}])).toMatchObject({ok:false,status:400})
  expect(await rpc('google_purchase_save',[a,second,next.lease,{...evidence,active:false,subscriptionState:'SUBSCRIPTION_STATE_EXPIRED'}])).toMatchObject({ok:true})
  expect(await rpc('google_purchase_access',[a])).toMatchObject({proExpiresAt:null})
  await rpc('google_purchase_release',[a,second,next.lease])
  expect(await rpc('google_purchase_save',[a,first,claim.lease,evidence])).toMatchObject({ok:false,status:409})
  await db.exec('reset role');expect((await db.query('select count(*)::int n from tenaceiq_google.purchases')).rows[0]).toEqual({n:1})
 }finally{await db.close()}
},30000)

it('isolates license testing, merges self-only access for existing RLS, and cascades private records on deletion',async()=>{
 const f=await fixture(),{db,rpc}=f
 try{
  expect(await rpc('google_purchase_account',[a,true])).toMatchObject({testEnabled:false,productionEnabled:false})
  expect(await rpc('google_purchase_prepare',[a])).toMatchObject({ok:false,status:403})
  const account=await f.enable(),op='10000000-0000-4000-8000-000000000001',hash='a'.repeat(64),claim=await rpc<{lease:string}>('google_purchase_claim',[a,op,'b'.repeat(64),hash]),now=Date.now()
  const evidence={productId:'com.tenaceiq.app.pro.monthly',kind:'pro',subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',tokenHash:hash,accountId:account.accountId,profileId:null,environment:'Test',active:true,acknowledged:false,consumed:false,expiresAt:now+86400000,purchasedAt:now-1000,linkedTokenHash:null}
  expect(await rpc('google_purchase_save',[a,op,claim.lease,{...evidence,environment:'Production'}])).toMatchObject({ok:false,status:400})
  await rpc('google_purchase_save',[a,op,claim.lease,evidence])
  await db.exec(`reset role;create table public.lineup_scenarios(id uuid primary key default gen_random_uuid(),owner_user_id uuid not null);alter table public.lineup_scenarios enable row level security;grant insert,select,update on public.lineup_scenarios to authenticated;grant select on public.profiles to authenticated;`)
  const policies=await readFile(new URL('../../supabase/migrations/20261028000500_apple_paid_tool_access.sql',import.meta.url),'utf8')
  for(const name of ['insert','update']){const policy=policies.match(new RegExp('create policy "owner '+name+' lineup_scenarios"[\\s\\S]*?;'))?.[0];if(!policy)throw Error('Expected existing captain write policy');await db.exec(policy)}
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${a}',false)`)
  expect(await rpc('my_native_store_purchase_access')).toMatchObject({ownerId:a,playerExpiresAt:expect.any(String),captainExpiresAt:expect.any(String),proExpiresAt:expect.any(String)})
  expect(await rpc('my_apple_purchase_access')).toMatchObject({proExpiresAt:expect.any(String)})
  expect(await rpc('has_current_coach_access',[a])).toBe(true)
  await db.query('insert into public.lineup_scenarios(owner_user_id) values($1)',[a])
  await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`)
  expect(await rpc('my_apple_purchase_access')).toMatchObject({ownerId:b,proExpiresAt:null})
  expect(await rpc('has_current_coach_access',[a])).toBe(false)
  await expect(db.query('insert into public.lineup_scenarios(owner_user_id) values($1)',[a])).rejects.toThrow()
  await expect(db.query('insert into public.lineup_scenarios(owner_user_id) values($1)',[b])).rejects.toThrow()
  await db.exec(`reset role;insert into public.account_deletion_requests values('${a}',true);set role service_role`)
  expect(await rpc('google_purchase_access',[a])).toMatchObject({proExpiresAt:null})
  expect(await rpc('google_purchase_settle',[a,op,claim.lease,true])).toMatchObject({ok:false,status:403})
  await db.exec('reset role');await db.query('delete from auth.users where id=$1',[a])
  for(const table of ['accounts','purchases','operations'])expect((await db.query('select * from tenaceiq_google.'+table+' where owner_id=$1',[a])).rows).toHaveLength(0)
 }finally{await db.close()}
},30000)

it('rejects expired leases and operation reuse, and counts retries toward the verification budget',async()=>{
 const f=await fixture(),{db,rpc}=f
 try{
  await f.enable();const op='10000000-0000-4000-8000-000000000001',hash='a'.repeat(64),fingerprint='b'.repeat(64)
  const first=await rpc<{lease:string}>('google_purchase_claim',[a,op,fingerprint,hash])
  await db.exec('reset role');await db.query("update tenaceiq_google.operations set lease_until=clock_timestamp()-interval '1 second' where operation_id=$1",[op]);await db.exec('set role service_role')
  const second=await rpc<{ok:boolean;lease:string}>('google_purchase_claim',[a,op,fingerprint,hash]);expect(second.ok).toBe(true);expect(second.lease).not.toBe(first.lease)
  expect(await rpc('google_purchase_settle',[a,op,first.lease,true])).toMatchObject({ok:false,status:409})
  await rpc('google_purchase_release',[a,op,second.lease])
  expect(await rpc('google_purchase_claim',[a,op,'c'.repeat(64),hash])).toMatchObject({ok:false,status:409})
  await db.exec('reset role');await db.query('update tenaceiq_google.accounts set rate_count=0 where owner_id=$1',[a]);await db.exec('set role service_role')
  for(let i=0;i<20;i++){const claimed=await rpc<{ok:boolean;lease:string}>('google_purchase_claim',[a,op,fingerprint,hash]);expect(claimed.ok).toBe(true);await rpc('google_purchase_release',[a,op,claimed.lease])}
  expect(await rpc('google_purchase_claim',[a,op,fingerprint,hash])).toMatchObject({ok:false,status:429})
  await db.exec('reset role');await db.query("update tenaceiq_google.accounts set rate_window=clock_timestamp()-interval '16 minutes' where owner_id=$1",[a]);await db.exec('set role service_role')
  expect(await rpc('google_purchase_claim',[a,op,fingerprint,hash])).toMatchObject({ok:true})
 }finally{await db.close()}
},30000)

it('retires linked subscriptions without reviving older grants and rejects foreign or unknown replacement links',async()=>{
 const f=await fixture(),{db,rpc}=f
 try{
  const account=await f.enable(),otherAccount=await f.enable(b),now=Date.now(),old='a'.repeat(64),next='b'.repeat(64),foreign='c'.repeat(64)
  let sequence=0
  async function save(owner:string,accountId:string,hash:string,active=true,linkedTokenHash:string|null=null){
   const op=`10000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`,claim=await rpc<{lease:string}>('google_purchase_claim',[owner,op,'f'.repeat(64),hash])
   const result=await rpc('google_purchase_save',[owner,op,claim.lease,{productId:'com.tenaceiq.app.pro.monthly',kind:'pro',subscriptionState:active?'SUBSCRIPTION_STATE_ACTIVE':'SUBSCRIPTION_STATE_EXPIRED',tokenHash:hash,accountId,profileId:null,environment:'Test',active,acknowledged:true,consumed:false,expiresAt:now+86400000,purchasedAt:now-1000,linkedTokenHash}])
   await rpc('google_purchase_release',[owner,op,claim.lease]);return result
  }
  expect(await save(a,account.accountId,old)).toMatchObject({ok:true});expect(await save(a,account.accountId,next,true,old)).toMatchObject({ok:true})
  expect(await save(a,account.accountId,next,false,old)).toMatchObject({ok:true});expect(await save(a,account.accountId,next,false,null)).toMatchObject({ok:true});expect(await save(a,account.accountId,old,true)).toMatchObject({ok:true,receipt:{active:false}})
  expect(await rpc('google_purchase_access',[a])).toMatchObject({proExpiresAt:null})
  expect(await save(b,otherAccount.accountId,foreign)).toMatchObject({ok:true})
  expect(await save(a,account.accountId,'d'.repeat(64),true,foreign)).toMatchObject({ok:false,status:409})
  expect(await save(a,account.accountId,'e'.repeat(64),true,'0'.repeat(64))).toMatchObject({ok:false,status:409})
 }finally{await db.close()}
},30000)
