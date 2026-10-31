import type {SupabaseClient} from '@supabase/supabase-js'
import {readCoachInvitationForPlayer,coachInvitationRevision} from './coach-invite-acceptance'
import {readCoachConnection} from './native-coach-connection-contract'
export async function nativeCoachConnection(service:SupabaseClient,token:string,user:{id:string;email?:string|null}){
 const context=await readCoachInvitationForPlayer(service,token,user,true),s=context.link!.data!
 return readCoachConnection({ok:true,owner:user.id,name:s.player_name,level:s.level_label||'',message:context.invite.message||'',expiresAt:context.invite.expires_at,state:context.resuming?s.player_user_id===user.id?'connected':'reserved':'ready',revision:coachInvitationRevision(context)},user.id)
}
