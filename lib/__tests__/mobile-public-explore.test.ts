import {afterEach,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {CapacitorHttp} from '@capacitor/core'
import {loadGuestProfileHeader,loadProfileHeader} from '../../mobile/src/player-profile-header-data'
import {unknownImportFreshness} from '../player-import-freshness'
const created=vi.hoisted(()=>vi.fn(()=>({auth:{getSession:async()=>({data:{session:null},error:null})}})))
vi.mock('@supabase/supabase-js',()=>({createClient:created}))
import {createPublicBrowseClient} from '../../mobile/src/public-browse-client'
const id='11111111-2222-4333-8444-555555555555'
const row={id,name:'Alex Public',location:'Metro',flight:'4.0',overall_dynamic_rating:4.2,rating_source:'verified'}
afterEach(()=>vi.clearAllMocks())
function fixture(options:{failed?:boolean;deferred?:boolean}={}) {
 let finish!:(v:unknown)=>void,owner='one'
 const session=vi.fn(async()=>({data:{session:{user:{id:owner}}},error:null})),q={select:vi.fn(),eq:vi.fn(),limit:vi.fn(),abortSignal:vi.fn(),maybeSingle:vi.fn(()=>options.deferred?new Promise(r=>{finish=r}):Promise.resolve({data:row,error:options.failed?{message:'denied'}:null}))}
 for(const fn of [q.select,q.eq,q.limit,q.abortSignal])fn.mockReturnValue(q)
 const from=vi.fn(()=>q),client={from,auth:{getSession:session}} as unknown as SupabaseClient
 return {client,from,q,session,finish:()=>finish({data:row,error:null}),change:()=>{owner='two'}}
}
const request=async(options:Parameters<typeof CapacitorHttp.get>[0])=>({status:200,data:unknownImportFreshness,headers:{},url:options.url})
it('creates a distinct nonpersistent public client without native storage or a saved account token',async()=>{
 const client=createPublicBrowseClient();expect((await client.auth.getSession()).data.session).toBeNull()
 const auth=created.mock.calls[0] as unknown as [string,string,{auth:Record<string,unknown>}]
 expect(auth[2].auth).toEqual({storageKey:'tenaceiq-public-explore',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false})
})
it('reads only one exact public player without consulting an account, with bounded read and fixed-origin freshness',async()=>{
 const f=fixture(),http=vi.fn(request),result=await loadGuestProfileHeader(f.client,id,()=>true,http)
 expect(result.player?.id).toBe(id);expect(f.session).not.toHaveBeenCalled();expect(f.from.mock.calls).toEqual([['players']]);expect(f.q.eq).toHaveBeenCalledExactlyOnceWith('id',id);expect(f.q.limit).toHaveBeenCalledExactlyOnceWith(1);expect(f.q.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal))
 expect(http).toHaveBeenCalledOnce();expect(http.mock.calls[0][0]).toEqual({url:'https://www.tenaceiq.com/api/player/import-freshness?playerId='+id,responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000})
})
it('does not start network work for invalid IDs or a closed public visit',async()=>{
 const f=fixture(),http=vi.fn(request)
 for(const invalid of ['../private','', 'a'.repeat(101)])await expect(loadGuestProfileHeader(f.client,invalid,()=>true,http)).rejects.toThrow('closed')
 await expect(loadGuestProfileHeader(f.client,id,()=>false,http)).rejects.toThrow('closed');expect(f.from).not.toHaveBeenCalled();expect(http).not.toHaveBeenCalled();expect(f.session).not.toHaveBeenCalled()
})
it('discards a public response arriving after sign-in or navigation closes that visit',async()=>{
 const f=fixture({deferred:true});let current=true
 const pending=loadGuestProfileHeader(f.client,id,()=>current,request);current=false;f.finish();await expect(pending).rejects.toThrow('closed');expect(f.session).not.toHaveBeenCalled()
})
it('preserves unavailable metadata and unknown freshness instead of inventing evidence',async()=>{
 const f=fixture({failed:true}),result=await loadGuestProfileHeader(f.client,id,()=>true,async options=>({status:403,data:{},headers:{},url:options.url}))
 expect(result).toEqual({player:null,freshness:unknownImportFreshness});expect(f.session).not.toHaveBeenCalled()
})
it('avoids a freshness HTTP request for non-UUID public IDs',async()=>{
 const f=fixture(),http=vi.fn(request);const result=await loadGuestProfileHeader(f.client,'public-canonical-id',()=>true,http)
 expect(result.player).toBeNull();expect(http).not.toHaveBeenCalled();expect(result.freshness).toEqual(unknownImportFreshness)
})
it('retains the signed-in loader owner checks before and after its public reads',async()=>{
 const f=fixture();await loadProfileHeader(f.client,id,()=>true,request);expect(f.session).toHaveBeenCalledTimes(2)
 const changed=fixture();await expect(loadProfileHeader(changed.client,id,()=>true,async options=>{changed.change();return request(options)})).rejects.toThrow('closed')
 const signedOut=fixture();signedOut.session.mockResolvedValue({data:{session:null},error:null} as never);await expect(loadProfileHeader(signedOut.client,id,()=>true,request)).rejects.toThrow('closed');expect(signedOut.from).not.toHaveBeenCalled()
})
