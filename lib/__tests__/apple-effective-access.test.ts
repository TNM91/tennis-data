import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
vi.mock('server-only',()=>({}))
const m=vi.hoisted(()=>({session:vi.fn(),from:vi.fn(),native:false,http:vi.fn()}))
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>m.native},CapacitorHttp:{get:m.http}}))
vi.mock('../supabase',()=>({supabase:{auth:{getSession:m.session},from:m.from}}))
import {withAppleAccess} from '../apple-effective-access'
import {getClientEntitlementSnapshot} from '../access-model'
import {DEFAULT_ENTITLEMENTS,buildProductAccessState} from '../access-model-core'
const owner='11111111-1111-4111-8111-111111111111',until=new Date(Date.now()+86400000).toISOString()
beforeEach(()=>{vi.resetAllMocks();m.native=false;vi.stubEnv('APPLE_MEMBERSHIPS_ENABLED','true');m.session.mockResolvedValue({data:{session:{user:{id:owner},access_token:'synthetic'}},error:null})})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
describe('effective Apple access',()=>{
 it('does no Apple reads when disabled and merges only the correct owner when enabled',async()=>{
  const rpc=vi.fn(async()=>({data:{ownerId:owner,playerExpiresAt:until,captainExpiresAt:until},error:null})),client={rpc} as unknown as SupabaseClient
  vi.stubEnv('APPLE_MEMBERSHIPS_ENABLED','false');expect(await withAppleAccess(client,owner,DEFAULT_ENTITLEMENTS)).toEqual(DEFAULT_ENTITLEMENTS);expect(rpc).not.toHaveBeenCalled()
  vi.stubEnv('APPLE_MEMBERSHIPS_ENABLED','true');const merged=await withAppleAccess(client,owner,DEFAULT_ENTITLEMENTS);expect(rpc).toHaveBeenCalledExactlyOnceWith('my_apple_purchase_access');expect(buildProductAccessState('member',merged).canUseCaptainWorkflow).toBe(true)
  await withAppleAccess(client,owner,DEFAULT_ENTITLEMENTS,true);expect(rpc).toHaveBeenLastCalledWith('apple_purchase_access',{p_owner:owner})
 })
 it('does not convert an unavailable, foreign-owner or malformed Apple response into a free or paid snapshot',async()=>{
  for(const result of [{error:{code:'timeout'},data:null},{error:null,data:{ownerId:'other',playerExpiresAt:until,captainExpiresAt:null}},{error:null,data:{ownerId:owner,playerExpiresAt:'forever',captainExpiresAt:null}}])await expect(withAppleAccess({rpc:async()=>result} as unknown as SupabaseClient,owner,DEFAULT_ENTITLEMENTS)).rejects.toThrow('temporarily unavailable')
 })
 it('browser fallback reads the verified aggregate endpoint with a bounded request rather than profile flags',async()=>{
  const fetch=vi.fn(async()=>Response.json({ok:true,access:{role:'member',entitlements:{...DEFAULT_ENTITLEMENTS,captainSubscriptionActive:true,captainSubscriptionStatus:'active',captainAccessExpiresAt:until}}}));vi.stubGlobal('fetch',fetch)
  const snapshot=await getClientEntitlementSnapshot(owner);expect(buildProductAccessState('member',snapshot!).canUseCaptainWorkflow).toBe(true);expect(fetch).toHaveBeenCalledWith('/api/auth/access',expect.objectContaining({headers:{Authorization:'Bearer synthetic'},cache:'no-store',redirect:'error',signal:expect.any(AbortSignal)}));expect(m.from).not.toHaveBeenCalled()
 })
 it('uses the pinned native transport inside the app instead of requesting the bundled localhost origin',async()=>{
  m.native=true;const fetch=vi.fn();vi.stubGlobal('fetch',fetch);m.http.mockResolvedValue({status:200,data:{ok:true,access:{role:'member',entitlements:DEFAULT_ENTITLEMENTS}}})
  expect(await getClientEntitlementSnapshot(owner)).toEqual(DEFAULT_ENTITLEMENTS)
  expect(m.http).toHaveBeenCalledExactlyOnceWith({url:'https://www.tenaceiq.com/api/auth/access',headers:{Authorization:'Bearer synthetic'},responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000});expect(fetch).not.toHaveBeenCalled()
 })
 it('drops browser responses after an account switch and never uses a cached or malformed response',async()=>{
  const fetch=vi.fn(async()=>Response.json({ok:true,access:{role:'member',entitlements:DEFAULT_ENTITLEMENTS}}));vi.stubGlobal('fetch',fetch)
  m.session.mockResolvedValueOnce({data:{session:{user:{id:owner},access_token:'synthetic'}}}).mockResolvedValueOnce({data:{session:{user:{id:'other'}}}});expect(await getClientEntitlementSnapshot(owner)).toBeNull()
  fetch.mockResolvedValueOnce(Response.json({ok:true,access:{role:'admin'}}));expect(await getClientEntitlementSnapshot(owner)).toBeNull()
  fetch.mockResolvedValueOnce(Response.json({ok:false},{status:503}));expect(await getClientEntitlementSnapshot(owner)).toBeNull()
  expect(await getClientEntitlementSnapshot(null)).toBeNull()
 })
})
