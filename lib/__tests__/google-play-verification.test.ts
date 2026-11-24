import {describe,it,expect,vi} from 'vitest'
import {createHash,generateKeyPairSync,verify} from 'node:crypto'
vi.mock('server-only',()=>({}))
import {GOOGLE_PLAY_PRODUCTS} from '../google-play-products'
import {googleAccountBinding,googleEventBinding,verifiedGooglePurchase} from '../google-play-verification'
import {googlePlayConfiguration,googlePurchaseReader} from '../google-play-server'

const now=Date.parse('2026-11-23T12:00:00Z'),accountId='a'.repeat(64),profileId='b'.repeat(64),purchaseToken='fake-google-purchase-token-1111'
const pro=GOOGLE_PLAY_PRODUCTS[0],tournament=GOOGLE_PLAY_PRODUCTS[1],league=GOOGLE_PLAY_PRODUCTS[2]
const expected=(productId:string=pro.id)=>({productId,purchaseToken,accountId,profileId:productId===pro.id?null:profileId,allowTest:false})
const subscription=(patch:Record<string,unknown>={})=>({regionCode:'US',subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',startTime:new Date(now-86400000).toISOString(),acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING',externalAccountIdentifiers:{obfuscatedExternalAccountId:accountId},lineItems:[{productId:pro.id,expiryTime:new Date(now+86400000).toISOString(),offerDetails:{basePlanId:'monthly'},autoRenewingPlan:{autoRenewEnabled:true}}],...patch})
const event=(id:string=tournament.id,patch:Record<string,unknown>={})=>({regionCode:'US',purchaseStateContext:{purchaseState:'PURCHASED'},obfuscatedExternalAccountId:accountId,obfuscatedExternalProfileId:profileId,acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING',purchaseCompletionTime:new Date(now-1000).toISOString(),productLineItem:[{productId:id,productOfferDetails:{purchaseOptionId:'standard',quantity:1,refundableQuantity:1,consumptionState:'CONSUMPTION_STATE_YET_TO_BE_CONSUMED'}}],...patch})

describe('Google canonical purchase verification',()=>{
 it('maps the approved Pro, tournament and league terms without granting or settling anything',()=>{
  expect(GOOGLE_PLAY_PRODUCTS.map(p=>p.amountCents)).toEqual([499,500,2500])
  expect(verifiedGooglePurchase(subscription(),expected(),now)).toMatchObject({kind:'pro',active:true,acknowledged:false,consumed:false,environment:'Production',tokenHash:createHash('sha256').update(purchaseToken).digest('hex')})
  for(const item of [tournament,league])expect(verifiedGooglePurchase(event(item.id),expected(item.id),now)).toMatchObject({kind:item.kind,active:true,profileId})
 })
 it.each(['SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED'])('preserves the paid period for %s',subscriptionState=>{
  expect(verifiedGooglePurchase(subscription({subscriptionState}),expected(),now).active).toBe(true)
 })
 it.each(['SUBSCRIPTION_STATE_ON_HOLD','SUBSCRIPTION_STATE_PAUSED','SUBSCRIPTION_STATE_EXPIRED','SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED'])('does not grant %s even when a date is in the future',subscriptionState=>{
  expect(verifiedGooglePurchase(subscription({subscriptionState}),expected(),now).active).toBe(false)
 })
 it('does not revive an expired Pro membership, refunded event or cancelled event',()=>{
  const expired=subscription();expired.lineItems[0].expiryTime=new Date(now-1).toISOString()
  expect(verifiedGooglePurchase(expired,expected(),now).active).toBe(false)
  const refunded=event();refunded.productLineItem[0].productOfferDetails.refundableQuantity=0
  expect(verifiedGooglePurchase(refunded,expected(tournament.id),now).active).toBe(false)
  expect(verifiedGooglePurchase(event(tournament.id,{purchaseStateContext:{purchaseState:'CANCELLED'}}),expected(tournament.id),now).active).toBe(false)
 })
 it('refuses pending purchases, test leakage and malformed account/event bindings',()=>{
  expect(()=>verifiedGooglePurchase(subscription({subscriptionState:'SUBSCRIPTION_STATE_PENDING'}),expected(),now)).toThrow('google_purchase_pending')
  expect(()=>verifiedGooglePurchase(event(tournament.id,{purchaseStateContext:{purchaseState:'PENDING'}}),expected(tournament.id),now)).toThrow('google_purchase_pending')
  expect(()=>verifiedGooglePurchase(subscription({testPurchase:{}}),expected(),now)).toThrow('google_test_purchase')
  expect(verifiedGooglePurchase(subscription({testPurchase:{}}),{...expected(),allowTest:true},now).environment).toBe('Test')
  expect(()=>verifiedGooglePurchase(event(tournament.id,{testPurchaseContext:{fopType:'TEST'}}),expected(tournament.id),now)).toThrow('google_test_purchase')
  expect(()=>verifiedGooglePurchase(subscription({externalAccountIdentifiers:{obfuscatedExternalAccountId:'c'.repeat(64)}}),expected(),now)).toThrow('google_purchase_mismatch')
  expect(()=>verifiedGooglePurchase(event(tournament.id,{obfuscatedExternalProfileId:'c'.repeat(64)}),expected(tournament.id),now)).toThrow('google_purchase_mismatch')
  expect(()=>verifiedGooglePurchase(event(),{...expected(tournament.id),profileId:null},now)).toThrow('google_purchase_mismatch')
 })
 it.each([
  {regionCode:'CA'},{regionCode:null},{acknowledgementState:'unknown'},
  {lineItems:[]},{lineItems:[{},{}]},{subscriptionState:'unknown'},
  {startTime:new Date(now+600000).toISOString()},
 ])('rejects a subscription with invalid scope or evidence %j',patch=>{
  expect(()=>verifiedGooglePurchase(subscription(patch),expected(),now)).toThrow('google_purchase_mismatch')
 })
 it('rejects unapproved subscription plans, trials, mixed products and malformed linked tokens',()=>{
  for(const patch of [{productId:league.id},{offerDetails:{basePlanId:'annual'}},{offerDetails:{basePlanId:'monthly',offerId:'trial'}},{autoRenewingPlan:{autoRenewEnabled:'true'}},{expiryTime:'invalid'}]){
   const data=subscription();Object.assign(data.lineItems[0],patch);expect(()=>verifiedGooglePurchase(data,expected(),now)).toThrow('google_purchase_mismatch')
  }
  expect(()=>verifiedGooglePurchase(subscription({linkedPurchaseToken:purchaseToken}),expected(),now)).toThrow('google_purchase_mismatch')
  expect(verifiedGooglePurchase(subscription({linkedPurchaseToken:'fake-linked-purchase-token'}),expected(),now).linkedTokenHash).toMatch(/^[a-f0-9]{64}$/)
 })
 it('requires a single non-rental, released, single-quantity event with the correct product and purchase option',()=>{
  for(const patch of [{quantity:2},{quantity:'1'},{refundableQuantity:2},{refundableQuantity:'1'},{purchaseOptionId:'other'},{rentOfferDetails:{}},{preorderOfferDetails:{}},{offerId:'sale'},{consumptionState:'unknown'}]){
   const data=event();Object.assign(data.productLineItem[0].productOfferDetails,patch);expect(()=>verifiedGooglePurchase(data,expected(tournament.id),now)).toThrow('google_purchase_mismatch')
  }
  expect(()=>verifiedGooglePurchase(event(league.id),expected(tournament.id),now)).toThrow('google_purchase_mismatch')
  const consumed=event();consumed.productLineItem[0].productOfferDetails.consumptionState='CONSUMPTION_STATE_CONSUMED'
  expect(verifiedGooglePurchase(consumed,expected(tournament.id),now).consumed).toBe(true)
 })
 it('uses purpose-separated, private stable account and per-attempt event bindings',()=>{
  const owner='11111111-1111-4111-8111-111111111111',target='22222222-2222-4222-8222-222222222222',attempt='33333333-3333-4333-8333-333333333333',secret='synthetic-binding-secret-'.repeat(3)
  const account=googleAccountBinding(owner,secret),eventBinding=googleEventBinding(owner,'tournament',target,attempt,secret)
  expect(account).toMatch(/^[a-f0-9]{64}$/);expect(googleAccountBinding(owner.toUpperCase(),secret)).toBe(account)
  expect(eventBinding).not.toBe(account);expect(googleEventBinding(owner,'league',target,attempt,secret)).not.toBe(eventBinding)
  expect(()=>googleAccountBinding(owner,'short')).toThrow();expect(()=>googleEventBinding(owner,'league','invalid',attempt,secret)).toThrow()
 })
})

describe('Google Publisher read boundary',()=>{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048}),key=privateKey.export({type:'pkcs8',format:'pem'}).toString(),email='purchase-reader@tenaceiq-test.iam.gserviceaccount.com'
 const config={email,key,mode:'production' as const},env={GOOGLE_PLAY_ENABLED:'true',GOOGLE_PLAY_PURCHASE_MODE:'production',GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL:email,GOOGLE_PLAY_PRIVATE_KEY:key}
 it('defaults to disabled and rejects wrong key types, weak RSA and unrecognized modes',()=>{
  expect(googlePlayConfiguration({})).toBeNull();expect(googlePlayConfiguration(env)).toEqual({...config,key:key.trim()})
  for(const patch of [{GOOGLE_PLAY_ENABLED:'false'},{GOOGLE_PLAY_PURCHASE_MODE:'live'},{GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL:'attacker@example.com'},{GOOGLE_PLAY_PRIVATE_KEY:'not-a-key'}])expect(googlePlayConfiguration({...env,...patch})).toBeNull()
  const weak=generateKeyPairSync('rsa',{modulusLength:1024}).privateKey.export({type:'pkcs8',format:'pem'}).toString();expect(googlePlayConfiguration({...env,GOOGLE_PLAY_PRIVATE_KEY:weak})).toBeNull()
 })
 it('signs a short-lived scoped assertion, uses only pinned endpoints, and encodes opaque tokens',async()=>{
  const encodedToken='token-with/slash?and=parameters',calls:{url:string;init?:RequestInit}[]=[]
  const send=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{const url=String(input);calls.push({url,init});return Response.json(calls.length===1?{access_token:'synthetic-access-token-1234',token_type:'Bearer',expires_in:3600}:subscription())})
  expect((await googlePurchaseReader(config,send).verify({...expected(),purchaseToken:encodedToken},now)).active).toBe(true)
  expect(calls).toHaveLength(2);expect(calls[0].url).toBe('https://oauth2.googleapis.com/token');expect(calls[1].url).toBe('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.tenaceiq.app/purchases/subscriptionsv2/tokens/'+encodeURIComponent(encodedToken))
  for(const call of calls)expect(call.init?.redirect).toBe('error')
  const assertion=(calls[0].init?.body as URLSearchParams).get('assertion')!,parts=assertion.split('.'),claims=JSON.parse(Buffer.from(parts[1],'base64url').toString())
  expect(claims).toMatchObject({iss:email,aud:calls[0].url,scope:'https://www.googleapis.com/auth/androidpublisher',iat:now/1000,exp:now/1000+300})
  expect(verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),publicKey,Buffer.from(parts[2],'base64url'))).toBe(true)
  expect(calls[1].init?.method).toBe('GET');expect((calls[1].init?.headers as Record<string,string>).Authorization).toBe('Bearer synthetic-access-token-1234')
 })
 it('pins event verification to productsv2 and refuses test/production crossover',async()=>{
  const send=vi.fn(async(input:RequestInfo|URL)=>String(input).includes('oauth2')?Response.json({access_token:'synthetic-access-token-1234',token_type:'Bearer',expires_in:3600}):Response.json(event(tournament.id,{testPurchaseContext:{fopType:'TEST'}})))
  await expect(googlePurchaseReader(config,send).verify({...expected(tournament.id),allowTest:true},now)).rejects.toThrow('google_test_purchase')
  expect(send.mock.calls[1][0]).toContain('/purchases/productsv2/tokens/')
  expect((await googlePurchaseReader({...config,mode:'test'},send).verify({...expected(tournament.id),allowTest:true},now)).environment).toBe('Test')
  const production=vi.fn(async(input:RequestInfo|URL)=>String(input).includes('oauth2')?Response.json({access_token:'synthetic-access-token-1234',token_type:'Bearer',expires_in:3600}):Response.json(subscription()))
  await expect(googlePurchaseReader({...config,mode:'test'},production).verify({...expected(),allowTest:true},now)).rejects.toThrow('google_purchase_mismatch')
 })
 it('rejects oversized/error responses without exposing provider details and does not request arbitrary products',async()=>{
  const send=vi.fn(async()=>new Response('private provider body',{status:403}))
  await expect(googlePurchaseReader(config,send).verify(expected(),now)).rejects.toThrow('google_verification_unavailable')
  send.mockClear();await expect(googlePurchaseReader(config,send).verify({...expected(),productId:'attacker'},now)).rejects.toThrow('google_purchase_mismatch');expect(send).not.toHaveBeenCalled()
  await expect(googlePurchaseReader(config,async()=>new Response('x'.repeat(9000))).verify(expected(),now)).rejects.toThrow('google_verification_unavailable')
  await expect(googlePurchaseReader(config,async()=>{throw Error('private transport failure '+purchaseToken)}).verify(expected(),now)).rejects.toThrow(/^google_verification_unavailable$/)
 })
})
