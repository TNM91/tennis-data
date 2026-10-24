import type {SupabaseClient} from '@supabase/supabase-js'
import {loadChatBlocks} from './team-chat-safety'
export const nativeReactionKinds=['helpful','celebrate'] as const
export type NativeReactionKind=typeof nativeReactionKinds[number]
export const isNativeReaction=(value:unknown):value is NativeReactionKind=>nativeReactionKinds.some(kind=>kind===value)
const uuid=(value:unknown):value is string=>typeof value==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
/** Caller verifies the exact accepted team scope and current participation first. */
export async function setNativeChatReaction(service:SupabaseClient,owner:string,roomId:string,input:{messageId?:unknown;reaction?:unknown;active?:unknown}){
 if(!uuid(input.messageId) || !isNativeReaction(input.reaction) || typeof input.active!=='boolean')return {ok:false,status:400}
 const message=await service.from('internal_messages').select('id,sender_user_id').eq('id',input.messageId).eq('conversation_id',roomId).is('deleted_at',null).maybeSingle()
 if(message.error)return {ok:false,status:503}
 if(!message.data)return {ok:false,status:404}
 let blocked:Set<string>;try{blocked=await loadChatBlocks(service,owner)}catch{return {ok:false,status:503}}
 if(blocked.has(message.data.sender_user_id))return {ok:false,status:404}
 const row={conversation_id:roomId,message_id:input.messageId,profile_id:owner,reaction:input.reaction}
 const saved=input.active?await service.from('team_room_message_reactions').upsert(row,{onConflict:'message_id,profile_id,reaction',ignoreDuplicates:true})
  :await service.from('team_room_message_reactions').delete().eq('conversation_id',roomId).eq('message_id',input.messageId).eq('profile_id',owner).eq('reaction',input.reaction)
 return saved.error?{ok:false,status:503}:{ok:true,status:200,messageId:input.messageId,reaction:input.reaction,active:input.active}
}
export async function loadNativeReactionSummary(service:SupabaseClient,owner:string,roomId:string,messageIds:string[]){
 if(messageIds.length>75 || messageIds.some(id=>!uuid(id)))throw Error('Invalid reaction window')
 const map=new Map<string,{reaction:NativeReactionKind;count:number;reacted:boolean}[]>()
 if(!messageIds.length)return map
 const result=await service.rpc('native_chat_reaction_summary',{p_conversation:roomId,p_messages:messageIds,p_owner:owner})
 if(result.error || !Array.isArray(result.data) || result.data.length>150)throw Error('Reaction summaries unavailable')
 const visible=new Set(messageIds)
 for(const row of result.data){
  if(!visible.has(row.message_id) || !isNativeReaction(row.reaction) || !Number.isSafeInteger(Number(row.reaction_count)) || Number(row.reaction_count)<1 || typeof row.reacted!=='boolean')throw Error('Invalid reaction summary')
  const current=map.get(row.message_id) || []
  if(current.some(item=>item.reaction===row.reaction))throw Error('Duplicate reaction summary')
  current.push({reaction:row.reaction,count:Number(row.reaction_count),reacted:row.reacted});map.set(row.message_id,current)
 }
 return map
}
