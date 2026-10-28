import {readTeamChatCursor,teamChatCursor,teamChatMessageId} from './team-chat-cursor'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadChatBlocks,redactBlockedChatRows} from './team-chat-safety'
import type {SentTeamMessage} from './team-room-message-send'
/** The caller must first resolve this exact conversation from the current user's accepted team scope. */
export async function checkTeamChatAccess(service:SupabaseClient,userId:string,conversationId:string,canManage:boolean){
 const [participant,removal]=await Promise.all([
  service.from('internal_conversation_participants').select('last_read_at').eq('conversation_id',conversationId).eq('profile_id',userId).maybeSingle(),
  canManage?Promise.resolve({data:null,error:null}):service.from('team_room_member_removals').select('profile_id').eq('conversation_id',conversationId).eq('profile_id',userId).maybeSingle(),
 ])
 if(participant.error || removal.error)return {ok:false as const,status:503,message:'Team access could not be checked.'}
 if(!participant.data || removal.data)return {ok:false as const,status:403,message:'Your team access is unavailable.'}
 return {ok:true as const,lastReadAt:String(participant.data.last_read_at || '')}
}
export async function loadTeamChatRows(service:SupabaseClient,userId:string,conversationId:string,canManage:boolean,before='',focus=''){
 const cursor=before?readTeamChatCursor(before):null
 if(focus&&(!teamChatMessageId(focus)||before))return {ok:false as const,status:400,message:'Choose a valid conversation message.'}
 if(before && !cursor)return {ok:false as const,status:400,message:'Choose a valid conversation page.'}
 const access=await checkTeamChatAccess(service,userId,conversationId,canManage)
 if(!access.ok)return access
 let blocked:Set<string>
 try{blocked=await loadChatBlocks(service,userId)}catch{return {ok:false as const,status:503,message:'Chat safety settings are unavailable.'}}
 let focusCursor=''
 if(focus){const target=await service.from('internal_messages').select('id,created_at').eq('conversation_id',conversationId).eq('id',focus).maybeSingle();if(target.error)return {ok:false as const,status:503,message:'Conversation message unavailable.'};if(!target.data||target.data.id!==focus)return {ok:false as const,status:404,message:'Conversation message unavailable.'};focusCursor=teamChatCursor(String(target.data.created_at||''),String(target.data.id));if(!focusCursor)return {ok:false as const,status:503,message:'Conversation message unavailable.'}}
 let query=service.from('internal_messages').select('id,sender_user_id,body,message_kind,metadata,created_at,edited_at,deleted_at,reply_to_message_id')
  .eq('conversation_id',conversationId).not('created_at','is',null)
 const inclusive=focusCursor?readTeamChatCursor(focusCursor):null
 if(inclusive)query=query.or(`created_at.lt.${inclusive.createdAt},and(created_at.eq.${inclusive.createdAt},id.lte.${inclusive.id})`)
 else if(cursor)query=query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)
 const loaded=await query.order('created_at',{ascending:false,nullsFirst:false}).order('id',{ascending:false}).limit(76)
 if(loaded.error)return {ok:false as const,status:503,message:'Conversation updates are unavailable.'}
 const page=(loaded.data || []).slice(0,75),oldest=page.at(-1)
 if(focus&&!page.some(row=>row.id===focus))return {ok:false as const,status:404,message:'Conversation message unavailable.'}
 const nextCursor=loaded.data && loaded.data.length>75 && oldest?teamChatCursor(String(oldest.created_at || ''),String(oldest.id)):''
 return {ok:true as const,...(focus?{focusMessageId:focus,focusCursor}:{}),beforeCursor:before,nextCursor,rows:redactBlockedChatRows([...page].reverse() as SentTeamMessage[],blocked),lastReadAt:access.lastReadAt,blockedUserIds:Array.from(blocked)}
}
