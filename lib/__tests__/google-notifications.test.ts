import {expect,it,vi} from 'vitest'
import {generateKeyPairSync} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
vi.mock('server-only',()=>({}))
import {googleNotificationLedgerFixture} from './fixtures/google-notification-ledger'
import {handleGoogleNotification} from '../google-notifications'
import {GoogleNotificationAuthError} from '../google-notification-auth'
import {googleProNotificationPurchase} from '../google-play-server'
import {reconcileGooglePro} from '../google-purchase-api'
import {verifiedGooglePurchase,type GooglePurchaseExpectation} from '../google-play-verification'
import {POST} from '../../app/api/google/notifications/route'

const owner='11111111-1111-4111-8111-111111111111',sku='com.tenaceiq.app.pro.monthly',token='synthetic-notification-purchase-token-1'
const pair=generateKeyPairSync('rsa',{modulusLength:2048}),play={mode:'test' as const,email:'reader@tenaceiq-test.iam.gserviceaccount.com',key:pair.privateKey.export({type:'pkcs8',format:'pem'}).toString()}
const configuration={audience:'https://www.tenaceiq.com/api/google/notifications',email:'push@tenaceiq-test.iam.gserviceaccount.com',subscription:'projects/tenaceiq-test/subscriptions/google-pro'}
function provider(accountId:string,patch:Record<string,unknown>={}){
 const now=Date.now()
 return {regionCode:'US',subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',startTime:new Date(now-1000).toISOString(),acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING',externalAccountIdentifiers:{obfuscatedExternalAccountId:accountId},lineItems:[{productId:sku,expiryTime:new Date(now+86400000).toISOString(),offerDetails:{basePlanId:'monthly'},autoRenewingPlan:{autoRenewEnabled:true}}],testPurchase:{},...patch}
}
function request(id='123456789',details:Record<string,unknown>={subscriptionNotification:{version:'1.0',notificationType:2,purchaseToken:token}}){
 const event={version:'1.0',packageName:'com.tenaceiq.app',eventTimeMillis:'1503349566168',...details}
 return new Request(configuration.audience,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic'},body:JSON.stringify({subscription:configuration.subscription,message:{messageId:id,data:Buffer.from(JSON.stringify(event)).toString('base64')}})})
}
async function setup(){
 const f=await googleNotificationLedgerFixture(),account=await f.enable(),calls:string[]=[]
 let current=provider(account.accountId)
 const service={rpc:vi.fn(async(name:string,args:Record<string,unknown>={})=>{
  calls.push(name);const names=Object.keys(args),params=names.map((name,i)=>name+'=> $'+(i+1)).join(',')
  try{return {data:(await f.db.query<{r:unknown}>('select public.'+name+'('+params+') r',names.map(name=>args[name]))).rows[0].r,error:null}}catch{return {data:null,error:{code:'synthetic-db-outage'}}}
 })}
 const authenticate=vi.fn(async()=>{}),discover=vi.fn(async()=>verifiedGooglePurchase(current,{productId:sku,purchaseToken:token,accountId:account.accountId,profileId:null,allowTest:true}))
 const verify=vi.fn(async(expected:GooglePurchaseExpectation)=>{calls.push('canonical-read');return verifiedGooglePurchase(current,expected)})
 const acknowledge=vi.fn(async()=>{calls.push('acknowledge');expect(await f.rpc('google_purchase_access',[owner])).toMatchObject({proExpiresAt:expect.any(String)})})
 const reconcile:typeof reconcileGooglePro=(ctx,body)=>reconcileGooglePro(ctx,body,{verify,acknowledge})
 const deps={configuration,play,service:()=>service as unknown as SupabaseClient,authenticate,discover,reconcile}
 return {...f,account,service,calls,deps,authenticate,discover,verify,acknowledge,setCurrent:(value:Record<string,unknown>)=>{current=provider(account.accountId,value)}}
}

it('grants a first approved purchase in the background, verifies again under the lease and deduplicates only after durable settlement',async()=>{
 const f=await setup()
 try{
  expect((await handleGoogleNotification(request(),f.deps)).status).toBe(200)
  expect(await f.rpc('google_purchase_access',[owner])).toMatchObject({proExpiresAt:expect.any(String)})
  expect(f.discover).toHaveBeenCalledOnce();expect(f.verify).toHaveBeenCalledOnce();expect(f.acknowledge).toHaveBeenCalledOnce()
  expect(f.calls.indexOf('google_purchase_claim')).toBeLessThan(f.calls.indexOf('canonical-read'))
  expect(f.calls.indexOf('google_purchase_settle')).toBeLessThan(f.calls.indexOf('google_notification_complete'))
  const result=await handleGoogleNotification(request(),f.deps)
  expect(result.status).toBe(200);expect(result.headers.get('cache-control')).toContain('no-store');expect(f.verify).toHaveBeenCalledOnce();expect(f.discover).toHaveBeenCalledOnce()
  expect(JSON.stringify(await result.json())).not.toContain(token)
 }finally{await f.db.close()}
},30000)
it('updates renewals, cancelled paid periods, holds, recovery and revocation from current Google evidence rather than event order or type',async()=>{
 const f=await setup()
 try{
  await handleGoogleNotification(request(),f.deps)
  f.setCurrent({subscriptionState:'SUBSCRIPTION_STATE_CANCELED',acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'})
  expect((await handleGoogleNotification(request('2'),f.deps)).status).toBe(200)
  expect(await f.rpc('google_purchase_access',[owner])).toMatchObject({proExpiresAt:expect.any(String),purchaseBlocked:true})
  f.setCurrent({subscriptionState:'SUBSCRIPTION_STATE_ON_HOLD'})
  expect((await handleGoogleNotification(request('3'),f.deps)).status).toBe(200)
  expect(await f.rpc('google_purchase_access',[owner])).toMatchObject({proExpiresAt:null,purchaseBlocked:true})
  f.setCurrent({subscriptionState:'SUBSCRIPTION_STATE_ACTIVE'})
  expect((await handleGoogleNotification(request('4'),f.deps)).status).toBe(200)
  expect(await f.rpc('google_purchase_access',[owner])).toMatchObject({proExpiresAt:expect.any(String)})
  // Refunding an older renewal is a signal to recheck, not an instruction to
  // discard a currently valid paid period.
  expect((await handleGoogleNotification(request('40',{voidedPurchaseNotification:{purchaseToken:token,productType:1,refundType:1}}),f.deps)).status).toBe(200)
  expect(await f.rpc('google_purchase_access',[owner])).toMatchObject({proExpiresAt:expect.any(String)})
  f.setCurrent({subscriptionState:'SUBSCRIPTION_STATE_EXPIRED'})
  expect((await handleGoogleNotification(request('5',{voidedPurchaseNotification:{purchaseToken:token,productType:1,refundType:1}}),f.deps)).status).toBe(200)
  expect(await f.rpc('google_purchase_access',[owner])).toMatchObject({proExpiresAt:null,purchaseBlocked:false})
  // A delayed renewal event must not replay its old active state.
  expect((await handleGoogleNotification(request('6'),f.deps)).status).toBe(200)
  expect(await f.rpc('google_purchase_access',[owner])).toMatchObject({proExpiresAt:null})
  expect(f.discover).toHaveBeenCalledOnce();expect(f.acknowledge).toHaveBeenCalledOnce()
 }finally{await f.db.close()}
},30000)
it('retries interrupted acknowledgment and completion without duplicate grants or acknowledging an unverified purchase',async()=>{
 const f=await setup()
 try{
  f.acknowledge.mockRejectedValueOnce(Error('synthetic ack interruption'))
  expect((await handleGoogleNotification(request(),f.deps)).status).toBe(503)
  expect((await handleGoogleNotification(request(),f.deps)).status).toBe(200)
  expect(f.acknowledge).toHaveBeenCalledTimes(2)
  const original=f.service.rpc.getMockImplementation()!
  f.service.rpc.mockImplementationOnce(async()=>({data:null,error:{code:'synthetic'}}))
  expect((await handleGoogleNotification(request('2'),f.deps)).status).toBe(503)
  f.service.rpc.mockImplementation(async(name,args={})=>name==='google_notification_complete'?{data:null,error:{code:'synthetic'}}:original(name,args))
  expect((await handleGoogleNotification(request('2'),f.deps)).status).toBe(503)
  f.service.rpc.mockImplementation(original)
  expect((await handleGoogleNotification(request('2'),f.deps)).status).toBe(200)
  expect(f.acknowledge).toHaveBeenCalledTimes(2)
  await f.db.exec('reset role');expect((await f.db.query('select count(*)::int n from tenaceiq_google.purchases')).rows[0]).toEqual({n:1})
 }finally{await f.db.close()}
},30000)
it('authenticates before parsing or touching the database and never trusts body-supplied owner/access claims',async()=>{
 const f=await setup()
 try{
  f.authenticate.mockRejectedValueOnce(new GoogleNotificationAuthError('unauthorized'))
  expect((await handleGoogleNotification(request(),f.deps)).status).toBe(401);expect(f.service.rpc).not.toHaveBeenCalled();expect(f.discover).not.toHaveBeenCalled()
  f.authenticate.mockRejectedValueOnce(Error('synthetic key outage'))
  expect((await handleGoogleNotification(request(),f.deps)).status).toBe(503);expect(f.service.rpc).not.toHaveBeenCalled()
  expect((await handleGoogleNotification(request('2',{testNotification:{version:'1.0'},subscriptionNotification:{version:'1.0',notificationType:2,purchaseToken:token}}),f.deps)).status).toBe(400)
  expect((await handleGoogleNotification(request('2',{testNotification:{version:'1.0'},subscriptionNotification:undefined}),f.deps)).status).toBe(200)
  expect(f.service.rpc).not.toHaveBeenCalled()
  f.discover.mockResolvedValueOnce({...await f.discover(),accountId:'f'.repeat(64)})
  expect((await handleGoogleNotification(request('3',{ownerId:owner,active:true,subscriptionNotification:{version:'1.0',notificationType:2,purchaseToken:token}}),f.deps)).status).toBe(200)
  expect(f.verify).not.toHaveBeenCalled();expect(await f.rpc('google_purchase_access',[owner])).toMatchObject({proExpiresAt:null})
 }finally{await f.db.close()}
},30000)
it('does not revive deleted accounts and rejects event/message collisions or changed canonical bindings',async()=>{
 const f=await setup()
 try{
  await handleGoogleNotification(request(),f.deps)
  expect((await handleGoogleNotification(request('123456789',{subscriptionNotification:{version:'1.0',notificationType:12,purchaseToken:token}}),f.deps)).status).toBe(503)
  f.setCurrent({externalAccountIdentifiers:{obfuscatedExternalAccountId:'f'.repeat(64)}})
  expect((await handleGoogleNotification(request('2'),f.deps)).status).toBe(503)
  expect(f.acknowledge).toHaveBeenCalledOnce()
  await f.db.exec(`reset role;insert into public.account_deletion_requests values('${owner}',true);set role service_role`)
  const count=f.verify.mock.calls.length
  expect((await handleGoogleNotification(request('3'),f.deps)).status).toBe(200);expect(f.verify).toHaveBeenCalledTimes(count)
  expect(await f.rpc('google_purchase_access',[owner])).toMatchObject({proExpiresAt:null})
 }finally{await f.db.close()}
},30000)
it('discovers a binding through fixed authenticated canonical endpoints and rejects production evidence',async()=>{
 const accountId='a'.repeat(64)
 let data=provider(accountId)
 const send=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  expect(init?.cache).toBe('no-store');expect(init?.redirect).toBe('error')
  return String(input).includes('oauth2')?Response.json({access_token:'synthetic-google-access-token-123',token_type:'Bearer',expires_in:3600}):Response.json(data)
 })
 expect(await googleProNotificationPurchase(play,token,send)).toMatchObject({accountId,environment:'Test'})
 expect(send.mock.calls[1][0]).toBe('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.tenaceiq.app/purchases/subscriptionsv2/tokens/'+encodeURIComponent(token))
 data=provider(accountId,{testPurchase:undefined})
 await expect(googleProNotificationPurchase(play,token,send)).rejects.toThrow('google_purchase_mismatch')
 send.mockClear();await expect(googleProNotificationPurchase({...play,mode:'production'},token,send)).rejects.toThrow('google_purchase_mismatch');expect(send).not.toHaveBeenCalled()
})
it('leaves the actual notification route disabled with absent configuration',async()=>{
 const response=await POST(request())
 expect(response.status).toBe(503);expect(response.headers.get('cache-control')).toContain('no-store')
})
