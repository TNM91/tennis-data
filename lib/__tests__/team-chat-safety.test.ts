import {describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {chatNotificationRecipients,chatSafetyAction,isChatReportReason,loadChatBlocks,redactBlockedChatRows} from '../team-chat-safety'
function database(results:Record<string,{data?:unknown;error?:unknown}>) {
 const calls:{table:string;method:string;args:unknown[]}[]=[]
 const service={from:(table:string)=>{
  const query:Record<string,unknown>={then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(resolve(results[table] || {data:[],error:null}))}
  for(const method of ['select','eq','in','is','limit','upsert','delete'])query[method]=(...args:unknown[])=>{calls.push({table,method,args});return query}
  query.maybeSingle=vi.fn().mockResolvedValue(results[table] || {data:null,error:null})
  return query
 }} as unknown as SupabaseClient
 return {service,calls}
}
describe('private team chat safety',()=>{
 it('redacts blocked content and attachment/card metadata before previews are assembled without mutating source rows',()=>{
  const original=[{sender_user_id:'blocked',body:'private blocked text',metadata:{attachment:'private URL'},deleted_at:null,reply_to_message_id:'reply'},{sender_user_id:'allowed',body:'Hello',metadata:null,deleted_at:null,reply_to_message_id:null}]
  const result=redactBlockedChatRows(original,new Set(['blocked']))
  expect(result[0]).toMatchObject({body:'',metadata:null,reply_to_message_id:null});expect(result[0].deleted_at).toBeTruthy();expect(result[1]).toBe(original[1]);expect(original[0].body).toContain('private')
 })
 it('loads only the current user block list and fails closed on unavailable or truncated results',async()=>{
  const {service,calls}=database({team_chat_blocks:{data:[{blocked_user_id:'other'}]}})
  expect(await loadChatBlocks(service,'owner')).toEqual(new Set(['other']))
  expect(calls).toContainEqual({table:'team_chat_blocks',method:'eq',args:['owner_user_id','owner']})
  for(const result of [{error:{message:'private'}},{data:Array.from({length:1000},()=>({blocked_user_id:'x'}))}])await expect(loadChatBlocks(database({team_chat_blocks:result}).service,'owner')).rejects.toThrow('unavailable')
 })
 it('never blocks self or a non-member and scopes unblocking to the owner',async()=>{
  const {service,calls}=database({})
  for(const memberId of ['owner','stranger'])expect((await chatSafetyAction(service,'owner','room',[{id:'teammate'}],{action:'block_chat_member',memberId})).ok).toBe(false)
  expect(calls).toEqual([])
  expect((await chatSafetyAction(service,'owner','room',[],{action:'unblock_chat_member',memberId:'former-member'})).ok).toBe(true)
  expect(calls).toContainEqual({table:'team_chat_blocks',method:'eq',args:['owner_user_id','owner']})
 })
 it('reports only another member message in the verified room and derives the content/author on the server',async()=>{
  const {service,calls}=database({internal_messages:{data:{id:'post',sender_user_id:'teammate',body:'server text'}},team_chat_reports:{error:null}})
  expect((await chatSafetyAction(service,'owner','verified-room',[],{action:'report_chat_message',messageId:'post',reason:'harassment'})).ok).toBe(true)
  expect(calls).toContainEqual({table:'internal_messages',method:'eq',args:['conversation_id','verified-room']})
  expect(calls.find(call=>call.table==='team_chat_reports'&&call.method==='upsert')?.args[0]).toMatchObject({reporter_user_id:'owner',reported_user_id:'teammate',message_body:'server text',conversation_id:'verified-room'})
  expect(isChatReportReason('invented')).toBe(false)
  const self=database({internal_messages:{data:{id:'post',sender_user_id:'owner',body:'mine'}}})
  expect((await chatSafetyAction(self.service,'owner','room',[],{action:'report_chat_message',messageId:'post',reason:'spam'})).ok).toBe(false)
 })
 it('suppresses notifications to users who blocked the sender and on lookup failures',async()=>{
  const {service,calls}=database({team_chat_blocks:{data:[{owner_user_id:'blocked-me'}]}})
  expect(await chatNotificationRecipients(service,'actor',['allowed','blocked-me'])).toEqual(['allowed'])
  expect(calls).toContainEqual({table:'team_chat_blocks',method:'eq',args:['blocked_user_id','actor']})
  expect(await chatNotificationRecipients(database({team_chat_blocks:{error:{}}}).service,'actor',['allowed'])).toEqual([])
 })
})
