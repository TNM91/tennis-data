import {beforeEach,afterEach,it,expect,vi} from 'vitest'
vi.mock('server-only',()=>({}))
const m=vi.hoisted(()=>({identity:vi.fn(),client:vi.fn(),config:vi.fn()}))
vi.mock('../mobile-account-auth',()=>({verifiedAccount:m.identity,accountClient:m.client,accountResponse:(value:unknown,status=200,headers={})=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store',...headers}}),readAccountJson:async(request:Request)=>{try{return await request.json()}catch{return null}}}))
vi.mock('../google-play-server',()=>({googlePlayConfiguration:m.config,googlePurchaseReader:()=>({verify:vi.fn()})}))
import {googlePurchaseContext,googlePublicContext,prepareGooglePro} from '../google-purchase-api'
import {GET,POST} from '../../app/api/mobile/google-purchases/route'
import {GOOGLE_PLAY_PRODUCTS} from '../google-play-products'
const owner='11111111-1111-4111-8111-111111111111',accountId='a'.repeat(64),sku=GOOGLE_PLAY_PRODUCTS[0].id
const request=(body?:unknown)=>new Request('https://www.tenaceiq.com/api/mobile/google-purchases',{method:body?'POST':'GET',headers:{Authorization:'Bearer synthetic-token','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})
function fixture(){
 const profile={role:'member',stripe_subscription_id:null as string|null,coach_subscription_active:false,coach_subscription_status:'inactive',captain_subscription_active:false,captain_subscription_status:'inactive'}
 const values:Record<string,{data:unknown;error:unknown}>={google_purchase_catalog_ready:{data:true,error:null},google_purchase_account:{data:{ownerId:owner,accountId,testEnabled:true},error:null},google_purchase_access:{data:{ownerId:owner,proExpiresAt:null,purchaseBlocked:false},error:null},apple_purchase_access:{data:{ownerId:owner,playerExpiresAt:null,captainExpiresAt:null,proExpiresAt:null,purchaseBlocked:false},error:null},google_purchase_prepare:{data:{ok:true,productId:sku,targetId:null,profileId:null,accountId},error:null}}
 const rpc=vi.fn(async(name:string)=>values[name]??{data:null,error:null}),builder={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn(async()=>({data:profile,error:null}))}
 m.client.mockReturnValue({rpc,from:()=>builder});m.identity.mockResolvedValue({user:{id:owner}});m.config.mockReturnValue({mode:'test',email:'synthetic',key:'synthetic'})
 return {profile,values,rpc}
}
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('GOOGLE_PLAY_FULFILLMENT_ENABLED','true');vi.stubEnv('GOOGLE_PLAY_ENTITLEMENTS_ENABLED','true');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-server-key')})
afterEach(()=>vi.unstubAllEnvs())
it('authenticates before exposing readiness, and keeps unconfigured or production checkout disabled',async()=>{
 const f=fixture();m.identity.mockResolvedValueOnce(null);expect((await GET(request())).status).toBe(401);expect(m.client).not.toHaveBeenCalled()
 m.config.mockReturnValueOnce(null);expect(await (await GET(request())).json()).toMatchObject({enabled:false,ownerId:owner});expect(f.rpc).not.toHaveBeenCalled()
 m.config.mockReturnValueOnce({mode:'production'});expect(await (await GET(request())).json()).toMatchObject({enabled:false});expect(f.rpc).not.toHaveBeenCalled()
 vi.stubEnv('GOOGLE_PLAY_FULFILLMENT_ENABLED','false');expect(await (await GET(request())).json()).toMatchObject({enabled:false});expect(f.rpc).not.toHaveBeenCalled()
})
it('exposes only the Pro license-test catalog and no credentials',async()=>{
 fixture();const response=await GET(request()),data=await response.json()
 expect(response.headers.get('cache-control')).toContain('no-store');expect(data).toMatchObject({enabled:true,ownerId:owner,accountId,environment:'Test',canPurchase:true,products:[{id:sku,name:'TenAceIQ Pro'}]})
 expect(JSON.stringify(data)).not.toContain('synthetic');expect(data.products).toHaveLength(1)
})
it('fails closed on schema/identity/date mismatches and requires a server-approved license-test account',async()=>{
 const f=fixture();f.values.google_purchase_catalog_ready.data=false;expect((await GET(request())).status).toBe(503)
 f.values.google_purchase_catalog_ready.data=true;f.values.google_purchase_account.data={ownerId:owner,accountId,testEnabled:false};expect(await (await GET(request())).json()).toMatchObject({enabled:false})
 f.values.google_purchase_account.data={ownerId:'another-owner',accountId,testEnabled:true};expect((await GET(request())).status).toBe(503)
 f.values.google_purchase_account.data={ownerId:owner,accountId,testEnabled:true};f.values.google_purchase_access.data={ownerId:owner,proExpiresAt:'malformed',purchaseBlocked:false};expect((await GET(request())).status).toBe(503)
})
it('blocks duplicate web, Apple or existing Google Pro purchases while still allowing restoration context',async()=>{
 const f=fixture();f.profile.coach_subscription_active=true;f.profile.coach_subscription_status='active'
 const loaded=await googlePurchaseContext(request());if('response'in loaded||!loaded.context)throw Error('Fixture unavailable')
 expect(googlePublicContext(owner,loaded.context)).toMatchObject({enabled:true,canPurchase:false,otherAccess:true});expect((await prepareGooglePro(loaded.context,sku,null)).status).toBe(409)
 f.profile.coach_subscription_active=false;f.profile.coach_subscription_status='inactive';f.values.apple_purchase_access.data={ownerId:owner,captainExpiresAt:new Date(Date.now()+86400000).toISOString(),playerExpiresAt:null,proExpiresAt:null,purchaseBlocked:false}
 expect(await (await GET(request())).json()).toMatchObject({canPurchase:false,otherAccess:true})
 f.values.apple_purchase_access.data={ownerId:owner,captainExpiresAt:null,playerExpiresAt:null,proExpiresAt:null,purchaseBlocked:false};f.values.google_purchase_access.data={ownerId:owner,proExpiresAt:new Date(Date.now()+86400000).toISOString(),purchaseBlocked:true}
 expect(await (await GET(request())).json()).toMatchObject({canPurchase:false,active:true})
 f.values.google_purchase_access.data={ownerId:owner,proExpiresAt:null,purchaseBlocked:true}
 expect(await (await GET(request())).json()).toMatchObject({canPurchase:false,active:false,manageRequired:true})
 f.values.google_purchase_access.data={ownerId:owner,proExpiresAt:new Date(Date.now()-86400000).toISOString(),purchaseBlocked:false}
 expect(await (await GET(request())).json()).toMatchObject({canPurchase:true,active:false,manageRequired:false})
})
it('requires exact request shapes and a database-confirmed preparation before returning checkout bindings',async()=>{
 const f=fixture();expect((await POST(request({action:'prepare',productId:sku,targetId:null,allowTest:true}))).status).toBe(400)
 expect((await POST(request({action:'prepare',productId:GOOGLE_PLAY_PRODUCTS[1].id,targetId:owner}))).status).toBe(400)
 expect((await POST(request({action:'reconcile',productId:sku,operationId:owner,purchaseToken:'short'}))).status).toBe(400)
 expect(await (await POST(request({action:'prepare',productId:sku,targetId:null}))).json()).toMatchObject({ownerId:owner,accountId,profileId:null,productId:sku})
 f.values.google_purchase_prepare.data={ok:false,status:409};expect((await POST(request({action:'prepare',productId:sku,targetId:null}))).status).toBe(409)
 f.values.google_purchase_prepare.data={ok:true,productId:sku,targetId:null,profileId:null,accountId:'b'.repeat(64)};expect((await POST(request({action:'prepare',productId:sku,targetId:null}))).status).toBe(503)
})
