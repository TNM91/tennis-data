import type {SentTeamMessage} from './team-room-message-send'
import type {SupabaseClient} from '@supabase/supabase-js'
import {checkTeamChatAccess} from './team-chat-updates'
import {loadChatBlocks} from './team-chat-safety'
import {chatMessageId,type ChatMessageView} from './team-chat-message-contract'
/** Caller resolves the exact accepted team room first. Read only; no read acknowledgement or storage URL. */
export async function loadTeamChatMessage(service:SupabaseClient,owner:string,room:string,requestedId:string,view:string){
 if(!chatMessageId(requestedId)||!['message','reply'].includes(view))return {ok:false as const,status:400}
 const access=await checkTeamChatAccess(service,owner,room,false);if(!access.ok)return access
 let blocked:Set<string>;try{blocked=await loadChatBlocks(service,owner)}catch{return {ok:false as const,status:503}}
 const read=(id:string)=>service.from('internal_messages').select('id,sender_user_id,body,message_kind,metadata,created_at,edited_at,deleted_at,reply_to_message_id').eq('id',id).eq('conversation_id',room).maybeSingle()
 const source=await read(requestedId)
 if(source.error)return {ok:false as const,status:503}
 if(!source.data||source.data.deleted_at||blocked.has(source.data.sender_user_id))return {ok:false as const,status:404}
 let row=source.data
 if(view==='reply'){
  if(!chatMessageId(row.reply_to_message_id))return {ok:false as const,status:404}
  const target=await read(row.reply_to_message_id)
  if(target.error)return {ok:false as const,status:503}
  if(!target.data||target.data.deleted_at||blocked.has(target.data.sender_user_id))return {ok:false as const,status:404}
  row=target.data
 }
 return {ok:true as const,row,requestedId,view:view as ChatMessageView}
}

export function publicChatMessage(row:SentTeamMessage,senderName:string,hasAttachment:boolean){const body=String(row.body||'');return {id:row.id,senderName:senderName.slice(0,120),body:body.slice(0,8000),truncated:body.length>8000,kind:row.message_kind==='announcement'?'announcement':row.message_kind==='system'?'system':'message',createdAt:row.created_at||'',editedAt:row.edited_at||'',hasAttachment}}
