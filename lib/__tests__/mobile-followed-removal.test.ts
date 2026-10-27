import {describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {removeFollowedEntity,type FollowedEntity} from '../../mobile/src/followed-entities'
function fixture(){
 const session={user:{id:'owner'},access_token:'local-token'},getSession=vi.fn().mockResolvedValue({data:{session},error:null})
 return {client:{auth:{getSession}} as unknown as SupabaseClient,getSession,session}
}
describe('exact saved follow removal',()=>{
 it.each(['player','team','league'] as const)('removes %s using its exact stored identifier and server-owned session',async kind=>{
  const {client}=fixture(),item={entity_type:kind,entity_id:'legacy__scope__identifier',entity_name:'Saved name',subtitle:null},send=vi.fn().mockResolvedValue({status:200,data:{ok:true,following:false}})
  await removeFollowedEntity(client,item,()=>true,send)
  expect(send).toHaveBeenCalledOnce();expect(send).toHaveBeenCalledWith(expect.objectContaining({url:'https://www.tenaceiq.com/api/follows',method:'DELETE',data:item,disableRedirects:true,connectTimeout:12000,readTimeout:12000,headers:{Authorization:'Bearer local-token','Content-Type':'application/json'}}))
 })
 it('rejects malformed input and closed visits before sending',async()=>{
  const {client}=fixture(),send=vi.fn(),item={entity_type:'team',entity_id:'exact',entity_name:'Aces',subtitle:null} as const
  await expect(removeFollowedEntity(client,{...item,entity_type:'other'} as unknown as FollowedEntity,()=>true,send)).rejects.toThrow()
  await expect(removeFollowedEntity(client,{...item,entity_id:''},()=>true,send)).rejects.toThrow()
  await expect(removeFollowedEntity(client,item,()=>false,send)).rejects.toThrow();expect(send).not.toHaveBeenCalled()
 })
 it('does not confirm a write after an owner switch or an uncertain response and never retries',async()=>{
  const {client,getSession,session}=fixture(),item={entity_type:'league',entity_id:'City__4.0____',entity_name:'City',subtitle:null} as const,send=vi.fn().mockResolvedValue({status:200,data:{ok:true,following:false}})
  getSession.mockResolvedValueOnce({data:{session},error:null}).mockResolvedValueOnce({data:{session:{...session,user:{id:'another'}}},error:null})
  await expect(removeFollowedEntity(client,item,()=>true,send)).rejects.toThrow('Could not confirm');expect(send).toHaveBeenCalledOnce()
  for(const reply of [{status:200,data:{ok:true,following:true}},{status:403,data:{ok:false}},{status:500,data:{ok:false}}]){send.mockResolvedValue(reply);await expect(removeFollowedEntity(client,item,()=>true,send)).rejects.toThrow('Could not confirm')}
  expect(send).toHaveBeenCalledTimes(4)
 })
})
