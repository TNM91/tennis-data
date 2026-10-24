import {describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadTeamChatRows} from '../team-chat-updates'
const row={id:'new',sender_user_id:'blocked',body:'hidden body',metadata:{attachment:'hidden URL'},deleted_at:null,reply_to_message_id:null}
function database(overrides:Record<string,unknown>={}){
 const results:Record<string,unknown>={internal_conversation_participants:{data:{last_read_at:'checkpoint'},error:null},team_room_member_removals:{data:null,error:null},team_chat_blocks:{data:[{blocked_user_id:'blocked'}],error:null},internal_messages:{data:[row,{...row,id:'old',sender_user_id:'allowed'}],error:null},...overrides}
 const calls:{table:string;method:string;args:unknown[]}[]=[]
 const service={from:(table:string)=>{
  const q:Record<string,unknown>={then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(resolve(results[table]))}
  for(const method of ['select','eq','order','limit'])q[method]=(...args:unknown[])=>{calls.push({table,method,args});return q}
  q.maybeSingle=vi.fn().mockResolvedValue(results[table]);return q
 }} as unknown as SupabaseClient
 return {calls,service}
}
describe('lightweight moderated conversation reads',()=>{
 it('scopes every membership/content read, bounds history, preserves source order and redacts blocked content',async()=>{
  const db=database(),result=await loadTeamChatRows(db.service,'owner','verified-room',false)
  expect(result.ok).toBe(true);if(!result.ok)return
  expect(result.lastReadAt).toBe('checkpoint');expect(result.rows.map(row=>row.id)).toEqual(['old','new']);expect(result.rows[1]).toMatchObject({body:'',metadata:null});expect(row.body).toBe('hidden body')
  expect(db.calls).toContainEqual({table:'internal_messages',method:'limit',args:[75]})
  for(const table of ['internal_messages','internal_conversation_participants','team_room_member_removals'])expect(db.calls).toContainEqual({table,method:'eq',args:['conversation_id','verified-room']})
  expect(new Set(db.calls.map(call=>call.table))).toEqual(new Set(['internal_conversation_participants','team_room_member_removals','team_chat_blocks','internal_messages']))
 })
 it('does not read messages after absent membership, explicit removal or a safety lookup failure',async()=>{
  for(const overrides of [{internal_conversation_participants:{data:null,error:null}},{team_room_member_removals:{data:{profile_id:'owner'},error:null}},{team_chat_blocks:{error:{}}}]){
   const db=database(overrides);expect((await loadTeamChatRows(db.service,'owner','room',false)).ok).toBe(false)
   expect(db.calls.some(call=>call.table==='internal_messages')).toBe(false)
  }
 })
 it('matches the existing captain removal exception while still requiring participant membership',async()=>{
  const db=database({team_room_member_removals:{data:{profile_id:'owner'}}})
  expect((await loadTeamChatRows(db.service,'owner','room',true)).ok).toBe(true)
  expect(db.calls.some(call=>call.table==='team_room_member_removals')).toBe(false)
 })
})
