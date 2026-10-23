import {describe,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {canFollowPlayers,FollowAccessError,loadPlayerFollows,playerFollowState,savePlayerFollow} from '../../mobile/src/follows-data'
const item={entity_type:'player' as const,entity_id:'player-2',entity_name:'Alex Sample',subtitle:null}
function fixture(){
 const query={select:vi.fn(),eq:vi.fn(),order:vi.fn(),limit:vi.fn(),abortSignal:vi.fn().mockResolvedValue({data:[item],error:null})}
 for(const key of ['select','eq','order','limit'] as const)query[key].mockReturnValue(query)
 const client={auth:{getSession:vi.fn().mockResolvedValue({data:{session:{user:{id:'owner'},access_token:'test-token'}},error:null})},from:vi.fn().mockReturnValue(query)} as unknown as SupabaseClient
 return {client,query}
}
describe('native player follows',()=>{
 it('reads a bounded deterministic player list scoped to the current user',async()=>{
  const {client,query}=fixture();expect(await loadPlayerFollows(client,()=>true)).toEqual([item])
  expect(query.eq).toHaveBeenCalledWith('user_id','owner');expect(query.eq).toHaveBeenCalledWith('entity_type','player');expect(query.limit).toHaveBeenCalledWith(24);expect(query.order).toHaveBeenCalledWith('entity_id',{ascending:true});expect(query.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal))
 })
 it('does not treat a failed state read as an unfollowed player',async()=>{
  const {client,query}=fixture();query.abortSignal.mockResolvedValue({data:null,error:{message:'denied'}})
  await expect(playerFollowState(client,'player-2',()=>true)).rejects.toThrow('Follow status unavailable')
  expect(query.eq).toHaveBeenCalledWith('entity_id','player-2')
 })
 it('sends mutations only to the existing API with current-session credentials and no supplied owner',async()=>{
  const {client}=fixture(),send=vi.fn().mockResolvedValue({status:201,data:{ok:true,following:true}})
  await savePlayerFollow(client,item,true,()=>true,send)
  expect(send).toHaveBeenCalledWith(expect.objectContaining({url:'https://www.tenaceiq.com/api/follows',method:'POST',data:item,disableRedirects:true,connectTimeout:12000,readTimeout:12000,headers:{Authorization:'Bearer test-token','Content-Type':'application/json'}}))
  send.mockResolvedValue({status:200,data:{ok:true,following:false}});await savePlayerFollow(client,item,false,()=>true,send);expect(send.mock.calls[1][0].method).toBe('DELETE')
 })
 it('blocks stale screens before sending and requires explicit server confirmation',async()=>{
  const {client}=fixture(),send=vi.fn().mockResolvedValue({status:200,data:{ok:true,following:false}})
  await expect(savePlayerFollow(client,item,true,()=>false,send)).rejects.toThrow('Sign in again');expect(send).not.toHaveBeenCalled()
  await expect(savePlayerFollow(client,item,true,()=>true,send)).rejects.toThrow('Could not confirm')
  send.mockResolvedValue({status:403,data:{ok:false}});await expect(savePlayerFollow(client,item,true,()=>true,send)).rejects.toBeInstanceOf(FollowAccessError)
 })
 it('uses shared membership rules and fails closed when account access cannot be loaded',async()=>{
  const {client}=fixture(),send=vi.fn().mockResolvedValue({status:200,data:{ok:true,access:{role:'member',entitlements:{playerPlusSubscriptionActive:false,playerPlusSubscriptionStatus:'inactive'}}}})
  expect(await canFollowPlayers(client,()=>true,send)).toBe(false)
  send.mockResolvedValue({status:200,data:{ok:true,access:{role:'admin',entitlements:{}}}});expect(await canFollowPlayers(client,()=>true,send)).toBe(true)
  send.mockResolvedValue({status:503,data:{ok:false}});await expect(canFollowPlayers(client,()=>true,send)).rejects.toThrow('Account access unavailable')
 })
})
