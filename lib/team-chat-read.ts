import type {SupabaseClient} from '@supabase/supabase-js'
/** Current membership is verified by the caller; only an existing post in that room can advance the checkpoint. */
export async function markTeamChatRead(service:SupabaseClient,userId:string,conversationId:string,messageId:unknown) {
 if(typeof messageId!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId))return {ok:false,status:400,message:'Choose a message to mark read.'}
 const target=await service.from('internal_messages').select('created_at').eq('id',messageId).eq('conversation_id',conversationId).maybeSingle()
 if(target.error)return {ok:false,status:503,message:'Could not save your read position.'}
 const date=Date.parse(target.data?.created_at || '')
 if(!target.data || !Number.isFinite(date))return {ok:false,status:404,message:'That message is unavailable.'}
 const checkpoint=date>Date.now()?new Date().toISOString():String(target.data.created_at)
 const result=await service.from('internal_conversation_participants').update({last_read_at:checkpoint}).eq('conversation_id',conversationId).eq('profile_id',userId).or(`last_read_at.is.null,last_read_at.lt.${checkpoint}`)
 return result.error?{ok:false,status:503,message:'Could not save your read position.'}:{ok:true,status:200}
}
