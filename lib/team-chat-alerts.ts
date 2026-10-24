import type {SupabaseClient} from '@supabase/supabase-js'
/** Caller resolves accepted exact team scope and checks current participation/removals first. */
export async function setTeamChatMute(service:SupabaseClient,owner:string,room:string,muted:unknown){
 if(typeof muted!=='boolean')return {ok:false as const,status:400,message:'Choose whether team alerts are muted.'}
 const result=await service.from('internal_conversation_participants').update({muted}).eq('conversation_id',room).eq('profile_id',owner).select('conversation_id,profile_id,muted').maybeSingle()
 if(result.error)return {ok:false as const,status:503,message:'Team alert settings are unavailable.'}
 if(!result.data || result.data.conversation_id!==room || result.data.profile_id!==owner)return {ok:false as const,status:403,message:'Your team access is unavailable.'}
 if(result.data.muted!==muted)return {ok:false as const,status:503,message:'Team alert settings could not be confirmed.'}
 return {ok:true as const,status:200,conversationId:room,muted}
}
