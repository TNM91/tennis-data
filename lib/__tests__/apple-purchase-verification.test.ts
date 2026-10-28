import {afterEach,describe,expect,it,vi} from 'vitest'
import {generateKeyPairSync,X509Certificate} from 'node:crypto'
vi.mock('server-only',()=>({}))
import {applePurchaseConfiguration,appleVerifier,currentAppleMembership,type AppleVerification} from '../apple-purchase-server'
import {APPLE_TRUST_ROOTS} from '../apple-trust-roots'
import {appleMembership,mergeAppleAccess} from '../apple-purchase-contract'
import {DEFAULT_ENTITLEMENTS,buildProductAccessState} from '../access-model-core'
const token='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',now=Date.now()
const payload=(patch:Record<string,unknown>={})=>({environment:'Sandbox',bundleId:'com.tenaceiq.app',subscriptionGroupIdentifier:'22523692',appAccountToken:token,originalTransactionId:'1001',transactionId:'1002',productId:'com.tenaceiq.app.player.monthly',type:'Auto-Renewable Subscription',inAppOwnershipType:'PURCHASED',storefront:'USA',expiresDate:now+86400000,signedDate:now,...patch})
afterEach(()=>vi.unstubAllEnvs())
describe('Apple signed transaction boundary',()=>{
 it('pins public Apple trust roots and rejects an attacker-signed or unsigned payload',async()=>{
  expect(APPLE_TRUST_ROOTS.map(v=>new X509Certificate(Buffer.from(v,'base64')).fingerprint256)).toEqual(['C2:B9:B0:42:DD:57:83:0E:7D:11:7D:AC:55:AC:8A:E1:94:07:D3:8E:41:D8:8F:32:15:BC:3A:89:04:44:A0:50','63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79'])
  const fake=Buffer.from(JSON.stringify({alg:'none',x5c:[]})).toString('base64url')+'.'+Buffer.from(JSON.stringify(payload())).toString('base64url')+'.fake'
  await expect(appleVerifier('Sandbox').verifyAndDecodeTransaction(fake)).rejects.toThrow()
 })
 it('keeps access enablement separate from new-sale mode and requires a valid separate server key',()=>{
  const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey.export({type:'pkcs8',format:'pem'}).toString(),env={APPLE_MEMBERSHIPS_ENABLED:'true',APPLE_PURCHASE_MODE:'sandbox',APPLE_IAP_KEY_ID:'ABCDEFGHIJ',APPLE_IAP_ISSUER_ID:token,APPLE_IAP_PRIVATE_KEY:key}
  expect(applePurchaseConfiguration(env as never)).toMatchObject({mode:'sandbox',environment:'Sandbox',key:key.trim()})
  expect(applePurchaseConfiguration({...env,APPLE_IAP_PRIVATE_KEY:key.replace(/\n/g,'\\n')} as never)?.key).toBe(key.trim())
  expect(applePurchaseConfiguration({...env,APPLE_PURCHASE_MODE:'off'} as never)).toMatchObject({mode:'off'})
  for(const patch of [{APPLE_MEMBERSHIPS_ENABLED:'false'},{APPLE_IAP_PRIVATE_KEY:'not a key'},{APPLE_IAP_KEY_ID:'bad'},{APPLE_IAP_ISSUER_ID:'bad'}])expect(applePurchaseConfiguration({...env,...patch} as never)).toBeNull()
 })
 it('binds verified ownership, environment, product, region, type and safe dates',()=>{
  expect(appleMembership(payload({appAccountToken:token.toUpperCase()}),'Sandbox',token,1)).toMatchObject({appAccountToken:token,status:1})
  for(const patch of [{appAccountToken:other},{environment:'Production'},{bundleId:'other.app'},{productId:'com.tenaceiq.app.coach.monthly'},{inAppOwnershipType:'FAMILY_SHARED'},{storefront:'CAN'},{type:'Consumable'},{transactionId:'not-an-id'},{expiresDate:'tomorrow'},{signedDate:now+600000}])expect(()=>appleMembership(payload(patch),'Sandbox',token,1)).toThrow('mismatch')
 })
 it('uses current Apple server status rather than the submitted old receipt for access',async()=>{
  const latest=payload({transactionId:'1003',productId:'com.tenaceiq.app.captain.monthly',revocationDate:now,signedDate:now+1000})
  const decode=vi.fn(async(jws:string)=>jws==='submitted.receipt.sig'?payload():latest)
  const statuses=vi.fn(async()=>({environment:'Sandbox',bundleId:'com.tenaceiq.app',data:[{subscriptionGroupIdentifier:'22523692',lastTransactions:[{originalTransactionId:'1001',status:5,signedTransactionInfo:'latest.receipt.sig'}]}]}))
  const r=await currentAppleMembership('submitted.receipt.sig',token,'Sandbox',{decode,statuses} as AppleVerification)
  expect(r).toMatchObject({acknowledgedTransactionId:'1002',membership:{transactionId:'1003',productId:'com.tenaceiq.app.captain.monthly',status:5,revoked:true}})
  expect(statuses).toHaveBeenCalledExactlyOnceWith('1001');expect(decode).toHaveBeenCalledTimes(2)
 })
 it('never looks up status from an unverified transaction and rejects mismatched current status',async()=>{
  const statuses=vi.fn();await expect(currentAppleMembership('bad.receipt.sig',token,'Sandbox',{decode:async()=>{throw Error('unverified')},statuses})).rejects.toThrow('unverified');expect(statuses).not.toHaveBeenCalled()
  for(const response of [{environment:'Production',bundleId:'com.tenaceiq.app',data:[]},{environment:'Sandbox',bundleId:'other',data:[]},{environment:'Sandbox',bundleId:'com.tenaceiq.app',data:[]}])await expect(currentAppleMembership('old.receipt.sig',token,'Sandbox',{decode:async()=>payload(),statuses:async()=>response})).rejects.toThrow('status_mismatch')
 })
 it('adds only unexpired Apple tools and preserves a valid web or administrative grant through Apple expiry',()=>{
  const until=new Date(now+86400000).toISOString(),web={...DEFAULT_ENTITLEMENTS,playerPlusSubscriptionActive:true,playerPlusSubscriptionStatus:'canceled' as const,playerPlusAccessExpiresAt:null}
  const merged=mergeAppleAccess(web,{playerExpiresAt:until,captainExpiresAt:until},now)
  expect(merged.playerPlusAccessExpiresAt).toBeNull();expect(merged.playerPlusSubscriptionStatus).toBe('canceled')
  expect(buildProductAccessState('member',merged,now).canUseCaptainWorkflow).toBe(true)
  const expired=mergeAppleAccess(web,{playerExpiresAt:new Date(now-1).toISOString(),captainExpiresAt:null},now)
  expect(expired).toEqual(web);expect(buildProductAccessState('member',expired,now).canUseAdvancedPlayerInsights).toBe(true)
  expect(buildProductAccessState('admin',expired,now).canUseCaptainWorkflow).toBe(true)
 })
})
