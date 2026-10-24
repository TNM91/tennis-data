import {describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadNativeReactionSummary,setNativeChatReaction} from '../native-chat-reactions'
import {parseChatReactions} from '../../mobile/src/chat-reactions'
const id='1959be10-4557-4a03-87bd-584ba14ff519'
function database(message:unknown={id,sender_user_id:'teammate'},blocks:unknown=[]){
 const calls:{table:string;method:string;args:unknown[]}[]=[]
 const service={from:(table:string)=>{
  const result={data:table==='internal_messages'?message:table==='team_chat_blocks'?blocks:null,error:null}
  const query:Record<string,unknown>={then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(resolve(result)),maybeSingle:vi.fn().mockResolvedValue(result)}
  for(const method of ['select','eq','is','limit','upsert','delete'])query[method]=(...args:unknown[])=>{calls.push({table,method,args});return query}
  return query
 }} as unknown as SupabaseClient
 return {service,calls}
}
describe('native chat reactions',()=>{
 it('uses desired state for safe retries and scopes removal to the owner and room',async()=>{
  const {service,calls}=database()
  const action={messageId:id,reaction:'helpful',active:true}
  for(let attempt=0;attempt<2;attempt++)expect(await setNativeChatReaction(service,'owner','room',action)).toMatchObject({ok:true,active:true})
  expect(calls.filter(call=>call.method==='upsert')).toHaveLength(2)
  expect(calls.find(call=>call.method==='upsert')?.args).toEqual([{conversation_id:'room',message_id:id,profile_id:'owner',reaction:'helpful'},{onConflict:'message_id,profile_id,reaction',ignoreDuplicates:true}])
  await setNativeChatReaction(service,'owner','room',{...action,active:false})
  for(const args of [['conversation_id','room'],['message_id',id],['profile_id','owner'],['reaction','helpful']])expect(calls).toContainEqual({table:'team_room_message_reactions',method:'eq',args})
 })
 it('rejects formal acknowledgments, malformed state and inaccessible messages before writing',async()=>{
  const {service,calls}=database()
  for(const action of [{messageId:id,reaction:'ack',active:true},{messageId:id,reaction:'helpful',active:'true'},{messageId:'bad',reaction:'helpful',active:true}])expect(await setNativeChatReaction(service,'owner','room',action)).toMatchObject({status:400})
  expect(calls).toEqual([])
  for(const db of [database(null),database(undefined,[{blocked_user_id:'teammate'}])]){
   expect(await setNativeChatReaction(db.service,'owner','room',{messageId:id,reaction:'celebrate',active:true})).toMatchObject({status:404})
   expect(db.calls.some(call=>call.method==='upsert')).toBe(false)
  }
 })
 it('returns only bounded aggregate counts and rejects unexpected or duplicate rows',async()=>{
  const rpc=vi.fn().mockResolvedValue({data:[{message_id:id,reaction:'helpful',reaction_count:'2',reacted:true,profile_id:'private'}]})
  const service={rpc} as unknown as SupabaseClient
  expect((await loadNativeReactionSummary(service,'owner','room',[id])).get(id)).toEqual([{reaction:'helpful',count:2,reacted:true}])
  expect(rpc).toHaveBeenCalledWith('native_chat_reaction_summary',{p_conversation:'room',p_messages:[id],p_owner:'owner'})
  await expect(loadNativeReactionSummary(service,'owner','room',Array(76).fill(id))).rejects.toThrow('window')
  for(const data of [[{message_id:'outside',reaction:'helpful',reaction_count:1,reacted:false}],[{message_id:id,reaction:'ack',reaction_count:1,reacted:false}],Array(2).fill({message_id:id,reaction:'helpful',reaction_count:1,reacted:false})]){
   rpc.mockResolvedValueOnce({data});await expect(loadNativeReactionSummary(service,'owner','room',[id])).rejects.toThrow()
  }
 })
 it('strips identities and unknown kinds from the native payload',()=>{
  expect(parseChatReactions([{reaction:'helpful',count:3,reacted:true,profileIds:['private']},{reaction:'ack',count:1,reacted:true},{reaction:'celebrate',count:-1,reacted:true}])).toEqual([{reaction:'helpful',count:3,reacted:true}])
  expect(parseChatReactions([{reaction:'helpful',count:0,reacted:true}])).toEqual([{reaction:'helpful',count:0,reacted:false}])
 })
})
