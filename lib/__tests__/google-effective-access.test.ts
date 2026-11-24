import {afterEach,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
vi.mock('server-only',()=>({}))
import {withAppleAccess} from '../apple-effective-access'
import {DEFAULT_ENTITLEMENTS,buildProductAccessState} from '../access-model-core'
const owner='11111111-1111-4111-8111-111111111111',expiry=new Date(Date.now()+86400000).toISOString()
const data={ownerId:owner,playerExpiresAt:expiry,captainExpiresAt:expiry,proExpiresAt:expiry}
afterEach(()=>vi.unstubAllEnvs())
it('uses one combined store read to unlock both Captain and Coach without rewriting profile billing flags',async()=>{
 vi.stubEnv('GOOGLE_PLAY_ENTITLEMENTS_ENABLED','true');vi.stubEnv('APPLE_MEMBERSHIPS_ENABLED','true')
 const rpc=vi.fn(async()=>({data,error:null})),client={rpc} as unknown as SupabaseClient
 const merged=await withAppleAccess(client,owner,DEFAULT_ENTITLEMENTS,true)
 expect(rpc).toHaveBeenCalledWith('native_store_purchase_access',{p_owner:owner,p_include_apple:true,p_include_google:true})
 expect(buildProductAccessState('member',merged)).toMatchObject({canUseCaptainWorkflow:true,canUseCoachWorkflow:true})
 expect(DEFAULT_ENTITLEMENTS.coachSubscriptionActive).toBe(false)
})
it('keeps authenticated reads self-scoped and separates entitlement access from checkout configuration',async()=>{
 vi.stubEnv('GOOGLE_PLAY_ENTITLEMENTS_ENABLED','true');vi.stubEnv('GOOGLE_PLAY_ENABLED','false');vi.stubEnv('APPLE_MEMBERSHIPS_ENABLED','false')
 const rpc=vi.fn(async()=>({data,error:null}))
 expect((await withAppleAccess({rpc} as unknown as SupabaseClient,owner,DEFAULT_ENTITLEMENTS)).coachSubscriptionActive).toBe(true)
 expect(rpc).toHaveBeenCalledWith('my_native_store_purchase_access',{p_include_apple:false,p_include_google:true})
})
it('fails closed on owner/date mismatches, and leaves the existing path untouched when Google rollout is disabled',async()=>{
 vi.stubEnv('GOOGLE_PLAY_ENTITLEMENTS_ENABLED','true')
 const rpc=vi.fn(async()=>({data:{...data,ownerId:'wrong-owner'},error:null})),client={rpc} as unknown as SupabaseClient
 await expect(withAppleAccess(client,owner,DEFAULT_ENTITLEMENTS,true)).rejects.toThrow()
 rpc.mockResolvedValueOnce({data:{...data,proExpiresAt:'invalid'},error:null});await expect(withAppleAccess(client,owner,DEFAULT_ENTITLEMENTS,true)).rejects.toThrow()
 vi.stubEnv('GOOGLE_PLAY_ENTITLEMENTS_ENABLED','false');vi.stubEnv('APPLE_MEMBERSHIPS_ENABLED','false');rpc.mockClear()
 expect(await withAppleAccess(client,owner,DEFAULT_ENTITLEMENTS,true)).toEqual(DEFAULT_ENTITLEMENTS);expect(rpc).not.toHaveBeenCalled()
})
