import {it,expect,vi} from 'vitest'
import {createHash,generateKeyPairSync} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
vi.mock('server-only',()=>({}))
import {googleLedgerFixture} from './fixtures/google-purchase-ledger'
import {reconcileGooglePro,prepareGooglePro,type GooglePurchaseContext} from '../google-purchase-api'
import {googleProSettlement} from '../google-pro-settlement'
import {verifiedGooglePurchase,type GooglePurchaseExpectation} from '../google-play-verification'
import {GOOGLE_PLAY_PRODUCTS} from '../google-play-products'

const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',operation='33333333-3333-4333-8333-333333333333',sku=GOOGLE_PLAY_PRODUCTS[0].id,token='synthetic-google-purchase-token-1'
const keys=generateKeyPairSync('rsa',{modulusLength:2048}),config={mode:'test' as const,email:'purchase-reader@tenaceiq-test.iam.gserviceaccount.com',key:keys.privateKey.export({type:'pkcs8',format:'pem'}).toString()}
const body={productId:sku,purchaseToken:token,operationId:operation}
function provider(accountId:string,patch:Record<string,unknown>={}){
 const now=Date.now()
 return {regionCode:'US',subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',startTime:new Date(now-1000).toISOString(),acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING',externalAccountIdentifiers:{obfuscatedExternalAccountId:accountId},lineItems:[{productId:sku,expiryTime:new Date(now+86400000).toISOString(),offerDetails:{basePlanId:'monthly'},autoRenewingPlan:{autoRenewEnabled:true}}],testPurchase:{},...patch}
}
async function setup(){
 const f=await googleLedgerFixture(),account=await f.enable(),calls:string[]=[]
 const service={rpc:vi.fn(async(name:string,args:Record<string,unknown>={})=>{
  calls.push(name)
  const keys=Object.keys(args),parameters=keys.map((key,index)=>key+'=> $'+(index+1)).join(',')
  try{return {data:(await f.db.query<{r:unknown}>('select public.'+name+'('+parameters+') r',keys.map(k=>args[k]))).rows[0].r,error:null}}catch{return {data:null,error:{code:'database-unavailable'}}}
 })}
 const ctx={owner,service:service as unknown as SupabaseClient,config,accountId:account.accountId,canPurchase:true,otherAccess:false,active:false,manageRequired:false} satisfies GooglePurchaseContext
 const verify=vi.fn(async(expected:GooglePurchaseExpectation)=>{calls.push('provider-verify');return verifiedGooglePurchase(provider(account.accountId),expected)})
 const acknowledge=vi.fn(async()=>{calls.push('provider-ack');expect(await f.rpc('google_purchase_access',[owner])).toMatchObject({proExpiresAt:expect.any(String)})})
 return {...f,account,service,ctx,calls,verify,acknowledge}
}

it('delivers durable access before acknowledgment, returns a bound receipt and does not duplicate a restored purchase',async()=>{
 const f=await setup()
 try{
  expect((await prepareGooglePro(f.ctx,sku,null)).status).toBe(200)
  const result=await reconcileGooglePro(f.ctx,body,{verify:f.verify,acknowledge:f.acknowledge})
  expect(result.status).toBe(200);expect(result.headers.get('cache-control')).toContain('no-store')
  expect(await result.json()).toMatchObject({ownerId:owner,receipt:{delivered:true,settled:true,active:true,accountId:f.account.accountId,profileId:null,tokenHash:createHash('sha256').update(token).digest('hex')}})
  expect(f.calls.indexOf('google_purchase_save')).toBeLessThan(f.calls.indexOf('provider-ack'));expect(f.calls.indexOf('provider-ack')).toBeLessThan(f.calls.indexOf('google_purchase_settle'))
  f.verify.mockImplementationOnce(async expected=>verifiedGooglePurchase(provider(f.account.accountId,{acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'}),expected))
  expect((await reconcileGooglePro(f.ctx,body,{verify:f.verify,acknowledge:f.acknowledge})).status).toBe(200)
  expect(f.acknowledge).toHaveBeenCalledOnce()
  expect((await reconcileGooglePro(f.ctx,body,{verify:f.verify,acknowledge:f.acknowledge})).status).toBe(200);expect(f.acknowledge).toHaveBeenCalledOnce()
  await f.db.exec('reset role');expect((await f.db.query('select count(*)::int n from tenaceiq_google.purchases')).rows[0]).toEqual({n:1})
 }finally{await f.db.close()}
},30000)

it('recovers a saved grant after interrupted acknowledgment without opening another payment or trusting an old receipt',async()=>{
 const f=await setup()
 try{
  f.acknowledge.mockRejectedValueOnce(Error('synthetic transport interruption'))
  expect((await reconcileGooglePro(f.ctx,body,{verify:f.verify,acknowledge:f.acknowledge})).status).toBe(503)
  expect(await f.rpc('google_purchase_access',[owner])).toMatchObject({proExpiresAt:expect.any(String)})
  expect(await f.rpc('google_purchase_prepare',[owner])).toMatchObject({ok:false,code:'google_existing_access'})
  expect((await reconcileGooglePro(f.ctx,body,{verify:f.verify,acknowledge:f.acknowledge})).status).toBe(200)
  expect(f.verify).toHaveBeenCalledTimes(2);expect(f.acknowledge).toHaveBeenCalledTimes(2)
  f.verify.mockImplementationOnce(async expected=>verifiedGooglePurchase(provider(f.account.accountId,{subscriptionState:'SUBSCRIPTION_STATE_ON_HOLD'}),expected))
  const inactive=await reconcileGooglePro(f.ctx,body,{verify:f.verify,acknowledge:f.acknowledge})
  expect(await inactive.json()).toMatchObject({receipt:{active:false,settled:true}});expect(f.acknowledge).toHaveBeenCalledTimes(2)
  expect(await f.rpc('google_purchase_access',[owner])).toMatchObject({proExpiresAt:null,purchaseBlocked:true})
  expect(await f.rpc('google_purchase_prepare',[owner])).toMatchObject({ok:false,code:'google_existing_access'})
  f.verify.mockImplementationOnce(async expected=>verifiedGooglePurchase(provider(f.account.accountId,{subscriptionState:'SUBSCRIPTION_STATE_PAUSED'}),expected))
  expect((await reconcileGooglePro(f.ctx,body,{verify:f.verify,acknowledge:f.acknowledge})).status).toBe(200)
  expect(await f.rpc('google_purchase_access',[owner])).toMatchObject({proExpiresAt:null,purchaseBlocked:true})
  f.verify.mockImplementationOnce(async expected=>verifiedGooglePurchase(provider(f.account.accountId,{subscriptionState:'SUBSCRIPTION_STATE_EXPIRED'}),expected))
  expect((await reconcileGooglePro(f.ctx,body,{verify:f.verify,acknowledge:f.acknowledge})).status).toBe(200)
  expect(await f.rpc('google_purchase_access',[owner])).toMatchObject({proExpiresAt:null,purchaseBlocked:false})
  expect(await f.rpc('google_purchase_prepare',[owner])).toMatchObject({ok:true})
  expect(f.acknowledge).toHaveBeenCalledTimes(2)
 }finally{await f.db.close()}
},30000)

it('does not acknowledge unverified, foreign, pending, production or unsaved purchases',async()=>{
 const f=await setup()
 try{
  f.verify.mockImplementationOnce(async expected=>verifiedGooglePurchase(provider('c'.repeat(64)),expected))
  expect((await reconcileGooglePro(f.ctx,body,{verify:f.verify,acknowledge:f.acknowledge})).status).toBe(409)
  f.verify.mockImplementationOnce(async expected=>verifiedGooglePurchase(provider(f.account.accountId,{subscriptionState:'SUBSCRIPTION_STATE_PENDING'}),expected))
  expect((await reconcileGooglePro(f.ctx,body,{verify:f.verify,acknowledge:f.acknowledge})).status).toBe(409)
  f.verify.mockImplementationOnce(async expected=>({...verifiedGooglePurchase(provider(f.account.accountId),expected),environment:'Production'}))
  expect((await reconcileGooglePro(f.ctx,body,{verify:f.verify,acknowledge:f.acknowledge})).status).toBe(409)
  const original=f.service.rpc.getMockImplementation()!
  f.service.rpc.mockImplementation(async(name,args={})=>name==='google_purchase_save'?{data:null,error:{code:'database-unavailable'}}:original(name,args))
  expect((await reconcileGooglePro(f.ctx,body,{verify:f.verify,acknowledge:f.acknowledge})).status).toBe(503)
  expect(f.acknowledge).not.toHaveBeenCalled();expect(await f.rpc('google_purchase_access',[owner])).toMatchObject({proExpiresAt:null})
  expect((await prepareGooglePro(f.ctx,GOOGLE_PLAY_PRODUCTS[1].id,operation)).status).toBe(400)
  expect((await reconcileGooglePro(f.ctx,{...body,productId:GOOGLE_PLAY_PRODUCTS[2].id},{verify:f.verify,acknowledge:f.acknowledge})).status).toBe(400)
 }finally{await f.db.close()}
},30000)

it('rechecks ownership and deletion at the database boundary and closes inactive grants without falsely acknowledging them',async()=>{
 const f=await setup()
 try{
  f.verify.mockImplementationOnce(async expected=>verifiedGooglePurchase(provider(f.account.accountId,{subscriptionState:'SUBSCRIPTION_STATE_EXPIRED'}),expected))
  const inactive=await reconcileGooglePro(f.ctx,body,{verify:f.verify,acknowledge:f.acknowledge})
  expect(inactive.status).toBe(200);expect(await inactive.json()).toMatchObject({receipt:{active:false,settled:true,acknowledged:false}});expect(f.acknowledge).not.toHaveBeenCalled()
  await f.db.exec(`reset role;insert into account_deletion_requests values('${owner}',true);set role service_role`)
  expect((await reconcileGooglePro(f.ctx,body,{verify:f.verify,acknowledge:f.acknowledge})).status).toBe(403)
  expect(f.acknowledge).not.toHaveBeenCalled()
  expect((await reconcileGooglePro({...f.ctx,owner:other},body,{verify:f.verify,acknowledge:f.acknowledge})).status).not.toBe(200)
 }finally{await f.db.close()}
},30000)

it('restricts the Google write operation to saved test-mode Pro grants and fixed no-cache endpoints',async()=>{
 const digest=createHash('sha256').update(token).digest('hex'),permit={saved:true as const,active:true as const,productId:sku,tokenHash:digest,accountId:'a'.repeat(64),environment:'Test' as const,lease:operation}
 const send=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{expect(init?.cache).toBe('no-store');return String(input).includes('oauth2')?Response.json({access_token:'synthetic-access-token-1234',token_type:'Bearer',expires_in:3600}):new Response(null,{status:204})})
 await googleProSettlement(config,send).acknowledge(token,permit)
 expect(send.mock.calls[1][0]).toBe('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.tenaceiq.app/purchases/subscriptions/'+sku+'/tokens/'+encodeURIComponent(token)+':acknowledge')
 for(const call of send.mock.calls){const init=call[1] as RequestInit;expect(init.cache).toBe('no-store');expect(init.redirect).toBe('error');expect(init.method).toBe('POST')}
 send.mockClear()
 for(const patch of [{saved:false},{active:false},{tokenHash:'c'.repeat(64)},{productId:GOOGLE_PLAY_PRODUCTS[1].id},{environment:'Production'}])await expect(googleProSettlement(config,send).acknowledge(token,{...permit,...patch} as typeof permit)).rejects.toThrow('google_settlement_unavailable')
 await expect(googleProSettlement({...config,mode:'production'},send).acknowledge(token,permit)).rejects.toThrow('google_settlement_unavailable');expect(send).not.toHaveBeenCalled()
})
