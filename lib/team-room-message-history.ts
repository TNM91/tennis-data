import type {SupabaseClient} from '@supabase/supabase-js'

// Select the newest bounded window, then deliver it in conversation order.
export async function loadTeamConversationMessages(service:SupabaseClient,conversationId:string) {
 const result=await service.from('internal_messages')
  .select('id,sender_user_id,body,message_kind,metadata,created_at,edited_at,deleted_at,reply_to_message_id')
  .eq('conversation_id',conversationId)
  .order('created_at',{ascending:false,nullsFirst:false})
  .order('id',{ascending:false})
  .limit(300)
 return {...result,data:result.data?[...result.data].reverse():null}
}
