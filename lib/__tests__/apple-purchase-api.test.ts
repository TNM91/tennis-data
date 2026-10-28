import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
const m=vi.hoisted(()=>({identity:vi.fn(),client:vi.fn(),config:vi.fn(),verify:vi.fn(),canonical:vi.fn(),notification:vi.fn(),transaction:vi.fn()}))
vi.mock('../mobile-account-auth',()=>({verifiedAccount:m.identity,accountClient:m.client,accountResponse:(body:unknown,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',...headers}}),readAccountJson:async(r:Request)=>r.json()}))
vi.mock('../apple-purchase-server',()=>({applePurchaseConfiguration:m.config,appleVerification:m.verify,currentAppleMembership:m.canonical,appleVerifier:()=>({verifyAndDecodeNotification:m.notification,verifyAndDecodeTransaction:m.transaction}),APPLE_APP_ID:6826324431}))
import {applePurchaseContext,prepareApplePurchase,reconcileApplePurchase,type ApplePurchaseContext} from '../apple-purchase-api'
import {POST as notification} from '../../app/api/apple/notifications/[environment]/route'
const owner='11111111-1111-4111-8111-111111111111',token='22222222-2222-4222-8222-222222222222',operation='33333333-3333-4333-8333-333333333333',sku='com.tenaceiq.app.player.monthly'
const request=()=>new Request('https://www.tenaceiq.com/api/mobile/apple-purchases',{headers:{Authorization:'Bearer synthetic'}})
const config={mode:'sandbox' as const,environment:'Sandbox' as const,key:'synthetic',keyId:'ABCDEFGHIJ',issuerId:owner}
function fixture(){
 const profile={role:'member',player_plus_subscription_active:false,player_plus_subscription_status:'inactive',captain_subscription_active:false}
 const values:Record<string,{data:unknown;error:unknown}>={apple_purchase_catalog_ready:{data:true,error:null},apple_purchase_account:{data:{ownerId:owner,accountToken:token,sandboxEnabled:true},error:null},apple_purchase_access:{data:{ownerId:owner,playerExpiresAt:null,captainExpiresAt:null},error:null},apple_purchase_claim:{data:{ok:true,lease:operation},error:null},apple_purchase_commit:{data:{ok:true,receipt:{transactionId:'1002',accountToken:token,environment:'Sandbox'}},error:null}}
 const rpc=vi.fn(async(name:string)=>values[name]||{data:null,error:null})
 const builder={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn(async()=>({data:profile,error:null}))}
 const service={rpc,from:vi.fn(()=>builder)}
 m.client.mockReturnValue(service);m.identity.mockResolvedValue({user:{id:owner}});m.config.mockReturnValue(config);m.canonical.mockResolvedValue({membership:{environment:'Sandbox',originalTransactionId:'1001'},acknowledgedTransactionId:'1002'});m.verify.mockReturnValue({})
 const ctx={owner,service,config,accountToken:token,webBlocked:false,activeProductId:null,canPurchase:true} as unknown as ApplePurchaseContext
 return {ctx,rpc,profile,values,builder}
}
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-server-key')})
afterEach(()=>vi.unstubAllEnvs())
describe('Apple purchase server account boundary',()=>{
 it('authenticates even when off and never reaches the database while disabled',async()=>{
  const f=fixture();m.config.mockReturnValue(null);expect(await applePurchaseContext(request())).toEqual({context:null});expect(f.rpc).not.toHaveBeenCalled();m.identity.mockResolvedValue(null);const r=await applePurchaseContext(request());expect('response'in r&&r.response.status).toBe(401)
 })
 it('isolates sandbox accounts and blocks a second purchase for existing website access',async()=>{
  const f=fixture();f.values.apple_purchase_account.data={ownerId:owner,accountToken:token,sandboxEnabled:false};expect(await applePurchaseContext(request())).toEqual({context:null})
  f.values.apple_purchase_account.data={ownerId:owner,accountToken:token,sandboxEnabled:true};f.profile.player_plus_subscription_active=true;f.profile.player_plus_subscription_status='active'
  const result=await applePurchaseContext(request());expect('context'in result&&result.context).toMatchObject({webBlocked:true,canPurchase:false});expect((await prepareApplePurchase({...f.ctx,canPurchase:false},sku)).status).toBe(409);expect((await prepareApplePurchase(f.ctx,'unknown')).status).toBe(400)
 })
 it('creates only a server-owned token and acknowledges only after a canonical durable commit',async()=>{
  const f=fixture();expect(await (await prepareApplePurchase(f.ctx,sku)).json()).toMatchObject({accountToken:token,environment:'Sandbox',productId:sku});expect(f.rpc).toHaveBeenCalledWith('apple_purchase_account',{p_owner:owner,p_create:true})
  const response=await reconcileApplePurchase(f.ctx,operation,'signed.receipt.sig');expect(response.status).toBe(200);expect(m.canonical).toHaveBeenCalledWith('signed.receipt.sig',token,'Sandbox',{})
  expect(f.rpc).toHaveBeenCalledWith('apple_purchase_commit',expect.objectContaining({p_owner:owner,p_operation:operation,p_lease:operation,p_acknowledged:'1002'}));expect(f.rpc.mock.invocationCallOrder.at(-1)).toBeGreaterThan(m.canonical.mock.invocationCallOrder[0])
 })
 it('replays only the owner-bound durable receipt and fails closed on provider, quota and commit errors',async()=>{
  const f=fixture();f.values.apple_purchase_claim.data={ok:true,receipt:{transactionId:'1002',accountToken:token,environment:'Sandbox'}};expect((await reconcileApplePurchase(f.ctx,operation,'signed.receipt.sig')).status).toBe(200);expect(m.canonical).not.toHaveBeenCalled()
  f.values.apple_purchase_claim.data={ok:true,receipt:{transactionId:'1002',accountToken:owner,environment:'Sandbox'}};expect((await reconcileApplePurchase(f.ctx,operation,'signed.receipt.sig')).status).toBe(503)
  f.values.apple_purchase_claim.data={ok:false,status:429};const limited=await reconcileApplePurchase(f.ctx,operation,'signed.receipt.sig');expect(limited.status).toBe(429);expect(limited.headers.get('Retry-After')).toBe('900')
  f.values.apple_purchase_claim.data={ok:true,lease:operation};m.canonical.mockRejectedValueOnce(Error('network'));expect((await reconcileApplePurchase(f.ctx,operation,'signed.receipt.sig')).status).toBe(503)
  m.canonical.mockRejectedValueOnce(Error('apple_transaction_mismatch'));expect((await reconcileApplePurchase(f.ctx,operation,'signed.receipt.sig')).status).toBe(409)
  f.values.apple_purchase_commit.error={code:'unavailable'};expect((await reconcileApplePurchase(f.ctx,operation,'signed.receipt.sig')).status).toBe(503)
 })
})
describe('Apple signed notification boundary',()=>{
 const send=()=>notification(new Request('https://www.tenaceiq.com/api/apple/notifications/sandbox',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({signedPayload:'signed.notification.sig'})}),{params:Promise.resolve({environment:'sandbox'})})
 const payload=()=>({version:'2.0',notificationUUID:operation,data:{environment:'Sandbox',bundleId:'com.tenaceiq.app',signedTransactionInfo:'signed.receipt.sig'}})
 it('rejects an invalid outer signature or environment before any database call',async()=>{
  const f=fixture();m.notification.mockRejectedValueOnce(Error('bad signature'));expect((await send()).status).toBe(503);expect(f.rpc).not.toHaveBeenCalled();m.notification.mockResolvedValue({...payload(),data:{...payload().data,environment:'Production'}});expect((await send()).status).toBe(400);expect(f.rpc).not.toHaveBeenCalled()
 })
 it('does not recreate a deleted or unbound account, and applies verified current status through the notification lane',async()=>{
  const f=fixture();m.notification.mockResolvedValue(payload());m.transaction.mockResolvedValue({appAccountToken:token});f.values.apple_purchase_account.data=null;expect((await send()).status).toBe(200);expect(m.canonical).not.toHaveBeenCalled()
  f.values.apple_purchase_account.data={ownerId:owner,accountToken:token,sandboxEnabled:true};expect((await send()).status).toBe(200);expect(f.rpc).toHaveBeenCalledWith('apple_purchase_account',{p_owner:null,p_token:token});expect(f.rpc).toHaveBeenCalledWith('apple_purchase_claim',expect.objectContaining({p_owner:owner,p_kind:'notification'}))
 })
})
