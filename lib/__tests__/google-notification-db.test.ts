import {expect,it} from 'vitest'
import {googleNotificationLedgerFixture as fixture} from './fixtures/google-notification-ledger'

const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
const key=['a'.repeat(64),'b'.repeat(64),'c'.repeat(64)]
it('keeps notification records and RPCs private while preserving all purchase and erasure audits',async()=>{
 const {db,rpc}=await fixture()
 try{
  for(const name of ['google_notification_catalog_ready','google_purchase_catalog_ready','apple_purchase_catalog_ready','account_erasure_catalog_ready'])expect(await rpc(name)).toBe(true)
  for(const role of ['anon','authenticated','service_role']){
   await db.exec('reset role;set role '+role)
   await expect(db.query('select * from tenaceiq_google_notifications.receipts')).rejects.toThrow()
   if(role!=='service_role')await expect(rpc('google_notification_lookup',key)).rejects.toThrow()
  }
  await db.exec('reset role;grant usage on schema tenaceiq_google_notifications to authenticated;set role service_role')
  expect(await rpc('google_notification_catalog_ready')).toBe(false);expect(await rpc('account_erasure_catalog_ready')).toBe(false)
 }finally{await db.close()}
},30000)
it('leases duplicate messages with a stable operation, rejects mutated redeliveries and requires durable settlement',async()=>{
 const f=await fixture(),{db,rpc}=f
 try{
  const account=await f.enable(),otherAccount=await f.enable(other)
  expect(await rpc('google_notification_lookup',key)).toMatchObject({state:'lookup',accountId:null})
  const first=await rpc<{lease:string;operationId:string}>('google_notification_claim',[...key,account.accountId])
  expect(first).toMatchObject({ok:true,state:'ready',ownerId:owner})
  expect(await rpc('google_notification_claim',[...key,account.accountId])).toMatchObject({ok:false,status:409})
  expect(await rpc('google_notification_claim',[key[0],'d'.repeat(64),key[2],account.accountId])).toMatchObject({ok:false,status:409})
  expect(await rpc('google_notification_claim',[...key,otherAccount.accountId])).toMatchObject({ok:false,status:409})
  expect(await rpc('google_notification_complete',[...key,first.lease])).toBe(false)
  await rpc('google_notification_release',[key[0],first.lease])
  const second=await rpc<{lease:string;operationId:string}>('google_notification_claim',[...key,account.accountId])
  expect(second.operationId).toBe(first.operationId);expect(second.lease).not.toBe(first.lease)
  const purchase=await rpc<{lease:string}>('google_purchase_claim',[owner,second.operationId,'e'.repeat(64),key[2]]),now=Date.now()
  const evidence={productId:'com.tenaceiq.app.pro.monthly',kind:'pro',subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',tokenHash:key[2],accountId:account.accountId,profileId:null,environment:'Test',active:true,acknowledged:true,consumed:false,expiresAt:now+86400000,purchasedAt:now-1000,linkedTokenHash:null}
  await rpc('google_purchase_save',[owner,second.operationId,purchase.lease,evidence])
  expect(await rpc('google_notification_complete',[...key,second.lease])).toBe(false)
  await rpc('google_purchase_settle',[owner,second.operationId,purchase.lease,true])
  expect(await rpc('google_notification_complete',[...key,first.lease])).toBe(false)
  expect(await rpc('google_notification_complete',[...key,second.lease])).toBe(true)
  expect(await rpc('google_notification_lookup',key)).toEqual({ok:true,state:'done'})
  expect(await rpc('google_notification_lookup',[key[0],'d'.repeat(64),key[2]])).toMatchObject({ok:false,status:409})
  expect(await rpc('google_notification_claim',[...key,account.accountId])).toMatchObject({state:'done'})
  expect(await rpc('google_notification_lookup',['f'.repeat(64),key[1],key[2]])).toMatchObject({accountId:account.accountId})
 }finally{await db.close()}
},30000)
it('never recreates unbound, disabled or deleted accounts and erases notification metadata with its owner',async()=>{
 const f=await fixture(),{db,rpc}=f
 try{
  expect(await rpc('google_notification_claim',[...key,'f'.repeat(64)])).toMatchObject({state:'ignored'})
  const account=await f.enable()
  const first=await rpc<{lease:string}>('google_notification_claim',[...key,account.accountId])
  await db.exec(`reset role;insert into public.account_deletion_requests values('${owner}',true);set role service_role`)
  expect(await rpc('google_notification_lookup',key)).toMatchObject({state:'ignored'})
  expect(await rpc('google_notification_complete',[...key,first.lease])).toBe(false)
  expect(await rpc('google_notification_claim',[...key,account.accountId])).toMatchObject({state:'ignored'})
  await db.exec('reset role');await db.query('delete from auth.users where id=$1',[owner]);await db.exec('set role service_role')
  expect(await rpc('google_notification_claim',[...key,account.accountId])).toMatchObject({state:'ignored'})
  await db.exec('reset role');expect((await db.query('select * from tenaceiq_google_notifications.receipts')).rows).toHaveLength(0)
  expect((await db.query('select * from tenaceiq_google.accounts')).rows).toHaveLength(0)
 }finally{await db.close()}
},30000)
