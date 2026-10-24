import type {SupabaseClient} from '@supabase/supabase-js'
import type {SentTeamMessage} from './team-room-message-send'
import {parseTeamMessageSendId} from './team-room-message-send'
const columns='id,sender_user_id,body,message_kind,metadata,created_at,edited_at,deleted_at,reply_to_message_id'
export function canManageNativePost(row:Pick<SentTeamMessage,'message_kind'|'metadata'>){
 return row.message_kind==='announcement'?Object.keys(row.metadata || {}).length===0:row.message_kind==='message' && Object.keys(row.metadata || {}).every(key=>['teamRoomAttachment','nativePhotoSha256'].includes(key))
}
/** Caller checks accepted exact room scope and current participation/removals. No attachment object is purged. */
export async function changeNativePost(service:SupabaseClient,owner:string,room:string,input:{action?:unknown;messageId?:unknown;body?:unknown;expectedBody?:unknown;expectedEditedAt?:unknown}){
 const remove=input.action==='remove_chat_post'
 if(!['edit_chat_post','remove_chat_post'].includes(String(input.action)) || !parseTeamMessageSendId(input.messageId) || typeof input.expectedBody!=='string' || input.expectedBody.length>2400 || typeof input.expectedEditedAt!=='string' || input.expectedEditedAt.length>64)return {ok:false as const,status:400}
 const body=typeof input.body==='string'?input.body.trim():''
 if(!remove && (!body || body.length>2400))return {ok:false as const,status:400}
 const read=()=>service.from('internal_messages').select(columns).eq('id',input.messageId as string).eq('conversation_id',room).eq('sender_user_id',owner).maybeSingle()
 const current=await read()
 if(current.error)return {ok:false as const,status:503}
 const row=current.data as SentTeamMessage|null
 if(!row || !canManageNativePost(row))return {ok:false as const,status:404}
 const confirm=(message:SentTeamMessage)=>({ok:true as const,status:200,messageId:message.id,conversationId:room,removed:remove,body:message.body,editedAt:message.edited_at || ''})
 if(remove && row.deleted_at || !remove && !row.deleted_at && row.body===body)return confirm(row)
 if(row.deleted_at || row.body!==input.expectedBody || (row.edited_at || '')!==input.expectedEditedAt)return {ok:false as const,status:409}
 const now=new Date().toISOString()
 let query=service.from('internal_messages').update(remove?{body:'Message removed.',deleted_at:now,edited_at:now}:{body,edited_at:now}).eq('id',row.id).eq('conversation_id',room).eq('sender_user_id',owner).eq('message_kind',row.message_kind).eq('body',row.body).is('deleted_at',null)
 query=row.edited_at?query.eq('edited_at',row.edited_at):query.is('edited_at',null)
 // Guard workflow metadata against a concurrent captain publication as well as concurrent text edits.
 query=row.metadata?query.filter('metadata','eq',JSON.stringify(row.metadata)):query.is('metadata',null)
 const changed=await query.select(columns).maybeSingle()
 if(changed.error)return {ok:false as const,status:503}
 if(changed.data)return confirm(changed.data as SentTeamMessage)
 const raced=await read(),latest=raced.data as SentTeamMessage|null
 if(raced.error)return {ok:false as const,status:503}
 if(latest && canManageNativePost(latest) && (remove?Boolean(latest.deleted_at):!latest.deleted_at && latest.body===body))return confirm(latest)
 return {ok:false as const,status:409}
}
