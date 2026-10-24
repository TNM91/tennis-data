import {describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {setTeamChatMute} from '../team-chat-alerts'
function database(data:unknown={conversation_id:'room',profile_id:'owner',muted:true},error:unknown=null){
 const calls:{method:string;args:unknown[]}[]=[]
 const query:Record<string,unknown>={maybeSingle:vi.fn().mockResolvedValue({data,error})}
 for(const method of ['update','eq','select'])query[method]=(...args:unknown[])=>{calls.push({method,args});return query}
 const from=vi.fn(()=>query)
 return {service:{from} as unknown as SupabaseClient,calls,from}
}
describe('per-team alert settings',()=>{
 it('sets an explicit boolean for only the current participant and confirms the stored room/state on retries',async()=>{
  const db=database()
  for(let n=0;n<2;n++)expect(await setTeamChatMute(db.service,'owner','room',true)).toMatchObject({ok:true,conversationId:'room',muted:true})
  expect(db.from).toHaveBeenCalledWith('internal_conversation_participants')
  expect(db.calls.filter(c=>c.method==='update').map(c=>c.args)).toEqual([[{muted:true}],[{muted:true}]])
  for(const args of [['conversation_id','room'],['profile_id','owner']])expect(db.calls).toContainEqual({method:'eq',args})
  expect(await setTeamChatMute(database({conversation_id:'room',profile_id:'owner',muted:false}).service,'owner','room',false)).toMatchObject({ok:true,muted:false})
 })
 it('rejects malformed state before touching storage',async()=>{
  const db=database()
  for(const value of [null,undefined,'true',1,{}])expect(await setTeamChatMute(db.service,'owner','room',value)).toMatchObject({status:400})
  expect(db.from).not.toHaveBeenCalled()
 })
 it('fails closed for missing participants, database errors and mismatched confirmations',async()=>{
  for(const data of [null,{conversation_id:'other',profile_id:'owner',muted:true},{conversation_id:'room',profile_id:'other',muted:true}])expect(await setTeamChatMute(database(data).service,'owner','room',true)).toMatchObject({status:403})
  expect(await setTeamChatMute(database(undefined,{}).service,'owner','room',true)).toMatchObject({status:503})
  expect(await setTeamChatMute(database({conversation_id:'room',profile_id:'owner',muted:false}).service,'owner','room',true)).toMatchObject({status:503})
 })
})
